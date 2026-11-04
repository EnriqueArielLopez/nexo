import {EmailQueue} from './email-queue.mjs';
import {previewOfficialBatch,startOfficialBatch} from './instagram-batch.mjs';
import {OfficialInstagramConnection,loadInstagramService} from './instagram-connection.mjs';
import {previewInstagramTest,sendInstagramTest} from './instagram-test.mjs';
import {discoverWeb} from './web-discovery.mjs';
import {prepareBatch,approveBatch} from './batches.mjs';
import {SearchBrowser,BrowserWebDiscovery,waitForHuman} from './browser-search.mjs';
import {claudeSearchRequest} from './campaign.mjs';
import {InstagramSender} from './instagram-sender.mjs';
import {Extensions} from './extension-bridge.mjs';
import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import {Store,day,handle} from './core.mjs';
import {Claude,Instagram} from './providers.mjs';
import {Accounts} from './auth.mjs';
import {discover100} from './research.mjs';
import {vault} from './vault.mjs';
import {AccountBudget,SendQueue} from './automation.mjs';
import {readImport,ingest} from './imports.mjs';
import {exportWorkbook} from './export-portable.mjs';
import {NexoAssistant,campaignContext,connectionRequest} from './assistant.mjs';
import {emailLead,sendMail,mailConfig,attachmentDir,ATTACHMENT_TYPES} from './mailer.mjs';
import {runSchedules} from './scheduler.mjs';
const BUILD='3.11.0';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.resolve(process.env.HOTEL_DATA_DIR||path.join(root,'data'));
const port=Number(process.env.PORT||18761),loopback=`http://127.0.0.1:${port}`;
const accounts=new Accounts(data),budget=new AccountBudget(path.join(data,'cupos-instagram.sqlite')),contexts=new Map();
const installationFile=path.join(data,'.installation-key');let installationKey;
try{installationKey=await fs.readFile(installationFile,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;installationKey=randomBytes(32).toString('hex');try{await fs.writeFile(installationFile,installationKey,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;installationKey=await fs.readFile(installationFile,'utf8');}}
if(!/^[a-f0-9]{64}$/.test(installationKey))throw Error('La identidad local de Nexo no es válida.');
const uiHost=`nexo-${createHmac('sha256',installationKey).update('nexo-origin-v1').digest('hex').slice(0,32)}.localhost:${port}`,origin=`http://${uiHost}`;
const extensions=new Extensions(data,path.join(root,'chrome-extension'),port);await extensions.load();
async function chromePath(){const local=process.env.LOCALAPPDATA||'';for(const root of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],local].filter(Boolean)){const p=path.join(root,'Google','Chrome','Application','chrome.exe');try{await fs.access(p);return p;}catch{}}return '';}
let instagramService='',instagramServiceError='';try{instagramService=await loadInstagramService(data);}catch(e){instagramServiceError=e.message;}
const csrf=randomBytes(32).toString('hex'),shutdownToken=randomBytes(32).toString('hex');let stopping=false;
const localProof=message=>createHmac('sha256',shutdownToken).update(message).digest('hex');
const canStop=req=>{const given=Buffer.from(String(req.headers['x-nexo-shutdown']||'')),own=Buffer.from(localProof('nexo-shutdown-v1'));return given.length===own.length&&timingSafeEqual(given,own);};
const cookie=(token,remember=true)=>`nexo_session=${token}; HttpOnly; SameSite=Strict; Path=/${remember?'; Max-Age=604800':''}`;
function json(res,v,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(v));}
async function body(req){const limit=/^\/api\/(import|attachment)$/.test(req.url)?12e6:req.url==='/api/ext/result'?2e6:65536;const tooLarge=()=>Object.assign(Error('La solicitud supera el tamaño permitido.'),{status:413});if(Number(req.headers['content-length'])>limit)throw tooLarge();let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw tooLarge();chunks.push(chunk);}let value;try{value=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw Error('JSON inválido.');}if(!value||Array.isArray(value)||typeof value!=='object')throw Error('La solicitud debe ser un objeto JSON.');return value;}
function snapshot(c){return {generated:new Date().toISOString(),settings:c.store.settings(),leads:c.store.list(),history:c.store.history()};}
function excel(c){const snap=snapshot(c);const work=async()=>{c.exportError='';try{await exportWorkbook(snap,path.join(c.dir,'Clientes.xlsx'));}catch{c.exportError='Cerrá el Excel si está abierto y volvé a descargarlo. El historial quedó guardado.';throw Error(c.exportError);}};c.exportQueue=c.exportQueue.catch(()=>{}).then(work);return c.exportQueue;}
async function context(user){let c=contexts.get(user.id);if(!c){c={user,dir:accounts.folder(user),key:'',ig:null,secret:{},ready:null,exportQueue:Promise.resolve(),exportError:'',warning:'',search:{status:'idle',found:0,target:100,stage:''},active:true,validUntil:Date.now()+7*864e5};c.officialInstagram=new OfficialInstagramConnection({url:instagramService});c.store=new Store(c.dir);c.search=c.store.job('lastSearch')||c.search;if(['running','waiting'].includes(c.search.status)){c.search={...c.search,status:'paused',stage:'La búsqueda anterior se interrumpió. Iniciá otra para continuar sin duplicados.'};}c.queue=new SendQueue({store:c.store,instagram:()=>c.ig,saveExcel:()=>excel(c)});c.sender=new InstagramSender(path.join(data,'envios-chrome',c.user.id),{store:c.store,saveExcel:()=>excel(c),bridge:extensions.bridge(c.user.id)});c.inspector=new InstagramSender(path.join(data,'revision-instagram',c.user.id),{store:c.store,jobName:null});c.emails=new EmailQueue({store:c.store,dir:c.dir,save:()=>excel(c)});c.assistant=new NexoAssistant({store:c.store,claude:()=>new Claude(c.key,c.store.settings().model),instagram:()=>c.ig,queue:c.queue,search:async()=>{if(c.search.status==='running')throw Error('Ya hay una búsqueda en curso.');const seed=c.store.settings().lastSeed;if(!seed)throw Error('Pegá tu perfil de Instagram en la pantalla principal.');const canonical=`https://www.instagram.com/${handle(seed)}/`;await runSearch(c,canonical);if(c.search.status!=='completed')throw Error(c.search.error||'La búsqueda fue detenida.');},stopSearch:()=>{c.search.cancel=true;},saveExcel:()=>excel(c),valid:()=>!stopping&&c.active&&!!c.key&&c.validUntil>Date.now()});contexts.set(user.id,c);}c.active=true;c.validUntil=user.expires||Date.now()+7*864e5;if(!c.ready){c.ready=(async()=>{const saved=accounts.saved(user.id);if(saved){try{c.secret=await vault('open',saved);c.key=c.secret.key||'';if(c.secret.igToken){if(c.secret.igExpiresAt&&c.secret.igExpiresAt<=Date.now())throw Error('Autorización vencida.');const ig=new Instagram(c.secret.igToken,c.store.settings().graphVersion,{budget,profile:user.id});await ig.connect();c.ig=ig;c.officialInstagram.state={status:'connected',message:'Instagram conectado: @'+ig.account.username,expiresAt:c.secret.igExpiresAt||null};}}catch{c.warning='Una conexión guardada necesita reconectarse en Ajustes.';if(c.secret.igToken)c.officialInstagram.state={status:'failed',message:'La autorización guardada de Instagram necesita reconectarse.'};}}})();}await c.ready;return c;}
const smtp=c=>{const s=c.store.settings();return {host:s.smtpHost,port:s.smtpPort,user:s.smtpUser,pass:c.secret.smtpPass||''};};
async function saveConnection(c,remember){if(remember)accounts.save(c.user.id,await vault('seal',c.secret));else accounts.save(c.user.id,'');}
function state(c){const s=snapshot(c),account=c.ig?.account;const own=c.store.counts(),shared=account?budget.counts(account.id):own;return {...s,igSender:c.sender?.publicState(),emailQueue:c.emails.state,chromeConnected:!!c.sender?.bridge?.connected(),user:{name:c.user.name,id:c.user.id},counts:{daily:Math.max(own.daily,shared.daily),monthly:Math.max(own.monthly,shared.monthly)},claudeConnected:!!c.key,searchRequest:claudeSearchRequest(c.store.settings()),email:{configured:!!(c.secret.smtpPass&&c.store.settings().smtpUser),user:c.store.settings().smtpUser,counts:c.store.counts(new Date(),false,'email'),attachment:c.store.settings().attachment},officialInstagram:{...c.officialInstagram.publicState(),setupError:instagramServiceError},instagram:account||null,instagramPaused:c.ig?.paused||false,connectionWarning:c.warning,search:c.search,queue:c.queue.state,assistant:c.assistant.state,excelPath:path.join(c.dir,'Clientes.xlsx'),build:BUILD,schedules:c.store.schedules().map(x=>({id:x.id,leadId:x.lead_id,name:x.name,handle:x.handle,email:x.email,channel:x.channel,at:x.at,status:x.status,note:x.note})),exportError:c.exportError,leads:s.leads.map(l=>({...l,apiBlock:l.block||(!account?'Conectá Instagram':c.ig.paused?'Instagram pausado':c.store.gate({...l,approved:1},new Date(),true,account.id)||budget.gate(account.id,l.handle,c.store.settings()))}))};}
async function runSearch(c,seed){let cancel=false;const settings=c.store.settings(),ai=new Claude(c.key,settings.model);c.search={status:'running',found:0,target:100,stage:'Analizando tu oferta',cancel:false};const fingerprint=JSON.stringify([seed,settings.offer,settings.model]);const cached=c.store.job('providerProfile');const useCache=cached?.fingerprint===fingerprint&&Date.now()-Date.parse(cached.at)<7*864e5;if(useCache)ai.profile=cached.profile;await discover100({store:c.store,seed,prepare:async()=>{const p=await ai.analyzeProfile(seed,settings);if(!useCache)c.store.setJob('providerProfile',{fingerprint,profile:p,at:new Date().toISOString()});return p;},usage:()=>({...ai.usage}),search:(s,filters,exclude)=>ai.search(s,filters,exclude),progress:state=>{cancel=cancel||c.search.cancel;c.search={...state,cancel};},cancelled:()=>cancel||c.search.cancel,save:()=>excel(c)});}
async function runWebSearch(c,seed){
 const controller=new AbortController();c.webAbort=controller;let cancel=false;
 c.search={status:'running',method:'public-web',found:0,target:100,stage:'Preparando el buscador en segundo plano',cancel:false};
 c.searchBrowser=c.searchBrowser||new SearchBrowser(path.join(data,'buscador',c.user.id));
 const web=new BrowserWebDiscovery({browser:c.searchBrowser,signal:controller.signal,onChallenge:info=>waitForHuman(controller.signal,resume=>{
  c.search={...c.search,status:'waiting',stage:'Completá la verificación en la ventana del buscador',error:'',humanRequired:true,browserQuery:info.query};
  c.store.setJob('lastSearch',{...c.search,seed,at:new Date().toISOString()});
  c.browserResume=()=>{c.browserResume=null;c.search={...c.search,status:'running',humanRequired:false,stage:'Revisando la verificación del buscador'};resume();};
 })});
 try{await discoverWeb({store:c.store,seed,web,inspect:c.store.settings().verifyActivity?h=>c.inspector.inspect(h):null,verifyActivity:c.store.settings().verifyActivity,maxQueries:c.store.settings().searchDepth==='deep'?900:40,rest:(ms=1200+Math.random()*1800)=>delay(ms,undefined,{signal:controller.signal}).catch(()=>{}),progress:next=>{cancel=cancel||c.search.cancel;c.search={...next,cancel};},cancelled:()=>stopping||cancel||!!c.search.cancel||controller.signal.aborted,save:()=>excel(c)});}
 finally{c.browserResume=null;if(c.webAbort===controller)c.webAbort=null;}
}
function cleanPending(c){
 const keep=[...(c.sender.active?c.sender.state.items.filter(i=>i.status==='pending'):[]),...(c.emails.active?c.emails.state.items.filter(i=>i.status==='pending'):[]),...(['running','waiting'].includes(c.queue.state.status)?c.queue.state.items:[])].map(i=>i.id);
 if(!c.sender.active)c.sender.clear();if(!c.emails.active)c.emails.clear();
 if(!['running','waiting'].includes(c.queue.state.status)){c.queue.state={status:'idle',items:[],sent:0,skipped:0,reason:''};c.queue.persist();}
 const archived=c.store.archiveResults({keepIds:keep});void excel(c).catch(()=>{});return archived;
}
const staticFiles={'/':['nexo.html','text/html; charset=utf-8'],'/app.js':['nexo.js','text/javascript; charset=utf-8'],'/style.css':['nexo.css','text/css; charset=utf-8'],'/geography.js':['../geography.mjs','text/javascript; charset=utf-8'],...Object.fromEntries([400,500,600,700,800].map(w=>[`/fonts/Manrope-${w}.ttf`,[`fonts/Manrope-${w}.ttf`,'font/ttf']]))};
const server=http.createServer({requestTimeout:20000,headersTimeout:10000,keepAliveTimeout:5000,maxHeaderSize:16384},async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
try{const route=new URL(req.url,origin).pathname;
 if(route.startsWith('/api/ext/')&&req.headers.host===`127.0.0.1:${port}`&&(!req.headers.origin||req.headers.origin.startsWith('chrome-extension://'))){// Nexo's extension in the user's Chrome, with its token.
  const bridge=extensions.byToken(req.headers['x-nexo-token']);if(!bridge)return json(res,{error:'Extensión no autorizada'},401);
  if(req.method==='GET'&&route==='/api/ext/poll')return json(res,await bridge.poll());
  if(req.method==='POST'&&route==='/api/ext/result'){bridge.result(await body(req));return json(res,{ok:true});}
  return json(res,{error:'No encontrado'},404);
 }
 if(![uiHost,`127.0.0.1:${port}`].includes(req.headers.host)||req.headers.origin&&![origin,loopback].includes(req.headers.origin)||req.headers.host===`127.0.0.1:${port}`&&req.headers['sec-fetch-site']&&route!=='/api/health')return json(res,{error:'Origen no permitido. Abrí Nexo desde su ejecutable o la URL local indicada al iniciar.'},403);const user=accounts.resolve(req.headers.cookie);
 if(req.method==='GET'){
  if(route==='/api/health'){const nonce=String(req.headers['x-nexo-probe']||'');return json(res,{ok:true,app:'nexo',version:BUILD,build:BUILD,...(/^[a-f0-9]{32}$/.test(nonce)?{proof:localProof('nexo-health-v1:'+nonce)}:{})});}
  if(route==='/api/session')return json(res,{csrf,user:user?{id:user.id,name:user.name}:null,hasAccounts:accounts.count()>0});
  if(staticFiles[route]){const [file,type]=staticFiles[route];res.writeHead(200,{'content-type':type});return res.end(await fs.readFile(path.join(root,'public',file)));}
  if(!user)return json(res,{error:'Iniciá sesión en tu espacio de Nexo.'},401);const c=await context(user);
  if(route==='/api/search-request')return json(res,{request:claudeSearchRequest(c.store.settings()),mode:c.key?'api':'claude-app'});
  if(route==='/api/state')return json(res,state(c));
  if(route==='/api/excel'){await excel(c);res.writeHead(200,{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="Clientes-Nexo.xlsx"'});return res.end(await fs.readFile(path.join(c.dir,'Clientes.xlsx')));}
  if(route==='/api/backup'){res.writeHead(200,{'content-type':'application/json','content-disposition':'attachment; filename="Nexo-respaldo.json"'});return res.end(JSON.stringify({format:'nexo-backup-v1',...snapshot(c),leads:c.store.list({includeArchived:true})}));}
  return json(res,{error:'No encontrado'},404);
 }
 if(req.method!=='POST')return json(res,{error:'Método no permitido'},405);if(req.headers['x-csrf-token']!==csrf||!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'])))return json(res,{error:'Solicitud inválida'},403);
 if(!user&&!['/api/register','/api/login'].includes(route)&&!(route==='/api/quit'&&canStop(req)))return json(res,{error:'Iniciá sesión para continuar.'},401);const v=await body(req);
 if(route==='/api/quit'){stopping=true;for(const c of contexts.values()){void c.officialInstagram.cancel();c.search.cancel=true;c.webAbort?.abort();c.assistant.cancel();c.sender.stop();c.emails.stop();}json(res,{ok:true});setTimeout(()=>{server.close();Promise.all([...contexts.values()].map(async c=>{await Promise.allSettled([c.sender.done,c.emails.done]);await c.exportQueue.catch(()=>{});await c.searchBrowser?.close();})).finally(()=>{for(const c of contexts.values())c.store.close();for(const t of background.values())t.store.close();accounts.close();budget.close();process.exit(0);});},100);return;}
 if(route==='/api/register'||route==='/api/login'){const u=route==='/api/register'?accounts.create(v.name,v.password):accounts.login(v.name,v.password);res.setHeader('Set-Cookie',cookie(accounts.issue(u,v.remember!==false),v.remember!==false));return json(res,{ok:true,user:{id:u.id,name:u.name}});}
 if(!user)return json(res,{error:'Iniciá sesión para continuar.'},401);const c=await context(user);
 switch(route){
  case '/api/logout':void c.officialInstagram.cancel();c.instagramTestPreview=null;c.search.cancel=true;c.webAbort?.abort();c.assistant.cancel();c.sender.stop();c.emails.stop();c.queue.pause();c.active=false;c.key='';c.ig=null;c.secret={};c.ready=null;accounts.revoke(req.headers.cookie);res.setHeader('Set-Cookie','nexo_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');return json(res,{ok:true});
  case '/api/assistant/message':{if(!c.key)throw Error('Conectá Claude para usar el asistente.');const result=await c.assistant.run(v.text,{context:campaignContext({store:c.store,instagram:c.ig?.account,search:c.search,queue:c.queue.state})});return json(res,{...result,state:state(c)});}
  case '/api/assistant/approved':{if(!c.key)throw Error('Conectá Claude para continuar.');if(c.assistant.busy)throw Error('Pausá el pedido anterior antes de autorizar.');c.assistant.authorize(v.ids,v.confirm);const result=await c.assistant.run('Iniciá los envíos autorizados que acabo de revisar.',{authorized:true,context:campaignContext({store:c.store,instagram:c.ig?.account,search:c.search,queue:c.queue.state})});return json(res,{...result,state:state(c)});}
  case '/api/assistant/pause':c.assistant.cancel();c.sender.stop();c.emails.stop();break;
  case '/api/settings':if(['smtpHost','smtpPort','smtpUser','attachment'].some(k=>k in v))throw Error('Configurá el servidor y adjuntos desde los controles de Email.');c.store.saveSettings(v);break;
  case '/api/results/clear':{if(['running','waiting'].includes(c.search.status))throw Error('Detené la búsqueda antes de limpiar.');const archived=cleanPending(c);c.search={status:'idle',found:0,target:100,stage:''};c.store.setJob('lastSearch',c.search);await excel(c);return json(res,{archived,state:state(c)});}
  case '/api/results/restore':c.store.restoreResults();await excel(c);break;
  case '/api/batch/preview':return json(res,prepareBatch(c.store,v.ids,v.channel));
  // Automatic send from Nexo's own Chrome window: one chat at a time, 20-40 s apart.
  case '/api/ig/login':return json(res,{logged:await c.sender.openLogin(),state:state(c)});
  case '/api/ig/send':{if(c.sender.active)throw Error('Ya hay una tanda enviándose.');if(v.confirm!==true)throw Error('Revisá y confirmá la tanda.');const batch=prepareBatch(c.store,v.ids,'instagram');if(v.token!==batch.token)throw Error('La tanda cambió. Revisá la vista previa nuevamente.');if(!batch.items.length)throw Error(batch.skipped[0]?.reason||'No hay clientes habilitados para enviar hoy.');approveBatch(c.store,batch);c.sender.start(batch.items);return json(res,{...batch,state:state(c)});}
  case '/api/ig/stop':c.sender.stop();break;
  case '/api/ig/resume':c.sender.resume();break;
  case '/api/ext/install':{const folder=await extensions.install(c.user.id);spawn('explorer.exe',[folder],{detached:true,stdio:'ignore'}).on('error',()=>{}).unref();const chrome=await chromePath();if(chrome)spawn(chrome,['chrome://extensions/'],{detached:true,stdio:'ignore'}).on('error',()=>{}).unref();return json(res,{folder,chrome:!!chrome,state:state(c)});}
  case '/api/batch/manual':{if(v.reviewed!==true)throw Error('Revisá los perfiles, su oportunidad y los textos.');const batch=prepareBatch(c.store,v.ids,'instagram');if(v.token!==batch.token)throw Error('La tanda cambió. Abrí la vista previa nuevamente.');approveBatch(c.store,batch);return json(res,{...batch,state:state(c)});}
  case '/api/claude':{const key=String(v.key||'').trim();if(!key)throw Error('Ingresá la clave de API de Claude.');try{await new Claude(key,c.store.settings().model).call(connectionRequest(campaignContext({store:c.store,instagram:c.ig?.account,search:c.search,queue:c.queue.state}))); }catch(e){throw Error(e.status===401?'La clave no es válida. Copiá una nueva desde tu cuenta de Anthropic.':e.status===429?'Anthropic no habilitó la conexión. Revisá saldo y límite de uso.':'No se pudo conectar. Revisá Internet, saldo y permisos de tu cuenta de Anthropic.');}c.key=key;c.secret.key=key;await saveConnection(c,v.remember===true);break;}
  case '/api/instagram/oauth/start':{if(!c.active)throw Error('Iniciá sesión de nuevo.');const username=handle(v.username);const result=await c.officialInstagram.start(username);c.queue.pause();c.store.saveSettings({instagramSender:username});return json(res,{...result,state:state(c)});}
  case '/api/instagram/oauth/cancel':await c.officialInstagram.cancel();break;
  case '/api/instagram/disconnect':await c.officialInstagram.cancel();c.queue.pause();c.ig=null;c.instagramTestPreview=null;delete c.secret.igToken;delete c.secret.igExpiresAt;await saveConnection(c,true);break;
  case '/api/instagram/batch/preview':return json(res,await previewOfficialBatch({store:c.store,instagram:c.ig,budget,ids:v.ids}));
  case '/api/instagram/test/preview':{c.instagramTestPreview=await previewInstagramTest({store:c.store,instagram:c.ig,budget,target:v.target,text:v.text});return json(res,{preview:c.instagramTestPreview,state:state(c)});}
  case '/api/instagram/test/send':{const result=await sendInstagramTest({store:c.store,instagram:c.ig,preview:c.instagramTestPreview,nonce:v.nonce,confirm:v.confirm});await excel(c);c.instagramTestPreview=null;return json(res,{...result,state:state(c)});}
  case '/api/instagram':{await c.officialInstagram.cancel();const ig=new Instagram(String(v.token||'').trim(),c.store.settings().graphVersion,{budget,profile:user.id});await ig.connect();c.ig=ig;for(const l of c.store.list().filter(l=>l.dnc))budget.doNotContact(ig.account.id,l.handle,true);c.secret.igToken=ig.token;delete c.secret.igExpiresAt;c.officialInstagram.state={status:'connected',message:'Instagram conectado: @'+ig.account.username};await saveConnection(c,v.remember===true);break;}
  case '/api/email-config':{const old=smtp(c),user=String(v.user||'').trim(),pass=String(v.pass||'').replace(/\s+/g,'');if(!pass&&(old.host!==v.host||old.port!==Number(v.port)||old.user!==user))throw Error('Volvé a ingresar la contraseña de aplicación al cambiar el servidor o la casilla.');const config=mailConfig({host:v.host,port:v.port,user,pass:pass||old.pass});await sendMail(config,null,{});c.store.saveSettings({smtpHost:config.host,smtpPort:config.port,smtpUser:config.user,emailFrom:v.fromName,...('subject'in v?{emailSubject:v.subject}:{})});c.secret.smtpPass=config.pass;await saveConnection(c,v.remember!==false);break;}
  case '/api/attachment':{const dir=attachmentDir(c.dir);if(v.remove){const old=c.store.settings().attachment;if(old)await fs.rm(path.join(dir,path.basename(old)),{force:true});c.store.saveSettings({attachment:''});break;}const name=path.basename(String(v.name||'')).replace(/[^\p{L}\p{N} ._()-]/gu,'_').slice(0,120);if(!ATTACHMENT_TYPES.includes(path.extname(name).toLowerCase()))throw Error('Adjuntá un PDF, Word, PowerPoint, Excel o imagen.');const data=Buffer.from(String(v.content||''),'base64');if(!data.length||data.length>8e6)throw Error('El adjunto debe pesar hasta 8 MB.');await fs.mkdir(dir,{recursive:true});const old=c.store.settings().attachment;if(old&&old!==name)await fs.rm(path.join(dir,path.basename(old)),{force:true});await fs.writeFile(path.join(dir,name),data);c.store.saveSettings({attachment:name});break;}
  case '/api/email/send':{
   if(v.confirm!==true)throw Error('Confirmá los emails antes de enviarlos.');
   if(c.emails.active)throw Error('Ya hay una tanda de email en curso.');
   const batch=v.reviewed===true?prepareBatch(c.store,v.ids,'email'):null;
   if(batch){if(v.token!==batch.token)throw Error('La tanda cambió. Revisá la vista previa nuevamente.');if(!batch.items.length)throw Error('No hay emails habilitados.');approveBatch(c.store,batch);}
   else {if(!Array.isArray(v.ids)||!v.ids.length||v.ids.length>100)throw Error('Elegí entre 1 y 100 clientes.');for(const id of v.ids){const l=c.store.get(Number(id));if(!l)throw Error('Cliente inexistente.');const block=c.store.gate({...l,approved:1},new Date(),false,'','email');if(block)throw Error(block);c.store.update(l.id,{approved:true});}}
   const job=c.emails.start(batch?batch.items.map(l=>l.id):v.ids,smtp(c));return json(res,{started:job.items.length,state:state(c)});
  }
  case '/api/email/stop':c.emails.stop();break;
  case '/api/email/resume':c.emails.resume(smtp(c));break;
  case '/api/schedule':{if(v.confirm!==true)throw Error('Confirmá la programación.');if(!Array.isArray(v.ids)||!v.ids.length||v.ids.length>200)throw Error('Elegí entre 1 y 200 clientes.');if(!['email','instagram'].includes(v.channel))throw Error('Elegí email o Instagram.');const r=c.store.schedule(v.ids,v.channel,v.at);return json(res,{...r,state:state(c)});}
  case '/api/schedule/cancel':c.store.cancelSchedule(v.id);break;
  case '/api/open-chat':{// Open the Instagram chat in Chrome (where the user is signed in to Instagram); only ig.me chat links.
   const url='https://ig.me/m/'+handle(v.handle);const local=process.env.LOCALAPPDATA||'';let chrome='';for(const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',path.join(local,'Google','Chrome','Application','chrome.exe')]){try{await fs.access(p);chrome=p;break;}catch{}}
   const child=chrome?spawn(chrome,[url],{detached:true,stdio:'ignore',windowsHide:false}):spawn('explorer.exe',[url],{detached:true,stdio:'ignore'});child.on('error',()=>{});child.unref();return json(res,{ok:true,browser:chrome?'chrome':'default'});}
  case '/api/disconnect':void c.officialInstagram.cancel();c.instagramTestPreview=null;c.assistant.cancel();c.sender.stop();c.emails.stop();c.queue.pause();c.key='';c.ig=null;c.secret={};accounts.save(user.id,'');break;
  case '/api/sync':if(!c.ig)throw Error('Conectá Instagram primero.');return json(res,{...await c.ig.sync(c.store),state:state(c)});
  case '/api/search':{
   if(['running','waiting'].includes(c.search.status))throw Error('Ya hay una búsqueda en curso.');
   if(!/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(v.seed||''))throw Error('Pegá el enlace completo del perfil de Instagram.');
   const seed=`https://www.instagram.com/${handle(v.seed)}/`;
   if(v.mode==='api'&&!c.key)throw Error('La opción API requiere una conexión.');
   c.store.saveSettings({lastSeed:seed});
   const archived=c.store.settings().clearOnSearch?cleanPending(c):0;
   if(v.mode==='api')void runSearch(c,seed);else void runWebSearch(c,seed);
   return json(res,{archived,state:state(c)});
  }
  case '/api/search/resume':if(v.confirm!==true||c.search.status!=='waiting'||!c.browserResume)throw Error('No hay una verificación pendiente.');c.browserResume();break;
  case '/api/search/browser':if(!c.searchBrowser)throw Error('Primero iniciá una búsqueda.');await c.searchBrowser.show();break;
  case '/api/search/stop':c.search.cancel=true;c.webAbort?.abort();break;
  case '/api/import':{const stats=ingest(c.store,readImport(v));await excel(c);return json(res,{...stats,state:state(c)});}
  case '/api/add':{const result=c.store.add(v);if(result.added)c.store.setScore(result.id,v.score,v.score_reason);await excel(c);break;}
  case '/api/activity':c.store.setActivity(Number(v.id),{active:v.active===true,by:'user',note:v.active===true?'Marcada por vos: publica seguido':'Marcada por vos: poco activa'});if(v.active===true)c.store.update(Number(v.id),{approved:false});await excel(c);break;
  case '/api/update':c.store.update(Number(v.id),v);if(c.ig?.account&&'dnc'in v)budget.doNotContact(c.ig.account.id,c.store.get(Number(v.id)).handle,v.dnc===true);await excel(c);break;
  case '/api/manual':{if(v.confirm!==true)throw Error('Confirmá que ya enviaste la propuesta.');const event=c.store.reserve(Number(v.id));c.store.finish(event.event,'sent','Confirmado manualmente');await excel(c);break;}
  case '/api/send':if(!c.ig)throw Error('Conectá Instagram.');await c.ig.send(c.store,Number(v.id));await excel(c);break;
  case '/api/queue/start':{if(v.reviewed===true){await startOfficialBatch({store:c.store,instagram:c.ig,budget,queue:c.queue,ids:v.ids,token:v.token,confirm:v.confirm});break;}if(!c.ig?.account)throw Error('Conectá Instagram para usar el envío automático oficial.');if(v.confirm!==true)throw Error('Revisá y confirmá las propuestas seleccionadas.');await c.ig.sync(c.store);if(!Array.isArray(v.ids)||v.ids.length>100)throw Error('La selección admite hasta 100 clientes.');for(const id of v.ids)c.store.update(Number(id),{approved:true});c.queue.start(v.ids);break;}
  case '/api/queue/pause':c.queue.pause();break;
  case '/api/queue/resume':if(!c.ig)throw Error('Conectá Instagram para reanudar.');c.queue.resume();break;
  case '/api/demo':{for(const [i,name,city,country,score]of [[1,'DEMO · Hotel Brisa','Mar del Plata','Argentina',91],[2,'DEMO · Posada del Puerto','Colonia','Uruguay',84],[3,'DEMO · Hotel Azahar','Sevilla','España',72]]){const r=c.store.add({handle:`demo_hotel_ficticio_${i}`,name,city,country,reason:'Hotel ficticio para probar la aplicación.',source:'https://example.com',message:`DEMO: Hola, equipo de ${name}. Esta propuesta es una simulación.`},{demo:true});c.store.update(r.id,{approved:true});c.store.setScore(r.id,score,'Ejemplo ficticio de afinidad.');}await excel(c);break;}
  case '/api/clear-demo':c.store.db.exec('BEGIN IMMEDIATE');try{c.store.db.exec('DELETE FROM events WHERE lead_id IN (SELECT id FROM leads WHERE demo=1);DELETE FROM leads WHERE demo=1;COMMIT');}catch(e){c.store.db.exec('ROLLBACK');throw e;}await excel(c);break;
  case '/api/reconcile':{const e=c.store.db.prepare("SELECT * FROM events WHERE id=? AND status='uncertain'").get(Number(v.event));if(!e||!['sent','failed'].includes(v.status))throw Error('Conciliación inválida.');c.store.finish(e.id,v.status,'Conciliado por usuario');budget.finish(user.id+':'+e.id,v.status);await excel(c);break;}
  default:return json(res,{error:'No encontrado'},404);
 }
 return json(res,{ok:true,state:state(c)});
}catch(e){if(!res.headersSent){if(e.code==='LOGIN_LOCKED'){res.setHeader('Retry-After',String(e.retryAfterSeconds));json(res,{error:e.message,code:e.code,retryAt:e.retryAt,retryAfterSeconds:e.retryAfterSeconds},429);}else json(res,{error:e.message||'No se pudo completar la acción.'},e.status===413?413:400);}else res.end();}});
const background=new Map();let scheduling=false;
async function scheduleTarget(u){const c=contexts.get(u.id);if(c&&c.ready){await c.ready;return {store:c.store,dir:c.dir,secret:c.secret,save:()=>excel(c)};}let t=background.get(u.id);if(!t){const dir=accounts.folder(u);t={store:new Store(dir),dir,secret:{},at:0};background.set(u.id,t);}if(Date.now()-t.at>300000){t.at=Date.now();const saved=accounts.saved(u.id);try{t.secret=saved?await vault('open',saved):{};}catch{t.secret={};}}return {...t,save:()=>exportWorkbook({generated:new Date().toISOString(),settings:t.store.settings(),leads:t.store.list(),history:t.store.history()},path.join(t.dir,'Clientes.xlsx')).catch(()=>{})};}
const scheduler=setInterval(async()=>{if(stopping||scheduling)return;scheduling=true;try{for(const u of accounts.db.prepare('SELECT id,name,legacy FROM users').all()){if(stopping)break;try{const t=await scheduleTarget(u);const s=t.store.settings();await runSchedules({store:t.store,dir:t.dir,smtp:{host:s.smtpHost,port:s.smtpPort,user:s.smtpUser,pass:t.secret.smtpPass||''},onSent:t.save});}catch(e){console.error('Programados:',e.message);}}}finally{scheduling=false;}},20000);scheduler.unref();
async function acceptOfficialInstagram(c,result,valid){const ig=new Instagram(result.token,c.store.settings().graphVersion,{budget,profile:c.user.id});await ig.connect();if(ig.account.id!==result.account.id||ig.account.username.toLowerCase()!==result.account.username.toLowerCase())throw Error('Meta devolvió una cuenta distinta de la autorizada.');if(!valid()||!c.active||c.validUntil<=Date.now()||stopping)return;const secret={...c.secret,igToken:result.token,igExpiresAt:result.expiresAt},sealed=await vault('seal',secret);if(!valid()||!c.active||c.validUntil<=Date.now()||stopping)return;accounts.save(c.user.id,sealed);c.secret=secret;c.ig=ig;c.warning='';c.instagramTestPreview=null;for(const l of c.store.list().filter(l=>l.dnc))budget.doNotContact(ig.account.id,l.handle,true);}
const officialHeartbeat=setInterval(()=>{if(stopping)return;for(const c of contexts.values())if(c.active&&c.validUntil>Date.now()){if(c.ig&&c.secret.igExpiresAt&&c.secret.igExpiresAt<=Date.now()){c.queue.pause();c.ig=null;c.officialInstagram.state={status:'failed',message:'La autorización de Instagram venció. Volvé a conectar.'};}void c.officialInstagram.tick((r,valid)=>acceptOfficialInstagram(c,r,valid));}},3000);officialHeartbeat.unref();
const heartbeat=setInterval(()=>{if(stopping)return;for(const c of contexts.values())if(c.active&&c.validUntil>Date.now())void c.queue.tick().catch(()=>{c.queue.pause();});},1000);heartbeat.unref();
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Nexo ya está abierto o el puerto está ocupado.':e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',async()=>{try{await fs.writeFile(path.join(data,'.shutdown-token'),shutdownToken,{mode:0o600});console.log(`Nexo: ${origin}`);}catch{console.error('No se pudo preparar el cierre seguro de Nexo.');server.close();process.exitCode=1;}});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stopping=true;for(const c of contexts.values()){c.search.cancel=true;c.webAbort?.abort();c.assistant.cancel();c.sender.stop();c.emails.stop();c.queue.pause();}server.close(()=>{for(const c of contexts.values())c.store.close();accounts.close();budget.close();process.exit(0);});});
