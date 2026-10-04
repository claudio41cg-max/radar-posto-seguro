(()=>{
'use strict';
const TURBO='https://turbo-engine-production.up.railway.app';
const TOKEN_KEY='radar.turboToken.v1';
const SHARED_TOKEN_KEY='meuIngles.turboToken.v1';
const SESSION_KEY='radar.gptSession.v1';
let loginPromise=null;

function migrateLegacyAuth(){
  try{
    const legacy=
      localStorage.getItem(TOKEN_KEY)||
      localStorage.getItem(SHARED_TOKEN_KEY)||
      '';

    if(legacy&&!sessionStorage.getItem(TOKEN_KEY)){
      sessionStorage.setItem(TOKEN_KEY,legacy);
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SHARED_TOKEN_KEY);
  }catch(_){}
}

migrateLegacyAuth();

function injectLogin(){
  if(document.getElementById('radarTurboLogin'))return;
  const style=document.createElement('style');
  style.textContent=`
  .radarTurboLogin{position:fixed;inset:0;z-index:999999;display:none;place-items:center;padding:18px;background:rgba(3,8,15,.82);backdrop-filter:blur(9px)}
  .radarTurboLogin.open{display:grid}
  .radarTurboCard{width:min(100%,390px);border:1px solid rgba(120,180,255,.28);background:#0b1728;color:#eef6ff;border-radius:20px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
  .radarTurboCard h3{margin:0 0 6px}.radarTurboCard p{margin:0 0 14px;color:#9fb2ca;font-size:13px;line-height:1.45}
  .radarTurboCard input{box-sizing:border-box;width:100%;margin:0 0 9px;border:1px solid #29415f;background:#07111e;color:white;border-radius:12px;padding:12px 13px;font:inherit}
  .radarTurboActions{display:flex;gap:8px;justify-content:flex-end;margin-top:7px}
  .radarTurboActions button{border:1px solid #29415f;border-radius:11px;padding:10px 13px;font-weight:800}
  .radarTurboCancel{background:#101d2f;color:#e7f1ff}.radarTurboEnter{background:#2586d4;color:white}
  .radarTurboError{min-height:18px;margin-top:7px;color:#ff8698;font-size:12px}
  `;
  document.head.appendChild(style);
  const wrap=document.createElement('div');
  wrap.id='radarTurboLogin';
  wrap.className='radarTurboLogin';
  wrap.innerHTML=`
    <div class="radarTurboCard">
      <h3>Entrar no GPT do Radar</h3>
      <p>Use o mesmo acesso do Cláudio Turbo Agent. A senha não fica salva no Radar.</p>
      <input id="radarTurboUser" autocomplete="username" value="claudio" placeholder="Usuário">
      <input id="radarTurboPass" type="password" autocomplete="current-password" placeholder="Senha do Turbo">
      <div id="radarTurboError" class="radarTurboError"></div>
      <div class="radarTurboActions">
        <button type="button" class="radarTurboCancel" id="radarTurboCancel">Cancelar</button>
        <button type="button" class="radarTurboEnter" id="radarTurboEnter">Entrar</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

function login(){
  if(loginPromise)return loginPromise;
  injectLogin();
  const wrap=document.getElementById('radarTurboLogin');
  const user=document.getElementById('radarTurboUser');
  const pass=document.getElementById('radarTurboPass');
  const error=document.getElementById('radarTurboError');
  const enter=document.getElementById('radarTurboEnter');
  const cancel=document.getElementById('radarTurboCancel');
  wrap.classList.add('open'); error.textContent=''; setTimeout(()=>pass.focus(),50);
  loginPromise=new Promise((resolve,reject)=>{
    const cleanup=()=>{enter.onclick=null;cancel.onclick=null;pass.onkeydown=null;wrap.classList.remove('open');loginPromise=null};
    const submit=async()=>{
      error.textContent=''; enter.disabled=true; enter.textContent='Entrando...';
      try{
        const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
        const r=await fetch(TURBO+'/__turbo/panel-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:user.value.trim(),password:pass.value}),signal:controller.signal}).finally(()=>clearTimeout(timer));
        const d=await r.json().catch(()=>({}));
        if(!r.ok||!d.ok||!d.token)throw new Error(d.error||'Não foi possível entrar.');
        sessionStorage.setItem(TOKEN_KEY,d.token);
        try{
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(SHARED_TOKEN_KEY);
        }catch(_){}
        pass.value=''; cleanup(); resolve(d.token);
      }catch(e){error.textContent=e?.message||String(e)}
      finally{enter.disabled=false;enter.textContent='Entrar'}
    };
    enter.onclick=submit;
    cancel.onclick=()=>{cleanup();reject(new Error('Login cancelado.'))};
    pass.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};
  });
  return loginPromise;
}

async function token(){
  return sessionStorage.getItem(TOKEN_KEY)||login();
}

async function ask(message,retry=true){
  const auth=await token();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  const r=await fetch(TURBO+'/__turbo/chat',{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+auth},
    body:JSON.stringify({
      sessionId:sessionStorage.getItem(SESSION_KEY)||null,
      project:{key:'radar-seguro',name:'Radar Seguro RJ PRO',repo:'claudio41cg-max/radar-posto-seguro'},
      message:String(message||'')
    }),
    signal:controller.signal
  }).finally(()=>clearTimeout(timer));
  const d=await r.json().catch(()=>({}));
  if(r.status===401&&retry){
    sessionStorage.removeItem(TOKEN_KEY);
    try{
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SHARED_TOKEN_KEY);
    }catch(_){}
    return ask(message,false);
  }
  if(!r.ok||!d.ok)throw new Error(d.error||'GPT indisponível.');
  if(d.sessionId)sessionStorage.setItem(SESSION_KEY,d.sessionId);
  return String(d.reply||'').trim();
}

window.radarTurboAuth=token;
window.radarTurboBase=TURBO;
window.radarGptAsk=ask;
window.radarGptLogout=()=>{
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  try{
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SHARED_TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  }catch(_){}
};
})();