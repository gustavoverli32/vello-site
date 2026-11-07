// First-party navigation metrics. No form contents, full URLs, fingerprints or identities.
const endpoint='https://qjdvrqlcblkynheitkuk.supabase.co/functions/v1/vello-analytics';
const consentKey='vello_cookie_consent',sessionKey='vello_site_session';
const allowed=['/','/solucoes.html','/segmentos.html','/plataforma.html','/sobre.html','/contato.html','/politica-de-privacidade.html'];
const path=location.pathname==='/index.html'?'/':location.pathname;
let view=null,timer=null,lastTick=performance.now(),wasVisible=!document.hidden;
function permitted(){try{return localStorage.getItem(consentKey)==='accepted'&&!navigator.globalPrivacyControl&&navigator.doNotTrack!=='1';}catch{return false;}}
function source(){const utm=new URLSearchParams(location.search).get('utm_source')?.toLowerCase()||'';let host='';try{host=new URL(document.referrer).hostname.toLowerCase();}catch{}const text=utm+' '+host;if(/instagram/.test(text))return 'Instagram';if(/facebook|^fb |^meta /.test(text))return 'Facebook';if(/linkedin/.test(text))return 'LinkedIn';if(/google/.test(text))return 'Google';if(/bing/.test(text))return 'Bing';return !host||host===location.hostname?'Direto':'Outros';}
function session(){let s;try{s=JSON.parse(sessionStorage.getItem(sessionKey)||'null');}catch{}if(!s||Date.now()-s.last>1800000||!s.id)s={id:crypto.randomUUID(),last:Date.now(),source:source(),device:innerWidth<768?'Celular':innerWidth<1024?'Tablet':'Computador'};s.last=Date.now();sessionStorage.setItem(sessionKey,JSON.stringify(s));return s;}
function accrue(){const now=performance.now();if(view&&wasVisible)view.ms=Math.min(86400000,view.ms+Math.min(30000,Math.max(0,now-lastTick)));lastTick=now;wasVisible=!document.hidden;}
function pulse(final=false){
 if(!view||!permitted()){stop();return;}accrue();
 const s=session();if(s.id!==view.session){view={id:crypto.randomUUID(),session:s.id,source:s.source,device:s.device,ms:0,clicked:false,submitted:false};}
 const body=JSON.stringify({id:view.id,session:view.session,path,source:view.source,device:view.device,seconds:Math.floor(view.ms/1000),clicked:view.clicked,submitted:view.submitted,visible:!document.hidden,consent:true});
 if(final&&navigator.sendBeacon?.(endpoint,new Blob([body],{type:'text/plain'})))return;
 fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body,keepalive:true,credentials:'omit',referrerPolicy:'no-referrer'}).catch(()=>{});
}
function start(){if(view||!allowed.includes(path)||!permitted())return;try{const s=session();view={id:crypto.randomUUID(),session:s.id,source:s.source,device:s.device,ms:0,clicked:false,submitted:false};lastTick=performance.now();wasVisible=!document.hidden;pulse();timer=setInterval(()=>{if(!document.hidden)pulse();},15000);}catch{stop();}}
function stop(){clearInterval(timer);timer=null;view=null;try{sessionStorage.removeItem(sessionKey);}catch{}}
function banner(){
 if(document.querySelector('.cookie-banner'))return;
 const el=document.createElement('div');el.className='cookie-banner';el.setAttribute('role','region');el.setAttribute('aria-label','Preferências de privacidade');
 el.innerHTML='<p><strong>Sua privacidade.</strong> Com sua permissão, medimos páginas visitadas e tempo de navegação para melhorar o site, sem gravar o conteúdo dos formulários. <a href="/politica-de-privacidade.html">Saiba mais</a>.</p><div class="cookie-actions"><button class="btn btn-primary" data-consent="accepted">Aceitar análise</button><button class="btn btn-secondary" data-consent="essential_only">Apenas essenciais</button></div>';
 el.addEventListener('click',e=>{const b=e.target.closest('[data-consent]');if(!b)return;try{localStorage.setItem(consentKey,b.dataset.consent);}catch{}el.remove();if(b.dataset.consent==='accepted')start();else stop();});document.body.append(el);
}
if(allowed.includes(path)){
 const footer=document.querySelector('.footer-bottom')||document.querySelector('footer');if(footer){const b=document.createElement('button');b.className='privacy-settings';b.type='button';b.textContent='Preferências de privacidade';b.addEventListener('click',banner);footer.append(b);}
 let chosen;try{chosen=localStorage.getItem(consentKey);}catch{}if(!chosen)banner();start();
 document.addEventListener('visibilitychange',()=>{if(view)pulse(true);else if(!document.hidden)start();});
 window.addEventListener('pagehide',()=>pulse(true));window.addEventListener('pageshow',()=>start());
 window.addEventListener('storage',e=>{if(e.key===consentKey){if(permitted())start();else stop();}});
 document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||!view)return;try{const url=new URL(a.href);if(url.origin===location.origin&&url.pathname==='/contato.html'){view.clicked=true;pulse(true);}}catch{}});
 window.addEventListener('vello:conversion',()=>{if(view&&permitted()){view.submitted=true;pulse();}});
}
