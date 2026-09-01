const TOMTOM_HOST='https://api.tomtom.com';

const ALLOWED_PREFIXES=[
  '/routing/',
  '/search/',
  '/traffic/'
];

function isAllowedPath(pathname){
  return ALLOWED_PREFIXES.some(prefix=>pathname.startsWith(prefix));
}

function copyResponseHeaders(source,origin){
  const headers=new Headers();
  const contentType=source.headers.get('content-type');
  const cacheControl=source.headers.get('cache-control');

  if(contentType) headers.set('Content-Type',contentType);
  if(cacheControl) headers.set('Cache-Control',cacheControl);
  else headers.set('Cache-Control','no-store');

  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('Vary','Origin');
  if(origin) headers.set('Access-Control-Allow-Origin',origin);

  return headers;
}

export async function handleTomTomProxy(request,env,origin){
  if(!env.TOMTOM_API_KEY){
    return new Response(
      JSON.stringify({ok:false,error:'TomTom ainda não configurada no servidor.'}),
      {
        status:503,
        headers:{
          'Content-Type':'application/json; charset=utf-8',
          'Cache-Control':'no-store',
          'Access-Control-Allow-Origin':origin,
          'Vary':'Origin'
        }
      }
    );
  }

  if(request.method!=='GET'){
    return new Response(
      JSON.stringify({ok:false,error:'Método não permitido.'}),
      {
        status:405,
        headers:{
          'Content-Type':'application/json; charset=utf-8',
          'Cache-Control':'no-store',
          'Access-Control-Allow-Origin':origin,
          'Vary':'Origin'
        }
      }
    );
  }

  const incoming=new URL(request.url);
  // URLSearchParams.get() já devolve o valor decodificado. Não decodificar uma segunda vez.
  const targetPath=incoming.searchParams.get('path')||'';

  if(!targetPath.startsWith('/') || !isAllowedPath(targetPath)){
    return new Response(
      JSON.stringify({ok:false,error:'Serviço TomTom não autorizado.'}),
      {
        status:403,
        headers:{
          'Content-Type':'application/json; charset=utf-8',
          'Cache-Control':'no-store',
          'Access-Control-Allow-Origin':origin,
          'Vary':'Origin'
        }
      }
    );
  }

  let target;
  try{
    target=new URL(TOMTOM_HOST+targetPath);
  }catch(error){
    return new Response(
      JSON.stringify({ok:false,error:'Caminho TomTom inválido.'}),
      {
        status:400,
        headers:{
          'Content-Type':'application/json; charset=utf-8',
          'Cache-Control':'no-store',
          'Access-Control-Allow-Origin':origin,
          'Vary':'Origin'
        }
      }
    );
  }

  // A chave nunca é aceita do navegador; qualquer key existente é removida
  // e substituída exclusivamente pelo segredo configurado no Worker.
  target.searchParams.delete('key');
  target.searchParams.set('key',env.TOMTOM_API_KEY);

  const response=await fetch(target.toString(),{
    method:'GET',
    headers:{
      'Accept':request.headers.get('Accept')||'*/*',
      'User-Agent':'Radar-Seguro-RJ-Pro/1.0'
    },
    cf:{cacheEverything:false}
  });

  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers:copyResponseHeaders(response,origin)
  });
}
