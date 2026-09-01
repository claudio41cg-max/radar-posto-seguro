from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Build marker
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="39-news-conversation">',s,count=1)

# Add lightweight conversation/news state near aiBusy.
marker="  aiBusy:false,\n"
insert="""  aiBusy:false,
  conversationHistory:[],
  lastNewsItems:[],
  lastNewsIndex:0,
  lastNewsUpdatedAt:0,
"""
if marker in s and 'lastNewsItems:' not in s:
    s=s.replace(marker,insert,1)

# Replace askAI body context builder with richer conversational context.
old="""            body:JSON.stringify({
              pergunta:(()=>{
                const n=this.normalize(text);
                const needsLocation=['perto','proximo','proxima','aqui','onde estou','minha localizacao','tempo','clima'].some(k=>n.includes(k));
                if(needsLocation && Array.isArray(App.userPos) && App.userPos.length>=2){
                  return text+'\\n\\nContexto do Radar: localização GPS atual latitude '+Number(App.userPos[1]).toFixed(5)+', longitude '+Number(App.userPos[0]).toFixed(5)+'. Use esse contexto apenas se for relevante.';
                }
                return text;
              })()
            }),"""
new="""            body:JSON.stringify({
              pergunta:(()=>{
                const ctx=[];
                if(Array.isArray(App.userPos) && App.userPos.length>=2){
                  ctx.push('GPS atual: latitude '+Number(App.userPos[1]).toFixed(5)+', longitude '+Number(App.userPos[0]).toFixed(5));
                }
                if(this.lastKnownAddress) ctx.push('Endereço atual confirmado: '+this.lastKnownAddress);
                if(App.navActive && App.route){
                  const totalM=Number(App.route.distance ?? App.route.summary?.lengthInMeters);
                  const progressM=Math.max(0,Number(App.routeProgressMeters||0));
                  const remainM=Number.isFinite(totalM)?Math.max(0,totalM-progressM):NaN;
                  const totalSec=Number(App.route.duration ?? App.route.summary?.travelTimeInSeconds);
                  const ratio=Number.isFinite(totalM)&&totalM>0&&Number.isFinite(remainM)?remainM/totalM:1;
                  const remainSec=Number.isFinite(totalSec)?Math.max(0,totalSec*ratio):NaN;
                  if(Number.isFinite(remainM)) ctx.push('Distância restante da rota: '+Math.round(remainM)+' metros');
                  if(Number.isFinite(remainSec)) ctx.push('Tempo restante estimado: '+Math.max(1,Math.round(remainSec/60))+' minutos');
                  const g=App.getUpcomingGuidance?.();
                  if(g?.step?.name) ctx.push('Próxima via/orientação: '+g.step.name);
                }
                const recent=(this.conversationHistory||[]).slice(-6).map(x=>x.role+': '+x.text).join(' | ');
                if(recent) ctx.push('Conversa recente: '+recent);
                ctx.push('Responda em português do Brasil, de forma natural, curta e útil para um motorista. Não invente fatos atuais nem notícias. Se a pergunta depender de notícia atual e não houver dados fornecidos, diga que precisa consultar as fontes do Radar.');
                return text+(ctx.length?'\\n\\nContexto do Radar:\\n'+ctx.join('\\n'):'');
              })()
            }),"""
if old in s:
    s=s.replace(old,new,1)

# Remember AI conversation after answer.
needle="""      this.reply(answer);

      return true;"""
repl="""      this.conversationHistory.push({role:'motorista',text});
      this.conversationHistory.push({role:'radar',text:answer});
      if(this.conversationHistory.length>12) this.conversationHistory=this.conversationHistory.slice(-12);
      this.reply(answer);

      return true;"""
if needle in s:
    s=s.replace(needle,repl,1)

