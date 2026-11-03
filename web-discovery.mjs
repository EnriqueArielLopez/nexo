import {createHash} from 'node:crypto';
import {personalize} from './templates.mjs';
import {websiteProfiles} from './website-prospects.mjs';
import dns from 'node:dns/promises';
import net from 'node:net';
import {COUNTRIES} from './geography.mjs';
import {handle,httpUrl,defaults} from './core.mjs';
import {isNewProspect} from './campaign.mjs';
import {ingest} from './imports.mjs';
import {COUNTRY_CITIES,premiumSignals,isDirectory} from './prospecting.mjs';

export const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function decodeHtml(value){return String(value||'').replace(/&#(x[\da-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,m=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '})[m]);}
export function plainText(value){return decodeHtml(String(value||'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),decodeHtml(m[2]??m[3])]));
export function instagramHandle(url){try{const u=new URL(url);if(!['instagram.com','www.instagram.com'].includes(u.hostname))return '';const parts=u.pathname.split('/').filter(Boolean);if(parts.length===2&&['reels','tagged'].includes(parts[1]))u.pathname='/'+parts[0]+'/';return handle(u.href);}catch{return '';}}
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
export async function fetchPublic(value,{signal,timeoutMs=12000}={}){
 let url=value;
 for(let redirects=0;redirects<5;redirects++){
  const u=await publicUrl(url);const response=await fetch(u,{redirect:'manual',headers:{'user-agent':'NexoClientes/3.4 (public business research)','accept':'text/html,application/xhtml+xml'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});
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
 'Gastronomía':['restaurante','parrilla','resto','cerveceria','pizzeria','restobar','bodegon','sangucheria','bar','parrillada','gastronomia','restaurant','gastronomico'],
 'Cafeterías':['cafeteria','cafe','coffee'],'Indumentaria':['indumentaria','ropa','moda','boutique','vestidos'],
 'Estética y belleza':['estetica','belleza','peluqueria','salon de belleza','spa','cosmetica'],
 'Gimnasios':['gimnasio','fitness','gym','crossfit'],'Inmobiliarias':['inmobiliaria','bienes raices','real estate'],
 'Turismo':['turismo','excursiones','agencia de viajes','tours'],'Salud':['clinica','consultorio','odontologia','centro medico','salud'],
 'Comercios':['tienda','comercio','local comercial','negocio','shop']
};
const countryAliases={AR:['argentina','🇦🇷','arg.'],BO:['bolivia','🇧🇴'],CL:['chile','🇨🇱'],CO:['colombia','🇨🇴'],CR:['costa rica','🇨🇷'],CU:['cuba','🇨🇺'],EC:['ecuador','🇪🇨'],SV:['el salvador','🇸🇻'],ES:['españa','spain','🇪🇸'],GT:['guatemala','🇬🇹'],GQ:['guinea ecuatorial','🇬🇶'],HN:['honduras','🇭🇳'],MX:['méxico','mexico','🇲🇽'],NI:['nicaragua','🇳🇮'],PA:['panamá','panama','🇵🇦'],PY:['paraguay','🇵🇾'],PE:['perú','peru','🇵🇪'],PR:['puerto rico','🇵🇷'],DO:['república dominicana','🇩🇴'],UY:['uruguay','🇺🇾'],VE:['venezuela','🇻🇪']};
const escaped=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const contains=(text,term)=>new RegExp('(?:^|[^a-z0-9])'+escaped(normalize(term))+'(?:$|[^a-z0-9])').test(normalize(text));
const terms=s=>{const lists=String(s).split(/\s*,\s*/).filter(Boolean).map(x=>SECTOR_TERMS[x]||[x]),out=[];for(let i=0;i<Math.max(0,...lists.map(l=>l.length));i++)for(const l of lists)if(l[i])out.push(l[i]);return [...new Set(out)];};
// A province request includes its localities; a specific city stays specific.
const regionalZones={AR:{tucuman:['Tucumán','San Miguel de Tucumán','Yerba Buena','Tafí Viejo','Tafí del Valle']}};
const zonesFor=(city,code)=>regionalZones[code]?.[normalize(city)]||[city];
export function matchGeography(text,settings){
 // Handles, hashtags and URLs are identities/topics, not proof of location.
 const location=normalize(text).replace(/https?:\/\/\S+|[@#][a-z0-9._]+/g,' ').replace(/"/g,' ').trim();
 const citiesByCountry={AR:['buenos aires','mar del plata','villa carlos paz','san carlos de bariloche','puerto iguazu'],UY:['montevideo','punta del este','colonia del sacramento'],ES:['madrid','barcelona','sevilla','valencia'],MX:['ciudad de mexico','cancun','aguascalientes','guadalajara'],CO:['bogota','medellin','cartagena de indias'],PE:['lima, peru','cusco','cuzco'],BO:['cochabamba','santa cruz de la sierra'],CL:['santiago de chile','vina del mar','puerto varas']};
 const hasCountry=c=>(countryAliases[c.code]||[c.name]).some(t=>{
  if(/[^\x00-\x7f]/.test(t)&&t.includes('🇦'))return location.includes(t);
  if(t.codePointAt(0)>0xffff)return location.includes(t);
  return new RegExp('(?:^|[,;|•·:–—]\\s*|\\b(?:en|in|pais)\\s+)'+escaped(normalize(t))+'(?=$|[\\s,;|•·:!.)])').test(location);
 });
 const explicit=COUNTRIES.filter(hasCountry);const selected=COUNTRIES.filter(c=>settings.countries.includes(c.code));
 const ambiguous=new Set(['cuenca','valencia','salamanca','leon','santander']);
 const atLocation=city=>new RegExp('(?:^|[,;|•·:–—]\\s*|\\b(?:en|in)\\s+)'+escaped(normalize(city))+'(?=$|[\\s,;|•·:!.)])').test(location);
 const inferred=COUNTRIES.filter(c=>[...(citiesByCountry[c.code]||[]),...(COUNTRY_CITIES[c.code]||[])].some(city=>!ambiguous.has(normalize(city))&&(atLocation(city)||location.split(/\s+/).length>=4&&contains(location,city))));
 const country=explicit.length?selected.find(c=>explicit.includes(c)):inferred.length===1?selected.find(c=>c.code===inferred[0].code):null;
 if(!country)return null;
 if(country.code==='AR'&&normalize(settings.cities).trim()==='tucuman'){
  if(['CABA','Capital Federal','Ciudad Autónoma de Buenos Aires'].some(p=>contains(location,p)))return null;
  if(!contains(location,'Tucumán')&&['Catamarca','Salta','Jujuy','Santiago del Estero','Buenos Aires','Córdoba','Mendoza','La Rioja','San Juan','San Luis','Santa Fe','Entre Ríos','Corrientes','Misiones','Chaco','Formosa','Neuquén','Río Negro','Chubut','Santa Cruz','Tierra del Fuego','La Pampa'].some(p=>contains(location,p)&&!new RegExp(escaped(normalize(p))+'\\s+\\d').test(location)))return null;
 }
 const cities=String(settings.cities||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);const city=cities.flatMap(c=>zonesFor(c,country.code)).sort((a,b)=>b.length-a.length).find(c=>contains(location,c));
 if(cities.length&&!city)return null;return {country:country.name,city:city||(COUNTRY_CITIES[country.code]||[]).find(c=>contains(location,c))||''};
}
export function inferServices(text){
 text=normalize(text).replace(/see instagram photos and videos from|instagram photos and videos|fotos y videos de instagram/g,'');
 const matches=[[/community manager|social media|gestion de redes/,'gestión de redes sociales'],[/content creator|creador[ae]? de contenido|contenido|\bugc\b/,'creación de contenido'],[/fotograf/,'fotografía'],[/video|reels|audiovisual/,'producción de videos'],[/marketing|publicidad/,'marketing y publicidad'],[/diseno|branding/,'diseño y marca'],[/software|programacion|desarrollo web/,'desarrollo de software']];
 return matches.filter(([pattern])=>pattern.test(text)).map(([,label])=>label).join(', ');
}
// Indexed Instagram snippets often omit the location; the query already targeted it.
// Countries outside the Spanish-speaking list that still show up in results ("Hotel en Miami, Estados Unidos").
const FOREIGN=/(?:^|[^a-z])(estados unidos|united states|ee ?uu|brasil|brazil|portugal|italia|italy|francia|france|alemania|germany|reino unido|united kingdom|inglaterra|canada|turquia|turkiye|turkey|grecia|greece|marruecos|morocco|egipto|egypt|dubai|emiratos|tailandia|thailand|indonesia|bali|maldivas|maldives|japon|japan|australia|suiza|switzerland|austria|holanda|netherlands|belgica|croacia|croatia)(?:$|[^a-z])/;
function queryGeography(result,settings){const q=result.query;if(!q?.country)return null;const text=normalize([result.title,result.snippet].join(' '));const other=COUNTRIES.filter(c=>!settings.countries.includes(c.code)).some(c=>(countryAliases[c.code]||[c.name]).some(t=>t.codePointAt(0)<=0xffff&&new RegExp('(?:^|[^a-z])'+escaped(normalize(t))+'(?:$|[^a-z])').test(text)));if(other||FOREIGN.test(text))return null;const cities=String(settings.cities||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);if(cities.length&&!q.city)return null;return {country:q.country,city:q.city||'',fromQuery:true};}
// Big hotel chains run social media from a central team, so they aren't clients for this service.
const CHAINS=/(?:^|[^a-z])(secrets [^()@]*resort|dreams [^()@]*resort|breathless|zoetry|hyatt|marriott|sheraton|westin|ritz.carlton|st\.? regis|four seasons|hilton|doubletree|hampton by|waldorf|conrad|intercontinental|holiday inn|crowne plaza|radisson|wyndham|sofitel|novotel|ibis|mercure|pullman|fairmont|kempinski|mandarin oriental|rosewood|melia|paradisus|riu|barcelo|iberostar|bahia principe|nh hotel|nh collection|hard rock hotel|palladium|royalton|sandos|h10 hotel|catalonia hotel|fiesta americana|live aqua|grand velas|krystal|decameron|sonesta|best western|eurostars|vincci|room mate|anantara|sls|hotel indigo|kimpton|aloft|le meridien|courtyard by|four points|moxy|ac hotel|city express|camino real|vignette collection|royal hideaway|trs [a-z]+ hotel|sercotel|hospes|abba hotel(?:es)?|abbahoteles)(?:$|[^a-z])/;
// Creators, influencers, agencies and real estate mention hotels but aren't businesses that need the service (some are competitors).
const NOT_BUSINESS=/(?:^|[^a-z])(creador(?:a)? de contenido|content creator|ugc creator|influencer|blogger|bloguera|vlogger|travel ?(?:&|y|and) ?life|travel lover|amante de los viajes|viajer[oa] ?(?:por el mundo|empedernid[oa])|fotograf[oa] de|fotografia (?:de|para) hoteles|filmmaker|videograf[oa]|community manager|social media manager|marketing digital|agencia de (?:marketing|publicidad|contenido)|real estate|inmobiliaria|bienes raices|colaboraciones por dm|colabs? por dm|embajador(?:a)? de marca|agente de viajes|travel agent|(?:los )?mejores hoteles|hoteles top|top hoteles|especialistas en hoteles|hoteles (?:de lujo )?para parejas|periodista|revista|editorial|gerente (?:en|de|general)|liderazgo|perfumeria|aromas? (?:para|que)|tu hogar en hotel|official bar and restaurant|experiencias? de viaje)(?:$|[^a-z])/;
// Other trades that mention hotels in the bio ("VIP Home & Hotel Service") but name another business.
const LODGING=/hotel|hostal|hostel|posada|resort|lodge|suites|apart|cabana|hosteria|hospedaje|alojamiento|glamping|estancia|hacienda|inn(?:$|[^a-z])|bnb|villas?(?:$|[^a-z])/;
const OTHER_TRADE=/(?:^|[^a-z])(barberia|barber|peluqueria|salon de belleza|estetica|nails|unas|tattoo|restaurante?|bar|cafe|cafeteria|pasteleria|panaderia|heladeria|tienda|joyeria|boutique de ropa|indumentaria|clinica|consultorio|dental|gimnasio|gym|inmobiliaria|tours?|traslados|transporte|yates?|catamaran|eventos|wedding|florer[ia]a?|spa)(?:$|[^a-z])/;
const accountName=result=>normalize(result.title.replace(/\s*[-–|•]\s*Instagram.*$/i,'').replace(/on instagram.*$/i,'')+' '+(instagramHandle(result.url)||''));
export function otherTrade(result){const name=accountName(result);return OTHER_TRADE.test(name)&&!LODGING.test(name);}
// A lodging is a lodging by its own name, or because its bio talks about rooms and guests. A bio that only mentions "hotel" isn't enough
// (barbers, drivers and photographers list hotels among their clients).
const STAY=/(?:^|[^a-z])(habitacion(?:es)?|rooms?|suites?|huespedes|guests|check.?in|hospedate|alojate|hospedaje|alojamiento|estadias?|tu estadia|your stay|noches? de hotel|hotel boutique|boutique hotel|cabanas|departamentos? (?:temporarios|turisticos))(?:$|[^a-z])/;
export function lodging(result){const name=accountName(result);if(LODGING.test(name))return true;if(OTHER_TRADE.test(name))return false;return STAY.test(normalize(result.snippet.replace(/^.*?on\s+Instagram\s*:\s*/i,'')));}
export function notBusiness(result){return NOT_BUSINESS.test(normalize(result.title+' '+result.snippet));}
export function hotelChain(result){return CHAINS.test(normalize(result.title+' '+(instagramHandle(result.url)||'')));}
// Post dates the search index shows for an account ("handle on March 23, 2026", "handle el 23 de marzo de 2026", "handle 2d").
const MONTHS={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};
export function postDates(results,h,now=new Date()){const name=escaped(normalize(h)),out=new Set();for(const r of results||[]){const t=normalize(r.title+' '+r.snippet);for(const m of t.matchAll(new RegExp(name+' on ([a-z]+) (\\d{1,2}), (\\d{4})','g')))if(m[1]in MONTHS)out.add(new Date(Date.UTC(+m[3],MONTHS[m[1]],+m[2])).toISOString().slice(0,10));for(const m of t.matchAll(new RegExp(name+' el (\\d{1,2}) de ([a-z]+) de (\\d{4})','g')))if(m[2]in MONTHS)out.add(new Date(Date.UTC(+m[3],MONTHS[m[2]],+m[1])).toISOString().slice(0,10));for(const m of t.matchAll(new RegExp(name+' (\\d{1,3}) ?(h|d|w|sem)(?:$|[^a-z])','g'))){const n=+m[1],ago=m[2]==='h'?0:m[2]==='d'?n:n*7;out.add(new Date(now-ago*864e5).toISOString().slice(0,10));}}return [...out].filter(d=>new Date(d)<=now).sort().reverse();}
// Signals that an Instagram account is gone or inactive in the public index.
export function inactiveAccount(result){const t=normalize([result.title,result.snippet].join(' '));if(/page not found|pagina no encontrada|no esta disponible|isn.t available|cuenta (eliminada|desactivada)|cerrado definitivamente|permanently closed|cerramos (nuestras puertas|definitivamente)|ya no (estamos|atendemos)/.test(t))return 'cerrada o inexistente';const m=t.match(/([\d.,]+)\s*(k|mil|m)?\s*(posts|publicaciones)\b/);if(m&&Number(m[1].replace(/[.,]/g,''))===0)return 'sin publicaciones';return '';}
// The snippet of an account rarely says its category: a result of a search for luxury or 3-5 star hotels counts as high
// category unless it says it has 1 or 2 stars (the activity check and the user's review come after).
const LOW_STARS=/(?:^|[^a-z0-9])(?:1|2|una|dos)\s*(?:[-–]\s*)?(?:estrellas|stars?)(?:$|[^a-z])/;
const PREMIUM_QUERY=/(?:^|\s)(?:lujo|luxury|[345] estrellas|boutique spa)(?:\s|$)/;
export function premiumMatch(result,source=''){const text=result.title+' '+result.snippet,signals=premiumSignals(text,source);if(signals.length)return signals;if(LOW_STARS.test(normalize(text)))return [];return PREMIUM_QUERY.test(result.query?.q||'')?[{label:'Encontrado buscando alta categoría (confirmala)',excerpt:result.query.q,source:''}]:[];}
export function webCandidate(result,settings,profile,known=[]){
 const h=instagramHandle(result.url);if(!h||!isNewProspect(h,settings.lastSeed,known))return null;
 const text=[result.title,result.snippet].join(' ');const biography=result.snippet.replace(/^.*?on\s+Instagram\s*:\s*/i,'');
 if(isDirectory(text)||hotelChain(result)||notBusiness(result))return null;
 if(/hotel|resort|posada|hostal|apart/i.test(settings.segment)&&(otherTrade(result)||!lodging(result)))return null;
 if(inactiveAccount(result))return null;const geo=matchGeography(biography,settings)||queryGeography(result,settings);if(!geo||!terms(settings.segment).some(t=>contains(text,t)))return null;
 if(/(?:cerrado definitivamente|permanently closed|agencia de viajes|guia de hoteles|directorio de hoteles|asesoramos y gestionamos sus reservas)/i.test(text)&&!String(settings.segment).split(/\s*,\s*/).includes('Turismo'))return null;
 const name=result.title.replace(/\s*[-–|]\s*Instagram.*$/i,'').replace(/\s*\(@[^)]+\)/,'').trim().slice(0,200)||h;
 const description=result.snippet.slice(0,1000);const source=result.evidenceUrl||result.url;
 const commercial=/reserv[aá]|booking|compr[aá]|pedidos|turnos|citas|tienda|ventas|whatsapp|contact[aá]|men[uú]|cat[aá]logo/i.test(description);
 const fit=`Rubro ${settings.segment} y ubicación coinciden con los filtros. Oferta del proveedor: ${profile.services}. Encaje específico pendiente de revisión.`;
 const category=premiumMatch(result,source);if(settings.businessTier==='premium'&&!category.length)return null;
 const indexedMatch=description.match(/([\d.,]+)\s+(?:posts|publicaciones)\b/i),indexedPosts=indexedMatch?Number(indexedMatch[1].replace(/[.,]/g,'')):null;const sparseHint=indexedPosts!==null&&indexedPosts<=12;
 const followers=(()=>{const m=normalize(description).match(/([\d.,]+)\s*(k|mil|m)?\s*(followers|seguidores)/);if(!m)return null;const n=Number(m[1].replace(/[.,]/g,''));return m[2]==='m'?n*1e6:m[2]?n*1000:n;})();const active=indexedPosts!==null&&indexedPosts>0&&(followers===null||followers>=50);
 const score=Math.min(90,40+(sparseHint?10:0)+(geo.city?10:0)+(commercial?10:0)+(active?5:0)-(geo.fromQuery?5:0)-(followers!==null&&followers>=20000?10:0)+Math.min(25,category.length*10));
 const qualification={version:2,method:'public-web',status:'review',hotel:true,hotelSource:source,business:'unknown',businessSignal:'none',businessSource:source,businessDetail:'Resultado público indexado: '+description,feed:'unverified',feedSource:'',feedDetail:'El feed y la actividad actual no fueron comprobados. Un resultado indexado no confirma operación actual ni falta de contenido.',postsCount:null,lastPost:'',stories:'unverified',fit,score,label:'Coincide con filtros · revisar oportunidad',checkedAt:new Date().toISOString(),manual:false};
 qualification.indexedPosts=indexedPosts;qualification.followers=followers;qualification.activeSignal=active;if(geo.fromQuery)qualification.feedDetail+=' Ubicación tomada de la búsqueda; confirmala en el perfil.';qualification.contentHint=sparseHint?'Pocas publicaciones en el índice; revisar estado actual':'';if(indexedPosts!==null)qualification.feedDetail+=' El índice informa '+indexedPosts+' publicaciones; el conteo actual no está verificado.';qualification.categorySignals=category;qualification.capacityToPay='unverified';if(category.length)qualification.label=sparseHint?'Alta categoría · pocas publicaciones indexadas · revisar':'Señales de alta categoría · revisar encaje';qualification.fit+=category.length?' Señales públicas: '+category.map(s=>s.label).join(', ')+'. Capacidad de pago sin verificar.':'';
 const message=personalize(settings.template||defaults.template,{name,handle:h,city:geo.city},{...settings,sender:settings.sender||'@'+handle(settings.lastSeed),offer:profile.services});
 const email=(description.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)||[])[0]||'';
 return {email,handle:h,name,...geo,language:'es',source,message,reason:[qualification.businessDetail,qualification.fit,qualification.feedDetail].join(' · '),score,score_reason:'Afinidad por rubro, ubicación y categoría publicada; capacidad de pago e intención de compra sin verificar.',qualification};
}
export function rejectionReason(result,settings,known=[]){
 const h=instagramHandle(result.url);if(!h)return 'invalidProfile';if(!isNewProspect(h,settings.lastSeed,known))return 'duplicates';
 const text=result.title+' '+result.snippet;if(isDirectory(text))return 'directory';if(hotelChain(result))return 'chain';if(notBusiness(result))return 'creator';if(/hotel|resort|posada|hostal|apart/i.test(settings.segment)&&(otherTrade(result)||!lodging(result)))return 'sector';
 if(inactiveAccount(result))return 'inactive';if(!matchGeography(result.snippet.replace(/^.*?on\s+Instagram\s*:\s*/i,''),settings)&&!queryGeography(result,settings))return 'location';
 if(!terms(settings.segment).some(t=>contains(text,t)))return 'sector';
 if(settings.businessTier==='premium'&&!premiumMatch(result,result.url).length)return 'category';return 'other';
}
export function queryPlan(settings){
 const countries=COUNTRIES.filter(c=>settings.countries.includes(c.code));const cities=String(settings.cities||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);const plan=[];
 const variants=settings.businessTier==='premium'?['lujo','4 estrellas','3 estrellas','5 estrellas','boutique spa','luxury']:['','reservas','oficial','contacto'];
 const countryZones=c=>cities.length?[...new Set(cities.flatMap(city=>zonesFor(city,c.code)))]:['',...(COUNTRY_CITIES[c.code]||[])];
 // Try different business types early instead of repeating restaurante/restaurant.
 for(const variant of variants){const maxZones=Math.max(0,...countries.map(c=>countryZones(c).length));
  const pairs=Array.from({length:maxZones},(_,zone)=>terms(settings.segment).map((term,index)=>({zone,term,index}))).flat();if(!cities.length)pairs.sort((a,b)=>a.index-b.index||a.zone-b.zone);
  for(const {zone,term} of pairs)for(const country of countries){const zones=countryZones(country);if(zone>=zones.length)continue;const city=zones[zone];const region=cities.find(c=>regionalZones[country.code]?.[normalize(c)]?.includes(city));const q=`site:instagram.com ${term} ${variant} ${city||country.name}${region&&normalize(city)!==normalize(region)?' '+region:''}${variant&&cities.length?' '+country.name:''}`.replace(/\s+/g,' ').trim();plan.push({q,country:country.name,city});}
 }
 const mixed=[];for(const p of plan){mixed.push(p);if(settings.businessTier==='premium'&&settings.segment.includes('Hotel'))mixed.push({...p,q:p.q.replace('site:instagram.com ','')+' Instagram'});}return mixed.slice(0,6000);
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
export async function discoverWeb({store,seed,web=new PublicWebDiscovery(),inspect=null,verifyActivity=true,maxQueries=QUERIES_PER_SEARCH,rest=(ms=1200+Math.random()*1800)=>new Promise(r=>setTimeout(r,ms)),progress=()=>{},save=async()=>{},cancelled=()=>false}){
 const settings={...store.settings(),lastSeed:seed};const known=new Set(store.knownHandles());const state={status:'running',method:'public-web',found:0,qualified:0,review:0,target:Math.min(100,settings.maxResults||100),businessTier:settings.businessTier||'all',stage:'Identificando tu oferta en la web pública',summary:'',queries:0,pages:0,scanned:0,rejected:{},ids:[],usage:null,startedAt:new Date().toISOString()};
 let checking=Promise.resolve(),queued=0,failure=null,halted=false;
 const emit=()=>progress({...state,elapsedMs:Date.now()-Date.parse(state.startedAt),checking:queued,ids:[...state.ids],rejected:{...state.rejected}});emit();
 try{
  const profile=await web.profile(seed,settings);state.profile=profile;emit();
  const full=queryPlan(settings),fingerprint=createHash('sha256').update(JSON.stringify([seed,settings.countries,settings.cities,settings.segment,settings.businessTier,full])).digest('hex'),saved=store.job('searchCursor'),start=saved?.fingerprint===fingerprint&&saved.next<full.length?saved.next:0;const plan=[...full.slice(start),...full.slice(0,start)].slice(0,Math.max(1,Math.min(QUERIES_PER_SEARCH,maxQueries)));state.totalQueries=plan.length;let consecutive=0,cooldowns=0;
  // Nexo is for accounts that barely post: read the dates of their last posts on the profile itself (or, if it can't be
  // read, estimate them from the index) and drop the ones that post regularly, that don't exist or that aren't lodgings.
  const drop=(id,why)=>{store.db.prepare('UPDATE leads SET archived=1,approved=0 WHERE id=?').run(id);state.found--;state.review--;state.ids=state.ids.filter(x=>x!==id);state.rejected[why]=(state.rejected[why]||0)+1;};
  const checkActivity=async ids=>{const pending=ids.filter(id=>!store.get(id)?.activity);if(!pending.length)return;if(!inspect)state.stage=`Revisando en Instagram cuándo publicaron ${pending.length} ${pending.length===1?'cuenta':'cuentas'}`;emit();for(const id of pending){if(cancelled()||halted)break;const l=store.get(id);let profile=null;if(inspect){try{profile=await inspect(l.handle);}catch{}if(cancelled()||halted)break;if(profile?.warning)throw Error('Instagram pidió una revisión. Se detuvo la verificación; los candidatos quedaron guardados.');if(profile?.missing){drop(id,'missing');continue;}if(profile?.title&&/hotel|resort|posada|hostal|apart/i.test(settings.segment)&&otherTrade({title:profile.title,url:l.source})){drop(id,'otherTrade');continue;}await rest();}let a;if(profile?.dates)a=store.setActivity(id,{dates:profile.dates,source:'profile',note:'Revisado en su perfil durante la búsqueda'});else if(inspect)continue;else{let found;try{found=await resilient(()=>web.search('site:instagram.com/p/ '+l.handle));}catch(e){if(!transient(e))throw e;continue;}a=store.setActivity(id,{dates:postDates(found,l.handle),source:'index'});}state.activityChecked=(state.activityChecked||0)+1;if(a.verdict==='active')drop(id,'active');emit();}await save().catch(()=>{});};
  // With Instagram open in Chrome, profiles are checked while the search keeps going in the other browser.

  const enqueue=ids=>{const pending=ids.filter(id=>!store.get(id)?.activity);if(!pending.length)return;queued+=pending.length;checking=checking.then(()=>checkActivity(pending)).catch(e=>{failure=failure||e;}).then(()=>{queued-=pending.length;});};
  const settle=async()=>{await checking;if(failure)throw failure;};
  for(const [index,query]of plan.entries()){
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
