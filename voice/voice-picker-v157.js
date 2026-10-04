/* Radar Seguro RJ PRO — seletor de voz v157 */
(()=>{'use strict';

if(window.RadarVoicePickerV157)return;

const picker={
  storageKey:'radarVoiceURI',
  voices(){
    return (window.speechSynthesis?.getVoices?.()||[]).filter(v=>/^pt(?:-|_)/i.test(v.lang||''));
  },
  selected(){
    const uri=localStorage.getItem(this.storageKey)||'';
    return this.voices().find(v=>v.voiceURI===uri)||this.voices().find(v=>/pt-BR/i.test(v.lang||''))||null;
  },
  choose(uri){ localStorage.setItem(this.storageKey,String(uri||'')); },
  sample(uri){
    const v=this.voices().find(x=>x.voiceURI===uri)||this.selected();
    if(!v) return false;
    const u=new SpeechSynthesisUtterance('Olá. Esta é uma opção de voz do Radar Seguro.');
    u.lang='pt-BR'; u.voice=v;
    speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
  },
  init(){
    if(!window.speechSynthesis) return;
    const apply=()=>{
      const original=window.SpeechSynthesisUtterance;
      if(!original || original.__radarVoiceWrapped) return;
      const picker=this;
      function Wrapped(text){ const u=new original(text); const v=picker.selected(); if(v) u.voice=v; return u; }
      Wrapped.prototype=original.prototype;
      Wrapped.__radarVoiceWrapped=true;
      try{ window.SpeechSynthesisUtterance=Wrapped; }catch(e){}
    };
    speechSynthesis.getVoices();
    if('onvoiceschanged' in speechSynthesis) speechSynthesis.addEventListener('voiceschanged',apply,{once:true});
    apply();
  }
};

window.RadarVoicePickerV157=picker;

})();