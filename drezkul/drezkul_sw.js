// Cache do Drezkul no aparelho: sons, personagens, texturas (assets/) e o
// canvaskit ficam guardados e, depois da primeira visita, saem daqui sem ir
// à rede. O nome do cache é a versão do jogo (version.json, gerado pelo
// build): versão nova baixa tudo de novo uma vez e apaga a antiga.
'use strict';

const PREFIX = 'drezkul-';
let currentName = null;
let versionCheck = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/// Lê a versão publicada (sem cache) e troca de cache se mudou.
async function refreshVersion() {
  try {
    const res = await fetch('version.json', { cache: 'no-store' });
    const v = await res.json();
    const name = PREFIX + v.version + '+' + v.build_number;
    if (name !== currentName) {
      currentName = name;
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== name) await caches.delete(key);
      }
    }
  } catch (e) {
    // Sem rede: fica com o cache que já existe.
    if (!currentName) {
      const keys = (await caches.keys()).filter((k) => k.startsWith(PREFIX));
      currentName = keys.length ? keys[keys.length - 1] : PREFIX + 'offline';
    }
  }
}

function ensureVersion() {
  if (!versionCheck) versionCheck = refreshVersion();
  return versionCheck;
}

function cacheable(url) {
  return url.pathname.includes('/assets/') || url.pathname.includes('/canvaskit/');
}

async function cacheFirst(request) {
  await ensureVersion();
  const cache = await caches.open(currentName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Página nova: confere a versão (o resto da página espera por isso).
  if (request.mode === 'navigate') {
    versionCheck = refreshVersion();
    return;
  }
  if (cacheable(url)) event.respondWith(cacheFirst(request));
});
