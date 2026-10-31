// Sends the Instagram batch from Nexo's own Edge window, signed in to the user's account: one chat at a time,
// with a 20-40 s pause between sends. Before each send it reads the real profile (name and last posts) and skips
// accounts that aren't lodgings, that post often, or that were already contacted. Debugging listens only on loopback.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DevtoolsConnection} from './browser-search.mjs';
import {otherTrade} from './web-discovery.mjs';

async function findEdge(){
 const roots=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean);
 for(const root of roots){const executable=path.join(root,'Microsoft','Edge','Application','msedge.exe');try{await fs.access(executable);return executable;}catch{}}
 throw Error('No se encontró Microsoft Edge. Instalalo desde Microsoft para enviar desde Nexo.');
}
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
 constructor(profileDir,{store,onChange,saveExcel=async()=>{},connect=DevtoolsConnection.connect,launch=spawn,edge=findEdge,readFile=fs.readFile,pause=[20000,40000],wait=sleep,loginWait=300}={}){
  Object.assign(this,{profileDir:path.resolve(profileDir),store,onChange,saveExcel,connect,launch,edge,readFile,pause,wait,loginWait});this.client=null;this.sessionId='';this.targetId='';
  this.state={status:'idle',total:0,sent:0,skipped:0,current:'',nextAt:0,message:'',items:[]};
 }
 publicState(){return {...this.state,items:this.state.items.map(i=>({...i}))};}
 async endpoint(){const text=await this.readFile(path.join(this.profileDir,'DevToolsActivePort'),'utf8');const [line,browserPath]=text.trim().split(/\r?\n/);const port=Number(line);if(!Number.isInteger(port)||port<1024||port>65535||!/^\/devtools\/browser\/[a-z0-9-]+$/i.test(browserPath))throw Error('Puerto del navegador inválido.');return 'ws://127.0.0.1:'+port+browserPath;}
 async ensure(){
  if(this.client){try{await this.client.call('Target.getTargetInfo',{targetId:this.targetId});return;}catch{this.client.close();this.client=null;}}
  try{this.client=await this.connect(await this.endpoint());}catch{}
  if(!this.client){
   await fs.mkdir(this.profileDir,{recursive:true});const executable=await this.edge();
   // A profile only for Nexo's sends: the user signs in to Instagram there once.
   const child=this.launch(executable,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+this.profileDir,'--no-first-run','--no-default-browser-check','--new-window','--window-size=1100,850','about:blank'],{stdio:'ignore',windowsHide:false});
   let launchError=null;child.once('error',e=>{launchError=e;});child.unref();
   for(let i=0;i<40&&!this.client;i++){if(launchError)throw Error('No se pudo abrir Microsoft Edge.');await sleep(250);try{this.client=await this.connect(await this.endpoint());}catch{}}
   if(!this.client)throw Error('No se pudo abrir la ventana de envíos de Nexo. Cerrala y volvé a intentar.');
  }
  const targets=await this.client.call('Target.getTargets');
  const page=targets.targetInfos?.find(t=>t.type==='page');
  const target=page||await this.client.call('Target.createTarget',{url:'about:blank'});this.targetId=target.targetId;
  const attached=await this.client.call('Target.attachToTarget',{targetId:this.targetId,flatten:true});this.sessionId=attached.sessionId;
  await this.client.call('Page.enable',{},this.sessionId);
  // Keeps the page behaving as focused while the user works in other windows.
  await this.client.call('Emulation.setFocusEmulationEnabled',{enabled:true},this.sessionId).catch(()=>{});
 }
 async show(){await this.ensure();const {windowId}=await this.client.call('Browser.getWindowForTarget',{targetId:this.targetId});await this.client.call('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await this.client.call('Target.activateTarget',{targetId:this.targetId});}
 async go(url){const r=await this.client.call('Page.navigate',{url},this.sessionId);if(r.errorText)throw Error('No se pudo abrir Instagram. Revisá la conexión.');for(let i=0;i<60;i++){await sleep(250);const s=await this.eval('document.readyState').catch(()=>'');if(s==='complete')break;}}
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
 emit(){this.onChange?.(this.publicState());}
 stop(){if(['running','waiting'].includes(this.state.status)){this.cancel=true;this.state.message='Deteniendo después del envío en curso…';}}
 start(items){
  if(['running','waiting'].includes(this.state.status))throw Error('Ya hay una tanda enviándose.');
  if(!items.length)throw Error('No hay clientes para enviar.');
  this.cancel=false;this.state={status:'running',total:items.length,sent:0,skipped:0,current:'',nextAt:0,message:'Preparando la ventana de envíos…',items:items.map(l=>({id:l.id,name:l.name||l.handle,handle:l.handle,message:l.message,status:'pending',note:''}))};
  this.done=this.run().catch(e=>{this.state.status='error';this.state.message=e.message;this.emit();});return this.publicState();
 }
 async run(){
  await this.ensure();await this.show();
  if(!(await this.loggedIn())){
   // First time: the user signs in to Instagram in this window and the batch starts by itself.
   await this.go('https://www.instagram.com/accounts/login/');this.state.status='login';this.state.message='Iniciá sesión en Instagram en la ventana que se abrió. Apenas entres, Nexo empieza a enviar solo.';this.emit();
   for(let i=0;i<this.loginWait&&!this.cancel;i++){await this.wait(3000);if(await this.loggedIn().catch(()=>false))break;}
   if(this.cancel||!(await this.loggedIn().catch(()=>false))){this.state.status='login';this.state.message='No se inició sesión en Instagram. Iniciá sesión en la ventana de Nexo y tocá «Reanudar el envío».';this.emit();return;}
   this.state.status='running';await this.wait(4000);
  }
  const items=this.state.items;
  for(const [n,item] of items.entries()){
   if(this.cancel)break;
   this.state.current=item.handle;this.state.message=`Revisando @${item.handle} (${n+1} de ${items.length})`;this.emit();
   let sent=false;
   try{sent=await this.exclusive(()=>this.one(item));}catch(e){if(e.stopBatch){this.log(item,'failed',e.message);this.state.status='paused';this.state.message=e.message;this.emit();return;}this.log(item,'failed',e.message);}
   if(item.status!=='sent')this.state.skipped++;else this.state.sent++;
   this.emit();
   const rest=items.slice(n+1).some(i=>i.status==='pending');
   if(rest&&!this.cancel){const ms=sent?this.pause[0]+Math.random()*(this.pause[1]-this.pause[0]):3000+Math.random()*3000;this.state.status='waiting';this.state.nextAt=Date.now()+ms;this.state.message=sent?`Enviado a @${item.handle}. Próximo en ${Math.round(ms/1000)} segundos.`:`Salteado @${item.handle}. Sigue con el próximo.`;this.emit();await this.wait(ms);this.state.status='running';this.state.nextAt=0;}
  }
  await this.go('about:blank').catch(()=>{});
  this.state.status=this.cancel?'paused':'done';this.state.current='';this.state.message=this.cancel?`Detenido: ${this.state.sent} enviados.`:`Listo: ${this.state.sent} enviados${this.state.skipped?`, ${this.state.skipped} salteados`:''}.`;this.emit();
 }
 // One account: checks, then sends. Returns true only when the message shows up as sent in the chat.
 async one(item){
  const store=this.store,lead=store.get(item.id);
  const block=lead&&store.gate({...lead,approved:1,qualification:''},new Date());
  if(!lead||block){this.log(item,'skipped',block||'Ya no está en la lista');return false;}
  const p=await this.read(item.handle);
  if(p.warning)throw Object.assign(Error('Instagram mostró un aviso. Se pausó la tanda: revisá la ventana de Nexo antes de seguir.'),{stopBatch:true});
  if(p.missing){store.update(item.id,{dnc:true});this.log(item,'skipped','La cuenta ya no existe');return false;}
  if(otherTrade({title:p.title,url:`https://www.instagram.com/${item.handle}/`})){store.update(item.id,{dnc:true});this.log(item,'skipped','No es un alojamiento: '+p.title.slice(0,60));return false;}
  if(p.dates){const a=store.setActivity(item.id,{dates:p.dates,source:'profile',note:'Revisado por Nexo antes de enviar'});if(a.verdict==='active'){store.update(item.id,{approved:false});this.log(item,'skipped',`Publica seguido (${a.weeks} de ${a.span} semanas)`);return false;}}
  else{let checked=false;try{checked=['profile','user'].includes(JSON.parse(lead.activity||'{}').source);}catch{}if(!checked){this.log(item,'skipped','No se pudieron leer sus publicaciones');return false;}}
  this.state.message=`Escribiendo a @${item.handle}`;this.emit();
  await this.go(`https://ig.me/m/${item.handle}`);
  let b=null;for(let i=0;i<50&&!b;i++){await sleep(400);const body=await this.eval(`document.body.innerText.slice(0,4000)`).catch(()=>'');if(WARNING.test(body))throw Object.assign(Error('Instagram mostró un aviso. Se pausó la tanda: revisá la ventana de Nexo antes de seguir.'),{stopBatch:true});if(CANT_RECEIVE.test(body)){store.update(item.id,{dnc:true});this.log(item,'skipped','La cuenta no acepta mensajes');return false;}
   // First visit to the inbox: Instagram asks about notifications.
   await this.eval(`(()=>{const b=[...document.querySelectorAll('[role="dialog"] button')].find(x=>/^(Ahora no|Not Now)$/i.test(x.innerText.trim()));if(b)b.click();})()`).catch(()=>{});
   b=await this.box();}
  if(!b){this.log(item,'skipped','No se abrió el chat');return false;}
  const message=String(item.message||'').replace(/\r/g,''),probe=flat(message).slice(0,40);
  const before=flat(await this.eval(`(document.querySelector('[role="main"]')||document.body).innerText`));
  // Never twice: if the chat already shows the proposal, it was sent earlier (by hand, for example).
  if(probe&&before.replace(flat(b.text),'').includes(probe)){const e=store.reserve(item.id);store.finish(e.event,'sent','Ya figuraba en el chat');this.log(item,'sent','Ya figuraba enviado en el chat');await this.saveExcel().catch(()=>{});return false;}
  if(flat(b.text)){await this.click(b.x,b.y);await this.client.call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},this.sessionId);await this.client.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},this.sessionId);await this.client.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},this.sessionId);await this.client.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},this.sessionId);}
  await this.click(b.x,b.y);
  const lines=message.split('\n');
  for(const [i,line] of lines.entries()){if(line)await this.client.call('Input.insertText',{text:line},this.sessionId);if(i<lines.length-1)await this.key(8);await sleep(60);}
  await sleep(500);
  const draft=await this.box();
  if(!draft||flat(draft.text)!==flat(message))throw Object.assign(Error(`El mensaje para @${item.handle} no se pegó completo. Se pausó la tanda sin enviarlo.`),{stopBatch:true});
  const event=store.reserve(item.id);
  await this.key(0);
  for(let i=0;i<30;i++){await sleep(500);const now=await this.box().catch(()=>null);const text=flat(await this.eval(`(document.querySelector('[role="main"]')||document.body).innerText`).catch(()=>''));
   if(WARNING.test(text)){store.finish(event.event,'uncertain','Instagram mostró un aviso al enviar');throw Object.assign(Error('Instagram mostró un aviso al enviar. Se pausó la tanda: revisá la ventana de Nexo.'),{stopBatch:true});}
   if(now&&!flat(now.text)&&text.includes(probe)){store.finish(event.event,'sent','Enviado por Nexo');this.log(item,'sent','Enviado');await this.saveExcel().catch(()=>{});return true;}}
  // The text left the box but didn't show up: counts as contacted so it's never sent twice; the user checks it.
  store.finish(event.event,'uncertain','No se pudo confirmar en el chat');throw Object.assign(Error(`No se pudo confirmar el envío a @${item.handle}. Se pausó la tanda: fijate en la ventana de Nexo si salió.`),{stopBatch:true});
 }
}
