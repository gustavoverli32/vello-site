import * as api from './leads-data.js?v=auth-20261107b';
const $=s=>document.querySelector(s);
const stages=[['novo','Novo lead','#5b9fff'],['contato','Em contato','#b39bff'],['diagnostico','Diagnóstico agendado','#70d4dc'],['proposta','Proposta','#e8bc73'],['fechado','Fechado','#77d6aa'],['perdido','Perdido','#93a0b0']];
const stageLabel=key=>stages.find(s=>s[0]===key)?.[1]||key;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Não informado';
const day=value=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(value));
let leads=[],signedIn=false,loading=false,selectedId=null,dragId=null,dragEndedAt=0,sessionVersion=0,busyIds=new Set(),poll;
function feedback(id,text,type=''){const el=$(id);el.textContent=text;el.className='feedback'+(type?' '+type:'');}
function clearPrivate(){leads=[];selectedId=null;busyIds.clear();$('#lead-dialog').close();$('#detail-content').replaceChildren();$('#board').replaceChildren();$('#workspace').hidden=true;$('#logout').hidden=true;$('#auth').hidden=false;$('#login-form').hidden=false;$('#login-password').value='';clearInterval(poll);}
async function sessionChanged(user,error){
  const version=++sessionVersion;signedIn=!!user;
  if(!user){clearPrivate();feedback('#auth-feedback',error||'',error?'error':'');return;}
  $('#auth').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;$('#login-password').value='';feedback('#auth-feedback','');
  await load();if(version!==sessionVersion)return;
  clearInterval(poll);poll=setInterval(()=>{if(!document.hidden&&!$('#lead-dialog').open)load(true);},60000);
  const linked=new URLSearchParams(location.search).get('lead');if(linked&&leads.some(l=>l.id===linked))openDetail(linked);
}
async function load(silent=false){
  if(!signedIn||loading)return;loading=true;const version=sessionVersion;$('#refresh').disabled=true;$('#board').setAttribute('aria-busy','true');
  if(!leads.length&&!silent)$('#board').innerHTML='<div class="loading">Carregando solicitações…</div>';
  if(!silent)feedback('#board-feedback','');
  try{const result=await api.listLeads();if(version!==sessionVersion)return;leads=result;render();$('#last-updated').textContent='Atualizado em '+date(new Date())+' · horários de Brasília';}
  catch(e){if(version===sessionVersion){if(!leads.length)$('#board').replaceChildren();feedback('#board-feedback',e.message,'error');}}
  finally{loading=false;$('#refresh').disabled=false;$('#board').setAttribute('aria-busy','false');}
}
function filtered(){const q=$('#search').value.trim().toLocaleLowerCase('pt-BR'),stage=$('#status-filter').value;return leads.filter(l=>(!stage||l.status===stage)&&(!q||[l.empresa,l.nome,l.email,l.telefone,l.interesse].join(' ').toLocaleLowerCase('pt-BR').includes(q)));}
function render(){
  if(!signedIn)return;
  $('#stat-total').textContent=leads.length;$('#stat-new').textContent=leads.filter(l=>l.status==='novo').length;$('#stat-progress').textContent=leads.filter(l=>['contato','diagnostico','proposta'].includes(l.status)).length;$('#stat-won').textContent=leads.filter(l=>l.status==='fechado').length;
  const rows=filtered(),filter=$('#status-filter').value;$('#lead-count').textContent=rows.length;$('#board').classList.toggle('single-stage',!!filter);
  $('#board').innerHTML=stages.filter(s=>!filter||s[0]===filter).map(([key,label,color])=>{const cards=rows.filter(l=>l.status===key);return `<section class="column" data-stage="${key}" aria-label="${label}"><header class="column-header"><span class="column-title"><i class="dot"></i>${label}</span><span class="count">${cards.length}</span></header><div class="cards">${cards.length?cards.map(card).join(''):`<div class="empty-column">${leads.length?'Nenhum lead nesta etapa.':'As solicitações do site<br>aparecerão aqui.'}</div>`}</div></section>`;}).join('');
  if(leads.length&&!rows.length)feedback('#board-feedback','Nenhum lead corresponde aos filtros.');
  else if($('#board-feedback').textContent==='Nenhum lead corresponde aos filtros.')feedback('#board-feedback','');
}
function card(l){return `<article class="lead-card" draggable="${!busyIds.has(l.id)}" data-id="${l.id}"><div class="card-meta"><span>DIAGNÓSTICO · SITE</span><time datetime="${esc(l.created_at)}">${day(l.created_at)}</time></div><button class="card-main" type="button" data-open="${l.id}" aria-label="Ver lead ${esc(l.empresa)}"><h3>${esc(l.empresa)}</h3><span class="person">${esc(l.nome)}</span><span class="interest">${esc(l.interesse||'Diagnóstico geral')}</span><p class="card-message">${esc(l.mensagem||'O contato não deixou uma mensagem adicional.')}</p><span class="card-footer"><span>${busyIds.has(l.id)?'Salvando…':'Ver detalhes'}</span><span>↗</span></span></button>${l.agendado_para?`<p class="card-next">◷ ${date(l.agendado_para)}</p>`:''}</article>`;}
async function move(id,status){
  const lead=leads.find(l=>l.id===id);if(!lead||lead.status===status||busyIds.has(id)||!stages.some(s=>s[0]===status))return;
  busyIds.add(id);render();
  try{const updated=await api.updateLead(id,{status},lead.updated_at);if(!signedIn)return;Object.assign(lead,updated);feedback('#board-feedback',`${lead.empresa} movido para ${stageLabel(status)}.`,'success');}
  catch(e){feedback('#board-feedback',e.message,'error');}
  finally{busyIds.delete(id);render();}
}
function localInput(iso){if(!iso)return '';const d=new Date(iso);return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(' ','T');}
async function openDetail(id){
  const l=leads.find(l=>l.id===id);if(!l)return;selectedId=id;const version=sessionVersion;
  const phone=l.telefone.replace(/\D/g,''),wa=phone.startsWith('55')&&phone.length>11?phone:'55'+phone;
  $('#detail-content').innerHTML=`<h2 id="detail-company">${esc(l.empresa)}</h2><p class="detail-sub">Recebido em ${date(l.created_at)}</p><div class="detail-grid"><div><small>Contato</small><p>${esc(l.nome)}</p></div><div><small>Cargo</small><p>${esc(l.cargo||'Não informado')}</p></div><div><small>E-mail</small><p><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></p></div><div><small>Telefone / WhatsApp</small><p>${esc(l.telefone)}</p></div><div><small>Interesse</small><p>${esc(l.interesse||'Diagnóstico geral')}</p></div><div><small>Origem</small><p>Formulário do site</p></div></div><div class="detail-actions"><a class="button" href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp ↗</a><a class="button" href="mailto:${esc(l.email)}">Escrever e-mail ↗</a></div><section class="detail-block"><h3>Mensagem da solicitação</h3><div class="original-message">${esc(l.mensagem||'Sem mensagem adicional.')}</div></section><form id="detail-form" class="detail-form detail-block"><h3>Acompanhamento</h3><label for="detail-status">Etapa do atendimento</label><select id="detail-status" name="status">${stages.map(([key,label])=>`<option value="${key}" ${key===l.status?'selected':''}>${label}</option>`).join('')}</select><label for="detail-date">Próximo atendimento · horário de Brasília</label><input id="detail-date" name="agendado_para" type="datetime-local" value="${localInput(l.agendado_para)}"><label for="detail-next">Próxima ação</label><input id="detail-next" name="proxima_acao" maxlength="500" placeholder="Ex.: ligar para entender a operação" value="${esc(l.proxima_acao)}"><label for="detail-notes">Anotações internas</label><textarea id="detail-notes" name="notas" rows="5" maxlength="10000" placeholder="Contexto, decisões e próximos passos…">${esc(l.notas)}</textarea><button class="button primary full" type="submit">Salvar acompanhamento</button><p id="detail-feedback" class="feedback" role="status"></p></form><section class="detail-block"><h3>Histórico do atendimento</h3><ol id="history" class="history"><li>Carregando histórico…</li></ol></section>`;
  $('#detail-form').addEventListener('submit',saveDetail);
  if(!$('#lead-dialog').open)$('#lead-dialog').showModal();
  try{const history=await api.getHistory(id);if(version!==sessionVersion||selectedId!==id)return;$('#history').innerHTML=history.map(h=>`<li>${esc(h.tipo==='etapa'?h.descricao.split(' → ').map(stageLabel).join(' → '):h.descricao)}<time>${date(h.created_at)}</time></li>`).join('')||'<li>Nenhum registro ainda.</li>';}
  catch(e){if(version===sessionVersion&&selectedId===id)$('#history').innerHTML='<li>'+esc(e.message)+'</li>';}
}
async function saveDetail(e){
  e.preventDefault();const l=leads.find(l=>l.id===selectedId);if(!l||busyIds.has(l.id))return;
  const fd=new FormData(e.target),appointment=fd.get('agendado_para');
  const patch={status:fd.get('status'),notas:fd.get('notas').trim(),proxima_acao:fd.get('proxima_acao').trim(),agendado_para:appointment?new Date(appointment+':00-03:00').toISOString():null};
  const button=e.target.querySelector('[type="submit"]');button.disabled=true;busyIds.add(l.id);feedback('#detail-feedback','Salvando…');
  try{const updated=await api.updateLead(l.id,patch,l.updated_at);if(!signedIn)return;Object.assign(l,updated);render();await openDetail(l.id);feedback('#detail-feedback','Acompanhamento salvo.','success');}
  catch(error){feedback('#detail-feedback',error.message,'error');button.disabled=false;}
  finally{busyIds.delete(l.id);render();}
}
$('#board').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b&&Date.now()-dragEndedAt>300)openDetail(b.dataset.open);});
$('#board').addEventListener('dragstart',e=>{const card=e.target.closest('.lead-card');if(!card||busyIds.has(card.dataset.id)){e.preventDefault();return;}dragId=card.dataset.id;e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';card.classList.add('dragging');});
$('#board').addEventListener('dragover',e=>{const col=e.target.closest('.column');if(!dragId||!col)return;e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.drop-target').forEach(c=>c.classList.remove('drop-target'));col.classList.add('drop-target');});
$('#board').addEventListener('drop',e=>{const col=e.target.closest('.column'),id=dragId;if(!col||!id)return;e.preventDefault();col.classList.remove('drop-target');dragId=null;dragEndedAt=Date.now();move(id,col.dataset.stage);});
$('#board').addEventListener('dragend',()=>{dragId=null;dragEndedAt=Date.now();document.querySelectorAll('.dragging,.drop-target').forEach(c=>c.classList.remove('dragging','drop-target'));});
$('#close-detail').addEventListener('click',()=>$('#lead-dialog').close());$('#lead-dialog').addEventListener('close',()=>{selectedId=null;$('#detail-content').replaceChildren();});
$('#search').addEventListener('input',render);$('#status-filter').addEventListener('change',render);$('#refresh').addEventListener('click',()=>load());
$('#logout').addEventListener('click',async()=>{signedIn=false;++sessionVersion;clearPrivate();await api.logout();});
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;feedback('#auth-feedback','Entrando…');try{await api.login($('#login-email').value.trim().toLowerCase(),$('#login-password').value);}catch(err){feedback('#auth-feedback',err.message,'error');}finally{b.disabled=false;}});
api.init(sessionChanged).catch(()=>feedback('#auth-feedback','Não foi possível carregar o acesso. Verifique a conexão e atualize a página.','error'));
