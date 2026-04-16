#!/usr/bin/env bash
# ── Render Start Script for Rakshak AI Backend ──
# Starts BOTH the Node.js express/socket.io server AND the Python FastAPI agent.
# The Node.js server proxies crisis requests to the Python agent.

set -o errexit

# Start the Python FastAPI agent in the background on port 8000
echo "Starting Python LangGraph Agent on port 8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 &
PYTHON_PID=$!

# Give the Python server a moment to boot
sleep 2

# Start the Node.js server on the Render-assigned $PORT (default 3000)
echo "Starting Node.js Backend on port ${PORT:-3000}..."
export PYTHON_AGENT_URL="http://localhost:8000"
node server.js &
NODE_PID=$!

# Wait for either process to exit — if one dies, kill the other
wait -n $PYTHON_PID $NODE_PID
EXIT_CODE=$?

echo "A process exited with code $EXIT_CODE — shutting down..."
kill $PYTHON_PID $NODE_PID 2>/dev/null || true
exit $EXIT_CODE
