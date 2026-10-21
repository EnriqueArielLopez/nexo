import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
export function serviceUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.port&&u.port!=='443')throw Error('Configurá un servicio de conexión HTTPS válido.');return u.origin;}
export async function loadInstagramService(data,env=process.env){if(env.NEXO_INSTAGRAM_CONNECT_URL)return serviceUrl(env.NEXO_INSTAGRAM_CONNECT_URL);for(const file of [path.join(data,'instagram-connection.json'),new URL('./instagram-public-config.json',import.meta.url)]){try{const config=JSON.parse(await fs.readFile(file,'utf8'));return serviceUrl(config.serviceUrl);}catch(e){if(e.code==='ENOENT')continue;throw Error('La configuración del servicio de Instagram no es válida.');}}return '';}
export class OfficialInstagramConnection{
 constructor({url='',fetcher=fetch,now=Date.now}={}){this.url=url?serviceUrl(url):'';this.fetcher=fetcher;this.now=now;this.pending=null;this.busy=false;this.lastPoll=0;this.generation=0;this.state={status:'idle',message:''};}
 publicState(){return {configured:!!this.url,...this.state};}
 async request(route,body){let r,d;try{r=await this.fetcher(this.url+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});d=await r.json();}catch{throw Error('No se pudo contactar al servicio de conexión de Nexo. Intentá otra vez.');}if(!r.ok)throw Error('El servicio no pudo completar la autorización. Revisá su configuración e iniciá otra conexión.');return d;}
 async start(username){
  if(!this.url)throw Error('La conexión oficial está preparada, pero falta configurar la aplicación de Meta y su servicio de autorización.');
  if(!/^[a-z0-9._]{1,30}$/i.test(username))throw Error('Ingresá la cuenta de Instagram que enviará los mensajes.');
  if(this.starting)throw Error('Ya se está preparando una autorización.');
  this.starting=true;try{
   if(this.pending)await this.cancel();const generation=++this.generation;
   const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
   const result=await this.request('/v1/start',{challenge});
   if(generation!==this.generation){if(result.ticket)await this.request('/v1/cancel',{ticket:result.ticket,verifier}).catch(()=>{});throw Error('La conexión fue cancelada.');}
   let auth,redirect;try{auth=new URL(result.authorizationUrl);redirect=new URL(auth.searchParams.get('redirect_uri'));}catch{throw Error('El servicio no devolvió una autorización válida.');}
   const scopes=(auth.searchParams.get('scope')||'').split(',').sort().join(',');
   if(auth.origin!=='https://www.instagram.com'||auth.pathname!=='/oauth/authorize'||!/^\d+$/.test(auth.searchParams.get('client_id')||'')||auth.searchParams.get('response_type')!=='code'||!auth.searchParams.get('state')||redirect.origin!==this.url||redirect.pathname!=='/callback'||redirect.search||redirect.hash||scopes!=='instagram_business_basic,instagram_business_manage_messages'||!/^[a-zA-Z0-9_-]{43}$/.test(result.ticket)||!Number.isFinite(result.expiresAt)||result.expiresAt<=this.now()||result.expiresAt>this.now()+15*60e3)throw Error('El servicio no devolvió una autorización válida.');
   this.pending={ticket:result.ticket,verifier,username:username.toLowerCase(),expiresAt:result.expiresAt};
   this.state={status:'waiting',message:'Autorizá @'+username+' en la página oficial de Instagram.',expiresAt:result.expiresAt};return {authorizationUrl:auth.href};
  }finally{this.starting=false;}
 }
 async tick(accept){if(!this.pending||this.busy||this.now()-this.lastPoll<2500)return;const pending=this.pending,generation=this.generation;if(pending.expiresAt<=this.now()){this.pending=null;this.state={status:'failed',message:'La autorización venció. Pulsá Conectar Instagram para intentarlo de nuevo.'};return;}this.busy=true;this.lastPoll=this.now();try{const result=await this.request('/v1/poll',{ticket:pending.ticket,verifier:pending.verifier});if(this.pending!==pending||generation!==this.generation)return;if(result.status==='failed')throw Error('No se autorizó la conexión. Volvé a intentarlo y revisá los permisos en Meta.');if(result.status==='complete'){this.pending=null;this.state={status:'connecting',message:'Comprobando la cuenta y guardando la conexión.'};if(result.account?.username?.toLowerCase()!==pending.username||typeof result.token!=='string'||!result.token||!Number.isFinite(result.expiresAt)||result.expiresAt<=this.now())throw Error('La cuenta autorizada no coincide con @'+pending.username+' o su permiso no es válido.');await accept(result,()=>this.generation===generation&&this.state.status==='connecting');if(this.generation===generation&&this.state.status==='connecting')this.state={status:'connected',message:'Instagram conectado: @'+pending.username,expiresAt:result.expiresAt};}else if(!['waiting','connecting'].includes(result.status))throw Error('El servicio devolvió un estado de conexión inválido.');}
  catch(e){if(generation===this.generation&&(this.pending===pending||this.state.status==='connecting')){this.pending=null;this.state={status:'failed',message:e.message};}}finally{this.busy=false;}
 }
 async cancel(){this.generation++;const pending=this.pending;this.pending=null;this.state={status:'idle',message:'Conexión cancelada.'};if(pending)await this.request('/v1/cancel',{ticket:pending.ticket,verifier:pending.verifier}).catch(()=>{});}
}