# Add news helpers before speakSequence.
anchor="  speakSequence(parts,visibleText=''){"
if anchor in s and 'async fetchCurrentNews(' not in s:
    news_methods=r'''  stripNewsHtml(value){
    return String(value||'')
      .replace(/<script[\s\S]*?<\/script>/gi,' ')
      .replace(/<style[\s\S]*?<\/style>/gi,' ')
      .replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;/gi,' ')
      .replace(/&amp;/gi,'&')
      .replace(/&quot;/gi,'"')
      .replace(/&#39;/gi,"'")
      .replace(/\s+/g,' ')
      .trim();
  },

  parseRss(xmlText,source){
    try{
      const doc=new DOMParser().parseFromString(xmlText,'text/xml');
      const nodes=[...doc.querySelectorAll('item')];
      return nodes.map(item=>({
        title:this.stripNewsHtml(item.querySelector('title')?.textContent||''),
        description:this.stripNewsHtml(item.querySelector('description')?.textContent||''),
        link:String(item.querySelector('link')?.textContent||'').trim(),
        published:String(item.querySelector('pubDate')?.textContent||'').trim(),
        source
      })).filter(x=>x.title);
    }catch(e){ return []; }
  },

  async fetchFeed(url,source){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),9000);
    try{
      const r=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!r.ok) throw new Error('feed '+source);
      return this.parseRss(await r.text(),source);
    }finally{ clearTimeout(timeout); }
  },

  async fetchCurrentNews(){
    const now=Date.now();
    if(this.lastNewsItems.length && now-this.lastNewsUpdatedAt<10*60*1000) return this.lastNewsItems;

    const feeds=[
      ['https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml','Agência Brasil'],
      ['https://agenciabrasil.ebc.com.br/rss/geral/feed.xml','Agência Brasil']
    ];

    const settled=await Promise.allSettled(feeds.map(([url,source])=>this.fetchFeed(url,source)));
    let items=[];
    settled.forEach(x=>{ if(x.status==='fulfilled') items.push(...x.value); });

    const seen=new Set();
    items=items.filter(x=>{
      const k=this.normalize(x.title);
      if(!k || seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a,b)=>new Date(b.published||0)-new Date(a.published||0));

    this.lastNewsItems=items.slice(0,30);
    this.lastNewsUpdatedAt=now;
    this.lastNewsIndex=0;
    return this.lastNewsItems;
  },

  newsSummaryText(item){
    const title=String(item?.title||'').trim();
    let desc=String(item?.description||'').trim();
    if(desc.length>220) desc=desc.slice(0,217).replace(/\s+\S*$/,'')+'...';
    return desc && this.normalize(desc)!==this.normalize(title)
      ? title+'. '+desc
      : title+'.';
  },

  async reportNews(more=false,onlyRio=false){
    App.toast('Atualizando notícias...',4500);
    try{
      let items=await this.fetchCurrentNews();
      if(onlyRio){
        const rioWords=['rio de janeiro','rj','carioca','baixada fluminense','niteroi','petropolis','duque de caxias','nova iguacu'];
        const filtered=items.filter(x=>rioWords.some(w=>this.normalize((x.title||'')+' '+(x.description||'')).includes(this.normalize(w))));
        if(filtered.length) items=filtered;
      }
      if(!items.length){
        this.reply('Não consegui obter notícias atualizadas das fontes do Radar agora.');
        return;
      }

      if(!more) this.lastNewsIndex=0;
      const start=this.lastNewsIndex||0;
      const page=items.slice(start,start+4);
      if(!page.length){
        this.lastNewsIndex=0;
        this.reply('Essas foram as notícias disponíveis nesta consulta.');
        return;
      }
      this.lastNewsIndex=start+page.length;

      const stamp=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const intro=onlyRio
        ? 'Estas são algumas notícias recentes relacionadas ao Rio, consultadas às '+stamp+'.'
        : 'Estas são algumas das notícias mais recentes, consultadas às '+stamp+'.';
      const parts=[intro,...page.map((x,i)=>(i+1)+'. '+this.newsSummaryText(x))];
      if(this.lastNewsIndex<items.length) parts.push('Se quiser, diga: mais notícias.');
      else parts.push('Essas são as notícias disponíveis nesta consulta.');
      parts.push('Fonte: Agência Brasil.');
      this.speakSequence(parts);
    }catch(e){
      console.warn('Radar notícias:',e);
      this.reply('Não consegui atualizar as notícias agora. A navegação continua funcionando normalmente.');
    }
  },

'''
    s=s.replace(anchor,news_methods+anchor,1)

# Add news intents at start of handle after normalized empty guard block.
handle_marker="""    if(!normalized){

      this.reply(
        'Não consegui entender. Tente novamente.'
      );

      return;

    }
"""
news_intent="""    if(!normalized){

      this.reply(
        'Não consegui entender. Tente novamente.'
      );

      return;

    }

    const asksMoreNews=/^(?:mais|continue|continuar|proximas|próximas)\\s+(?:as\\s+)?noticias$/.test(normalized) || normalized==='mais noticias';
    if(asksMoreNews){
      await this.reportNews(true,false);
      return;
    }

    const asksNews =
      normalized.includes('noticias de hoje') ||
      normalized.includes('noticia de hoje') ||
      normalized.includes('noticias do dia') ||
      normalized.includes('noticia do dia') ||
      normalized.includes('principais noticias') ||
      normalized.includes('ultimas noticias') ||
      normalized.includes('o que aconteceu hoje') ||
      normalized.includes('me fale as noticias') ||
      normalized.includes('me diga as noticias') ||
      normalized==='noticias';

    if(asksNews){
      const onlyRio=normalized.includes('rio de janeiro') || normalized.includes('no rio') || normalized.includes('do rio');
      await this.reportNews(false,onlyRio);
      return;
    }
"""
if handle_marker in s and 'const asksNews =' not in s:
    s=s.replace(handle_marker,news_intent,1)

# Correct help text: no false hands-free claim, include news/conversation.
s=s.replace(
"Você pode pedir o clima de hoje ou amanhã, uma rota, a localização de um lugar, as ocorrências do Rio de Janeiro, repetir a orientação, consultar hora e data, mostrar ou ocultar postos e comunidades, salvar sua casa neste aparelho ou fazer perguntas gerais. Durante a navegação, toque uma vez no botão Radar para ligar o modo mãos livres e comece cada pedido dizendo Radar.",
"Você pode pedir notícias do dia, clima, rota, sua localização, tempo e distância até o destino, ocorrências do Rio de Janeiro, repetir a orientação, consultar hora e data, mostrar ou ocultar postos e comunidades, procurar lugares próximos ou fazer perguntas gerais. Toque no botão Radar, fale normalmente e eu uso o contexto recente da conversa quando isso ajudar.",1)

p.write_text(s,encoding='utf-8')
print('patch v39 aplicado')
