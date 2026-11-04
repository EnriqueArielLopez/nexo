// Sends the Instagram batch from a window of the user's Chrome (through Nexo's extension) or from Nexo's own Chrome window,
// signed in to the user's account: one chat at a time,
// with a 20-40 s pause between sends. Before each send it reads the real profile (name and last posts) and skips
// accounts that aren't lodgings, that post often, or that were already contacted. Debugging listens only on loopback.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {DevtoolsConnection} from './browser-search.mjs';
import {chatExpression} from './instagram-chat.mjs';
import {otherTrade} from './web-discovery.mjs';

// Chrome doesn't let other programs control the user's main window, so Nexo uses its own Chrome profile.
async function findBrowser(){
 const roots=[process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean);
 for(const app of [['Google','Chrome','Application','chrome.exe'],['Microsoft','Edge','Application','msedge.exe']])for(const root of roots){const executable=path.join(root,...app);try{await fs.access(executable);return executable;}catch{}}
 throw Error('No se encontró Google Chrome. Instalalo para enviar desde Nexo.');
}
const freePort=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>resolve(port));});});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const flat=s=>String(s||'').replace(/\s+/g,' ').trim();
export const WARNING=/intentalo m[aá]s tarde|int[eé]ntalo de nuevo m[aá]s tarde|try again later|restringimos|we restrict|limitamos (?:la frecuencia|cu[aá]ntas)|action blocked|acci[oó]n bloqueada|tu cuenta (?:fue|ha sido) (?:suspendida|restringida)|confirm(?:a|á) que (?:eres|sos) (?:una persona|vos)|challenge_required/i;
export const CANT_RECEIVE=/no puede recibir (?:tu|mensajes)|can.t receive (?:your )?messages|not accepting messages|no acepta mensajes/i;
export const MISSING=/esta p[aá]gina no est[aá] disponible|sorry, this page isn.t available|this page isn.t available|el enlace que seleccionaste puede no funcionar/i;

// Runs in the profile page: name, availability and the links of the grid. Each post's code carries its publication time,
// so the last posts' dates come out without opening them (it works without signing in).
const PROFILE=`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<40&&!document.querySelector('main');i++)await wait(250);
const grid=()=>document.querySelectorAll('main a[href*="/p/"],main a[href*="/reel/"]').length;for(let i=0;i<16&&!grid();i++)await wait(250);await wait(800);
const text=(document.querySelector('main')||document.body).innerText.slice(0,3000);
const codes=[...document.querySelectorAll('main a[href*="/p/"],main a[href*="/reel/"]')].map(a=>{const p=a.getAttribute('href').split('/').filter(Boolean),i=p.findIndex(x=>x==='p'||x==='reel');return p[i+1];}).filter(Boolean);
return {title:document.title,text,codes,empty:/no posts yet|a[uú]n no hay publicaciones|todav[ií]a no hay publicaciones/i.test(text)};})()`;
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
// Instagram's media ids start with the milliseconds since its own epoch; the post code is that id in base 64.
export function postDate(code){let id=0n;for(const ch of String(code).slice(0,11)){const n=ALPHABET.indexOf(ch);if(n<0)return '';id=id*64n+BigInt(n);}const at=new Date(Number(id>>23n)+1314220021721);return at.getFullYear()>2011&&at-Date.now()<864e5?at.toISOString().slice(0,10):'';}
const BOX=`document.querySelector('div[contenteditable="true"][role="textbox"]')`;

