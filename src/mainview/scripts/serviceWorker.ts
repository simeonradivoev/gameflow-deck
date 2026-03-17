/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const SHELL = 'shell-v1';

async function cacheWithoutVary (cache: Cache, url: string)
{
  const response = await fetch(url);
  const cleaned = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: (() =>
    {
      const h = new Headers(response.headers);
      h.delete('Vary');
      return h;
    })()
  });
  await cache.put(url, cleaned);
}

self.addEventListener('install', (event: ExtendableEvent) =>
{
  event.waitUntil(
    caches.open(SHELL).then(cache => cacheWithoutVary(cache, '/'))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) =>
{
  // Clean up old caches when you bump SHELL version
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) =>
{
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request)
      .then(response =>
      {
        const vary = response.headers.get('Vary');
        if (!vary?.includes('*'))
        {
          caches.open(SHELL).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() =>
        caches.match('/').then(cached => cached ?? Response.error())
      )
  );
});