const SUPABASE_URL='https://qjdvrqlcblkynheitkuk.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_WtViyZbjpmkjxjP5MFB3mw_-qCQwEXf';
const OWNER='emrys.ia2026@gmail.com';
let client,sessionListener,authVersion=0,loggingIn=false,ready;
const CONNECTION_ERROR='A conexão demorou mais que o esperado. Verifique a internet e tente entrar novamente.';
function bounded(promise,ms=20000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(CONNECTION_ERROR)),ms);})]).finally(()=>clearTimeout(timer));}
async function timedFetch(input,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
  try{return await fetch(input,{...options,signal});}finally{clearTimeout(timer);}
}
export async function init(onSession){
  sessionListener=onSession;
  ready=(async()=>{
    const {createClient}=await bounded(import('https://esm.sh/@supabase/supabase-js@2.95.0'));
    // sessionStorage belongs to one tab: use a matching lock/broadcast namespace.
    let tabId=sessionStorage.getItem('vello-internal-tab');
    if(!tabId){tabId=crypto.randomUUID();sessionStorage.setItem('vello-internal-tab',tabId);}
    const storageKey='vello-internal-auth-'+tabId,legacy=sessionStorage.getItem('vello-leads-auth');
    if(legacy&&!sessionStorage.getItem(storageKey)){sessionStorage.setItem(storageKey,legacy);sessionStorage.removeItem('vello-leads-auth');}
    client=createClient(SUPABASE_URL,PUBLISHABLE_KEY,{global:{fetch:timedFetch},auth:{storage:sessionStorage,storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    client.auth.onAuthStateChange((event,session)=>{
      if(loggingIn||!['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED'].includes(event))return;
      // A microtask can run before Supabase releases its auth lock. Defer a full task.
      setTimeout(()=>{if(!loggingIn)verifySession(session).catch(()=>{});},0);
    });
  })();
  return ready;
}
async function verifySession(session){
  const version=++authVersion;
  if(!session){sessionListener(null);return;}
  try{
    const user=await bounded((async()=>{
      const {data,error}=await client.auth.getUser(session.access_token);
      if(error)throw new Error('Não foi possível validar sua sessão. Tente entrar novamente.');
      if(!data.user?.email_confirmed_at||data.user.email?.toLowerCase()!==OWNER)throw new Error('Este e-mail não tem acesso à área interna.');
      const {data:admin,error:accessError}=await client.from('vello_lead_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
      if(accessError)throw new Error('Não foi possível verificar seu acesso. Tente novamente.');
      if(!admin)throw new Error('Acesso não autorizado. Fale com o responsável pela VELLO.');
      return {email:data.user.email};
    })());
    if(version===authVersion)sessionListener(user);
  }catch(error){if(version===authVersion){++authVersion;sessionListener(null,error.message);}throw error;}
}
export async function login(email,password){
  loggingIn=true;++authVersion;
  try{
    await ready;
    const {data,error}=await bounded(client.auth.signInWithPassword({email,password}));
    if(error)throw new Error(error.status===400?'E-mail ou senha inválidos. Confira seus dados e tente novamente.':'Não foi possível entrar agora. Verifique a conexão e tente novamente.');
    if(!data.session)throw new Error('Não foi possível iniciar a sessão. Tente novamente.');
    await verifySession(data.session);
  }catch(error){++authVersion;sessionListener(null,error.message);throw error;}
  finally{loggingIn=false;}
}
export async function logout(){++authVersion;sessionListener(null);await bounded(client.auth.signOut({scope:'local'}));}
export async function listLeads(){
  const all=[];for(let offset=0;;offset+=500){const {data,error}=await client.from('vello_diagnosticos').select('*').order('created_at',{ascending:false}).range(offset,offset+499);if(error)throw new Error('Não foi possível carregar os leads. Atualize ou entre novamente.');all.push(...data);if(data.length<500)break;}return all;
}
export async function getHistory(id){const {data,error}=await client.from('vello_lead_historico').select('id,tipo,descricao,created_at').eq('lead_id',id).order('created_at',{ascending:false}).limit(100);if(error)throw new Error('Não foi possível carregar o histórico.');return data;}
export async function updateLead(id,changes,expectedUpdated){const {data,error}=await client.from('vello_diagnosticos').update(changes).eq('id',id).eq('updated_at',expectedUpdated).select();if(error)throw new Error('Não foi possível salvar. Seus dados continuam no formulário.');if(!data.length)throw new Error('Este lead foi alterado em outra sessão. Atualize a lista antes de salvar.');return data[0];}

export async function siteReport(days){const {data,error}=await client.rpc('vello_site_report',{p_days:days});if(error)throw new Error('Não foi possível carregar as visitas. Tente atualizar novamente.');return data;}