export class InstagramSender {
 constructor(profileDir,{store,onChange,saveExcel=async()=>{},connect=DevtoolsConnection.connect,launch=spawn,edge=findBrowser,readFile=fs.readFile,pause=[20000,40000],wait=sleep,loginWait=300,bridge=null,jobName='chromeSender'}={}){
  Object.assign(this,{profileDir:path.resolve(profileDir),store,onChange,saveExcel,connect,launch,edge,readFile,pause,wait,loginWait,bridge,jobName});this.client=null;this.sessionId='';this.targetId='';
  this.active=false;this.state=(jobName?store?.job(jobName):null)||{status:'idle',total:0,sent:0,skipped:0,current:'',nextAt:0,message:'',items:[]};
  if(['running','waiting','login'].includes(this.state.status)){this.state={...this.state,status:'paused',current:'',nextAt:0,message:'La tanda se interrumpió. Revisá el historial y reanudá los pendientes.'};this.emit();}
 }
 publicState(){return {...this.state,active:this.active,items:this.state.items.map(i=>({...i}))};}
 // Chrome 156 doesn't report a port it picks itself, so Nexo picks a free one and keeps it next to the profile.
 async endpoint(){const saved=Number(String(await this.readFile(path.join(this.profileDir,'nexo-port'),'utf8').catch(()=>'')).trim());if(Number.isInteger(saved)&&saved>=1024&&saved<=65535){const r=await fetch(`http://127.0.0.1:${saved}/json/version`,{signal:AbortSignal.timeout(2000)}).then(r=>r.json()).catch(()=>null);const ws=r?.webSocketDebuggerUrl;if(typeof ws==='string'&&new URL(ws).hostname==='127.0.0.1'&&/^\/devtools\/browser\/[a-z0-9-]+$/i.test(new URL(ws).pathname))return ws;}
  const text=await this.readFile(path.join(this.profileDir,'DevToolsActivePort'),'utf8');const [line,browserPath]=text.trim().split(/\r?\n/);const port=Number(line);if(!Number.isInteger(port)||port<1024||port>65535||!/^\/devtools\/browser\/[a-z0-9-]+$/i.test(browserPath))throw Error('Puerto del navegador inválido.');return 'ws://127.0.0.1:'+port+browserPath;}
 async ensure(){
  if(this.client){try{await this.client.call('Target.getTargetInfo',{targetId:this.targetId});return;}catch{this.client.close();this.client=null;}}
  // With Nexo's extension, the window is one of the user's own Chrome.
  if(this.bridge){if(!this.bridge.connected())throw Error('Chrome no está conectado con Nexo. Abrí Chrome y, si es la primera vez, instalá la extensión desde «Conectar mi Chrome».');this.client=this.bridge;}
  else try{this.client=await this.connect(await this.endpoint());}catch{}
  if(!this.client){
   await fs.mkdir(this.profileDir,{recursive:true});const executable=await this.edge();
   // Reuse the dedicated profile; never synchronously scan or terminate browser processes.
   const port=await freePort();await fs.writeFile(path.join(this.profileDir,'nexo-port'),String(port));
   // A profile only for Nexo's sends: the user signs in to Instagram there once.
   const child=this.launch(executable,['--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+this.profileDir,'--no-first-run','--no-default-browser-check','--start-minimized','--new-window','--window-size=1100,850','about:blank'],{stdio:'ignore',windowsHide:true,detached:true});
   let launchError=null;child.once('error',e=>{launchError=e;});child.unref();
   for(let i=0;i<120&&!this.client;i++){if(launchError)throw Error('No se pudo abrir Chrome.');await sleep(250);try{this.client=await this.connect(await this.endpoint());}catch{}}
   if(!this.client)throw Error('No se pudo abrir la ventana de envíos de Nexo. Cerrala y volvé a intentar.');
  }
  const targets=await this.client.call('Target.getTargets');
  const page=targets.targetInfos?.find(t=>t.type==='page');
  const target=page||await this.client.call('Target.createTarget',{url:'about:blank'});this.targetId=target.targetId;
  const attached=await this.client.call('Target.attachToTarget',{targetId:this.targetId,flatten:true});this.sessionId=attached.sessionId;
  await this.client.call('Page.enable',{},this.sessionId);
  // Keeps the page behaving as focused while the user works in other windows.
  await this.backgroundFocus();
 }
 async backgroundFocus(){await this.client.call('Emulation.setFocusEmulationEnabled',{enabled:true},this.sessionId);}
 async chat(handle){return this.eval(chatExpression(handle));}
 async show(){await this.ensure();const {windowId}=await this.client.call('Browser.getWindowForTarget',{targetId:this.targetId});await this.client.call('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await this.client.call('Target.activateTarget',{targetId:this.targetId});}
 async go(url){const r=await this.client.call('Page.navigate',{url},this.sessionId);if(r.errorText)throw Error('No se pudo abrir Instagram. Revisá la conexión.');for(let i=0;i<60;i++){await sleep(250);const s=await this.eval('document.readyState').catch(()=>'');if(s==='complete')break;}await this.backgroundFocus();}
 async eval(expression){const r=await this.client.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},this.sessionId);if(r.exceptionDetails)throw Error('Instagram cambió la página: no se pudo leer.');return r.result?.value;}
 async loggedIn(){await this.ensure();const {cookies=[]}=await this.client.call('Network.getCookies',{urls:['https://www.instagram.com/']},this.sessionId);return cookies.some(c=>c.name==='ds_user_id'&&c.value);}
 // Opens the window on Instagram so the user signs in (Nexo never sees the password).
 async openLogin(){await this.ensure();await this.show();if(!(await this.loggedIn()))await this.go('https://www.instagram.com/accounts/login/');else await this.go('https://www.instagram.com/');return this.loggedIn();}
 async key(modifiers=0){const k={key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,modifiers};await this.client.call('Input.dispatchKeyEvent',{type:'keyDown',...k,text:'\r',unmodifiedText:'\r'},this.sessionId);await this.client.call('Input.dispatchKeyEvent',{type:'keyUp',...k},this.sessionId);}
 async box(){const r=await this.eval(`(()=>{const b=${BOX};if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,text:b.innerText};})()`);return r;}
 // One page for searches and sends: they take turns.
 exclusive(fn){const run=(this.lock||Promise.resolve()).then(fn,fn);this.lock=run.catch(()=>{});return run;}
 // Reads a profile: whether it exists, its name, and the dates of its last posts (null if the grid didn't load).
 async read(handle){
  await this.go(`https://www.instagram.com/${handle}/`);const p=await this.eval(PROFILE);const page=p.text+' '+p.title;
  const dates=[...new Set(p.codes.map(postDate).filter(Boolean))].sort().reverse().slice(0,12);
  return {title:flat(p.title),warning:WARNING.test(p.text),missing:MISSING.test(page)||/isn.t available|no est[aá] disponible/i.test(p.title),dates:dates.length||p.empty?dates:null};
 }
 // For the search: checks one account in this window, minimized if it wasn't open.
 inspect(handle){return this.exclusive(async()=>{if(!this.client){await this.ensure();await this.minimize().catch(()=>{});}else await this.ensure();return this.read(handle);});}
 async minimize(){const {windowId}=await this.client.call('Browser.getWindowForTarget',{targetId:this.targetId});await this.client.call('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});}
 async click(x,y){for(const type of ['mousePressed','mouseReleased'])await this.client.call('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1},this.sessionId);}
 log(item,status,note){Object.assign(item,{status,note});this.state.current='';this.emit();}
 emit(){this.state.sent=this.state.items.filter(i=>i.status==='sent').length;this.state.skipped=this.state.items.filter(i=>['skipped','failed'].includes(i.status)).length;if(this.jobName)this.store?.setJob(this.jobName,this.state);this.onChange?.(this.publicState());}
 async delay(ms){if(this.wait!==sleep)return this.wait(ms);if(this.cancel)return;await new Promise(resolve=>{this.wake=()=>{clearTimeout(timer);this.wake=null;resolve();};const timer=setTimeout(this.wake,ms);});}
 clear(){if(this.active)throw Error('Detené la tanda antes de limpiarla.');this.state={status:'idle',total:0,sent:0,skipped:0,current:'',nextAt:0,message:'',items:[]};this.emit();}
 resume(){if(this.active)throw Error('La tanda todavía está en curso.');if(!this.state.items.some(i=>i.status==='pending'))throw Error('No hay envíos pendientes para reanudar.');this.cancel=false;this.state.status='running';this.state.message='Reanudando los pendientes…';this.launchRun();return this.publicState();}
 launchRun(){this.active=true;this.emit();this.done=this.run().catch(e=>{this.state.status='error';this.state.message=e.message;}).finally(()=>{this.active=false;this.state.nextAt=0;this.emit();});}
 stop(){if(this.active){this.cancel=true;this.wake?.();this.state.message='Deteniendo después del envío en curso…';this.emit();}}
 start(items){
  if(this.active)throw Error('Ya hay una tanda enviándose.');
  if(!items.length)throw Error('No hay clientes para enviar.');
  this.cancel=false;this.state={status:'running',total:items.length,sent:0,skipped:0,current:'',nextAt:0,message:'Preparando la ventana de envíos…',items:items.map(l=>({id:l.id,name:l.name||l.handle,handle:l.handle,message:l.message,status:'pending',note:''}))};
  this.launchRun();return this.publicState();
 }
 async run(){
  await this.ensure();await this.minimize();
  if(!(await this.loggedIn())){
   // First time: the user signs in to Instagram in this window and the batch starts by itself.
   await this.show();await this.go('https://www.instagram.com/accounts/login/');this.state.status='login';this.state.message='Iniciá sesión en Instagram en la ventana que se abrió. Apenas entres, Nexo empieza a enviar solo.';this.emit();
   for(let i=0;i<this.loginWait&&!this.cancel;i++){await this.delay(3000);if(await this.loggedIn().catch(()=>false))break;}
   if(this.cancel||!(await this.loggedIn().catch(()=>false))){this.state.status=this.cancel?'paused':'login';this.state.message=this.cancel?'Tanda detenida. Podés reanudar los pendientes.':'No se inició sesión en Instagram. Iniciá sesión en la ventana de Nexo y tocá «Reanudar el envío».';this.emit();return;}
   this.state.status='running';await this.minimize();await this.delay(4000);
  }
  const items=this.state.items;
  for(const [n,item] of items.entries()){
   if(this.cancel)break;if(item.status!=='pending')continue;
   this.state.current=item.handle;this.state.message=`Revisando @${item.handle} (${n+1} de ${items.length})`;this.emit();
   let sent=false;
   try{sent=await this.exclusive(()=>this.one(item));}catch(e){if(e.stopBatch){this.log(item,'failed',e.message);this.state.status='paused';this.state.message=e.message;this.emit();return;}this.log(item,'failed',e.message);}
   this.emit();
   const rest=items.slice(n+1).some(i=>i.status==='pending');
   if(rest&&!this.cancel){const ms=sent?this.pause[0]+Math.random()*(this.pause[1]-this.pause[0]):3000+Math.random()*3000;this.state.status='waiting';this.state.nextAt=Date.now()+ms;this.state.message=sent?`Enviado a @${item.handle}. Próximo en ${Math.round(ms/1000)} segundos.`:`Salteado @${item.handle}. Sigue con el próximo.`;this.emit();await this.delay(ms);this.state.status='running';this.state.nextAt=0;}
  }
  await this.go('about:blank').catch(()=>{});
  this.state.status=this.cancel?'paused':'done';this.state.current='';this.state.message=this.cancel?`Detenido: ${this.state.sent} enviados.`:`Listo: ${this.state.sent} enviados${this.state.skipped?`, ${this.state.skipped} salteados`:''}.`;this.emit();
 }
 // One account: checks, then sends. Returns true only when the message shows up as sent in the chat.
 async one(item){
  const store=this.store,lead=store.get(item.id);
  const block=lead&&store.gate({...lead,approved:1,qualification:''},new Date());
  if(!lead||block){this.log(item,'skipped',block||'Ya no está en la lista');return false;}
  if(lead.message!==item.message)throw Object.assign(Error('La propuesta cambió. Revisá la tanda antes de enviar.'),{stopBatch:true});
  let activity={};try{activity=JSON.parse(lead.activity||'{}');}catch{}
  const fresh=activity.source==='profile'&&Date.now()-Date.parse(activity.checkedAt)>=0&&Date.now()-Date.parse(activity.checkedAt)<864e5;
  const p=fresh?{title:lead.name,dates:null}:await this.read(item.handle);
  if(p.warning)throw Object.assign(Error('Instagram mostró un aviso. Se pausó la tanda: revisá la ventana de Nexo antes de seguir.'),{stopBatch:true});
  if(p.missing){store.update(item.id,{dnc:true});this.log(item,'skipped','La cuenta ya no existe');return false;}
  if(/hotel|resort|posada|hostal|apart/i.test(store.settings().segment)&&otherTrade({title:p.title,url:`https://www.instagram.com/${item.handle}/`})){store.update(item.id,{dnc:true});this.log(item,'skipped','No es un alojamiento: '+p.title.slice(0,60));return false;}
  if(p.dates){const a=store.setActivity(item.id,{dates:p.dates,source:'profile',note:'Revisado por Nexo antes de enviar'});if(a.verdict==='active'){store.update(item.id,{approved:false});this.log(item,'skipped',`Publica seguido (${a.weeks} de ${a.span} semanas)`);return false;}}
  else{let checked=false;try{checked=['profile','user'].includes(JSON.parse(lead.activity||'{}').source);}catch{}if(!checked){this.log(item,'skipped','No se pudieron leer sus publicaciones');return false;}}
  this.state.message=`Escribiendo a @${item.handle}`;this.emit();
  await this.go(`https://ig.me/m/${item.handle}`);
  let chat=null,b=null,stable=0,last='';
  // A bounded read of this conversation, once per unknown recipient. Positive results are cached in SQLite.
  for(let i=0;i<25;i++){
   if(this.cancel)return false;
   await this.delay(400);
   await this.eval(`(()=>{const b=[...document.querySelectorAll('[role="dialog"] button')].find(x=>/^(Ahora no|Not Now)$/i.test(x.innerText.trim()));if(b)b.click();})()`).catch(()=>{});
   chat=await this.chat(item.handle);
   if(WARNING.test(chat.text))throw Object.assign(Error('Instagram mostró un aviso. Se pausó la tanda: revisá el navegador desde Nexo.'),{stopBatch:true});
   if(chat.identity&&chat.hasMessages){store.rememberContact(item.id);this.log(item,'skipped','Ya tiene una conversación en Instagram. Guardado en Enviados; no se volvió a escribir.');await this.saveExcel().catch(()=>{});return false;}
   if(chat.identity&&CANT_RECEIVE.test(chat.text)){this.log(item,'skipped','La cuenta no acepta mensajes');return false;}
   b=await this.box();
   const signature=JSON.stringify([chat.identity,chat.ready,chat.messages,chat.text]);
   stable=signature===last?stable+1:0;last=signature;
   if(chat.identity&&chat.ready&&b&&stable>=4)break;
  }
  if(!chat?.identity||!chat.ready||!b||stable<4){this.log(item,'skipped','No se pudo verificar que el chat esté vacío. Revisá la cuenta antes de reintentar.');return false;}
  const message=String(item.message||'').replace(/\r/g,''),probe=flat(message);
  await this.backgroundFocus();
  if(flat(b.text)){await this.click(b.x,b.y);await this.client.call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},this.sessionId);await this.client.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},this.sessionId);await this.client.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},this.sessionId);await this.client.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},this.sessionId);}
  await this.click(b.x,b.y);
  const lines=message.split('\n');
  for(const [i,line] of lines.entries()){if(line)await this.client.call('Input.insertText',{text:line},this.sessionId);if(i<lines.length-1)await this.key(8);await sleep(60);}
  await sleep(500);
  const draft=await this.box();
  if(!draft||flat(draft.text)!==flat(message))throw Object.assign(Error(`El mensaje para @${item.handle} no se pegó completo. Se pausó la tanda sin enviarlo.`),{stopBatch:true});
  if(this.cancel){item.note='Pendiente: tanda detenida antes de enviar';return false;}
  const finalChat=await this.chat(item.handle);
  if(!finalChat.identity||!finalChat.ready)throw Object.assign(Error('El chat cambió antes de enviar. Revisá el destinatario.'),{stopBatch:true});
  if(finalChat.hasMessages){store.rememberContact(item.id);this.log(item,'skipped','Conversación previa detectada antes de enviar; no se volvió a escribir.');await this.saveExcel().catch(()=>{});return false;}
  const event=store.reserve(item.id);
  try{
  await this.key(0);
  for(let i=0;i<30;i++){await sleep(500);const now=await this.box().catch(()=>null);const confirmation=await this.chat(item.handle).catch(()=>null),text=confirmation?.text||'';
   if(WARNING.test(text)){store.finish(event.event,'uncertain','Instagram mostró un aviso al enviar');throw Object.assign(Error('Instagram mostró un aviso al enviar. Se pausó la tanda: revisá la ventana de Nexo.'),{stopBatch:true});}
   if(now&&!flat(now.text)&&confirmation?.identity&&confirmation.messages.some(t=>flat(t)===probe)){store.finish(event.event,'sent','Enviado por Nexo');this.log(item,'sent','Enviado');await this.saveExcel().catch(()=>{});return true;}}
  // The text left the box but didn't show up: counts as contacted so it's never sent twice; the user checks it.
  store.finish(event.event,'uncertain','No se pudo confirmar en el chat');throw Object.assign(Error(`No se pudo confirmar el envío a @${item.handle}. Se pausó la tanda: fijate en la ventana de Nexo si salió.`),{stopBatch:true});
  }catch(e){const status=store.db.prepare('SELECT status FROM events WHERE id=?').get(event.event)?.status;if(status==='pending')store.finish(event.event,'uncertain','Conexión interrumpida después de preparar el envío');e.stopBatch=true;throw e;}
 }
}
