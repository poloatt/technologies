/**
 * URL base del API. En dev con Vite (5173–5175) usa '' para el proxy /api → backend :5000.
 */
export function getApiBaseUrl() {
  const apiUrl = import.meta.env.VITE_API_URL;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const port = typeof window !== 'undefined' ? window.location.port : '';
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  const viteDevPorts = new Set(['5173', '5174', '5175']);
  const onViteDevServer = import.meta.env.DEV && isLocalHost && viteDevPorts.has(port);

  if (onViteDevServer) {
    return '';
  }

  if (apiUrl && typeof apiUrl === 'string') {
    return apiUrl;
  }

  if (isLocalHost) {
    return import.meta.env.DEV ? '' : 'http://localhost:5000';
  }

  if (
    hostname === 'atta.attadia.com'
    || hostname === 'foco.attadia.com'
    || hostname === 'pulso.attadia.com'
  ) {
    return 'https://api.attadia.com';
  }

  return 'https://api.attadia.com';
}
