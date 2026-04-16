const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

const explicitBackendUrl = trimTrailingSlash(import.meta.env.VITE_BACKEND_URL);
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalBrowser = typeof window !== 'undefined' && LOCAL_HOSTS.has(window.location.hostname);

export const NODE_BACKEND_URL = explicitBackendUrl || (isLocalBrowser ? 'http://localhost:3000' : '');

export function buildBackendUrl(path = '') {
  if (!path) {
    return NODE_BACKEND_URL || browserOrigin || '';
  }

  if (NODE_BACKEND_URL) {
    return `${NODE_BACKEND_URL}${path}`;
  }

  return path;
}

export function getSocketTarget() {
  return NODE_BACKEND_URL || undefined;
}
