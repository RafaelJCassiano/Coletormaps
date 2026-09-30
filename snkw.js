// Service Worker - Coletormaps (modo offline)
// Ao mudar o index.html ou este arquivo, aumente a versão abaixo.
const VERSAO = 'coletormaps-v1';

const ARQUIVOS_LOCAIS = ['./', './index.html'];

const LIBS_EXTERNAS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSAO).then(async (cache) => {
      // Cada item é guardado separadamente: se um falhar, os outros continuam.
      await Promise.all(
        ARQUIVOS_LOCAIS.map((url) => cache.add(url).catch(() => {}))
      );
      await Promise.all(
        LIBS_EXTERNAS.map((url) =>
          fetch(url, { mode: 'no-cors' })
            .then((resp) => cache.put(url, resp))
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar a API do Supabase: o app trata o offline por conta própria.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Páginas (HTML): tenta a rede primeiro; sem internet, usa o cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put('./index.html', copia));
          return resp;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('./index.html') || caches.match('./'))
        )
    );
    return;
  }

  // Demais arquivos (bibliotecas, fontes, mapas, imagens): cache primeiro, depois rede.
  event.respondWith(
    caches.match(req).then((emCache) => {
      if (emCache) return emCache;
      return fetch(req)
        .then((resp) => {
          if (resp && (resp.ok || resp.type === 'opaque')) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => emCache);
    })
  );
});
