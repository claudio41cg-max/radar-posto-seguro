const fs = require('fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const before = html;

function replaceOnce(oldText, newText, label) {
  const first = html.indexOf(oldText);
  if (first < 0 || html.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`Trecho ausente ou duplicado: ${label}`);
  }
  html = html.replace(oldText, newText);
}

replaceOnce(
`  handleGPSError(error){`,
`  suspendIdleGPS(){

    /*
      ECONOMIA SEGURA:
      quando o aplicativo fica oculto e não há rota ativa,
      interrompe GPS e temporizador até o usuário voltar.
      Durante a navegação, a precisão permanece inalterada.
    */
    if(this.navActive)
      return;

    if(this.GPSWatch!=null){

      navigator.geolocation
      .clearWatch(
        this.GPSWatch
      );

      this.GPSWatch=null;

    }

    if(this.gpsContinuityTimer){

      clearInterval(
        this.gpsContinuityTimer
      );

      this.gpsContinuityTimer=null;

    }

  },


  handleGPSError(error){`,
  'suspensão econômica do GPS'
);

replaceOnce(
`  handleGPS(position){`,
`  runAdaptiveGPSTasks(force=false){

    const now=Date.now();

    const moving=
      this.currentSpeed>=3;

    /*
      Mantém as tarefas críticas da navegação em tempo real,
      mas reduz repetições de alertas, perigos e camadas quando
      o veículo está parado ou fora do modo de navegação.
    */
    const interval=
      this.navActive
      ?
      (moving ? 1200 : 4000)
      :
      (moving ? 2500 : 7000);

    if(
      !force &&
      this._lastGPSAuxAt &&
      now-this._lastGPSAuxAt<interval
    )
      return;

    this._lastGPSAuxAt=now;

    this.checkCommunityDanger();

    this.updateCommunityBillboard();

    this.updateTrafficLightHUD();

    this.renderHazards();

  },


  handleGPS(position){`,
  'tarefas adaptativas do GPS'
);

replaceOnce(
`      this.checkCommunityDanger();

      this.updateTrafficLightHUD();

      return;`,
`      this.runAdaptiveGPSTasks();

      return;`,
  'tarefas durante parada'
);

replaceOnce(
`    this.checkCommunityDanger();

    this.updateCommunityBillboard();

    this.updateTrafficLightHUD();

    this.renderHazards();

  },

  setGPSStatus(ok,text){`,
`    this.runAdaptiveGPSTasks();

  },

  setGPSStatus(ok,text){`,
  'tarefas após atualização de posição'
);

replaceOnce(
`          VoiceAssistant
          .suspendHandsFree();

        }`,
`          VoiceAssistant
          .suspendHandsFree();

          this.suspendIdleGPS();

        }`,
  'suspensão ao ocultar aplicativo'
);

const fogoLines = value => value
  .split(/\r?\n/)
  .filter(line => /fogo/i.test(line))
  .join('\n');

if (fogoLines(before) !== fogoLines(html)) {
  throw new Error('Proteção acionada: código do Fogo Cruzado seria alterado');
}

for (const required of [
  'suspendIdleGPS(){',
  'runAdaptiveGPSTasks(force=false){',
  'this.suspendIdleGPS();',
  'enableHighAccuracy:true',
  'this.runAdaptiveGPSTasks();'
]) {
  if (!html.includes(required)) {
    throw new Error(`Validação ausente: ${required}`);
  }
}

if (html === before) throw new Error('Nenhuma alteração produzida');

fs.writeFileSync(file, html);
console.log('Economia de bateria aplicada sem reduzir a precisão da navegação.');
