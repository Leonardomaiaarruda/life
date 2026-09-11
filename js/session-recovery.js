/* MetaLife V21.2 — valida sessão persistida sem bloquear o app por muito tempo. */
(() => {
  'use strict';

  const SESSION_OK_KEY = 'ml_session_checked_at';
  const SESSION_TTL = 2 * 60 * 1000;
  let patched = false;

  function showLogin() {
    document.querySelectorAll('.login-loading-overlay').forEach(node => node.remove());
    const auth = document.getElementById('authScreen');
    const app = document.getElementById('app');
    auth?.classList.remove('hidden');
    app?.classList.add('hidden');
    const form = document.getElementById('loginForm');
    if (form) {
      form.dataset.loading = 'false';
      form.removeAttribute('aria-busy');
      form.querySelectorAll('button,input').forEach(control => control.disabled = false);
    }
  }

  function clearSessionOnly() {
    localStorage.removeItem('ml_token');
    localStorage.removeItem('ml_user_id');
    sessionStorage.removeItem(SESSION_OK_KEY);
    try { window.mlPwaClear?.(); } catch (_) {}
    showLogin();
  }

  function sessionError(result) {
    if (!result || result.ok !== false) return false;
    const text = String(result.error || result.message || '');
    return /sess[aã]o|sessao|token|expirad|inv[aá]lid|identificar.*usu[aá]rio|login/i.test(text);
  }

  async function validatePersistedSession() {
    const token = localStorage.getItem('ml_token');
    if (!token) return 'none';

    const checked = Number(sessionStorage.getItem(SESSION_OK_KEY) || 0);
    if (checked && Date.now() - checked < SESSION_TTL) return 'valid';

    /* Se o próprio formulário acabou de receber um login válido, não fazemos uma
       segunda ida ao servidor. O login já confirmou o token. */
    if (document.getElementById('loginForm')?.dataset.loading === 'true') {
      sessionStorage.setItem(SESSION_OK_KEY, String(Date.now()));
      return 'valid';
    }

    if (!window.CONFIG?.API_URL || navigator.onLine === false) return 'unknown';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify({action:'sessionStatus', token}),
        signal: controller.signal
      });
      if (!response.ok) return 'unknown';
      const result = await response.json().catch(() => null);
      if (result?.ok === true) {
        sessionStorage.setItem(SESSION_OK_KEY, String(Date.now()));
        return 'valid';
      }
      if (sessionError(result)) return 'invalid';
      /* Backend antigo sem sessionStatus: não destrói sessão local. */
      return 'unknown';
    } catch (_) {
      return 'unknown';
    } finally {
      clearTimeout(timeout);
    }
  }

  function patchBoot() {
    if (patched || typeof window.boot !== 'function') return false;
    const original = window.boot;
    window.boot = async function mlSessionSafeBoot(...args) {
      if (!localStorage.getItem('ml_token')) return original.apply(this, args);
      const status = await validatePersistedSession();
      if (status === 'invalid') {
        clearSessionOnly();
        return;
      }
      return original.apply(this, args);
    };
    window.boot.__mlSessionRecovery = true;
    patched = true;
    return true;
  }

  function install() {
    if (!patchBoot()) {
      [0, 30, 100].forEach(delay => setTimeout(patchBoot, delay));
    }
  }

  /* Quando um SW novo assume uma guia antiga, recarrega apenas uma vez e somente
     enquanto a tela de autenticação estiver visível. Isso cura cache antigo sem
     apagar dados pessoais do navegador. */
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    const authVisible = !document.getElementById('authScreen')?.classList.contains('hidden');
    if (!authVisible || sessionStorage.getItem('ml_sw_reloaded_once') === '1') return;
    sessionStorage.setItem('ml_sw_reloaded_once', '1');
    location.reload();
  });

  window.mlClearSessionOnly = clearSessionOnly;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
