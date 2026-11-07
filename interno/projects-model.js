const arrays=['tarefas','bugs','tempo','arquivos','comentarios','financeiro','gastos','servicos'];
export const fileIdPattern=/^[a-zA-Z0-9_-]{1,120}$/;
export function projectPayload(value){
 if(!value||!Array.isArray(value.projects)||value.projects.length>500)throw new Error('Os dados de projetos não são válidos.');
 const clean=JSON.parse(JSON.stringify(value),(k,v)=>['__proto__','constructor','prototype'].includes(k)?undefined:v);
 const ids=new Set();
 for(const p of clean.projects){
  if(!p||typeof p!=='object'||typeof p.id!=='string'||!p.id||p.id.length>120||ids.has(p.id)||typeof p.nome!=='string'||!p.nome.trim())throw new Error('Há um projeto inválido ou repetido na transferência.');
  ids.add(p.id);for(const field of arrays)if(!Array.isArray(p[field]))p[field]=[];
  if(!p.estrutura||typeof p.estrutura!=='object'||Array.isArray(p.estrutura))p.estrutura={};
  p.cliente??='';p.status??='Em andamento';p.fase??=0;
 }
 const payload={projects:clean.projects,deletedIds:Array.isArray(clean.deletedIds)?clean.deletedIds.filter(x=>typeof x==='string').slice(-2000):[],deletedProjects:Array.isArray(clean.deletedProjects)?clean.deletedProjects.slice(-10):[]};
 if(new TextEncoder().encode(JSON.stringify(payload)).length>4000000)throw new Error('Os dados excedem o limite de 4 MB. Os anexos devem ser enviados separadamente.');
 return payload;
}
export function blankProject(id,nome){return {id,nome,cliente:'',status:'Em andamento',fase:0,prazo:'',valor:'',link:'',descricao:'',tarefas:[],bugs:[],tempo:[],arquivos:[],comentarios:[],financeiro:[],gastos:[],estrutura:{},servicos:[]};}
export function initialCatalog(){return projectPayload({projects:[['garcia','Garcia Mecânica'],['kf','KF Hot Dog'],['h2o','H2O Ostras'],['oistres','Oistres'],['hci','HCI'],['solo','Solum'],['eco','Eco'],['gnv','ECONGNV'],['nextuber','Nextuber']].map(([id,nome])=>blankProject(id,nome))});}
