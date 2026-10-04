/* Radar Seguro RJ PRO — motor básico de fala v157 */
(()=>{'use strict';

if(window.RadarVoiceEngineV157)return;

function create(deps={}){
  const getAssistant=typeof deps.getAssistant==='function'
    ?deps.getAssistant
    :()=>null;

  return {
    enabled:true,
    queue:[],
    speaking:false,

    clear(){
      if('speechSynthesis' in window){
        speechSynthesis.cancel();
      }

      this.queue=[];
      this.speaking=false;
    },

    speak(text,priority=false){
      if(!this.enabled||!('speechSynthesis' in window))return;

      getAssistant()?.pauseForSpeech?.();

      if(priority)this.clear();

      if(this.queue.includes(text))return;

      this.queue.push(text);
      this.process();
    },

    process(){
      if(this.speaking||!this.queue.length)return;

      const text=this.queue.shift();
      const utterance=new SpeechSynthesisUtterance(text);

      utterance.lang='pt-BR';
      utterance.rate=1.04;
      this.speaking=true;

      utterance.onend=()=>{
        this.speaking=false;
        const noMoreSpeech=!this.queue.length;
        if(noMoreSpeech){
          getAssistant()?.onAssistantSpeechEnded?.(text);
        }
        setTimeout(()=>this.process(),120);
      };

      utterance.onerror=()=>{
        this.speaking=false;
        getAssistant()?.cancelFollowUpWindow?.();
        setTimeout(()=>this.process(),120);
      };

      speechSynthesis.speak(utterance);
    }
  };
}

window.RadarVoiceEngineV157=Object.freeze({
  create,
  version:'157'
});

})();