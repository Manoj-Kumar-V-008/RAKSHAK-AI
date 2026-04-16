// Root bootstrap for the real Node relay.
// This keeps legacy `node server.js` deployments pointed at the maintained
// backend entrypoint in `backend-node/server.js`.
import('./backend-node/server.js').catch((error) => {
  console.error('[RAKSHAK AI] Failed to start backend-node/server.js');
  console.error(error);
  process.exit(1);
});
