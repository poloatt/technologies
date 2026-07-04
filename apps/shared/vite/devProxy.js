/**
 * Proxy /api en dev → backend local. Usar 127.0.0.1 (no localhost) por dual-stack en Windows.
 */
export function createDevApiProxy(mode = 'development') {
  const target = mode === 'development'
    ? 'http://127.0.0.1:5000'
    : (process.env.VITE_API_URL || 'https://api.attadia.com');

  return {
    '/api': {
      target,
      changeOrigin: true,
      secure: mode !== 'development',
      ws: true,
    },
  };
}
