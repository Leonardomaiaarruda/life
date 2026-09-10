/* No caching of personal data or API responses. */
self.window = self;
importScripts('./js/config.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
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
    } catch (_) { /* A visible generic notification remains available offline. */ }
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
