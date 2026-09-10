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
  function openChat(room='') {
    if (!/^(club|competition):[A-Za-z0-9_-]{8,80}$/.test(room)) room='';
    if (!localStorage.ml_token) { sessionStorage.ml_open_chat = '1';if(room)sessionStorage.ml_open_room=room;return; }
    if(room)window.Community?.openRoom(room);else show('Chats');
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    if (localStorage.ml_token) window.mlPwaRefresh();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; window.mlPwaRefresh(); });
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'METALIFE_OPEN_CHAT') openChat(event.data.room);
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
      if (!settings?.ok || force) settings = await API.call('pushSettings');
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
    let stage = 'permissão';
    try {
      // Called directly from the user click, as required by mobile browsers.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { message('Notificações não autorizadas. Você pode alterar a permissão nas configurações do navegador.'); return; }
      stage = 'configuração';
      settings = await API.call('pushSettings');
      if (!settings?.ok || !settings.enabled) { message('O Apps Script não confirmou a configuração. Confira as propriedades das chaves e publique uma nova versão da implantação.'); return; }
      stage = 'inscrição no aparelho';
      const reg = await register();
      const key = Uint8Array.from(atob(settings.publicKey.replace(/-/g,'+').replace(/_/g,'/')), char => char.charCodeAt(0));
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) subscription = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:key});
      stage = 'registro da conta no servidor';
      const response = await API.call('registerPush', {subscription:subscription.toJSON()});
      if (!response?.ok) {
        const error = String(response?.error || '');
        if (/PUSH_DEVICES|Aba ausente/i.test(error)) message('Falta criar a aba de dispositivos. Execute setupPush no editor do Apps Script e tente novamente.');
        else if (/sessão|sessao|token|login/i.test(error)) message('Sua sessão não foi aceita. Saia, entre novamente e confirme as notificações.');
        else if (/Ação inválida|not defined|não configurad/i.test(error)) message('A implantação do Apps Script está incompleta ou antiga. Adicione os arquivos Push e PushCrypto e publique uma nova versão.');
        else if (/Provedor|Endereço|Inscrição/i.test(error)) message('O servidor recusou a inscrição deste navegador. Informe esse aviso e qual navegador está usando para ajustarmos a compatibilidade.');
        else if (/Limite de dez/i.test(error)) message('Sua conta atingiu o limite de aparelhos. Desative as notificações em um aparelho antigo.');
        else if (response?.offline) message('O registro no servidor não respondeu. Confira a internet e tente novamente.');
        else message('O Apps Script recusou o registro das notificações. Confira a execução mais recente no editor do Apps Script.');
        return;
      }
      stage = 'atualização dos botões';
      message('Notificações ativadas para esta conta neste aparelho.');
      await refreshButtons();
    } catch (error) {
      if (error?.name === 'NotAllowedError') message('O celular bloqueou a permissão. Confira as permissões de notificação do aplicativo nas configurações do aparelho.');
      else if (error?.name === 'InvalidCharacterError' || error?.name === 'InvalidAccessError') message('A chave pública das notificações está inválida. Confira o valor nas propriedades do Apps Script, sem aspas ou espaços.');
      else message('Não foi possível concluir a etapa: ' + stage + '. Informe esse aviso para identificarmos a falha.');
    }
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
    if (params.has('chat') || params.has('room') || sessionStorage.ml_open_chat) {
      const room=params.get('room')||sessionStorage.ml_open_room||'';
      sessionStorage.removeItem('ml_open_room');
      sessionStorage.removeItem('ml_open_chat');
      params.delete('chat');params.delete('room'); history.replaceState(null,'',location.pathname + (params.size ? '?'+params : '') + location.hash);
      openChat(room);
    }
    window.mlPwaRefresh();
  };
  window.mlPwaClear = function() { settings=null; document.getElementById('mlPwaCard')?.remove(); };
  document.addEventListener('DOMContentLoaded', () => {
    const button=document.createElement('button'); button.className='icon-btn'; button.type='button';
    button.textContent='⚙'; button.title='Instalação e notificações';
    button.onclick=()=>{
      const card=document.getElementById('mlPwaCard');
      if (card && !card.hidden) {
        card.hidden=true;
      } else {
        window.mlPwaRefresh(true);
      }
    };
    document.querySelector('.top-actions').appendChild(button);
    register().catch(()=>{});
  });
})();
