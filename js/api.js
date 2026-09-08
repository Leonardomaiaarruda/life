window.API = {
  reads: new Map(),
  async call(action, data = {}) {
    const readOnly = /^(list|getDashboard)/.test(action);
    const requestKey = JSON.stringify([localStorage.ml_token || '', action, data]);
    if (readOnly && this.reads.has(requestKey)) return this.reads.get(requestKey);
    const pending = this.request(action, data);
    if (readOnly) this.reads.set(requestKey, pending);
    try { return await pending; }
    finally { if (readOnly) this.reads.delete(requestKey); }
  },
  async request(action, data = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("COLE_")) {
      return { ok: false, offline: true, error: "API não configurada" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, token: localStorage.ml_token || "", ...data }),
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) return {ok:false, offline:response.status >= 500 || response.status === 429, error:'Servidor indisponível. Tente novamente.'};
      try { return JSON.parse(text); }
      catch { return { ok:false, offline:true, error:"Resposta inválida da API" }; }
    } catch (error) {
      return { ok:false, offline:true, error:error.name === "AbortError" ? "Tempo limite da API excedido" : error.message };
    } finally { clearTimeout(timer); }
  }
};
