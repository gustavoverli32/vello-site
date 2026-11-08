import * as api from './leads-data.js?v=projects-20261107';
import {setAccessView} from './access-view.js?v=vello-20261107c';
import {projectPayload,initialCatalog,fileIdPattern} from './projects-model.js?v=projects-20261107';
const $=s=>document.querySelector(s),frame=$('#project-frame'),SOURCE='https://gustavoverli32.github.io';
let signed=false,state=null,port=null,pending=null,saving=false,generation=0,transfer=null,loading=false;

function feedback(text,error=false){$('#project-feedback').textContent=text;$('#project-feedback').className='feedback'+(error?' error':'');}
function sync(text,kind=''){const el=$('#project-sync-status');el.textContent=text;el.dataset.state=kind;$('#project-retry').hidden=kind!=='error'||!pending;}
async function session(user,error){
 const previous=signed;signed=!!user;setAccessView(signed);$('#login-password').value='';$('#auth-feedback').textContent=error||'';
 if(!signed){++generation;port?.close();port=null;frame.removeAttribute('src');frame.hidden=true;state=null;pending=null;loading=false;saving=false;$('#transfer-dialog').close();transfer=null;return;}
 if(!previous)await load();
}
async function load(){
 if(!signed||loading)return;if((pending||saving)&&!confirm('Há alterações ainda não salvas nesta tela. Recarregar os dados salvos e descartar essas alterações?'))return;
 loading=true;const current=++generation;pending=null;sync('Carregando projetos…');$('#project-reload').disabled=true;
 try{const result=await api.getProjectState();if(current!==generation||!signed)return;state=result;feedback('');$('#project-setup').hidden=!!state;
  if(state){state.payload=projectPayload(state.payload);mount();sync('Alterações salvas · área privada','saved');}
  else{port?.close();port=null;frame.hidden=true;frame.removeAttribute('src');sync('Pronto para receber seus projetos');}
 }catch(e){if(current===generation){feedback(e.message,true);sync('Não foi possível carregar os projetos','error');}}
 finally{loading=false;$('#project-reload').disabled=false;}
}
function mount(){port?.close();port=null;frame.hidden=false;frame.src='projects-workspace.html?v=projects-20261107';}
async function flush(){
 if(saving||!pending||!signed)return;saving=true;const current=generation;
 while(pending&&signed&&current===generation){const data=pending;pending=null;sync('Salvando alterações…','saving');
  try{const result=await api.saveProjectState(data,state?.revision??null);if(current!==generation||!signed)break;state=result;sync('Alterações salvas · área privada','saved');feedback('');}
  catch(e){if(current===generation&&signed){pending??=data;sync('Alterações ainda não salvas','error');feedback(e.message,true);}break;}
 }
 saving=false;
}
window.addEventListener('message',event=>{
 if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='vello-projects-ready'&&signed&&state){
  const channel=new MessageChannel(),current=generation;let firstView=true;port?.close();port=channel.port1;
  port.onmessage=async e=>{
   if(!signed||current!==generation)return;const msg=e.data;
   if(msg.event==='height'){const height=Number(msg.value);if(Number.isFinite(height)&&height>=0)frame.style.height=Math.min(100000,Math.max(600,height))+'px';return;}
   if(msg.event==='view'){if(!firstView)frame.scrollIntoView({block:'start',behavior:'instant'});firstView=false;return;}
   if(msg.event==='save'){try{pending=projectPayload(msg.payload);flush();}catch(error){feedback(error.message,true);}return;}
   if(!Number.isInteger(msg.id)||!['upload','download','summary'].includes(msg.method))return;
   if(msg.method==='summary'?!['h2o','solum'].includes(msg.args?.source):!fileIdPattern.test(msg.args?.id||''))return;
   const responsePort=port;
   try{const value=msg.method==='summary'?await api.getProjectSummary(msg.args.source):msg.method==='upload'?await api.uploadProjectFile(msg.args.id,msg.args.file):await api.downloadProjectFile(msg.args.id);if(signed&&current===generation)responsePort.postMessage({id:msg.id,value});}
   catch(error){if(signed&&current===generation)responsePort.postMessage({id:msg.id,error:error.message});}
  };port.start();frame.contentWindow.postMessage({type:'vello-projects-init',payload:state.payload},location.origin,[channel.port2]);
 }

});

