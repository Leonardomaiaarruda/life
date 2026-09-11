/* MetaLife V22.1 — preparação para Supabase.
   Por padrão NÃO substitui o Apps Script. Só ativa quando CONFIG.SUPABASE_ENABLED=true.
   Nunca coloque service_role/secret key neste arquivo ou no config.js. */
(() => {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  let client = null;
  let sdkPromise = null;

  function configured() {
    return !!(
      window.CONFIG?.SUPABASE_ENABLED &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(window.CONFIG?.SUPABASE_URL || '')) &&
      String(window.CONFIG?.SUPABASE_PUBLISHABLE_KEY || '').trim()
    );
  }

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (sdkPromise) return sdkPromise;

    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CDN;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => window.supabase?.createClient
        ? resolve(window.supabase)
        : reject(new Error('SDK do Supabase não ficou disponível.'));
      script.onerror = () => reject(new Error('Não foi possível carregar o SDK do Supabase.'));
      document.head.appendChild(script);
    });

    return sdkPromise;
  }

  async function getClient() {
    if (!configured()) return null;
    if (client) return client;

    const sdk = await loadSdk();
    client = sdk.createClient(
      window.CONFIG.SUPABASE_URL,
      window.CONFIG.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'metalife_supabase_auth'
        },
        global: {
          headers: { 'x-client-info': `metalife-web/${window.CONFIG.VERSION || 'dev'}` }
        }
      }
    );
    return client;
  }

  async function status() {
    if (!configured()) return { configured: false, connected: false, authenticated: false };
    try {
      const sb = await getClient();
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      return {
        configured: true,
        connected: true,
        authenticated: !!data?.session,
        userId: data?.session?.user?.id || null
      };
    } catch (error) {
      return { configured: true, connected: false, authenticated: false, error: error.message };
    }
  }

  async function signUp(email, password, name = '') {
    const sb = await getClient();
    if (!sb) throw new Error('Supabase ainda não está ativado no config.js.');
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const sb = await getClient();
    if (!sb) throw new Error('Supabase ainda não está ativado no config.js.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const sb = await getClient();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function currentUser() {
    const sb = await getClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user || null;
  }

  /* Snapshot é a ponte de migração: salva o estado MetaLife inteiro em JSONB.
     Isso permite validar contas e sincronização antes de trocar cada módulo
     para tabelas normalizadas. */
  async function saveSnapshot(appState) {
    const sb = await getClient();
    const user = await currentUser();
    if (!sb || !user) throw new Error('Faça login no Supabase antes de sincronizar.');

    const payload = {
      user_id: user.id,
      app_version: window.CONFIG?.VERSION || null,
      data: appState || {}
    };
    const { data, error } = await sb.from('user_snapshots').upsert(payload, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return data;
  }

  async function loadSnapshot() {
    const sb = await getClient();
    const user = await currentUser();
    if (!sb || !user) return null;
    const { data, error } = await sb.from('user_snapshots').select('data,app_version,updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function testDatabase() {
    const sb = await getClient();
    const user = await currentUser();
    if (!sb) return { ok: false, error: 'Supabase não configurado.' };
    if (!user) return { ok: false, error: 'Supabase conectado, mas sem usuário autenticado.' };
    const { error } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle();
    return error ? { ok: false, error: error.message } : { ok: true, userId: user.id };
  }

  window.MetaLifeSupabase = {
    configured,
    getClient,
    status,
    signUp,
    signIn,
    signOut,
    currentUser,
    saveSnapshot,
    loadSnapshot,
    testDatabase
  };

  document.documentElement.dataset.supabase = configured() ? 'configured' : 'off';
})();
