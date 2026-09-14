/* MetaLife 22.2 - sincronização opcional de desafios por conta. */
(() => {
  'use strict';
  const arr = value => Array.isArray(value) ? value : [];
  const owner = () => String(window.challengeUserId?.() || 'demo');
  const key = name => `ml_v22_${encodeURIComponent(owner())}_${name}`;
  const coinKey = () => `ml_v18_${encodeURIComponent(owner())}_coin_ledger`;
  const stampKey = () => `ml_v22_${encodeURIComponent(owner())}_sync_stamp`;
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(key(name)) || 'null') ?? fallback; } catch (_) { return fallback; } };
  const readCoins = () => { try { return JSON.parse(localStorage.getItem(coinKey()) || '[]'); } catch (_) { return []; } };
  const snapshot = () => ({ challenges: arr(read('challenges', [])), rewards: arr(read('rewards', [])), coins: arr(readCoins()) });
  const fingerprint = value => JSON.stringify(value);
  let lastFingerprint = '';
  let unavailable = false;
  let running = null;

  function applyRemote(item) {
    if (!item) return;
    localStorage.setItem(key('challenges'), JSON.stringify(arr(item.challenges)));
    localStorage.setItem(key('rewards'), JSON.stringify(arr(item.rewards)));
    localStorage.setItem(coinKey(), JSON.stringify(arr(item.coins)));
    localStorage.setItem(stampKey(), String(item.client_updated_at || item.updatedAt || new Date().toISOString()));
    lastFingerprint = fingerprint(snapshot());
    window.dispatchEvent(new Event('metalife-v22-synced'));
    if (document.getElementById('pageTitle')?.textContent === 'Desafios') window.MetaLifeChallengesV22?.render?.();
  }

  async function sync(force = false) {
    if (running) return running;
    const currentOwner = owner();
    if (unavailable || currentOwner === 'demo' || !window.API?.call || navigator.onLine === false) return null;
    running = (async () => {
      try {
        const local = snapshot();
        const fp = fingerprint(local);
        const remote = await window.API.call('v22GetState');
        if (!remote?.ok) {
          if (/Ação inválida|Acao invalida/i.test(String(remote?.error || ''))) unavailable = true;
          return remote;
        }

        const remoteItem = remote.item || null;
        const localStamp = String(localStorage.getItem(stampKey()) || '');
        const remoteStamp = String(remoteItem?.client_updated_at || remoteItem?.updatedAt || '');
        if (remoteItem && remoteStamp && (!localStamp || remoteStamp > localStamp) && fp === lastFingerprint) {
          applyRemote(remoteItem);
          return {ok:true,direction:'pull'};
        }

        if (force || fp !== lastFingerprint || !remoteItem) {
          const stamp = new Date().toISOString();
          const saved = await window.API.call('v22SaveState', {state:local, client_updated_at:stamp});
          if (saved?.ok) {
            localStorage.setItem(stampKey(), stamp);
            lastFingerprint = fp;
            window.dispatchEvent(new Event('metalife-v22-synced'));
            return {ok:true,direction:'push'};
          }
          if (/Ação inválida|Acao invalida/i.test(String(saved?.error || ''))) unavailable = true;
          return saved;
        }
        return {ok:true,direction:'none'};
      } finally {
        running = null;
      }
    })();
    return running;
  }

  lastFingerprint = fingerprint(snapshot());
  window.addEventListener('metalife-features-ready', () => sync(false));
  window.addEventListener('metalife-data-saved', () => sync(false));
  window.addEventListener('online', () => sync(false));
  setInterval(() => { if (!document.hidden) sync(false); }, 30000);
  window.MetaLifeChallengeSync = { sync, snapshot, available: () => !unavailable };
})();
