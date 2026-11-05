import {normalize,decodeHtml,plainText,instagramHandle,parseSearchResults,matchGeography,inferServices,otherTrade,lodging,hotelChain,notBusiness,postDates,inactiveAccount,premiumMatch,webCandidate,rejectionReason,queryPlan} from './prospect-policy.mjs';
export * from './prospect-policy.mjs';
import {lodgingOnly} from './business-sectors.mjs';
import {createHash} from 'node:crypto';
import {websiteProfiles} from './website-prospects.mjs';
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import {handle,httpUrl,defaults} from './core.mjs';
import {ingest} from './imports.mjs';

export function isPublicAddress(address){
 if(net.isIPv4(address)){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
 if(net.isIPv6(address)){const v=address.toLowerCase(),parts=v.split(':');const first=parseInt(parts[0],16),second=parseInt(parts[1]||'0',16);return first>=0x2000&&first<=0x3fff&&first!==0x2002&&!(first===0x2001&&(second<0x200||second===0xdb8));}
 return false;
}
async function resolvePublic(value){
 const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||u.hostname==='localhost'||u.hostname.endsWith('.local'))throw Error('La búsqueda solo consulta sitios web públicos.');
 const records=await dns.lookup(u.hostname.replace(/^\[|\]$/g,''),{all:true});if(!records.length||records.some(r=>!isPublicAddress(r.address)))throw Error('Se omitió una dirección privada.');return {url:u,records};
}
export async function publicUrl(value){return (await resolvePublic(value)).url;}
// Resolve once and pin that validated address to the socket. A second DNS lookup must never choose a private address.
export function pinnedLookup(records){if(!records.length||records.some(r=>!isPublicAddress(r.address)))throw Error('Se omitió una dirección privada.');const record={...records[0]};return (_host,options,callback)=>{if(options?.all)callback(null,[record]);else callback(null,record.address,record.family);};}
function publicResponse(u,records,signal){return new Promise((resolve,reject)=>{const req=(u.protocol==='https:'?https:http).get(u,{agent:false,lookup:pinnedLookup(records),signal,headers:{'user-agent':'NexoClientes/3.11 (public business research)','accept':'text/html,application/xhtml+xml','accept-encoding':'identity'}},resolve);req.on('error',reject);});}
export async function fetchPublic(value,{signal,timeoutMs=12000}={}){
 let url=value;
 for(let redirects=0;redirects<5;redirects++){
  const {url:u,records}=await resolvePublic(url),deadline=AbortSignal.timeout(timeoutMs);const response=await publicResponse(u,records,signal?AbortSignal.any([signal,deadline]):deadline);
  if([301,302,303,307,308].includes(response.statusCode)){const location=response.headers.location;response.destroy();if(!location)throw Error('Redirección sin destino.');url=new URL(location,u).href;continue;}
  if(response.statusCode===429||response.statusCode===403){response.destroy();const e=Error('El sitio limitó las consultas públicas. Volvé a intentar más tarde.');e.code='WEB_BLOCKED';throw e;}
  if(response.statusCode<200||response.statusCode>=300){response.destroy();throw Error('El sitio respondió HTTP '+response.statusCode);}
  if(!/text\/html|application\/xhtml\+xml/i.test(response.headers['content-type']||'')){response.destroy();throw Error('La fuente no es una página HTML.');}
  let size=0,chunks=[];for await(const chunk of response){size+=chunk.length;if(size>1500000){response.destroy();throw Error('La página supera el tamaño de lectura.');}chunks.push(chunk);}
  return {url:u.href,html:Buffer.concat(chunks).toString('utf8')};
 }
 throw Error('Demasiadas redirecciones.');
}
// Each search runs this many queries and the next one continues where it stopped, so it doesn't repeat the same ones.
export const QUERIES_PER_SEARCH=900;
export class PublicWebDiscovery {
 constructor({read=fetchPublic,delayMs=5000,signal}={}){this.read=read;this.delayMs=delayMs;this.signal=signal;this.calls=0;this.lastSearch=0;this.websiteCache=new Map();}
 async search(q){
  if(this.signal?.aborted)throw Error('Búsqueda detenida.');
  const wait=Math.max(0,this.lastSearch+this.delayMs-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
  this.lastSearch=Date.now();this.calls++;const page=await this.read('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{signal:this.signal});
  if(/anomaly\.js|anomaly-modal|g-recaptcha|unusual traffic|verify you are human/i.test(page.html)){const e=Error('El buscador pidió una verificación humana. Se detuvo la búsqueda; los resultados obtenidos están guardados. Probá más tarde.');e.code='WEB_BLOCKED';throw e;}
  return parseSearchResults(page.html);
 }
 canEnrich(result){try{return !/(^|\.)(instagram\.com|facebook\.com|youtube\.com|booking\.com|tripadvisor\.[a-z.]+)$/.test(new URL(result.url).hostname);}catch{return false;}}
 async enrich(result){if(instagramHandle(result.url))return [result];if(!this.canEnrich(result))return [];if(this.websiteCache.has(result.url))return this.websiteCache.get(result.url);let profiles=[];try{this.calls++;profiles=websiteProfiles(await this.read(result.url,{signal:this.signal,timeoutMs:4000}),result);}catch{}this.websiteCache.set(result.url,profiles);return profiles;}
 async profile(seed,settings){
  if(settings.offer?.trim())return {services:settings.offer.trim().slice(0,1000),summary:'Oferta indicada por vos.',source:'',fromContext:true,method:'public-web'};
  const h=handle(seed),results=await this.search('"'+h+'" Instagram');const result=results.find(r=>instagramHandle(r.url)===h);const services=result&&inferServices(result.title+' '+result.snippet);
  if(!services)throw Error('No pudimos identificar tu oferta en la web pública. Completá “Qué ofrecés” en Filtros para orientar la búsqueda sin API.');
  return {services,summary:result.snippet,source:result.url,fromContext:false,method:'public-web'};
 }
}
const transient=e=>e?.code!=='WEB_BLOCKED'&&/no termin. de cargar|no respondi. a tiempo|No se pudo abrir el buscador|no pudo completar la operaci|HTTP 5\d\d|timeout|aborted due to timeout|fetch failed|ECONNRESET|ETIMEDOUT/i.test(e?.message||'');
async function resilient(fn){try{return await fn();}catch(e){if(!transient(e))throw e;await new Promise(r=>setTimeout(r,4000));return fn();}}
export async function discoverWeb({store,seed,web=new PublicWebDiscovery(),inspect=null,verifyActivity=true,maxQueries=QUERIES_PER_SEARCH,timeBudgetMs=Infinity,maxIdleQueries=Infinity,rest=(ms=1200+Math.random()*1800)=>new Promise(r=>setTimeout(r,ms)),progress=()=>{},save=async()=>{},cancelled=()=>false}){
 const settings={...store.settings(),lastSeed:seed};const known=new Set(store.knownHandles());const state={status:'running',method:'public-web',found:0,qualified:0,review:0,target:Math.min(100,settings.maxResults||100),businessTier:settings.businessTier||'all',stage:'Identificando tu oferta en la web pública',summary:'',queries:0,pages:0,scanned:0,rejected:{},ids:[],usage:null,startedAt:new Date().toISOString()};let idleQueries=0;
 let checking=Promise.resolve(),queued=0,failure=null,halted=false;
 const emit=()=>progress({...state,elapsedMs:Date.now()-Date.parse(state.startedAt),checking:queued,ids:[...state.ids],rejected:{...state.rejected}});emit();
 try{
  const profile=await web.profile(seed,settings);state.profile=profile;emit();
  const full=queryPlan(settings),fingerprint=createHash('sha256').update(JSON.stringify([seed,settings.countries,settings.cities,settings.segment,settings.businessTier,full])).digest('hex'),saved=store.job('searchCursor'),start=saved?.fingerprint===fingerprint&&saved.next<full.length?saved.next:0;const plan=[...full.slice(start),...full.slice(0,start)].slice(0,Math.max(1,Math.min(QUERIES_PER_SEARCH,maxQueries)));state.totalQueries=plan.length;let consecutive=0,cooldowns=0;
  // Nexo is for accounts that barely post: read the dates of their last posts on the profile itself (or, if it can't be
  // read, estimate them from the index) and drop the ones that post regularly, that don't exist or that aren't lodgings.
  const drop=(id,why)=>{store.db.prepare('UPDATE leads SET archived=1,approved=0 WHERE id=?').run(id);state.found--;state.review--;state.ids=state.ids.filter(x=>x!==id);state.rejected[why]=(state.rejected[why]||0)+1;};
  const checkActivity=async ids=>{const pending=ids.filter(id=>!store.get(id)?.activity);if(!pending.length)return;if(!inspect)state.stage=`Revisando en Instagram cuándo publicaron ${pending.length} ${pending.length===1?'cuenta':'cuentas'}`;emit();for(const id of pending){if(cancelled()||halted)break;const l=store.get(id);let profile=null;if(inspect){try{profile=await inspect(l.handle);}catch{}if(cancelled()||halted)break;if(profile?.warning)throw Error('Instagram pidió una revisión. Se detuvo la verificación; los candidatos quedaron guardados.');if(profile?.missing){drop(id,'missing');continue;}if(profile?.title&&lodgingOnly(settings.segment)&&otherTrade({title:profile.title,url:l.source})){drop(id,'otherTrade');continue;}await rest();}let a;if(profile?.dates)a=store.setActivity(id,{dates:profile.dates,source:'profile',note:'Revisado en su perfil durante la búsqueda'});else if(inspect)continue;else{let found;try{found=await resilient(()=>web.search('site:instagram.com/p/ '+l.handle));}catch(e){if(!transient(e))throw e;continue;}a=store.setActivity(id,{dates:postDates(found,l.handle),source:'index'});}state.activityChecked=(state.activityChecked||0)+1;if(a.verdict==='active')drop(id,'active');emit();}await save().catch(()=>{});};
  // With Instagram open in Chrome, profiles are checked while the search keeps going in the other browser.

  const enqueue=ids=>{const pending=ids.filter(id=>!store.get(id)?.activity);if(!pending.length)return;queued+=pending.length;checking=checking.then(()=>checkActivity(pending)).catch(e=>{failure=failure||e;}).then(()=>{queued-=pending.length;});};
  const settle=async()=>{await checking;if(failure)throw failure;};
  for(const [index,query]of plan.entries()){
   if(Date.now()-Date.parse(state.startedAt)>=timeBudgetMs||idleQueries>=maxIdleQueries){state.stopReason=idleQueries>=maxIdleQueries?'sin-resultados-nuevos':'tiempo-acotado';break;}const beforeQuery=state.found;
   if(cancelled())break;if(state.found>=state.target){await settle();if(state.found>=state.target)break;}const fresh=[];
   state.stage=`Buscando ${settings.segment} en ${query.city?[query.city,query.country].join(', '):query.country} · consulta ${index+1}/${plan.length}${queued?` · revisando ${queued} ${queued===1?'perfil':'perfiles'} en Instagram`:''}`;state.queries=index+1;emit();store.setJob('searchCursor',{next:(start+index+1)%full.length,size:full.length,fingerprint});
   let results;try{results=await resilient(()=>web.search(query.q));consecutive=0;}catch(e){if(!transient(e))throw e;consecutive++;state.skipped=(state.skipped||0)+1;if(consecutive>=5&&cooldowns<2&&!cancelled()){cooldowns++;consecutive=0;state.stage='El buscador pidió una pausa: se reintenta en 2 minutos';emit();await rest(120000);continue;}if(consecutive>=5)throw Error('La conexión con el buscador falló varias veces seguidas. Se conservaron los candidatos encontrados; volvé a intentar en un rato.');continue;}const seenPages=new Set();
   for(let page=0;page<3&&state.pages<1300&&!cancelled()&&state.found<state.target;page++){
    if(!results.length)break;const fingerprint=results.map(r=>r.url).join('|');if(seenPages.has(fingerprint))break;seenPages.add(fingerprint);state.pages++;
    for(const r of results)r.query=query;const leads=[],expanded=results.filter(r=>instagramHandle(r.url));const sites=web.enrich?results.filter(r=>!instagramHandle(r.url)&&(!web.canEnrich||web.canEnrich(r))).filter((r,i,a)=>a.findIndex(v=>v.url===r.url)===i).slice(0,2):[];
    if(sites.length){state.stage='Revisando '+sites.length+' fuentes públicas del rubro';emit();const checked=await Promise.allSettled(sites.map(r=>web.enrich(r)));for(const result of checked)if(result.status==='fulfilled')expanded.push(...result.value.map(v=>({...v,query})));}
    for(const result of expanded){state.scanned++;const lead=webCandidate(result,settings,profile,known);if(lead){known.add(lead.handle);leads.push(lead);}else{const why=rejectionReason(result,settings,known);state.rejected[why]=(state.rejected[why]||0)+1;}if(leads.length>=state.target-state.found)break;}
    const count=ingest(store,leads);state.found+=count.added;state.review+=count.added;for(const lead of leads){const id=store.db.prepare('SELECT id FROM leads WHERE handle=?').get(lead.handle)?.id;if(id){state.ids.push(Number(id));fresh.push(Number(id));}}emit();if(count.added)await save().catch(()=>{});
    if(page===2||state.found>=state.target||cancelled()||!web.nextPage||!leads.length)break;try{results=await web.nextPage();}catch(e){if(!transient(e))throw e;break;}
   }
   if(verifyActivity){if(inspect){enqueue(fresh);if(queued>20)await settle();}else await checkActivity(fresh);}if(failure)throw failure;
   idleQueries=state.found>beforeQuery?0:idleQueries+1;
   if(state.pages>=1300)break;
  }
  if(queued){state.stage=`Revisando los últimos ${queued} perfiles en Instagram`;emit();}await settle();
  state.status=cancelled()?'paused':'completed';state.stage=cancelled()?'Búsqueda detenida':`${state.found} candidatos encontrados en la web`;
 }catch(e){halted=true;await checking;state.status=cancelled()?'paused':'failed';state.error=cancelled()?'':e.message;state.stage=cancelled()?'Búsqueda detenida':'La búsqueda se detuvo; se conservaron los candidatos encontrados.';}
 state.qualified=state.ids.filter(id=>{try{return JSON.parse(store.get(id)?.qualification||'{}').status==='ready';}catch{return false;}}).length;state.review=state.found-state.qualified;state.verification=verifyActivity?'during-search':'on-demand';
 state.outcome=state.found>=state.target?'target-reached':'partial';
 state.summary=`${state.found}/${state.target} candidatos · ${state.queries} consultas · ${state.pages} páginas · ${state.scanned} resultados examinados. ${state.rejected.duplicates||0} repetidos; ${state.rejected.location||0} sin ubicación coincidente; ${state.rejected.sector||0} sin rubro coincidente; ${state.rejected.category||0} sin señales de alta categoría; ${state.rejected.directory||0} directorios descartados; ${state.rejected.inactive||0} cuentas cerradas o sin publicaciones; ${state.rejected.active||0} descartadas porque publican seguido; ${state.rejected.chain||0} cadenas; ${state.rejected.creator||0} creadores, agencias o inmobiliarias; ${state.skipped||0} consultas salteadas por errores de carga. Actividad, encaje y capacidad de pago requieren revisión. ${state.found<state.target?'Objetivo incompleto: no se inventaron contactos.':''}`;
 state.usage={webRequests:web.calls,paidApiCalls:0};emit();store.setJob('lastSearch',{...state,seed,at:new Date().toISOString()});return state;
}
