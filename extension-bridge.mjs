// Link between Nexo and its extension in the user's own Chrome (where Instagram is already signed in). The extension
// asks for commands (long polling on loopback, with a per-user token) and runs them in its own window of that Chrome
// through chrome.debugger, so the sender drives it with the same DevTools commands as any other window.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';

export class ExtensionBridge {
 constructor({timeout=60000,pollMs=20000}={}){Object.assign(this,{timeout,pollMs});this.queue=[];this.waiting=null;this.pending=new Map();this.next=0;this.seen=0;}
 connected(){return Date.now()-this.seen<this.pollMs*2;}
 call(method,params={}){
  if(!this.connected())return Promise.reject(Error('Chrome no está conectado con Nexo: abrí Chrome y fijate que la extensión de Nexo esté activa.'));
  const id=++this.next;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);this.queue=this.queue.filter(c=>c.id!==id);reject(Error('Chrome no respondió a Nexo.'));},this.timeout);this.pending.set(id,{resolve,reject,timer});this.queue.push({id,method,params,expiresAt:Date.now()+this.timeout});this.flush();});
 }
 flush(){if(this.waiting&&this.queue.length){const done=this.waiting;this.waiting=null;done(this.queue.splice(0));}}
 // The extension waits here for the next commands.
 poll(){
  this.seen=Date.now();if(this.waiting){const old=this.waiting;this.waiting=null;old([]);}
  if(this.queue.length)return Promise.resolve(this.queue.splice(0));
  return new Promise(resolve=>{this.waiting=resolve;setTimeout(()=>{if(this.waiting===resolve){this.waiting=null;resolve([]);}},this.pollMs);});
 }
 result({id,result,error}={}){this.seen=Date.now();const p=this.pending.get(Number(id));if(!p)return;clearTimeout(p.timer);this.pending.delete(Number(id));if(error)p.reject(Error(String(error).slice(0,300)));else p.resolve(result||{});}
 close(){}
}

// One extension folder per user, with its token; the user loads it once in chrome://extensions.
export class Extensions {
 constructor(dataDir,sourceDir,port){Object.assign(this,{dir:path.join(dataDir,'extension-chrome'),sourceDir,port});this.users=new Map();}
 folder(userId){return path.join(this.dir,String(userId).replace(/[^a-z0-9-]/gi,''));}
 bridge(userId){let u=this.users.get(userId);if(!u){u={token:'',bridge:new ExtensionBridge()};this.users.set(userId,u);}return u.bridge;}
 async load(){
  const ids=await fs.readdir(this.dir).catch(()=>[]);
  for(const id of ids){const token=await this.token(id);if(token){this.bridge(id);this.users.get(id).token=token;await this.write(id,token).catch(()=>{});}}
 }
 async token(userId){const text=await fs.readFile(path.join(this.folder(userId),'config.js'),'utf8').catch(()=>'');return text.match(/token:'([a-f0-9]{48})'/)?.[1]||'';}
 // Copies the extension (always the current version) and its config.
 async write(userId,token){
  const folder=this.folder(userId);await fs.mkdir(folder,{recursive:true});
  for(const file of await fs.readdir(this.sourceDir))await fs.copyFile(path.join(this.sourceDir,file),path.join(folder,file));
  await fs.writeFile(path.join(folder,'config.js'),`self.NEXO={token:'${token}',port:${this.port}};\n`);return folder;
 }
 async install(userId){this.bridge(userId);const u=this.users.get(userId);if(!u.token)u.token=await this.token(userId)||randomBytes(24).toString('hex');return this.write(userId,u.token);}
 byToken(token){const given=Buffer.from(String(token||''));for(const u of this.users.values()){const own=Buffer.from(u.token);if(u.token&&own.length===given.length&&timingSafeEqual(own,given))return u.bridge;}return null;}
}