function openTransfer(){if(!signed||loading||saving||pending){feedback('Aguarde o carregamento e salve as alterações antes da transferência.',true);return;}$('#transfer-dialog').showModal();}
function closeTransfer(){if(transfer?.busy)return;$('#transfer-dialog').close();transfer=null;}
$('#transfer-close').addEventListener('click',closeTransfer);
$('#transfer-dialog').addEventListener('cancel',e=>{e.preventDefault();closeTransfer();});
$('#project-import').addEventListener('click',()=>$('#project-import-file').click());
$('#project-import-file').addEventListener('change',async e=>{
 const selected=e.target.files[0];e.target.value='';if(!selected||!signed||saving||pending||transfer?.busy)return;
 try{
  if(selected.size>220200960)throw new Error('A cópia deve ter até 210 MB.');
  const backup=JSON.parse(await selected.text());
  if(backup.format!=='vello-project-backup-v1'||!Array.isArray(backup.files))throw new Error('Selecione uma cópia exportada pela central Vello.');
  const payload=projectPayload(backup.payload),files=new Map();
  for(const item of backup.files){
   if(!fileIdPattern.test(item.id||'')||typeof item.base64!=='string'||item.base64.length>69905068)throw new Error('Anexo inválido na cópia.');
   const raw=atob(item.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));files.set(item.id,new Blob([bytes],{type:typeof item.type==='string'?item.type:'application/octet-stream'}));
  }
  transfer={busy:false,files};$('#transfer-dialog').close();await importProjects(payload);
 }catch(error){$('#transfer-dialog').close();feedback(error.message,true);}
});
async function legacyFile(id,source){const file=source.files.get(id);if(!file)throw new Error('Anexo não encontrado na cópia.');return file;}
async function importProjects(raw){
 const source=transfer,current=generation;source.busy=true;frame.inert=true;$('#project-transfer').disabled=true;$('#project-reload').disabled=true;$('#setup-catalog').disabled=true;
 try{
  const incoming=projectPayload(raw),latest=await api.getProjectState(),existing=latest?projectPayload(latest.payload):{projects:[],deletedIds:[],deletedProjects:[]};
  const existingIds=new Set(existing.projects.map(p=>p.id)),added=incoming.projects.filter(p=>!existingIds.has(p.id)),skipped=incoming.projects.length-added.length;
  const backups=incoming.deletedProjects.filter(p=>p&&typeof p.id==='string'&&!existingIds.has(p.id));
  let missing=0,copied=0;const remapped=new Map();
  for(const p of [...added,...backups])for(const file of p.arquivos||[]){
   if(!file.local)continue;
   if(remapped.has(file.id)){Object.assign(file,remapped.get(file.id));continue;}
   const oldId=file.id,newId=crypto.randomUUID();
   let blob;
   try{blob=await legacyFile(oldId,source);}catch{file.id=newId;file.migrationMissing=true;missing++;}
   if(blob){if(!signed||current!==generation)throw new Error('A sessão foi encerrada.');await api.uploadProjectFile(newId,blob);file.id=newId;delete file.migrationMissing;copied++;}
   remapped.set(oldId,{id:file.id,migrationMissing:!!file.migrationMissing});sync(`Transferindo anexos: ${copied} salvo(s)…`,'saving');
  }
  if(!signed||current!==generation)throw new Error('A sessão foi encerrada. Entre novamente para transferir.');
  if(added.length||(!latest&&incoming.projects.length)){
   const payload=projectPayload({projects:[...existing.projects,...added],deletedIds:[...new Set([...existing.deletedIds,...incoming.deletedIds])],deletedProjects:[...existing.deletedProjects,...backups].slice(-10)});
   state=await api.saveProjectState(payload,latest?.revision??null);$('#project-setup').hidden=true;mount();
  }else state=latest;
  const message=`${added.length} projeto(s) transferido(s), ${copied} anexo(s) salvo(s).`+(skipped?` ${skipped} projeto(s) já existentes foram preservados.`:'')+(missing?` ${missing} anexo(s) não puderam ser copiados; confira-os na central antiga.`:'');
  feedback(message,missing>0);sync('Transferência concluída · área privada','saved');
 }catch(e){feedback(e.message,true);sync('Transferência não concluída','error');}
 finally{source.busy=false;frame.inert=false;$('#project-transfer').disabled=false;$('#project-reload').disabled=false;$('#setup-catalog').disabled=false;}
}
$('#setup-catalog').addEventListener('click',async()=>{if(!signed||state||loading)return;const button=$('#setup-catalog');button.disabled=true;try{state=await api.saveProjectState(initialCatalog(),null);$('#project-setup').hidden=true;mount();sync('Catálogo salvo · área privada','saved');feedback('Catálogo inicial criado. Você pode ajustar os projetos e suas etapas.');}catch(e){feedback(e.message,true);}finally{button.disabled=false;}});
$('#project-transfer').addEventListener('click',openTransfer);$('#setup-transfer').addEventListener('click',openTransfer);$('#project-reload').addEventListener('click',load);$('#project-retry').addEventListener('click',flush);
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;$('#auth-feedback').textContent='Entrando…';try{await api.login($('#login-email').value.trim().toLowerCase(),$('#login-password').value);}catch(error){$('#auth-feedback').textContent=error.message;}finally{button.disabled=false;}});
$('#logout').addEventListener('click',async()=>{if((pending||saving)&&!confirm('Há alterações ainda não salvas. Sair mesmo assim?'))return;await session(null);await api.logout();});
window.addEventListener('beforeunload',e=>{if(pending||saving||transfer?.busy){e.preventDefault();e.returnValue='';}});
api.init(session).catch(()=>session(null,'Não foi possível carregar o acesso. Verifique a conexão e atualize a página.'));
