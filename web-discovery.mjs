import dns from 'node:dns/promises';
import net from 'node:net';
import {COUNTRIES} from './geography.mjs';
import {handle,httpUrl} from './core.mjs';
import {isNewProspect} from './campaign.mjs';
import {ingest} from './imports.mjs';

export const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function decodeHtml(value){return String(value||'').replace(/&#(x[\da-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,m=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '})[m]);}
export function plainText(value){return decodeHtml(String(value||'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),decodeHtml(m[2]??m[3])]));
export function instagramHandle(url){try{const u=new URL(url);if(!['instagram.com','www.instagram.com'].includes(u.hostname))return '';return handle(u.href);}catch{return '';}}
export function parseSearchResults(html){
 const output=[];
 for(const part of html.split(/<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b)/i).slice(1)){
  const tag=part.slice(0,part.indexOf('>')),attr=attributes(tag);let url=attr.href||'';
  try{const u=new URL(url,'https://duckduckgo.com');url=u.hostname==='duckduckgo.com'?u.searchParams.get('uddg')||'':u.href;}catch{continue;}
  if(!httpUrl(url))continue;
  const title=plainText(part.slice(part.indexOf('>')+1,part.indexOf('</a>')));
  const snippet=plainText(part.match(/<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]||'');
  output.push({url,title,snippet});
 }
 return output.slice(0,30);
}
export function isPublicAddress(address){
 if(net.isIPv4(address)){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));}
 if(net.isIPv6(address)){const v=address.toLowerCase();return !v.startsWith('::')&&!/^(fc|fd|fe[89ab]|ff)/.test(v);}
 return false;
}
export async function publicUrl(value){
 const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||u.hostname==='localhost'||u.hostname.endsWith('.local'))throw Error('La búsqueda solo consulta sitios web públicos.');
 const records=await dns.lookup(u.hostname.replace(/^\[|\]$/g,''),{all:true});if(!records.length||records.some(r=>!isPublicAddress(r.address)))throw Error('Se omitió una dirección privada.');return u;
}
export async function fetchPublic(value,{signal}={}){
 let url=value;
 for(let redirects=0;redirects<5;redirects++){
  const u=await publicUrl(url);const response=await fetch(u,{redirect:'manual',headers:{'user-agent':'NexoClientes/3.4 (public business research)','accept':'text/html,application/xhtml+xml'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirección sin destino.');url=new URL(location,u).href;continue;}
  if(response.status===429||response.status===403){await response.body?.cancel();const e=Error('El sitio limitó las consultas públicas. Volvé a intentar más tarde.');e.code='WEB_BLOCKED';throw e;}
  if(!response.ok){await response.body?.cancel();throw Error('El sitio respondió HTTP '+response.status);}
  if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La fuente no es una página HTML.');}
  let size=0,chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>1500000)throw Error('La página supera el tamaño de lectura.');chunks.push(chunk);}
  return {url:u.href,html:Buffer.concat(chunks).toString('utf8')};
 }
 throw Error('Demasiadas redirecciones.');
}
const SECTOR_TERMS={
 'Hoteles':['hotel','hoteles','posada','hostal','resort','alojamiento','hoteleria'],
 'Hoteles boutique':['hotel boutique','boutique hotel','hoteleria boutique'],
 'Resorts':['resort'],'Posadas':['posada'],'Apart hoteles':['apart hotel','aparthotel'],'Hostales':['hostal','hostel'],
 'Gastronomía':['restaurante','restaurant','gastronomia','gastronomico','parrilla','pizzeria','resto','cerveceria'],
 'Cafeterías':['cafeteria','cafe','coffee'],'Indumentaria':['indumentaria','ropa','moda','boutique','vestidos'],
 'Estética y belleza':['estetica','belleza','peluqueria','salon de belleza','spa','cosmetica'],
 'Gimnasios':['gimnasio','fitness','gym','crossfit'],'Inmobiliarias':['inmobiliaria','bienes raices','real estate'],
 'Turismo':['turismo','excursiones','agencia de viajes','tours'],'Salud':['clinica','consultorio','odontologia','centro medico','salud'],
 'Comercios':['tienda','comercio','local comercial','negocio','shop']
};
const countryAliases={AR:['argentina','🇦🇷','arg.'],BO:['bolivia','🇧🇴'],CL:['chile','🇨🇱'],CO:['colombia','🇨🇴'],CR:['costa rica','🇨🇷'],CU:['cuba','🇨🇺'],EC:['ecuador','🇪🇨'],SV:['el salvador','🇸🇻'],ES:['españa','spain','🇪🇸'],GT:['guatemala','🇬🇹'],GQ:['guinea ecuatorial','🇬🇶'],HN:['honduras','🇭🇳'],MX:['méxico','mexico','🇲🇽'],NI:['nicaragua','🇳🇮'],PA:['panamá','panama','🇵🇦'],PY:['paraguay','🇵🇾'],PE:['perú','peru','🇵🇪'],PR:['puerto rico','🇵🇷'],DO:['república dominicana','🇩🇴'],UY:['uruguay','🇺🇾'],VE:['venezuela','🇻🇪']};
const escaped=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const contains=(text,term)=>new RegExp('(?:^|[^a-z0-9])'+escaped(normalize(term))+'(?:$|[^a-z0-9])').test(normalize(text));
const terms=s=>SECTOR_TERMS[s]||[s];
export function matchGeography(text,settings){
 const location=normalize(text).replace(/"/g,' ').trim();
 const citiesByCountry={AR:['buenos aires','mar del plata','villa carlos paz','san carlos de bariloche','puerto iguazu'],UY:['montevideo','punta del este','colonia del sacramento'],ES:['madrid','barcelona','sevilla','valencia'],MX:['ciudad de mexico','cancun','aguascalientes','guadalajara'],CO:['bogota','medellin','cartagena de indias'],PE:['lima, peru','cusco','cuzco'],BO:['cochabamba','santa cruz de la sierra'],CL:['santiago de chile','vina del mar','puerto varas']};
 const hasCountry=c=>(countryAliases[c.code]||[c.name]).some(t=>{
  if(/[^\x00-\x7f]/.test(t)&&t.includes('🇦'))return location.includes(t);
  if(t.codePointAt(0)>0xffff)return location.includes(t);
  return new RegExp('(?:^|[,;|•·:–—]\\s*|\\b(?:en|in|pais)\\s+)'+escaped(normalize(t))+'(?=$|[\\s,;|•·:!.)])').test(location);
 });
 const explicit=COUNTRIES.filter(hasCountry);const selected=COUNTRIES.filter(c=>settings.countries.includes(c.code));
 const country=explicit.length?selected.find(c=>explicit.includes(c)):selected.find(c=>(citiesByCountry[c.code]||[]).some(city=>contains(location,city)));
 if(!country)return null;
 const cities=String(settings.cities||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);const city=cities.find(c=>contains(text,c));
 if(cities.length&&!city)return null;return {country:country.name,city:city||''};
}
export function inferServices(text){
 text=normalize(text).replace(/see instagram photos and videos from|instagram photos and videos|fotos y videos de instagram/g,'');
 const matches=[[/community manager|social media|gestion de redes/,'gestión de redes sociales'],[/content creator|creador[ae]? de contenido|contenido|\bugc\b/,'creación de contenido'],[/fotograf/,'fotografía'],[/video|reels|audiovisual/,'producción de videos'],[/marketing|publicidad/,'marketing y publicidad'],[/diseno|branding/,'diseño y marca'],[/software|programacion|desarrollo web/,'desarrollo de software']];
 return matches.filter(([pattern])=>pattern.test(text)).map(([,label])=>label).join(', ');
}
export function webCandidate(result,settings,profile,known=[]){
 const h=instagramHandle(result.url);if(!h||!isNewProspect(h,settings.lastSeed,known))return null;
 const text=[result.title,result.snippet].join(' ');const biography=result.snippet.replace(/^.*?on\s+Instagram\s*:\s*/i,'');
 const geo=matchGeography(biography,settings);if(!geo||!terms(settings.segment).some(t=>contains(text,t)))return null;
 if(/(?:cerrado definitivamente|permanently closed|agencia de viajes|guia de hoteles|directorio de hoteles|asesoramos y gestionamos sus reservas)/i.test(text)&&settings.segment!=='Turismo')return null;
 const name=result.title.replace(/\s*[-–|]\s*Instagram.*$/i,'').replace(/\s*\(@[^)]+\)/,'').trim().slice(0,200)||h;
 const description=result.snippet.slice(0,1000);const source=result.url;
 const commercial=/reserv[aá]|booking|compr[aá]|pedidos|turnos|citas|tienda|ventas|whatsapp|contact[aá]|men[uú]|cat[aá]logo/i.test(description);
 const fit=`Rubro ${settings.segment} y ubicación coinciden con los filtros. Oferta del proveedor: ${profile.services}. Encaje específico pendiente de revisión.`;
 const score=45+(geo.city?10:0)+(commercial?10:0);
 const qualification={version:2,method:'public-web',status:'review',hotel:true,hotelSource:source,business:'unknown',businessSignal:'none',businessSource:source,businessDetail:'Resultado público indexado: '+description,feed:'unverified',feedSource:'',feedDetail:'El feed y la actividad actual no fueron comprobados. Un resultado indexado no confirma operación actual ni falta de contenido.',postsCount:null,lastPost:'',stories:'unverified',fit,score,label:'Coincide con filtros · revisar oportunidad',checkedAt:new Date().toISOString(),manual:false};
 const message=`Hola, equipo de ${name}. Soy ${settings.sender||'@'+handle(settings.lastSeed)}. Trabajo en ${profile.services}. Me gustaría conversar sobre una propuesta para su negocio. ¿Les interesa que les comparta más información? Si prefieren que no los contacte, me avisan y lo registro.`;
 return {handle:h,name,...geo,language:'es',source,message,reason:[qualification.businessDetail,fit,qualification.feedDetail].join(' · '),score,score_reason:'Afinidad por coincidencia de rubro, ubicación y señales públicas; no estima intención de compra.',qualification};
}
export function queryPlan(settings){
 const countries=COUNTRIES.filter(c=>settings.countries.includes(c.code));const cities=String(settings.cities||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);const zones=cities.length?cities:[''];const plan=[];
 const variations=['','contacto','oficial','ubicación','WhatsApp','servicios','información','reservas','ventas','novedades','pedidos','negocio'];
 for(let pass=0;pass<variations.length;pass++)for(const city of zones)for(const country of countries){
  const word=terms(settings.segment)[pass%terms(settings.segment).length];const q=`site:instagram.com "${word}" "${country.name}"${city?' "'+city+'"':''}${variations[pass]?' '+variations[pass]:''}`;
  plan.push({q,country:country.name,city});
 }
 return plan.slice(0,72);
}
export class PublicWebDiscovery {
 constructor({read=fetchPublic,delayMs=5000,signal}={}){this.read=read;this.delayMs=delayMs;this.signal=signal;this.calls=0;this.lastSearch=0;}
 async search(q){
  if(this.signal?.aborted)throw Error('Búsqueda detenida.');
  const wait=Math.max(0,this.lastSearch+this.delayMs-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
  this.lastSearch=Date.now();this.calls++;const page=await this.read('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{signal:this.signal});
  if(/anomaly\.js|anomaly-modal|g-recaptcha|unusual traffic|verify you are human/i.test(page.html)){const e=Error('El buscador pidió una verificación humana. Se detuvo la búsqueda; los resultados obtenidos están guardados. Probá más tarde.');e.code='WEB_BLOCKED';throw e;}
  return parseSearchResults(page.html);
 }
 async profile(seed,settings){
  if(settings.offer?.trim())return {services:settings.offer.trim().slice(0,1000),summary:'Oferta indicada por vos.',source:'',fromContext:true,method:'public-web'};
  const h=handle(seed),results=await this.search('"'+h+'" Instagram');const result=results.find(r=>instagramHandle(r.url)===h);const services=result&&inferServices(result.title+' '+result.snippet);
  if(!services)throw Error('No pudimos identificar tu oferta en la web pública. Completá “Qué ofrecés” en Filtros para orientar la búsqueda sin API.');
  return {services,summary:result.snippet,source:result.url,fromContext:false,method:'public-web'};
 }
}
export async function discoverWeb({store,seed,web=new PublicWebDiscovery(),progress=()=>{},save=async()=>{},cancelled=()=>false}){
 const settings={...store.settings(),lastSeed:seed};const known=new Set(store.list().map(l=>l.handle));const state={status:'running',method:'public-web',found:0,qualified:0,review:0,target:Math.min(100,settings.maxResults||100),stage:'Identificando tu oferta en la web pública',summary:'',queries:0,usage:null,startedAt:new Date().toISOString()};
 const emit=()=>progress({...state});emit();
 try{
  const profile=await web.profile(seed,settings);state.profile=profile;emit();
  const plan=queryPlan(settings);state.totalQueries=plan.length;
  for(const [index,query]of plan.entries()){
   if(cancelled()||state.found>=state.target)break;
   state.stage=`Buscando ${settings.segment} en ${query.city?[query.city,query.country].join(', '):query.country} · consulta ${index+1}/${plan.length}`;state.queries=index+1;emit();
   const results=await web.search(query.q);if(cancelled())break;
   const leads=[];for(const result of results){const lead=webCandidate(result,settings,profile,[...known]);if(lead){known.add(lead.handle);leads.push(lead);}if(leads.length>=state.target-state.found)break;}
   const count=ingest(store,leads);state.found+=count.added;state.review+=count.added;emit();if(count.added)await save().catch(()=>{});
  }
  state.status=cancelled()?'paused':'completed';state.stage=cancelled()?'Búsqueda detenida':`${state.found} candidatos encontrados en la web`;
 }catch(e){state.status=cancelled()?'paused':'failed';state.error=cancelled()?'':e.message;state.stage=cancelled()?'Búsqueda detenida':'La búsqueda se detuvo; se conservaron los candidatos encontrados.';}
 state.summary=`Búsqueda web sin API: ${state.found} candidatos con rubro y ubicación identificados en resultados públicos. Revisá Por verificar: falta comprobar actividad actual, feed y encaje específico con tu oferta. ${state.found<state.target?'No se completó el objetivo de '+state.target+'; no se rellenaron faltantes.':''}`;
 state.usage={webRequests:web.calls,paidApiCalls:0};emit();store.setJob('lastSearch',{...state,seed,at:new Date().toISOString()});return state;
}
