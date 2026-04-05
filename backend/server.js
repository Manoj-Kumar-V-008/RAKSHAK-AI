import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

app.get('/', (req, res) => {
  res.send('Rakshak AI Backend is running successfully!');
});
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
};

const SCENARIOS = [
  { type: 'smoke', value: 92, location: 'Kitchen, Floor 2', sensor_id: 'SMK-K2-07', temperature_c: 340 },
  { type: 'health', heart_rate: 0, spo2: 68, location: 'Lobby Level 1', sensor_id: 'BIO-L1-03', alert: 'cardiac_arrest' },
  { type: 'security', value: 95, location: 'East Gate, Sector B', sensor_id: 'SEC-E1-12', alert: 'perimeter_breach' },
  { type: 'power', value: 0, location: 'Sector C, Main Grid', sensor_id: 'PWR-C1-01', alert: 'total_blackout' },
  { type: 'water', value: 88, location: 'Basement B2, Utility', sensor_id: 'WTR-B2-04', alert: 'rapid_water_rise' }
];

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: [{
    functionDeclarations: [
      {
        name: "dispatch_responder",
        description: "Dispatch an emergency responder unit to a location.",
        parameters: {
          type: "OBJECT",
          properties: {
            unit_type: { type: "STRING", description: "Type of responder: hospital, police, or fire_station" },
            location: { type: "STRING" },
            priority: { type: "STRING", description: "low, medium, high, or critical" }
          },
          required: ["unit_type", "location", "priority"]
        }
      },
      {
         name: "escalate_crisis",
         description: "Escalate an ongoing crisis to a higher severity level.",
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
    ]
  }]
});

let isProcessing = false;
let runCount = 0;

// The autonomous AI loop
setInterval(async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Read current sensor data (Mocking random realistic anomaly)
    runCount++;
    const sensorData = runCount % 3 === 0 ? SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)] : { status: "nominal", message: "All sensors reporting normal thresholds." };
    
    // We only process if it's an anomaly or periodically to show scanning
    if (sensorData.status === "nominal") {
        isProcessing = false;
        return;
    }

    addLog('DETECTION', `🔔 Backend Sensor Scan: ${sensorData.type.toUpperCase()} anomaly at ${sensorData.location}. Raw: ${JSON.stringify(sensorData)}`);

    // 2 & 3. Send to Gemini and let it decide what tool to call
    addLog('ANALYSIS', '🧠 Backend AI ANALYZING DATA via Function Calling...');

    const prompt = `You are the autonomous backend supervisor for Rakshak AI.
A sensor event has occurred: ${JSON.stringify(sensorData)}
Based on this context, take ONE immediate action using the tools provided. DO NOT just output text, you MUST call a tool. Make a logical decision on whether to dispatch, escalate, or alert.`;

    const chat = model.startChat();
    const result = await chat.sendMessage(prompt);
    
    const call = result.functionCalls && result.functionCalls()[0];
    
    if (call) {
      // 4. Log the decision + reasoning
      addLog('DECISION', `Gemini Tool Call Chosen: ${call.name}\nReasoning: AI determined this was the optimal action based on sensor data [${sensorData.type}].`);
      
      const argsStr = JSON.stringify(call.args, null, 2);
      addLog('DISPATCH', `Executing ${call.name} with payload:\n${argsStr}`, call.args);
    } else {
       // If no tool was called
       addLog('DECISION', `AI Response: No immediate emergency tool execution required. Observation mode active.\nMessage: ${result.response.text()}`);
    }

  } catch (error) {
    console.error("Backend AI Error:", error);
    addLog('SYSTEM', `⚠️ Backend Agent Error: ${error.message}`);
  } finally {
    isProcessing = false;
  }
}, 5000); // Every 5 seconds

app.get('/api/audit', (req, res) => {
  res.json({ logs: auditLog });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "Rakshak AI online",
    timestamp: new Date()
  });
});

app.listen(PORT, () => {
  console.log(`Backend agent loop running on http://localhost:${PORT}`);
  addLog('SYSTEM', 'Autonomous Express backend loop started on port ' + PORT);
});
