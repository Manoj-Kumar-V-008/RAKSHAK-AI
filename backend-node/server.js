import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { existsSync } from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST_DIR = path.resolve(__dirname, '../frontend/dist');
const FRONTEND_INDEX_PATH = path.join(FRONTEND_DIST_DIR, 'index.html');
const HAS_FRONTEND_DIST = existsSync(FRONTEND_INDEX_PATH);

dotenv.config({ path: path.resolve(__dirname, '.env'), override: false });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

function normalizeServiceUrl(rawUrl) {
  const value = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!value) return 'http://localhost:8000';
  if (/^https?:\/\//i.test(value)) return value;
  return `http://${value}`;
}

const app = express();
app.use(cors());
app.use(express.json());
if (HAS_FRONTEND_DIST) {
  app.use(express.static(FRONTEND_DIST_DIR));
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ── Python Agent URL ─────────────────────────────────────────────────────────
// On Render this comes from `fromService` in render.yaml
// Locally it defaults to http://localhost:8000
const RAW_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://localhost:8000';

// Render private-service URLs are plain host[:port], so default to HTTP unless
// the scheme is explicitly provided.
const PYTHON_HTTP_URL = normalizeServiceUrl(RAW_AGENT_URL);

// Build WebSocket URL from HTTP URL
const PYTHON_WS_URL = PYTHON_HTTP_URL
  .replace(/^https:/, 'wss:')
  .replace(/^http:/, 'ws:');

console.log(`[CONFIG] Python Agent HTTP: ${PYTHON_HTTP_URL}`);
console.log(`[CONFIG] Python Agent WS:   ${PYTHON_WS_URL}`);

// ── Twilio Configuration ─────────────────────────────────────────────────────
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER || '';

let twilioClient = null;
if (TWILIO_SID && TWILIO_TOKEN) {
  try {
    const twilio = await import('twilio');
    twilioClient = twilio.default(TWILIO_SID, TWILIO_TOKEN);
    console.log('✅ Twilio client initialized — real SMS enabled.');
  } catch (err) {
    console.log('⚠️ Twilio module not found. Install with: npm install twilio');
  }
}

// ── Audit log ────────────────────────────────────────────────────────────────
const auditLog = [];
const addLog = (category, message, meta = null) => {
  const entry = { id: Date.now() + Math.random(), timestamp: new Date().toISOString(), category, message, meta };
  auditLog.push(entry);
  if (auditLog.length > 100) auditLog.shift();
  console.log(`[${category}] ${message}`);
  io.emit('audit_log', entry);
};

// ── SMS History ──────────────────────────────────────────────────────────────
const smsHistory = [];

// ── Active Python WS sessions (per frontend socket) ─────────────────────────
// Map<socketId, { ws: WebSocket, sessionId: string }>
const pythonSessions = new Map();

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  if (HAS_FRONTEND_DIST) {
    return res.sendFile(FRONTEND_INDEX_PATH);
  }
  return res.send('Rakshak AI Node Backend v3.1 — WebSocket Proxy + Twilio SMS');
});

