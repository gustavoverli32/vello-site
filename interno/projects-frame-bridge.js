(() => {
 let port,resolveReady,initialData,sequence=0;const pending=new Map();
 const ready=new Promise(resolve=>resolveReady=resolve);
 const cache=new Map();
 function request(method,args){return new Promise((resolve,reject)=>{
  if(!port){reject(new Error('Entre novamente na área de projetos.'));return;}
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('A operação demorou. Confira a conexão e tente novamente.'));},120000);
  pending.set(id,{resolve,reject,timer});port.postMessage({id,method,args});
 });}
 const bridge={ready,get initialData(){return initialData;},
  getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,String(value)),
  save:data=>{const payload={projects:data.projects,deletedIds:JSON.parse(cache.get('vello_deleted_project_ids_v1')||'[]'),deletedProjects:JSON.parse(cache.get('vello_deleted_projects_v1')||'[]')};port.postMessage({event:'save',payload});},
  putBlob:(id,file)=>request('upload',{id,file}),getBlob:id=>request('download',{id}),
  getSummary:source=>request('summary',{source}),
  notify:(event,value)=>port?.postMessage({event,value})
 };
 window.VelloProjects=bridge;
 window.addEventListener('message',event=>{
  if(port||window.parent===window||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='vello-projects-init'||!event.ports[0])return;
  port=event.ports[0];initialData={projects:event.data.payload.projects};
  cache.set('vello_deleted_project_ids_v1',JSON.stringify(event.data.payload.deletedIds||[]));
  cache.set('vello_deleted_projects_v1',JSON.stringify(event.data.payload.deletedProjects||[]));
  port.onmessage=e=>{const p=pending.get(e.data?.id);if(!p)return;pending.delete(e.data.id);clearTimeout(p.timer);e.data.error?p.reject(new Error(e.data.error)):p.resolve(e.data.value);};
  port.start();resolveReady();
 });
 if(window.parent!==window)window.parent.postMessage({type:'vello-projects-ready'},location.origin);
 ready.then(()=>{
  let frame=0,observed;const measure=()=>{frame=0;const host=document.querySelector('.sc-host>div');if(!host)return;if(host!==observed){resize.disconnect();resize.observe(host);observed=host;}bridge.notify('height',Math.max(600,Math.ceil(host.getBoundingClientRect().height)+24));};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);},resize=new ResizeObserver(schedule),observer=new MutationObserver(schedule);
  observer.observe(document,{childList:true,subtree:true});schedule();
  window.addEventListener('pagehide',()=>{resize.disconnect();observer.disconnect();cancelAnimationFrame(frame);for(const p of pending.values())clearTimeout(p.timer);port.close();});
 });
 if(window.parent===window)document.addEventListener('DOMContentLoaded',()=>{document.body.innerHTML='<main style="padding:32px;color:#f3f0ea"><p>Este acompanhamento faz parte da área privada da Vello.</p><a style="color:#ffb48f" href="projetos.html">Acessar projetos →</a></main>';});
})();
