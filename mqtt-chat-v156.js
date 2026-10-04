/* Radar Seguro RJ PRO — chat MQTT v156 */
(()=>{'use strict';

if(window.RadarMqttChatV156)return;

const CHAT_TOPIC='radarseguro-rj-pro/chat/v1';
const ALERT_TOPIC='radarseguro-rj-pro/alerts/v1';
const BROKER='wss://broker.emqx.io:8084/mqtt';

function start(app,Utils){
  try{
    app.mqttClient=mqtt.connect(BROKER,{
      clientId:'rsrj-'+Math.random().toString(16).slice(2,10),
      clean:true
    });

    app.mqttClient.on('connect',()=>{
      app.mqttClient.subscribe(CHAT_TOPIC);
      app.mqttClient.subscribe(ALERT_TOPIC);
      const status=document.getElementById('chatStatus');
      if(status)status.textContent='🟢 Chat conectado';
    });

    app.mqttClient.on('message',(topic,payload)=>{
      try{
        const data=JSON.parse(payload.toString());

        if(topic.includes('/chat/')){
          app.chatMessages.push(data);
          if(app.chatMessages.length>50)app.chatMessages.shift();
          render(app,Utils);
        }else if(topic.includes('/alerts/')&&data.label){
          app.toast('⚠ '+data.label,4000);
        }
      }catch(_){}
    });

    app.mqttClient.on('error',()=>{
      const status=document.getElementById('chatStatus');
      if(status)status.textContent='🔴 Chat temporariamente indisponível';
    });

    return true;
  }catch(_){
    return false;
  }
}

function sendReport(app,type,label){
  if(!app.userPos){
    app.toast('Aguardando GPS.');
    return false;
  }

  const msg={
    type,
    label,
    lat:app.userPos[1],
    lng:app.userPos[0],
    time:Date.now()
  };

  if(app.mqttClient?.connected){
    app.mqttClient.publish(ALERT_TOPIC,JSON.stringify(msg));
  }

  app.toast(label+' registrado.');

  document
    .getElementById('reportLiveModal')
    ?.classList.remove('show');

  return true;
}

function sendChat(app){
  const input=document.getElementById('chatInput');
  const text=String(input?.value||'').trim();

  if(!text)return false;

  if(!app.mqttClient?.connected){
    app.toast('Chat desconectado.');
    return false;
  }

  const msg={
    user:'Motorista',
    text,
    time:new Date().toLocaleTimeString('pt-BR',{
      hour:'2-digit',
      minute:'2-digit'
    })
  };

  app.mqttClient.publish(CHAT_TOPIC,JSON.stringify(msg));
  input.value='';
  return true;
}

function render(app,Utils){
  const box=document.getElementById('chatMessages');
  if(!box)return false;

  box.innerHTML='';

  app.chatMessages
    .slice(-50)
    .forEach(msg=>{
      const d=document.createElement('div');
      d.className='chat-msg';
      d.innerHTML=
        '<span class="user">'+Utils.sanitize(msg.user)+'</span>'+
        '<span class="time">'+Utils.sanitize(msg.time)+'</span><br>'+
        Utils.sanitize(msg.text);
      box.appendChild(d);
    });

  box.scrollTop=box.scrollHeight;
  return true;
}

window.RadarMqttChatV156=Object.freeze({
  start,
  sendReport,
  sendChat,
  render,
  version:'156'
});

})();