app.get('/api/health', async (_req, res) => {
  // Also check if Python agent is reachable
  let pythonStatus = 'unknown';
  try {
    const resp = await fetch(`${PYTHON_HTTP_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      pythonStatus = data.status || 'OK';
    } else {
      pythonStatus = `error_${resp.status}`;
    }
  } catch (err) {
    pythonStatus = `unreachable: ${err.message}`;
  }

  res.json({
    status: 'Rakshak AI Node Backend Online',
    version: '3.1.0',
    timestamp: new Date(),
    pythonAgentHttp: PYTHON_HTTP_URL,
    pythonAgentWs: PYTHON_WS_URL,
    pythonAgentStatus: pythonStatus,
    twilioEnabled: !!twilioClient,
    activeSessions: pythonSessions.size,
    frontendServedByNode: HAS_FRONTEND_DIST,
    smsCount: smsHistory.length,
  });
});

app.get('/api/audit', (_req, res) => res.json({ logs: auditLog }));

// ── SMS Endpoint — Send real or mock SMS ─────────────────────────────────────
app.post('/api/sms', async (req, res) => {
  const { to, message, contactName } = req.body;

  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Missing "to" or "message"' });
  }

  const smsRecord = {
    id: Date.now(),
    to,
    contactName: contactName || 'Unknown',
    message: message.substring(0, 320),
    timestamp: new Date().toISOString(),
    status: 'pending',
    sid: null,
  };

  if (twilioClient && TWILIO_FROM) {
    try {
      const result = await twilioClient.messages.create({
        body: message.substring(0, 1600),
        from: TWILIO_FROM,
        to: to,
      });
      smsRecord.status = 'sent';
      smsRecord.sid = result.sid;
      smsHistory.push(smsRecord);
      addLog('SMS', `✅ Real SMS sent to ${contactName} (${to}) — SID: ${result.sid}`);
      io.emit('sms_sent', { phone: to, status: 'delivered', sid: result.sid });
      return res.json({ success: true, mode: 'live', sid: result.sid });
    } catch (err) {
      smsRecord.status = 'failed';
      smsRecord.error = err.message;
      smsHistory.push(smsRecord);
      addLog('SMS', `❌ SMS to ${to} failed: ${err.message}`);
      io.emit('sms_sent', { phone: to, status: 'failed', error: err.message });
      return res.json({ success: false, mode: 'live', error: err.message });
    }
  } else {
    smsRecord.status = 'mock_sent';
    smsHistory.push(smsRecord);
    addLog('SMS', `📱 [MOCK] SMS to ${contactName} (${to}): "${message.substring(0, 80)}..."`);
    io.emit('sms_sent', { phone: to, status: 'delivered', mock: true });
    return res.json({ success: true, mode: 'mock', message: 'SMS simulated (configure Twilio env vars for real delivery)' });
  }
});

// ── Twilio Voice Call (optional) ─────────────────────────────────────────────
app.post('/api/call', async (req, res) => {
  const { to, ttsMessage } = req.body;

  if (!twilioClient || !TWILIO_FROM) {
    addLog('CALL', `📞 [MOCK] Voice call to ${to}: "${ttsMessage?.substring(0, 60)}..."`);
    return res.json({ success: true, mode: 'mock' });
  }

  try {
    const result = await twilioClient.calls.create({
      twiml: `<Response><Say voice="alice" language="en-IN">${ttsMessage}</Say></Response>`,
      from: TWILIO_FROM,
      to: to,
    });
    addLog('CALL', `✅ Voice call initiated to ${to} — SID: ${result.sid}`);
    return res.json({ success: true, mode: 'live', sid: result.sid });
  } catch (err) {
    addLog('CALL', `❌ Voice call to ${to} failed: ${err.message}`);
    return res.json({ success: false, error: err.message });
  }
});

// ── SMS History ──────────────────────────────────────────────────────────────
app.get('/api/sms/history', (_req, res) => res.json({ history: smsHistory.slice(-50) }));

// ── REST fallback — forward to Python agent ──────────────────────────────────
app.post('/api/events', async (req, res) => {
  const sensorData = req.body;
  const sessionId  = `sess-${Date.now()}`;

  res.json({ status: 'forwarded_to_python_agent', session_id: sessionId });

  io.emit('agent_status', { status: 'ANALYZING', isProcessing: true });
  addLog('DETECTION', `🔔 SENSOR ALERT: ${(sensorData.type || 'UNKNOWN').toUpperCase()} @ ${sensorData.location || '?'}. Forwarding to LangGraph agent...`, sensorData);

  try {
    const response = await fetch(`${PYTHON_HTTP_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id:  sessionId,
        sensor_data: sensorData,
        venue_lat:   sensorData.venue_lat ?? 12.9716,
        venue_lon:   sensorData.venue_lon ?? 77.5946,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`Python agent returned ${response.status}`);
    addLog('SYSTEM', `✅ Crisis forwarded to LangGraph agent. Session: ${sessionId}`);

  } catch (err) {
    addLog('SYSTEM', `⚠️ Python agent unreachable (${err.message}) — frontend fallback will activate.`);
    io.emit('agent_status', { status: 'NOMINAL', isProcessing: false });
  }
});

if (HAS_FRONTEND_DIST) {
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    return res.sendFile(FRONTEND_INDEX_PATH);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  Socket.IO — THE MAIN BRIDGE: Frontend ⇄ Node ⇄ Python Agent
// ═════════════════════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log(`[SOCKET.IO] Frontend connected: ${socket.id}`);
  socket.emit('sync_state', {
    logs: auditLog,
    isProcessing: false,
    twilioEnabled: !!twilioClient,
    pythonAgentUrl: PYTHON_HTTP_URL,
  });

  // ── crisis_event: Frontend triggers a crisis → Node opens WS to Python ────
  socket.on('crisis_event', (data) => {
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const wsUrl = `${PYTHON_WS_URL}/ws/${sessionId}`;

    console.log(`[PROXY] Opening WebSocket to Python agent: ${wsUrl}`);
    addLog('SYSTEM', `🔗 Opening WebSocket to LangGraph agent for session ${sessionId}...`);

    // Close any existing Python WS for this frontend socket
    const existing = pythonSessions.get(socket.id);
    if (existing?.ws) {
      try { existing.ws.close(); } catch (_) {}
    }

    let pyWs;
    try {
      pyWs = new WebSocket(wsUrl);
    } catch (err) {
      console.error(`[PROXY] Failed to create WebSocket: ${err.message}`);
      socket.emit('agent_message', { type: 'error', message: `Cannot connect to Python agent: ${err.message}` });
      return;
    }

    pythonSessions.set(socket.id, { ws: pyWs, sessionId });

    pyWs.on('open', () => {
      console.log(`[PROXY] Python WS connected for session ${sessionId}`);
      addLog('SYSTEM', `✅ WebSocket connected to LangGraph agent. Session: ${sessionId}`);

      // Forward the crisis event to Python
      const payload = JSON.stringify({
        type: 'crisis_event',
        data: data.sensor_data || data.data || data,
        venue_lat: data.venue_lat ?? 12.9716,
        venue_lon: data.venue_lon ?? 77.5946,
      });
      pyWs.send(payload);
      addLog('DETECTION', `🔔 Crisis event forwarded to LangGraph agent: ${(data.sensor_data?.type || data.data?.type || 'UNKNOWN').toUpperCase()}`);
    });

    pyWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Relay every Python agent message to the frontend
        socket.emit('agent_message', msg);

        // Also log key events to audit
        if (msg.type === 'threat_assessment') {
          addLog('ANALYSIS', `🎯 ThreatScore: ${msg.threat_score}/100 (${msg.threat_level})`);
        } else if (msg.type === 'decision') {
          addLog('DECISION', `🚨 Dispatch decision: ${msg.reasoning?.substring(0, 100) || 'Agent decided.'}`);
        } else if (msg.type === 'resolved') {
          addLog('RESOLVED', `✅ ${msg.summary || 'Crisis resolved by LangGraph agent.'}`);
        }
      } catch (err) {
        console.error(`[PROXY] Failed to parse Python message: ${err.message}`);
      }
    });

    pyWs.on('close', (code, reason) => {
      console.log(`[PROXY] Python WS closed for session ${sessionId} (code=${code})`);
      pythonSessions.delete(socket.id);
    });

    pyWs.on('error', (err) => {
      console.error(`[PROXY] Python WS error for session ${sessionId}: ${err.message}`);
      addLog('SYSTEM', `⚠️ Python agent WebSocket error: ${err.message}`);
      socket.emit('agent_message', {
        type: 'error',
        message: `Python agent connection failed: ${err.message}. Ensure the Python agent is deployed and running.`,
      });
      pythonSessions.delete(socket.id);
    });
  });

  // ── dispatch_confirmation: Frontend approves/rejects → forward to Python ──
  socket.on('dispatch_confirmation', (data) => {
    const session = pythonSessions.get(socket.id);
    if (session?.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({
        type: 'dispatch_confirmation',
        approved: data.approved,
      }));
      addLog('CONFIRM', `${data.approved ? '✅ DISPATCH APPROVED' : '✕ DISPATCH REJECTED'} — forwarded to LangGraph agent.`);
    } else {
      console.warn(`[PROXY] No active Python WS to forward confirmation for socket ${socket.id}`);
      socket.emit('agent_message', {
        type: 'error',
        message: 'No active agent session to send confirmation to.',
      });
    }
  });

  // ── Cleanup on frontend disconnect ─────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[SOCKET.IO] Frontend disconnected: ${socket.id}`);
    const session = pythonSessions.get(socket.id);
    if (session?.ws) {
      try { session.ws.close(); } catch (_) {}
    }
    pythonSessions.delete(socket.id);
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Rakshak AI Node Backend v3.1`);
  console.log(`  Port:          ${PORT}`);
  console.log(`  Python Agent:  ${PYTHON_HTTP_URL}`);
  console.log(`  Python WS:     ${PYTHON_WS_URL}`);
  console.log(`  Twilio SMS:    ${twilioClient ? '✅ ENABLED' : '⚠️ MOCK MODE'}`);
  console.log(`══════════════════════════════════════════════════\n`);
  addLog('SYSTEM', `Node Backend v3.1 initialized. Python agent: ${PYTHON_HTTP_URL} | Twilio: ${twilioClient ? 'LIVE' : 'MOCK'}`);
});
