/* Radar Seguro RJ PRO v137 — módulo de postos extraído do index.html */
/* =========================================================
   POSTOS
========================================================= */

const FuelModule = {

  visible:false,

  filter:'none',

  stations:[],

  markers:[],

  lastCenter:null,

  loading:false,

  officialLoaded:false,

  async loadOfficial(){

    if(this.officialLoaded)
      return;

    try{

      const responses=
        await Promise.all([
          fetch(VERIFIED_FUEL_URL,{cache:'no-store'}),
          fetch(ANP_STATIONS_URL,{cache:'no-store'})
        ]);

      if(!responses[0].ok || !responses[1].ok)
        throw new Error('Base oficial indisponível');

      const items=
        await responses[0].json();

      const anpItems=
        await responses[1].json();

      VERIFIED_FUEL_INCIDENTS.splice(
        0,
        VERIFIED_FUEL_INCIDENTS.length,
        ...(Array.isArray(items)?items:[])
      );

      ANP_STATIONS.splice(
        0,
        ANP_STATIONS.length,
        ...(Array.isArray(anpItems)?anpItems:[])
      );

    }catch(e){

      console.warn(
        'Falha ao carregar ocorrências oficiais:',
        e
      );

    }finally{

      this.officialLoaded=true;

    }

  },

  normalize(value){

    return String(value||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,' ')
      .trim();

  },


  houseNumber(value){

    const match=
      String(value||'').match(/\d[\d.]*/);

    return match
      ? match[0].replace(/\D/g,'')
      : '';

  },


  anpDetails(station){

    const stationAddress=this.normalize(station.address);
    const stationName=this.normalize(station.name);
    const stationNumber=this.houseNumber(station.address);
    const ignored=new Set([
      'rua','r','avenida','av','estrada','est','rodovia',
      'de','da','do','das','dos','numero','n'
    ]);

    const tokens=
      stationAddress.split(' ')
      .filter(token=>
        token.length>2 &&
        !ignored.has(token) &&
        !/^\d+$/.test(token)
      );

    let best=null;
    let bestScore=0;

    ANP_STATIONS.forEach(item=>{

      const officialAddress=this.normalize(item.address);
      const officialName=this.normalize(item.legalName);
      const officialNumber=this.houseNumber(item.address);

      if(
        stationNumber &&
        officialNumber &&
        stationNumber!==officialNumber
      )
        return;

      const overlap=
        tokens.filter(token=>
          officialAddress.includes(token)
        ).length;

      const nameMatch=
        stationName.length>5 &&
        (
          officialName.includes(stationName) ||
          stationName.includes(officialName)
        );

      const score=
        overlap+
        (stationNumber && stationNumber===officialNumber ? 3 : 0)+
        (nameMatch ? 4 : 0);

      if(score>bestScore){

        best=item;
        bestScore=score;

      }

    });

    return bestScore>=5
      ? best
      : null;

  },


  priceHtml(details){

    const prices=
      details?.prices||{};

    const entries=
      Object.entries(prices);

    if(!entries.length)
      return '<b>Preços ANP:</b> Preço não disponível';

    return '<b>Últimos preços pesquisados pela ANP:</b><br>'+
      entries.map(([product,info])=>{

        const value=
          Number(info.value);

        const formatted=
          Number.isFinite(value)
          ? value.toLocaleString(
              'pt-BR',
              {
                style:'currency',
                currency:'BRL',
                minimumFractionDigits:2,
                maximumFractionDigits:3
              }
            )
          : info.value;

        const date=
          String(info.date||'')
          .split('-')
          .reverse()
          .join('/');

        return Utils.sanitize(product)+
          ': <b>'+Utils.sanitize(formatted)+'</b>'+
          ' <small>(coleta '+Utils.sanitize(date)+')</small>';

      }).join('<br>');

  },


  officialIncident(station){

    const name=this.normalize(station.name);
    const address=this.normalize(station.address);

    return VERIFIED_FUEL_INCIDENTS.find(item=>{

      const officialName=this.normalize(item.name);
      const officialAddress=this.normalize(item.address);

      return officialName && officialAddress &&
        name===officialName && address.includes(officialAddress);

    }) || null;

  },


  clear(){

    this.markers.forEach(
      m=>{
        try{m.remove()}catch(e){}
      }
    );

    this.markers=[];

  },


  async load(center){

    if(
      this.loading ||
      !center
    )
      return;


    if(
      this.lastCenter &&
      Utils.distanceKm(
        center,
        this.lastCenter
      )<3
    )
      return;


    this.loading=true;

    await this.loadOfficial();

    this.lastCenter=[
      center[0],
      center[1]
    ];


    try{

      const query=
`[out:json][timeout:14];
(
node["amenity"="fuel"](around:7000,${center[1]},${center[0]});
way["amenity"="fuel"](around:7000,${center[1]},${center[0]});
);
out center tags;`;


      const r=
        await fetch(
          'https://overpass-api.de/api/interpreter?data='+
          encodeURIComponent(query)
        );


      if(!r.ok)
        throw new Error('Overpass');


      const data=
        await r.json();


      this.stations=
        (data.elements||[])
        .map(el=>{

          const lat=
            el.lat ??
            el.center?.lat;

          const lng=
            el.lon ??
            el.center?.lon;


          if(
            lat==null ||
            lng==null
          )
            return null;


          const t=
            el.tags||{};


          const station={

            lat,
            lng,

            name:
              t.name ||
              t.brand ||
              'Posto de combustível',

            brand:
              t.brand ||
              'Não informada',

            gnv:
              t['fuel:cng']==='yes' ||
              t['fuel:gnv']==='yes',

            address:
              [
                t['addr:street'],
                t['addr:housenumber'],
                t['addr:suburb']
              ]
              .filter(Boolean)
              .join(', ')

          };

          station.official=this.officialIncident(station);

          return station;

        })
        .filter(Boolean);


      this.stations.forEach(station=>{

        station.anp=
          this.anpDetails(station);

        if(station.anp){

          station.brand=
            station.anp.brand ||
            station.brand;

        }

      });


      VERIFIED_FUEL_INCIDENTS
      .forEach(item=>{

        const duplicate=
          this.stations.find(station=>
            Utils.distanceKm(
              [station.lng,station.lat],
              [item.lng,item.lat]
            )<0.08
          );

        if(duplicate){

          duplicate.name=item.name;
          duplicate.address=item.address;
          duplicate.official=item;

        }else{

          this.stations.push({
            ...item,
            official:item
          });

        }

      });


      this.stations.forEach(station=>{

        if(!station.anp)
          station.anp=
            this.anpDetails(station);

      });


      this.render(App.map);

    }catch(e){

      console.warn(
        'Falha ao carregar postos:',
        e
      );

    }finally{

      this.loading=false;

    }

  },


  render(map){

    this.clear();


    if(
      !this.visible ||
      this.filter==='none'
    )
      return;


    let list=[
      ...this.stations
    ];


    if(
      this.filter==='gnv'
    ){

      list=
        list.filter(s=>s.gnv);

    }

    if(
      this.filter==='official'
    ){

      list=
        list.filter(s=>s.official);

    }


    const center=
      App.userPos ||
      map.getCenter().toArray();


    list.sort(
      (a,b)=>
        Utils.distanceKm(
          [a.lng,a.lat],
          center
        )
        -
        Utils.distanceKm(
          [b.lng,b.lat],
          center
        )
    );


    list
    .slice(0,45)
    .forEach(s=>{

      const el=
        document.createElement('div');


      el.className=
        'fuel-marker'+
        (s.gnv?' gnv':'')+
        (s.official ? ' official-'+s.official.status : '');


      el.textContent=
        s.official?'!':(s.gnv?'G':'⛽');

      const incident=s.official;
      const details=s.anp;

      const cnpj=details?.cnpj
        ? details.cnpj.replace(
            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
            '$1.$2.$3/$4-$5'
          )
        : 'Não identificado na base oficial para este ponto';

      const registryHtml=`
  <br><b>Razão social:</b> ${Utils.sanitize(details?.legalName||'Não identificada')}
  <br><b>CNPJ:</b> ${Utils.sanitize(cnpj)}
  <br><b>Bandeira:</b> ${Utils.sanitize(details?.brand||s.brand||'Não informada')}
  <br><b>Local:</b> ${Utils.sanitize(
    details
      ? [details.address,details.complement,details.district,details.zip]
          .filter(Boolean)
          .join(', ')
      : (s.address||'Endereço não informado')
  )}
  <br>${this.priceHtml(details)}
  `;

      const officialHtml=incident ? `
  <hr style="margin:10px 0;border:0;border-top:1px solid #cbd5e1">
  <b style="color:${incident.status==='current'?'#b91c1c':incident.status==='pending'?'#b45309':'#1d4ed8'}">
    ${incident.status==='current'?'Medida oficial atual':incident.status==='pending'?'Ocorrência oficial em apuração':'Ocorrência oficial no histórico'}
  </b><br>
  Tipo: ${Utils.sanitize(incident.type)}<br>
  Ação informada: ${Utils.sanitize(incident.action)}<br>
  Data: ${Utils.sanitize(incident.date)}<br>
  Órgão: ${Utils.sanitize(incident.agency)}<br>
  Situação: ${Utils.sanitize(incident.situation)}<br>
  <small>Informação pública para orientação. Não representa julgamento definitivo.</small><br>
  <a href="${Utils.sanitize(incident.source)}" target="_blank" rel="noopener noreferrer">Ver fonte oficial</a>
  ` : '';


      const html=
`
<div style="color:#0f172a;font-size:12px;line-height:1.45">
  <b style="font-size:14px">${Utils.sanitize(s.name)}</b><br>
  ${registryHtml}
  ${s.gnv ? '<br><b style="color:#15803d">Também oferece GNV</b>' : ''}
  ${officialHtml}
  <br><br>
  <a href="${ANP_APP}" target="_blank">Consultar ANP</a>
</div>
`;


      const marker=
        new maplibregl.Marker({
          element:el
        })
        .setLngLat([
          s.lng,
          s.lat
        ])
        .setPopup(
          new maplibregl.Popup({
            offset:18
          })
          .setHTML(html)
        )
        .addTo(map);


      this.markers.push(marker);

    });

  }

};
