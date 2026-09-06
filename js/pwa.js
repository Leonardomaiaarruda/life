(() => {
  let installPrompt = null;
  let registration = null;
  let settings = null;
  let busy = false;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const capable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const cardKey = () => 'ml_install_later_' + (localStorage.ml_user_id || 'user');
  function message(text) { const target = document.getElementById('mlPwaStatus'); if (target) target.textContent = text; }
  async function register() {
    if (!('serviceWorker' in navigator) || !isSecureContext) return null;
    if (!registration) {
      await navigator.serviceWorker.register('./sw.js', {scope:'./',updateViaCache:'none'});
      registration = await navigator.serviceWorker.ready;
    }
    return registration;
  }
  function openChat() {
    if (!localStorage.ml_token) { sessionStorage.ml_open_chat = '1'; return; }
    show('Chats');
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    if (localStorage.ml_token) window.mlPwaRefresh();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; window.mlPwaRefresh(); });
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'METALIFE_OPEN_CHAT') openChat();
  });
  window.mlPwaRefresh = async function(force = false) {
    if (!localStorage.ml_token) return;
    let card = document.getElementById('mlPwaCard');
    if (!card) {
      card = document.createElement('section'); card.id = 'mlPwaCard'; card.className = 'card';
      card.style.margin = '12px 0';
      card.innerHTML = '<h3>MetaLife no seu celular</h3><p id="mlPwaStatus" role="status"></p><div class="actions"><button class="primary" id="mlInstall">Instalar MetaLife</button><button class="secondary" id="mlPush">Ativar notificações</button><button class="secondary" id="mlPushOff">Desativar notificações</button><button class="chip-btn" id="mlPwaLater">Agora não</button></div>';
      document.querySelector('.topbar').after(card);
      document.getElementById('mlInstall').onclick = async () => {
        if (installPrompt) { const pending=installPrompt; installPrompt=null; await pending.prompt(); await pending.userChoice; }
        else message(iphone() ? 'No menu Compartilhar do navegador, escolha Adicionar à Tela de Início e confirme.' : 'Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial, se disponível.');
      };
      document.getElementById('mlPush').onclick = enable;
      document.getElementById('mlPushOff').onclick = async () => {
        try { await window.mlPwaDisconnect(); message('Notificações desativadas neste aparelho.'); await refreshButtons(); }
        catch (_) { message('Não foi possível desativar. Confira sua conexão e tente novamente.'); }
      };
      document.getElementById('mlPwaLater').onclick = () => { localStorage.setItem(cardKey(),'1'); card.hidden=true; };
    }
    card.hidden = !force && localStorage.getItem(cardKey()) === '1';
    document.getElementById('mlInstall').hidden = installed();
    const token = localStorage.ml_token;
    try {
      await register();
      if (!settings) settings = await API.call('pushSettings');
      if (localStorage.ml_token !== token) return;
      if (iphone() && !installed()) message('Primeiro adicione o MetaLife à Tela de Início. Depois abra pelo ícone para ativar os avisos.');
      else if (!capable()) message('Este navegador permite usar o sistema, mas não oferece notificações em segundo plano.');
      else if (!settings?.ok || !settings.enabled) message('A instalação está disponível. As notificações aguardam a configuração do Apps Script.');
      else message('Ative para receber avisos de mensagens mesmo com o aplicativo fechado. Você pode desativar quando quiser.');
      await refreshButtons();
    } catch (_) { message('Não foi possível verificar a instalação. Tente novamente com conexão à internet.'); }
  };
  async function refreshButtons() {
    const subscription = registration ? await registration.pushManager?.getSubscription() : null;
    document.getElementById('mlPush').disabled = !settings?.enabled || !capable() || (iphone() && !installed());
    document.getElementById('mlPushOff').hidden = !subscription;
    if (subscription) document.getElementById('mlPush').textContent = 'Confirmar notificações nesta conta';
  }
  async function enable() {
    if (busy) return;
    busy = true;
    try {
      // Called directly from the user click, as required by mobile browsers.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { message('Notificações não autorizadas. Você pode alterar a permissão nas configurações do navegador.'); return; }
      const reg = await register();
      const key = Uint8Array.from(atob(settings.publicKey.replace(/-/g,'+').replace(/_/g,'/')), char => char.charCodeAt(0));
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) subscription = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:key});
      const response = await API.call('registerPush', {subscription:subscription.toJSON()});
      if (!response.ok) throw Error(response.error || 'Falha ao registrar');
      message('Notificações ativadas para esta conta neste aparelho.');
      await refreshButtons();
    } catch (_) { message('Não foi possível ativar. Confira a configuração do servidor e tente novamente.'); }
    finally { busy=false; }
  }
  window.mlPwaDisconnect = async function() {
    const reg=await register();
    const subscription=await reg?.pushManager?.getSubscription();
    if (subscription) {
      const result=await API.call('unregisterPush',{endpoint:subscription.endpoint});
      const removed=await subscription.unsubscribe();
      if (!result.ok && !removed) throw Error('Desativação incompleta');
    }
    const notifications=await reg?.getNotifications();
    notifications?.forEach(item=>item.close());
  };
  window.mlPwaAfterLogin = function() {
    const params=new URLSearchParams(location.search);
    if (params.has('chat') || sessionStorage.ml_open_chat) {
      sessionStorage.removeItem('ml_open_chat');
      params.delete('chat'); history.replaceState(null,'',location.pathname + (params.size ? '?'+params : '') + location.hash);
      openChat();
    }
    window.mlPwaRefresh();
  };
  window.mlPwaClear = function() { settings=null; document.getElementById('mlPwaCard')?.remove(); };
  document.addEventListener('DOMContentLoaded', () => {
    const button=document.createElement('button'); button.className='icon-btn'; button.type='button';
    button.textContent='⚙'; button.title='Instalação e notificações';
    button.onclick=()=>window.mlPwaRefresh(true);
    document.querySelector('.top-actions').appendChild(button);
    register().catch(()=>{});
  });
})();
