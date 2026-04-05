import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' } // Allow frontend to connect
});

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Maintain an audit log for recent actions
const auditLog = [];

const addLog = (category, message, meta = null) => {
  const entry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    category,
    message,
    meta
  };
  auditLog.push(entry);
  if (auditLog.length > 100) auditLog.shift(); // Keep last 100
  console.log(`[${category}] ${message}`);
  
  // Broadcast log to all frontend clients instantly
  io.emit('audit_log', entry);
};

app.get('/', (req, res) => {
  res.send('Rakshak AI Dynamic Agent Backend is running successfully!');
});

app.get('/api/audit', (req, res) => {
  res.json({ logs: auditLog });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "Rakshak AI Agent Online",
    timestamp: new Date()
  });
});

// Define our Tools
const functionDeclarations = [
  {
    name: "check_traffic_conditions",
    description: "Check current traffic conditions and estimated arrival times for a specific route or area before dispatching. Useful if you need to know if an ambulance can arrive fast enough.",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: { type: "STRING", description: "The destination location, e.g. Kitchen, Sector B, MG Road" },
        unit_type: { type: "STRING", description: "Type of responder to check traffic for e.g. ambulance, fire_station" }
      },
      required: ["destination", "unit_type"]
    }
  },
  {
    name: "dispatch_responder",
    description: "Dispatch an emergency responder unit to a location.",
    parameters: {
      type: "OBJECT",
      properties: {
        unit_type: { type: "STRING", description: "Type of responder: hospital, police, or fire_station" },
        location: { type: "STRING" },
        priority: { type: "STRING", description: "low, medium, high, or critical" },
        reason: { type: "STRING", description: "Why is this unit being dispatched based on current traffic and situation?" }
      },
      required: ["unit_type", "location", "priority", "reason"]
    }
  },
  {
     name: "escalate_crisis",
     description: "Escalate an ongoing crisis to a higher severity level if traffic or situation worsens.",
     parameters: {
       type: "OBJECT",
       properties: {
         crisis_id: { type: "STRING" },
         new_severity: { type: "INTEGER", description: "1 to 10" },
         reason: { type: "STRING" }
       },
       required: ["crisis_id", "new_severity", "reason"]
     }
  },
  {
     name: "send_alert",
     description: "Send an alert message to specific zones or agencies.",
     parameters: {
       type: "OBJECT",
       properties: {
         zones: { type: "ARRAY", items: { type: "STRING" } },
         message: { type: "STRING" },
         urgency: { type: "STRING", description: "info, warning, or critical" }
       },
       required: ["zones", "message", "urgency"]
     }
  }
];

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: [{ functionDeclarations }],
  systemInstruction: "You are RAKSHAK AI, an autonomous crisis response agent. You have persistent memory of past events. Before dispatching, you MUST always check traffic conditions to ensure the responder can physically arrive in time. Use 'check_traffic_conditions', observe the result, and ONLY then use 'dispatch_responder' with your reasoning."
});

// A global persistent chat session acts as the Agent's Memory
let agentMemoryChat = model.startChat();

let isProcessing = false;

