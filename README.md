# Rakshak AI

Rakshak AI is a crisis-response web app with a React frontend, a Node.js relay backend, and a Python LangGraph agent.

## Runtime Architecture

Production flow:

`Browser -> Node relay -> Python LangGraph agent -> Gemini`

- `frontend/` contains the React command-center UI.
- `backend-node/` contains the public Node service, Socket.IO relay, SMS endpoints, and optional static frontend serving.
- `backend-python/` contains the FastAPI + LangGraph crisis agent that performs the real AI workflow.

The root `server.js` is only a bootstrap that forwards legacy `node server.js` runs to `backend-node/server.js`.

## Local Development

Install dependencies:

```bash
npm run setup
```

Run all three services together:

```bash
npm run dev
```

Default local ports:

- Frontend: `http://localhost:5173`
- Node relay: `http://localhost:3000`
- Python agent: `http://localhost:8000`

## Deployment

`render.yaml` deploys:

1. `rakshak-backend` as the public web app and Node relay
2. `rakshak-agent` as the Python LangGraph agent

Important deployment behavior:

- The Node service builds the frontend and serves `frontend/dist` directly.
- The Node service talks to the Python agent through `PYTHON_AGENT_URL`.
- On Render, `PYTHON_AGENT_URL` is populated from the Python service `hostport`, which the Node backend normalizes to an internal `http://` URL.

## Required Environment Variables

Python agent:

- `GEMINI_API_KEY`
- `TOMTOM_API_KEY`

Optional Node relay variables:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Optional frontend variable for separate frontend hosting:

- `VITE_BACKEND_URL`

If the frontend is served by the Node relay, no frontend backend URL override is required.
