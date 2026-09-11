/* MetaLife V21.2.3 — cache auto-recuperável, Meu Dia moderno e nomes amigáveis. */
self.window = self;
importScripts('./js/config.js');

const STATIC_CACHE = 'metalife-static-v21-startup-5';
const CORE_ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './css/modern-ui.css', './css/today-modern.css',
  './js/config.js', './js/api.js', './js/store.js', './js/sync.js', './js/fast-data.js',
  './js/pwa.js', './js/app.js', './js/today-modern.js', './js/session-recovery.js', './js/login-stability.js', './js/post-login-loader.js', './js/friendly-labels.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

const OPTIONAL_ASSETS = [
  './css/v13.css', './css/mobile-nav.css', './css/v14.css', './css/v15-v16.css',
  './css/v17-v18.css', './css/v19.css', './css/v20.css', './css/v20-stage3.css',
  './css/v20-library-complete.css', './css/v21-history.css', './css/social.css',
  './css/competitions.css', './css/community.css',
  './js/social.js', './js/competitions.js', './js/community.js', './js/health-import.js', './js/progress.js',
  './js/v13.js', './js/mobile-nav.js', './js/v14.js', './js/v15.js', './js/v16.js', './js/v17.js',
  './js/v18.js', './js/v19.js', './js/v20.js', './js/v20-library-complete.js', './js/v20-images.js',
  './js/v20-stage2.js', './js/v20-stage3.js', './js/v21-history-guidance.js',
  './assets/v20/legs-sprite.webp', './assets/v20/agachamento-livre.svg', './assets/v20/leg-press-45.svg',
  './assets/v20/cadeira-extensora.svg', './assets/v20/cadeira-flexora.svg', './assets/v20/afundo.svg',
  './assets/v20/passada.svg', './assets/v20/stiff.svg', './assets/v20/levantamento-terra.svg',
  './assets/v20/agachamento-bulgaro.svg', './assets/v20/agachamento-sumo.svg', './assets/v20/cadeira-abdutora.svg',
  './assets/v20/elevacao-panturrilha.svg', './assets/v20/panturrilha-sentada.svg', './assets/v20/panturrilha-no-leg-press.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(CORE_ASSETS.map(asset => cache.add(asset)));
    Promise.allSettled(OPTIONAL_ASSETS.map(asset => cache.add(asset))).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('metalife-static-') && key !== STATIC_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request, {cache:'no-store'});
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return await cache.match(request) || await cache.match(new URL(request.url).pathname.replace(self.location.pathname.replace(/sw\.js$/, ''), './')) || new Response('Offline', {status:503, headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await network || new Response('Offline', {status:503, headers:{'Content-Type':'text/plain;charset=utf-8'}});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const navigation = request.mode === 'navigate' || /\/index\.html$/i.test(url.pathname) || url.pathname.endsWith('/');
  if (navigation) {
    event.respondWith(networkFirst(request));
    return;
  }

  const isStatic = /\.(?:css|js|webmanifest|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);
  if (isStatic) event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const subscription = await self.registration.pushManager.getSubscription();
    if (!subscription) return;
    let body = 'Você tem uma nova mensagem. Toque para abrir o chat.';
    let room = '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(self.CONFIG.API_URL, {
          method: 'POST', headers: {'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify({action:'pushNotice', subscription:subscription.toJSON()}),
          signal: controller.signal
        });
        const notice = await response.json();
        if (notice.ok && notice.name) {
          if (/^(club|competition):[A-Za-z0-9_-]{8,80}$/.test(notice.room || '')) {
            room=notice.room;
            body=String(notice.name).slice(0,80)+' enviou uma mensagem em '+String(notice.room_name||'seu grupo').slice(0,80)+'.';
          } else body = String(notice.name).slice(0,80) + ' te mandou mensagem. Toque para abrir o chat.';
        }
      } finally { clearTimeout(timer); }
    } catch (_) {}
    await self.registration.showNotification('MetaLife', {
      body, icon: new URL('icons/icon-192.png', self.registration.scope).href,
      badge: new URL('icons/icon-192.png', self.registration.scope).href,
      tag:room?'metalife-'+room:'metalife-chat', data:{room}
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const candidate=event.notification.data?.room;
    const room=/^(club|competition):[A-Za-z0-9_-]{8,80}$/.test(candidate||'')?candidate:'';
    const url = new URL(room?'?room='+encodeURIComponent(room):'?chat=1', self.registration.scope).href;
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.focus();
      existing.postMessage({type:'METALIFE_OPEN_CHAT',room});
    } else await self.clients.openWindow(url);
  })());
});