// Event ingestion endpoint replacing the old setInterval
app.post('/api/events', async (req, res) => {
  const sensorData = req.body;
  
  // Acknowledge receipt
  res.json({ status: 'Event received, agent is processing', original_event: sensorData });
  
  if (isProcessing) {
      addLog('SYSTEM', '⚠️ Agent is currently busy processing an ongoing crisis. Queueing event...');
      // Simplistic approach: we just process it immediately but ideally we'd queue it.
  }
  
  isProcessing = true;
  io.emit('agent_status', { status: 'ANALYZING', isProcessing: true });
  addLog('DETECTION', `🔔 LIVE SENSOR ALERT: ${sensorData.type?.toUpperCase()} anomaly. Recipient: ${sensorData.location}. Raw value: ${JSON.stringify(sensorData)}`, sensorData);

  try {
    let continueReasoning = true;
    let stepCount = 0;
    let promptText = `New event detected: ${JSON.stringify(sensorData)}. Please evaluate the situation, check traffic, and dispatch accordingly. If you have nothing else to do, respond with text explaining the situation is handled.`;

    while (continueReasoning && stepCount < 5) { // Max 5 ReAct steps to prevent infinite loop
        stepCount++;
        addLog('ANALYSIS', `🧠 [Step ${stepCount}] AI reasoning loop active...`);
        
        io.emit('agent_thought', `Thinking (Step ${stepCount})...`);

        const result = await agentMemoryChat.sendMessage(promptText);
        const calls = result.functionCalls && result.functionCalls();

        if (calls && calls.length > 0) {
            // Agent decided to call a physical tool
            const call = calls[0];
            const argsStr = JSON.stringify(call.args, null, 2);
            
            addLog('DECISION', `Agent decided to execute [${call.name}]`);
            io.emit('agent_action', { name: call.name, args: call.args });

            // Mock Execution
            let toolResponse;
            if (call.name === 'check_traffic_conditions') {
                addLog('INTEL', `Checking traffic to ${call.args.destination} for ${call.args.unit_type}...`);
                // Simulate network latency for traffic check
                await new Promise(r => setTimeout(r, 1500));
                
                const isHeavy = Math.random() > 0.5;
                if (isHeavy) {
                    toolResponse = { status: "HEAVY_CONGESTION", estimated_delay_mins: 15, recommendation: "Consider routing aerial units or escalating priority." };
                    addLog('INTEL', `⚠️ HEAVY TRAFFIC DETECTED to ${call.args.destination}. Expected delay: 15 mins.`);
                } else {
                    toolResponse = { status: "CLEAR", estimated_delay_mins: 2, recommendation: "Proceed with immediate dispatch." };
                    addLog('INTEL', `✅ Route is clear to ${call.args.destination}.`);
                }
            } else if (call.name === 'dispatch_responder') {
                addLog('DISPATCH', `[SUCCESS] Dispatched ${call.args.unit_type} to ${call.args.location}. Priority: ${call.args.priority}\nReasoning: ${call.args.reason}`, call.args);
                await new Promise(r => setTimeout(r, 1000));
                toolResponse = { status: "DISPATCH_CONFIRMED", eta: "Underway" };
                
                // Alert the frontend map to show dispatch
                io.emit('crisis_update', {
                    active: true,
                    types: [call.args.unit_type],
                    sensorData: sensorData,
                    action: 'dispatched',
                    details: call.args
                });
            } else {
                addLog('SYSTEM', `Executed secondary tool ${call.name}`);
                toolResponse = { status: "SUCCESS" };
            }

            // Provide tool output back into the memory for the next loop iteration
            promptText = [{
                functionResponse: {
                    name: call.name,
                    response: toolResponse
                }
            }];
            
        } else {
            // No tools called, agent is just speaking/concluding
            const textResponse = result.response.text();
            addLog('RESOLVED', `Agent Action Complete: ${textResponse}`);
            io.emit('agent_thought', `Resolution: ${textResponse}`);
            continueReasoning = false; // Exit loop
        }
    }

  } catch (err) {
      console.error("Agent Loop Error:", err);
      addLog('SYSTEM', `⚠️ Backend Agent Error: ${err.message}`);
  } finally {
      isProcessing = false;
      io.emit('agent_status', { status: 'NOMINAL', isProcessing: false });
  }

});

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log('Frontend connected via WebSocket');
  
  // On connect, optionally send them the current memory/audit log
  socket.emit('sync_state', { logs: auditLog, isProcessing });

  socket.on('disconnect', () => {
    console.log('Frontend disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend Agent Server (ReAct + WebSockets) running on http://localhost:${PORT}`);
  addLog('SYSTEM', 'Autonomous Agent Node initialized with memory persistence.');
});
