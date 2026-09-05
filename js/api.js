window.API = {
  async call(action, data = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("COLE_")) {
      return { ok: false, offline: true, error: "API não configurada" };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, token: localStorage.ml_token || "", ...data }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await response.text();
      try { return JSON.parse(text); }
      catch { return { ok:false, error:"Resposta inválida da API", raw:text.slice(0,300) }; }
    } catch (error) {
      return { ok:false, offline:true, error:error.name === "AbortError" ? "Tempo limite da API excedido" : error.message };
    }
  }
};
