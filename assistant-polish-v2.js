/* Radar Seguro RJ PRO — correção visual segura do assistente v4 */
(() => {
  'use strict';
  if (window.__radarAssistantPolishV4) return;
  window.__radarAssistantPolishV4 = true;

  // O usuário já tem o microfone principal ao lado do botão IR.
  // Remove qualquer botão extra criado pelas versões anteriores.
  function removeExtraButton(){
    document.getElementById('mainHandsFreeBtn')?.remove();
  }

  function stabilizeHandsFreeVisual(){
    const nav=document.getElementById('navAssistantMicBtn');
    if(!nav)return;

    // O estado vermelho "Ouvindo" piscando era apenas o ciclo interno
    // do reconhecimento do navegador. Mantemos o botão visualmente estável.
    nav.classList.remove('listening');
    const text=String(nav.textContent||'');
    if(/ouvindo/i.test(text)) nav.textContent='🎙️ Radar';
  }

  removeExtraButton();
  stabilizeHandsFreeVisual();

  // Mantém o visual estável mesmo quando o código antigo tenta alterná-lo.
  const observer=new MutationObserver(()=>{
    removeExtraButton();
    stabilizeHandsFreeVisual();
  });
  observer.observe(document.documentElement,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class']
  });

  // Reduz reinícios excessivamente rápidos do Web Speech no Android.
  // Isso diminui o som de abertura/fechamento do microfone sem mexer na navegação.
  try{
    const Proto=(window.SpeechRecognition||window.webkitSpeechRecognition)?.prototype;
    if(Proto && !Proto.__radarStartGuardV4){
      Proto.__radarStartGuardV4=true;
      const originalStart=Proto.start;
      let lastStart=0;
      Proto.start=function(...args){
        const now=Date.now();
        if(now-lastStart<1800)return;
        lastStart=now;
        try{this.continuous=true;}catch(_){}
        return originalStart.apply(this,args);
      };
    }
  }catch(_){}
})();
