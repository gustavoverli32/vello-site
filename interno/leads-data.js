const SUPABASE_URL='https://qjdvrqlcblkynheitkuk.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_WtViyZbjpmkjxjP5MFB3mw_-qCQwEXf';
const OWNER='emrys.ia2026@gmail.com';
let client,sessionListener,authVersion=0;
export async function init(onSession){
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
  client=createClient(SUPABASE_URL,PUBLISHABLE_KEY,{auth:{storage:sessionStorage,storageKey:'vello-leads-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  sessionListener=onSession;
  client.auth.onAuthStateChange((event,session)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event)){queueMicrotask(()=>verifySession(session));}});
}
async function verifySession(session){
  const version=++authVersion;
  if(!session){sessionListener(null);return;}
  const {data,error}=await client.auth.getUser();
  if(version!==authVersion)return;
  if(error||!data.user?.email_confirmed_at||data.user.email.toLowerCase()!==OWNER){await client.auth.signOut({scope:'local'});sessionListener(null,'Este e-mail não tem acesso à área de leads.');return;}
  const {data:admin,error:accessError}=await client.from('vello_lead_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
  if(version!==authVersion)return;
  if(accessError||!admin){await client.auth.signOut({scope:'local'});sessionListener(null,'Acesso não autorizado. Fale com o responsável pela VELLO.');return;}
  sessionListener({email:data.user.email});
}
export async function login(email,password){const {error}=await client.auth.signInWithPassword({email,password});if(error)throw new Error("E-mail ou senha inválidos. Confira seus dados e tente novamente.");}
export async function logout(){++authVersion;await client.auth.signOut({scope:'local'});sessionListener(null);}
export async function listLeads(){
  const all=[];for(let offset=0;;offset+=500){const {data,error}=await client.from('vello_diagnosticos').select('*').order('created_at',{ascending:false}).range(offset,offset+499);if(error)throw new Error('Não foi possível carregar os leads. Atualize ou entre novamente.');all.push(...data);if(data.length<500)break;}return all;
}
export async function getHistory(id){const {data,error}=await client.from('vello_lead_historico').select('id,tipo,descricao,created_at').eq('lead_id',id).order('created_at',{ascending:false}).limit(100);if(error)throw new Error('Não foi possível carregar o histórico.');return data;}
export async function updateLead(id,changes,expectedUpdated){const {data,error}=await client.from('vello_diagnosticos').update(changes).eq('id',id).eq('updated_at',expectedUpdated).select();if(error)throw new Error('Não foi possível salvar. Seus dados continuam no formulário.');if(!data.length)throw new Error('Este lead foi alterado em outra sessão. Atualize a lista antes de salvar.');return data[0];}

export async function siteReport(days){const {data,error}=await client.rpc('vello_site_report',{p_days:days});if(error)throw new Error('Não foi possível carregar as visitas. Tente atualizar novamente.');return data;}
