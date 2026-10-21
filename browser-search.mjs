// Product integration: a separate, visible Edge profile for public searches only.
// No stealth flags, CAPTCHA solving, personal browser profile or private sessions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {PublicWebDiscovery,parseSearchResults} from './web-discovery.mjs';

export const isSearchUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['html.duckduckgo.com','duckduckgo.com','www.duckduckgo.com'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}};
export const needsHuman=html=>/anomaly\.js|anomaly-modal|g-recaptcha|unusual traffic|verify you are human/i.test(html);
export class DevtoolsConnection {
 constructor(socket){this.socket=socket;this.next=0;this.pending=new Map();socket.addEventListener('message',event=>{let msg;try{msg=JSON.parse(String(event.data));}catch{return;}const request=this.pending.get(msg.id);if(!request)return;this.pending.delete(msg.id);clearTimeout(request.timer);if(msg.error)request.reject(Error('El navegador no pudo completar la operación.'));else request.resolve(msg.result||{});});socket.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Se cerró la ventana del buscador. Volvé a iniciar la búsqueda.'));}this.pending.clear();});}
 static async connect(url){const u=new URL(url);if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||!/^\/devtools\/browser\/[a-z0-9-]+$/i.test(u.pathname))throw Error('Conexión local de navegador inválida.');const socket=new WebSocket(u);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.close();reject(Error('No se pudo conectar con la ventana del buscador.'));},8000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('No se pudo conectar con el navegador.'));},{once:true});});return new DevtoolsConnection(socket);}
 call(method,params={},sessionId){return new Promise((resolve,reject)=>{if(this.socket.readyState!==1)return reject(Error('La ventana de búsqueda está cerrada.'));const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('El navegador no respondió a tiempo.'));},10000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 close(){this.socket.close();}
}
async function findEdge(){
 const roots=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean);
 for(const root of roots){const executable=path.join(root,'Microsoft','Edge','Application','msedge.exe');try{await fs.access(executable);return executable;}catch{}}
 throw Error('No se encontró Microsoft Edge. Instalalo desde Microsoft para usar la búsqueda con navegador.');
}
const SNAPSHOT=`(()=>{const u=new URL(location.href);if(u.protocol!=='https:'||!['duckduckgo.com','www.duckduckgo.com','html.duckduckgo.com'].includes(u.hostname))return {url:location.href,otherPage:true};return {url:location.href,query:u.searchParams.get('q')||document.querySelector('input[name=q]')?.value||'',ready:document.readyState,html:document.documentElement.outerHTML.slice(0,1500000)};})()`;
export class SearchBrowser {
 constructor(profileDir,{connect=DevtoolsConnection.connect,launch=spawn,edge=findEdge,readFile=fs.readFile}={}){this.profileDir=path.resolve(profileDir);this.connect=connect;this.launch=launch;this.edge=edge;this.readFile=readFile;this.client=null;this.sessionId='';this.targetId='';}
 async endpoint(){const text=await this.readFile(path.join(this.profileDir,'DevToolsActivePort'),'utf8');const [line,browserPath]=text.trim().split(/\r?\n/);const port=Number(line);if(!Number.isInteger(port)||port<1024||port>65535||!/^\/devtools\/browser\/[a-z0-9-]+$/i.test(browserPath))throw Error('Puerto del navegador inválido.');return 'ws://127.0.0.1:'+port+browserPath;}
 async ensure(){
  if(this.client){try{await this.client.call('Target.getTargetInfo',{targetId:this.targetId});return;}catch{this.client.close();this.client=null;}}
  try{this.client=await this.connect(await this.endpoint());}catch{}
  if(!this.client){
   await fs.mkdir(this.profileDir,{recursive:true});const executable=await this.edge();
   // The profile is dedicated to Nexo. Debugging listens only on loopback, on a random port.
   const child=this.launch(executable,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+this.profileDir,'--no-first-run','--no-default-browser-check','--new-window','about:blank'],{stdio:'ignore',windowsHide:false});
   let launchError=null;child.once('error',e=>{launchError=e;});child.unref();
   for(let i=0;i<40&&!this.client;i++){if(launchError)throw Error('No se pudo abrir Microsoft Edge.');await new Promise(r=>setTimeout(r,250));try{this.client=await this.connect(await this.endpoint());}catch{}}
   if(!this.client)throw Error('No se pudo preparar el buscador. Cerrá solo la ventana de búsqueda de Nexo y volvé a intentar.');
  }
  const targets=await this.client.call('Target.getTargets');
  const blank=targets.targetInfos?.find(t=>t.type==='page'&&t.url==='about:blank');
  const target=blank||await this.client.call('Target.createTarget',{url:'about:blank'});this.targetId=target.targetId;
  const attached=await this.client.call('Target.attachToTarget',{targetId:this.targetId,flatten:true});this.sessionId=attached.sessionId;
  await this.client.call('Page.enable',{},this.sessionId);
 }
 async show(){await this.ensure();await this.client.call('Target.activateTarget',{targetId:this.targetId});}
 async navigate(url){if(!isSearchUrl(url))throw Error('Solo se permite abrir el buscador público.');await this.ensure();this.expectedQuery=new URL(url).searchParams.get('q');const result=await this.client.call('Page.navigate',{url},this.sessionId);if(result.errorText)throw Error('No se pudo abrir el buscador. Revisá la conexión.');}
 async current({signal}={}){
  await this.ensure();let last=null;
  for(let i=0;i<50;i++){
   if(signal?.aborted)throw Error('Búsqueda detenida.');
   const result=await this.client.call('Runtime.evaluate',{expression:SNAPSHOT,returnByValue:true},this.sessionId);last=result.result?.value;
   if(last?.otherPage&&last.url!=='about:blank')throw Error('La ventana del buscador está en otra página. Volvé a iniciar la búsqueda; Nexo no leerá esa página.');
   if(last?.ready==='complete'&&last.html&&(needsHuman(last.html)||!this.expectedQuery||last.query===this.expectedQuery))return {url:last.url,html:last.html};
   await new Promise(r=>setTimeout(r,200));
  }
  throw Error('El buscador todavía no terminó de cargar. Revisá la ventana de búsqueda.');
 }
 async read(url,options){await this.navigate(url);return this.current(options);}
 async close(){if(this.client&&this.targetId)await this.client.call('Target.closeTarget',{targetId:this.targetId}).catch(()=>{});this.client?.close();this.client=null;}
}
export class BrowserWebDiscovery extends PublicWebDiscovery {
 constructor({browser,onChallenge,delayMs=5000,signal}={}){super({delayMs,signal});this.browser=browser;this.onChallenge=onChallenge;}
 async search(q){
  if(this.signal?.aborted)throw Error('Búsqueda detenida.');
  const wait=Math.max(0,this.lastSearch+this.delayMs-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
  if(this.signal?.aborted)throw Error('Búsqueda detenida.');
  this.lastSearch=Date.now();this.calls++;
  let page=await this.browser.read('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{signal:this.signal});
  while(needsHuman(page.html)){
   if(!this.onChallenge)throw Error('Completá la verificación en la ventana del buscador.');
   await this.browser.show();await this.onChallenge({query:q,url:page.url});
   if(this.signal?.aborted)throw Error('Búsqueda detenida.');
   // Only after a user's explicit Continue; do not navigate/reload or solve the challenge.
   page=await this.browser.current({signal:this.signal});
  }
  return parseSearchResults(page.html);
 }
}
export function waitForHuman(signal,present){
 return new Promise((resolve,reject)=>{let finished=false;const end=error=>{if(finished)return;finished=true;signal?.removeEventListener('abort',abort);error?reject(error):resolve();};const abort=()=>end(Error('Búsqueda detenida.'));if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});present(()=>end());});
}
