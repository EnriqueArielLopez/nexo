import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {Store,day,handle} from './core.mjs';
import {Claude,Instagram} from './providers.mjs';
import {Accounts} from './auth.mjs';
import {discover100} from './research.mjs';
import {vault} from './vault.mjs';
import {AccountBudget,SendQueue} from './automation.mjs';
import {readImport,ingest} from './imports.mjs';
import {exportWorkbook} from './export-portable.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.resolve(process.env.HOTEL_DATA_DIR||path.join(root,'data'));
const port=Number(process.env.PORT||18761),origin=`http://127.0.0.1:${port}`;
const accounts=new Accounts(data),budget=new AccountBudget(path.join(data,'cupos-instagram.sqlite')),contexts=new Map();
const csrf=randomBytes(32).toString('hex');let stopping=false;
const cookie=(token,remember=true)=>`nexo_session=${token}; HttpOnly; SameSite=Strict; Path=/${remember?'; Max-Age=604800':''}`;
function json(res,v,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(v));}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12e6)throw Error('El archivo supera el tamaño permitido.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function snapshot(c){return {generated:new Date().toISOString(),settings:c.store.settings(),leads:c.store.list(),history:c.store.history()};}
function excel(c){const snap=snapshot(c);const work=async()=>{c.exportError='';try{await exportWorkbook(snap,path.join(c.dir,'Clientes.xlsx'));}catch{c.exportError='Cerrá el Excel si está abierto y volvé a descargarlo. El historial quedó guardado.';throw Error(c.exportError);}};c.exportQueue=c.exportQueue.catch(()=>{}).then(work);return c.exportQueue;}
async function context(user){let c=contexts.get(user.id);if(!c){c={user,dir:accounts.folder(user),key:'',ig:null,secret:{},ready:null,exportQueue:Promise.resolve(),exportError:'',warning:'',search:{status:'idle',found:0,target:100,stage:''},active:true,validUntil:Date.now()+7*864e5};c.store=new Store(c.dir);c.search=c.store.job('lastSearch')||c.search;c.queue=new SendQueue({store:c.store,instagram:()=>c.ig,saveExcel:()=>excel(c)});contexts.set(user.id,c);}c.active=true;c.validUntil=user.expires||Date.now()+7*864e5;if(!c.ready){c.ready=(async()=>{const saved=accounts.saved(user.id);if(saved){try{c.secret=await vault('open',saved);c.key=c.secret.key||'';if(c.secret.igToken){const ig=new Instagram(c.secret.igToken,c.store.settings().graphVersion,{budget,profile:user.id});await ig.connect();c.ig=ig;}}catch{c.warning='Una conexión guardada necesita reconectarse en Ajustes.';}}})();}await c.ready;return c;}
async function saveConnection(c,remember){if(remember)accounts.save(c.user.id,await vault('seal',c.secret));else accounts.save(c.user.id,'');}
function state(c){const s=snapshot(c),account=c.ig?.account;const own=c.store.counts(),shared=account?budget.counts(account.id):own;return {...s,user:{name:c.user.name,id:c.user.id},counts:{daily:Math.max(own.daily,shared.daily),monthly:Math.max(own.monthly,shared.monthly)},claudeConnected:!!c.key,instagram:account||null,instagramPaused:c.ig?.paused||false,connectionWarning:c.warning,search:c.search,queue:c.queue.state,excelPath:path.join(c.dir,'Clientes.xlsx'),exportError:c.exportError,leads:s.leads.map(l=>({...l,apiBlock:!account?'Conectá Instagram':c.ig.paused?'Instagram pausado':c.store.gate({...l,approved:1},new Date(),true,account.id)||budget.gate(account.id,l.handle,c.store.settings())}))};}
async function runSearch(c,seed){let cancel=false;const settings=c.store.settings(),ai=new Claude(c.key,settings.model);c.search={status:'running',found:0,target:100,stage:'Analizando tu oferta',cancel:false};const fingerprint=JSON.stringify([seed,settings.offer,settings.model]);const cached=c.store.job('providerProfile');const useCache=cached?.fingerprint===fingerprint&&Date.now()-Date.parse(cached.at)<7*864e5;if(useCache)ai.profile=cached.profile;await discover100({store:c.store,seed,prepare:async()=>{const p=await ai.analyzeProfile(seed,settings);if(!useCache)c.store.setJob('providerProfile',{fingerprint,profile:p,at:new Date().toISOString()});return p;},usage:()=>({...ai.usage}),search:(s,filters,exclude)=>ai.search(s,filters,exclude),progress:state=>{cancel=cancel||c.search.cancel;c.search={...state,cancel};},cancelled:()=>cancel||c.search.cancel,save:()=>excel(c)});}
const staticFiles={'/':['nexo.html','text/html; charset=utf-8'],'/app.js':['nexo.js','text/javascript; charset=utf-8'],'/style.css':['nexo.css','text/css; charset=utf-8'],'/geography.js':['../geography.mjs','text/javascript; charset=utf-8'],...Object.fromEntries([400,500,600,700,800].map(w=>[`/fonts/Manrope-${w}.ttf`,[`fonts/Manrope-${w}.ttf`,'font/ttf']]))};
const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
try{if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==origin)return json(res,{error:'Origen no permitido'},403);const route=new URL(req.url,origin).pathname;const user=accounts.resolve(req.headers.cookie);
 if(req.method==='GET'){
  if(route==='/api/health')return json(res,{ok:true,app:'nexo',version:'3.1.0'});
  if(route==='/api/session')return json(res,{csrf,user:user?{id:user.id,name:user.name}:null,hasAccounts:accounts.count()>0});
  if(staticFiles[route]){const [file,type]=staticFiles[route];res.writeHead(200,{'content-type':type});return res.end(await fs.readFile(path.join(root,'public',file)));}
  if(!user)return json(res,{error:'Iniciá sesión en tu espacio de Nexo.'},401);const c=await context(user);
  if(route==='/api/state')return json(res,state(c));
  if(route==='/api/excel'){await excel(c);res.writeHead(200,{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="Clientes-Nexo.xlsx"'});return res.end(await fs.readFile(path.join(c.dir,'Clientes.xlsx')));}
  if(route==='/api/backup'){res.writeHead(200,{'content-type':'application/json','content-disposition':'attachment; filename="Nexo-respaldo.json"'});return res.end(JSON.stringify({format:'nexo-backup-v1',...snapshot(c)}));}
  return json(res,{error:'No encontrado'},404);
 }
 if(req.method!=='POST')return json(res,{error:'Método no permitido'},405);if(req.headers['x-csrf-token']!==csrf||!String(req.headers['content-type']).startsWith('application/json'))return json(res,{error:'Solicitud inválida'},403);const v=await body(req);
 if(route==='/api/quit'){stopping=true;for(const c of contexts.values())c.search.cancel=true;json(res,{ok:true});setTimeout(()=>{server.close();Promise.all([...contexts.values()].map(c=>c.exportQueue.catch(()=>{}))).finally(()=>{for(const c of contexts.values())c.store.close();accounts.close();budget.close();process.exit(0);});},100);return;}
 if(route==='/api/register'||route==='/api/login'){const u=route==='/api/register'?accounts.create(v.name,v.password):accounts.login(v.name,v.password);res.setHeader('Set-Cookie',cookie(accounts.issue(u,v.remember!==false),v.remember!==false));return json(res,{ok:true,user:{id:u.id,name:u.name}});}
 if(!user)return json(res,{error:'Iniciá sesión para continuar.'},401);const c=await context(user);
 switch(route){
  case '/api/logout':c.queue.pause();c.active=false;c.key='';c.ig=null;c.secret={};c.ready=null;accounts.revoke(req.headers.cookie);res.setHeader('Set-Cookie','nexo_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');return json(res,{ok:true});
  case '/api/settings':c.store.saveSettings(v);break;
  case '/api/claude':{const key=String(v.key||'').trim();if(!key)throw Error('Ingresá la clave de API de Claude.');try{await new Claude(key,c.store.settings().model).call({max_tokens:16,messages:[{role:'user',content:'Respondé OK.'}]});}catch(e){throw Error(e.status===401?'La clave no es válida. Copiá una nueva desde tu cuenta de Anthropic.':e.status===429?'Anthropic no habilitó la conexión. Revisá saldo y límite de uso.':'No se pudo conectar. Revisá Internet, saldo y permisos de tu cuenta de Anthropic.');}c.key=key;c.secret.key=key;await saveConnection(c,v.remember===true);break;}
  case '/api/instagram':{const ig=new Instagram(String(v.token||'').trim(),c.store.settings().graphVersion,{budget,profile:user.id});await ig.connect();c.ig=ig;for(const l of c.store.list().filter(l=>l.dnc))budget.doNotContact(ig.account.id,l.handle,true);c.secret.igToken=ig.token;await saveConnection(c,v.remember===true);break;}
  case '/api/disconnect':c.queue.pause();c.key='';c.ig=null;c.secret={};accounts.save(user.id,'');break;
  case '/api/sync':if(!c.ig)throw Error('Conectá Instagram primero.');return json(res,{...await c.ig.sync(c.store),state:state(c)});
  case '/api/search':{if(c.search.status==='running')throw Error('Ya hay una búsqueda en curso.');if(!c.key)throw Error('Conectá el asistente para buscar. Solo se configura una vez en esta PC.');if(!/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(v.seed||''))throw Error('Pegá el enlace completo del perfil de Instagram.');const seed=`https://www.instagram.com/${handle(v.seed)}/`;c.store.saveSettings({lastSeed:seed,maxResults:100});void runSearch(c,seed);break;}
  case '/api/search/stop':c.search.cancel=true;break;
  case '/api/import':{const stats=ingest(c.store,readImport(v));await excel(c);return json(res,{...stats,state:state(c)});}
  case '/api/add':{const result=c.store.add(v);if(result.added)c.store.setScore(result.id,v.score,v.score_reason);await excel(c);break;}
  case '/api/update':c.store.update(Number(v.id),v);if(c.ig?.account&&'dnc'in v)budget.doNotContact(c.ig.account.id,c.store.get(Number(v.id)).handle,v.dnc===true);await excel(c);break;
  case '/api/manual':{if(v.confirm!==true)throw Error('Confirmá que ya enviaste la propuesta.');const event=c.store.reserve(Number(v.id));c.store.finish(event.event,'sent','Confirmado manualmente');await excel(c);break;}
  case '/api/send':if(!c.ig)throw Error('Conectá Instagram.');await c.ig.send(c.store,Number(v.id));await excel(c);break;
  case '/api/queue/start':{if(!c.ig?.account)throw Error('Conectá Instagram para usar el envío automático oficial.');if(v.confirm!==true)throw Error('Revisá y confirmá las propuestas seleccionadas.');await c.ig.sync(c.store);if(!Array.isArray(v.ids)||v.ids.length>100)throw Error('La selección admite hasta 100 clientes.');for(const id of v.ids)c.store.update(Number(id),{approved:true});c.queue.start(v.ids);break;}
  case '/api/queue/pause':c.queue.pause();break;
  case '/api/queue/resume':if(!c.ig)throw Error('Conectá Instagram para reanudar.');c.queue.resume();break;
  case '/api/demo':{for(const [i,name,city,country,score]of [[1,'DEMO · Hotel Brisa','Mar del Plata','Argentina',91],[2,'DEMO · Posada del Puerto','Colonia','Uruguay',84],[3,'DEMO · Hotel Azahar','Sevilla','España',72]]){const r=c.store.add({handle:`demo_hotel_ficticio_${i}`,name,city,country,reason:'Hotel ficticio para probar la aplicación.',source:'https://example.com',message:`DEMO: Hola, equipo de ${name}. Esta propuesta es una simulación.`},{demo:true});c.store.update(r.id,{approved:true});c.store.setScore(r.id,score,'Ejemplo ficticio de afinidad.');}await excel(c);break;}
  case '/api/clear-demo':c.store.db.exec('BEGIN IMMEDIATE');try{c.store.db.exec('DELETE FROM events WHERE lead_id IN (SELECT id FROM leads WHERE demo=1);DELETE FROM leads WHERE demo=1;COMMIT');}catch(e){c.store.db.exec('ROLLBACK');throw e;}await excel(c);break;
  case '/api/reconcile':{const e=c.store.db.prepare("SELECT * FROM events WHERE id=? AND status='uncertain'").get(Number(v.event));if(!e||!['sent','failed'].includes(v.status))throw Error('Conciliación inválida.');c.store.finish(e.id,v.status,'Conciliado por usuario');budget.finish(user.id+':'+e.id,v.status);await excel(c);break;}
  default:return json(res,{error:'No encontrado'},404);
 }
 return json(res,{ok:true,state:state(c)});
}catch(e){if(!res.headersSent)json(res,{error:e.message||'No se pudo completar la acción.'},400);else res.end();}});
const heartbeat=setInterval(()=>{if(stopping)return;for(const c of contexts.values())if(c.active&&c.validUntil>Date.now())void c.queue.tick().catch(()=>{c.queue.pause();});},1000);heartbeat.unref();
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Nexo ya está abierto o el puerto está ocupado.':e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`Nexo: ${origin}`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stopping=true;for(const c of contexts.values()){c.search.cancel=true;c.queue.pause();}server.close(()=>{for(const c of contexts.values())c.store.close();accounts.close();budget.close();process.exit(0);});});
