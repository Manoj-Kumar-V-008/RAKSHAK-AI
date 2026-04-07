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

// ── Audit log ─────────────────────────────────────────────────────────────────
const auditLog = [];
const addLog = (category, message, meta = null) => {
  const entry = { id: Date.now() + Math.random(), timestamp: new Date().toISOString(), category, message, meta };
  auditLog.push(entry);
  if (auditLog.length > 100) auditLog.shift();
  console.log(`[${category}] ${message}`);
  io.emit('audit_log', entry);
};

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('Rakshak AI Relay Backend (Node.js) + LangGraph Python Agent Online'));

app.get('/api/health', (_req, res) => res.json({ status: 'Rakshak AI Online', timestamp: new Date(), pythonAgent: PYTHON_AGENT_URL }));

app.get('/api/audit', (_req, res) => res.json({ logs: auditLog }));

// ── Main event endpoint — relay to Python LangGraph agent ────────────────────
app.post('/api/events', async (req, res) => {
  const sensorData = req.body;
  const sessionId  = `sess-${Date.now()}`;

  // Acknowledge immediately
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
  socket.emit('sync_state', { logs: auditLog, isProcessing: false });
  socket.on('disconnect', () => console.log('Frontend disconnected'));
});

httpServer.listen(PORT, () => {
  console.log(`Node.js Relay Backend running on http://localhost:${PORT}`);
  addLog('SYSTEM', `Backend relay initialized. Python agent: ${PYTHON_AGENT_URL}`);
});
