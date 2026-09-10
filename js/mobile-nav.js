/* MetaLife — navegação mobile limpa (2026-09-10) */
(()=>{
  const PRIMARY = new Set(["Meu Dia","Evolução","Pessoas","Chats"]);
  let syncing = false;

  function navRoot(){ return document.getElementById("mainNav"); }
  function currentLabel(){ return (document.getElementById("pageTitle")?.textContent || "Meu Dia").trim(); }

  function setActive(button, active){
    if(!button) return;
    button.classList.toggle("active", !!active);
    if(active) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  }

  function closeMore(nav){
    const more = nav?.querySelector(":scope > .nav-more");
    const groups = nav?.querySelector("#navGroups");
    if(more){ more.setAttribute("aria-expanded","false"); }
    groups?.classList.remove("is-open");
  }

  function go(page){
    const nav = navRoot();
    closeMore(nav);
    if(typeof window.show === "function") window.show(page);
  }

  function ensureEvolution(nav){
    let old = nav.querySelector(":scope > [data-v13-nav]");
    if(old?.dataset.mobileNavEnhanced === "1") return old;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-button mobile-primary-link";
    button.dataset.v13Nav = "1";
    button.dataset.mobileNavEnhanced = "1";
    button.setAttribute("aria-label","Evolução");
    button.innerHTML = '<span aria-hidden="true">✦</span><span class="mobile-nav-label">Evolução</span>';
    button.addEventListener("click",()=>{
      closeMore(navRoot());
      const title = document.getElementById("pageTitle");
      if(title) title.textContent = "Evolução";
      navRoot()?.querySelectorAll(".nav-button.active").forEach(x=>x.classList.remove("active"));
      setActive(button,true);
      window.MetaLifeV13?.render?.();
      requestAnimationFrame(sync);
    });

    if(old) old.replaceWith(button);
    else {
      const progress = nav.querySelector(":scope > .nav-progress");
      nav.insertBefore(button, progress || nav.children[1] || null);
    }
    return button;
  }

  function ensurePrimary(nav,page,icon){
    let button = nav.querySelector(`:scope > [data-mobile-primary="${page}"]`);
    if(button) return button;
    button = document.createElement("button");
    button.type = "button";
    button.className = "nav-button mobile-primary-link";
    button.dataset.mobilePrimary = page;
    button.dataset.navPage = page;
    button.setAttribute("aria-label",page);
    button.innerHTML = `<span aria-hidden="true">${icon}</span><span class="mobile-nav-label">${page}</span>`;
    button.addEventListener("click",()=>go(page));
    nav.insertBefore(button, nav.querySelector(":scope > .nav-more") || nav.querySelector("#navGroups") || null);
    return button;
  }

  function ensureProgressInsideMore(nav){
    const groups = nav.querySelector("#navGroups");
    if(!groups || groups.querySelector(".nav-mobile-progress-group")) return;
    const section = document.createElement("section");
    section.className = "nav-group nav-mobile-progress-group";
    section.setAttribute("aria-label","Progresso");
    section.innerHTML = '<h2 class="nav-group-label">Progresso</h2><button type="button" class="nav-button" data-nav-page="Meu Progresso"><span aria-hidden="true">◫</span>Meu Progresso</button>';
    section.querySelector("button")?.addEventListener("click",()=>go("Meu Progresso"));
    const account = groups.querySelector(".nav-mobile-account");
    groups.insertBefore(section, account || groups.firstChild);
  }

  function syncActive(nav){
    const page = currentLabel();
    setActive(nav.querySelector(":scope > .nav-home .nav-button"), page === "Meu Dia");
    setActive(nav.querySelector(":scope > [data-v13-nav]"), page === "Evolução");
    setActive(nav.querySelector(':scope > [data-mobile-primary="Pessoas"]'), page === "Pessoas");
    setActive(nav.querySelector(':scope > [data-mobile-primary="Chats"]'), page === "Chats");
    setActive(nav.querySelector(":scope > .nav-more"), !PRIMARY.has(page));

    const progress = nav.querySelector('.nav-mobile-progress-group [data-nav-page="Meu Progresso"]');
    setActive(progress, page === "Meu Progresso");
  }

  function sync(){
    if(syncing) return;
    const nav = navRoot();
    if(!nav) return;
    syncing = true;
    try{
      ensureEvolution(nav);
      ensurePrimary(nav,"Pessoas","👥");
      ensurePrimary(nav,"Chats","💬");
      ensureProgressInsideMore(nav);
      syncActive(nav);
      if(typeof window.mlUpdateChatUnreadBadge === "function"){
        window.mlUpdateChatUnreadBadge(Number(document.documentElement.dataset.chatUnread || 0));
      }
    } finally {
      syncing = false;
    }
  }

  function watch(){
    const nav = navRoot();
    if(!nav){ setTimeout(watch,50); return; }
    sync();
    const observer = new MutationObserver(()=>queueMicrotask(sync));
    observer.observe(nav,{childList:true,subtree:true});
    document.getElementById("pageTitle") && new MutationObserver(sync).observe(document.getElementById("pageTitle"),{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",watch,{once:true});
  else watch();
})();
