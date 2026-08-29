// Service Worker para Vite - Foco
const CACHE_VERSION = 'v7';
const CACHE_PREFIX = 'foco-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

function isScriptResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('javascript') || contentType.includes('ecmascript');
}

function isStyleResponse(response) {
  return (response.headers.get('content-type') || '').includes('css');
}

function isHtmlResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
}

function isDocumentRequest(request) {
  return request.mode === 'navigate'
    || request.destination === 'document'
    || ((request.headers.get('accept') || '').includes('text/html'));
}

function isHashedAssetRequest(request) {
  return request.destination === 'script'
    || request.destination === 'style'
    || request.url.includes('/assets/');
}

function isCacheableAssetResponse(request, response) {
  if (!response || !response.ok) return false;
  if (isHtmlResponse(response)) return false;
  if (request.destination === 'script') return isScriptResponse(response);
  if (request.destination === 'style') return isStyleResponse(response);
  if (request.url.includes('/assets/')) {
    return !isHtmlResponse(response);
  }
  return false;
}

function isValidCachedAsset(request, cached) {
  if (!cached) return false;
  if (isHtmlResponse(cached)) return false;
  if (request.destination === 'script') return isScriptResponse(cached);
  if (request.destination === 'style') return isStyleResponse(cached);
  if (request.url.includes('/assets/')) {
    return !isHtmlResponse(cached);
  }
  return true;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (request.url.includes('/api/') || request.url.includes('api.attadia.com')) {
    return;
  }

  // HTML siempre desde red (evita index.html viejo con hashes de bundle obsoletos).
  if (isDocumentRequest(request)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() =>
        fetch('/index.html', { cache: 'no-store' })
      )
    );
    return;
  }

  // Assets hashed: network-first; no servir cache si el servidor responde 404.
  if (isHashedAssetRequest(request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.status === 404) {
            await cache.delete(request);
            return response;
          }
          if (isCacheableAssetResponse(request, response)) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch (networkError) {
          const cached = await cache.match(request);
          if (cached && isValidCachedAsset(request, cached)) return cached;
          throw networkError;
        }
      })
    );
  }
});
