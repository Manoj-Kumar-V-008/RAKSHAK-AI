import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Python agent URL — override via env var for Render deployment
const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://localhost:8000';

// ── Twilio Configuration ──────────────────────────────────────────────────────
const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM   = process.env.TWILIO_PHONE_NUMBER || '';

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

// ── Audit log ─────────────────────────────────────────────────────────────────
const auditLog = [];
const addLog = (category, message, meta = null) => {
  const entry = { id: Date.now() + Math.random(), timestamp: new Date().toISOString(), category, message, meta };
  auditLog.push(entry);
  if (auditLog.length > 100) auditLog.shift();
  console.log(`[${category}] ${message}`);
  io.emit('audit_log', entry);
};

// ── SMS History ───────────────────────────────────────────────────────────────
const smsHistory = [];

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('Rakshak AI Backend v3.0 — LangGraph Agent + Twilio SMS'));

app.get('/api/health', (_req, res) => res.json({
  status: 'Rakshak AI Online',
  version: '3.0.0',
  timestamp: new Date(),
  pythonAgent: PYTHON_AGENT_URL,
  twilioEnabled: !!twilioClient,
  smsCount: smsHistory.length,
}));

app.get('/api/audit', (_req, res) => res.json({ logs: auditLog }));

// ── SMS Endpoint — Send real or mock SMS ──────────────────────────────────────
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
    // ── REAL SMS via Twilio ──
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
    // ── MOCK MODE — no Twilio credentials ──
    smsRecord.status = 'mock_sent';
    smsHistory.push(smsRecord);
    addLog('SMS', `📱 [MOCK] SMS to ${contactName} (${to}): "${message.substring(0, 80)}..."`);
    io.emit('sms_sent', { phone: to, status: 'delivered', mock: true });
    return res.json({ success: true, mode: 'mock', message: 'SMS simulated (configure Twilio env vars for real delivery)' });
  }
});

// ── Twilio Voice Call (optional) ──────────────────────────────────────────────
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

// ── SMS History ───────────────────────────────────────────────────────────────
app.get('/api/sms/history', (_req, res) => res.json({ history: smsHistory.slice(-50) }));

// ── Main event endpoint — relay to Python LangGraph agent ────────────────────
app.post('/api/events', async (req, res) => {
  const sensorData = req.body;
  const sessionId  = `sess-${Date.now()}`;

  res.json({ status: 'forwarded_to_python_agent', session_id: sessionId });

  io.emit('agent_status', { status: 'ANALYZING', isProcessing: true });
  addLog('DETECTION', `🔔 SENSOR ALERT: ${(sensorData.type || 'UNKNOWN').toUpperCase()} @ ${sensorData.location || '?'}. Forwarding to LangGraph agent...`, sensorData);

  try {
    const response = await fetch(`${PYTHON_AGENT_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id:  sessionId,
        sensor_data: sensorData,
        venue_lat:   sensorData.venue_lat ?? 12.9716,
        venue_lon:   sensorData.venue_lon ?? 77.5946,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`Python agent returned ${response.status}`);
    addLog('SYSTEM', `✅ Crisis forwarded to LangGraph agent. Session: ${sessionId}`);

  } catch (err) {
    addLog('SYSTEM', `⚠️ Python agent unreachable (${err.message}) — frontend fallback will activate.`);
    io.emit('agent_status', { status: 'NOMINAL', isProcessing: false });
  }
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Frontend connected via Socket.IO');
  socket.emit('sync_state', { logs: auditLog, isProcessing: false, twilioEnabled: !!twilioClient });
  socket.on('disconnect', () => console.log('Frontend disconnected'));
});

httpServer.listen(PORT, () => {
  console.log(`Node.js Backend v3.0 running on http://localhost:${PORT}`);
  console.log(`Twilio SMS: ${twilioClient ? '✅ ENABLED' : '⚠️ MOCK MODE (set TWILIO_* env vars)'}`);
  addLog('SYSTEM', `Backend v3.0 initialized. Python agent: ${PYTHON_AGENT_URL} | Twilio: ${twilioClient ? 'LIVE' : 'MOCK'}`);
});
