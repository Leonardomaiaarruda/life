/* MetaLife V21.1 — cache estático com interface moderna global. */
self.window = self;
importScripts('./js/config.js');

const STATIC_CACHE = 'metalife-static-v21-modern-1';
const STATIC_ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './css/v13.css', './css/mobile-nav.css', './css/v14.css',
  './css/v15-v16.css', './css/v17-v18.css', './css/v19.css', './css/v20.css', './css/v20-stage3.css', './css/v20-library-complete.css', './css/v21-history.css', './css/modern-ui.css',
  './css/social.css', './css/competitions.css', './css/community.css',
  './js/config.js', './js/api.js', './js/store.js', './js/sync.js', './js/fast-data.js',
  './js/pwa.js', './js/app.js', './js/login-stability.js', './js/social.js', './js/competitions.js', './js/community.js',
  './js/health-import.js', './js/progress.js', './js/v13.js', './js/mobile-nav.js',
  './js/v14.js', './js/v15.js', './js/v16.js', './js/v17.js', './js/v18.js', './js/v19.js',
  './js/v20.js', './js/v20-library-complete.js', './js/v20-images.js', './js/v20-stage2.js', './js/v20-stage3.js', './js/v21-history-guidance.js',
  './assets/v20/legs-sprite.webp',
  './assets/v20/agachamento-livre.svg', './assets/v20/leg-press-45.svg',
  './assets/v20/cadeira-extensora.svg', './assets/v20/cadeira-flexora.svg',
  './assets/v20/afundo.svg', './assets/v20/passada.svg', './assets/v20/stiff.svg',
  './assets/v20/levantamento-terra.svg', './assets/v20/agachamento-bulgaro.svg',
  './assets/v20/agachamento-sumo.svg', './assets/v20/cadeira-abdutora.svg',
  './assets/v20/elevacao-panturrilha.svg', './assets/v20/panturrilha-sentada.svg',
  './assets/v20/panturrilha-no-leg-press.svg',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(STATIC_ASSETS.map(asset => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('metalife-static-') && k !== STATIC_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isStatic = /\.(?:html|css|js|webmanifest|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname) || url.pathname.endsWith('/');
  if (!isStatic) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request, {ignoreSearch:true});
    const network = fetch(request).then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => null);
    return cached || await network || new Response('Offline', {status:503, headers:{'Content-Type':'text/plain;charset=utf-8'}});
  })());
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
