import {GENERAL_COMMERCE,COMMERCE_TERMS,lodgingOnly,generalCommerce} from './business-sectors.mjs';
import {personalize,DEFAULT_TEMPLATE} from './templates.mjs';
import {COUNTRIES} from './geography.mjs';
import {handle,httpUrl} from './identity.mjs';
import {isNewProspect} from './campaign.mjs';
import {COUNTRY_CITIES,premiumSignals,isDirectory} from './prospecting.mjs';
const defaults={template:DEFAULT_TEMPLATE};
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
const terms=s=>{const lists=String(s).split(/\s*,\s*/).filter(Boolean).map(x=>(x===GENERAL_COMMERCE||x==='Comercios'?COMMERCE_TERMS:SECTOR_TERMS[x]||[x])),out=[];for(let i=0;i<Math.max(0,...lists.map(l=>l.length));i++)for(const l of lists)if(l[i])out.push(l[i]);return [...new Set(out)];};
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
function excludedBusiness(result,settings){if(lodgingOnly(settings.segment))return hotelChain(result)||notBusiness(result);const name=accountName(result);return /(?:^|[^a-z])(influencer|blogger|creador[ae]? de contenido|community manager|agencia de marketing|ugc creator|guia de comercios|directorio de negocios)(?:$|[^a-z])/.test(name);}
export function webCandidate(result,settings,profile,known=[]){
 const h=instagramHandle(result.url);if(!h||!isNewProspect(h,settings.lastSeed,known))return null;
 const text=[result.title,result.snippet].join(' ');const biography=result.snippet.replace(/^.*?on\s+Instagram\s*:\s*/i,'');
 if(isDirectory(text)||excludedBusiness(result,settings))return null;
 if(lodgingOnly(settings.segment)&&(otherTrade(result)||!lodging(result)))return null;
 if(inactiveAccount(result))return null;const geo=matchGeography(biography,settings)||queryGeography(result,settings);if(!geo||!terms(settings.segment).some(t=>contains(text,t)))return null;
 if(/(?:cerrado definitivamente|permanently closed|agencia de viajes|guia de hoteles|directorio de hoteles|asesoramos y gestionamos sus reservas)/i.test(text)&&!String(settings.segment).split(/\s*,\s*/).includes('Turismo'))return null;
 const name=result.title.replace(/\s*[-–|]\s*Instagram.*$/i,'').replace(/\s*\(@[^)]+\)/,'').trim().slice(0,200)||h;
 const description=result.snippet.slice(0,1000);const source=result.evidenceUrl||result.url;
 const commercial=/reserv[aá]|booking|compr[aá]|pedidos|turnos|citas|tienda|ventas|whatsapp|contact[aá]|men[uú]|cat[aá]logo/i.test(description);
 const fit=`Rubro ${settings.segment} y ubicación coinciden con los filtros. Oferta del proveedor: ${profile.services}. Encaje específico pendiente de revisión.`;
 const category=lodgingOnly(settings.segment)?premiumMatch(result,source):[];if(lodgingOnly(settings.segment)&&settings.businessTier==='premium'&&!category.length)return null;
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
 const text=result.title+' '+result.snippet;if(isDirectory(text))return 'directory';if(lodgingOnly(settings.segment)&&hotelChain(result))return 'chain';if(excludedBusiness(result,settings))return 'creator';if(lodgingOnly(settings.segment)&&(otherTrade(result)||!lodging(result)))return 'sector';
 if(inactiveAccount(result))return 'inactive';if(!matchGeography(result.snippet.replace(/^.*?on\s+Instagram\s*:\s*/i,''),settings)&&!queryGeography(result,settings))return 'location';
 if(!terms(settings.segment).some(t=>contains(text,t)))return 'sector';
 if(lodgingOnly(settings.segment)&&settings.businessTier==='premium'&&!premiumMatch(result,result.url).length)return 'category';return 'other';
}
export function queryPlan(settings){
 const countries=COUNTRIES.filter(c=>settings.countries.includes(c.code));const cities=String(settings.cities||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);const plan=[];
 const variants=lodgingOnly(settings.segment)&&settings.businessTier==='premium'?['lujo','4 estrellas','3 estrellas','5 estrellas','boutique spa','luxury']:['','reservas','oficial','contacto'];
 const countryZones=c=>cities.length?[...new Set(cities.flatMap(city=>zonesFor(city,c.code)))]:['',...(COUNTRY_CITIES[c.code]||[])];
 // Try different business types early instead of repeating restaurante/restaurant.
 for(const variant of variants){const maxZones=Math.max(0,...countries.map(c=>countryZones(c).length));
  const pairs=Array.from({length:maxZones},(_,zone)=>terms(settings.segment).map((term,index)=>({zone,term,index}))).flat();if(!cities.length)pairs.sort((a,b)=>a.index-b.index||a.zone-b.zone);
  for(const {zone,term} of pairs)for(const country of countries){const zones=countryZones(country);if(zone>=zones.length)continue;const city=zones[zone];const region=cities.find(c=>regionalZones[country.code]?.[normalize(c)]?.includes(city));const q=`site:instagram.com ${term} ${variant} ${city||country.name}${region&&normalize(city)!==normalize(region)?' '+region:''}${variant&&cities.length?' '+country.name:''}`.replace(/\s+/g,' ').trim();plan.push({q,country:country.name,city});}
 }
 const mixed=[];for(const p of plan){mixed.push(p);if(settings.businessTier==='premium'&&settings.segment.includes('Hotel'))mixed.push({...p,q:p.q.replace('site:instagram.com ','')+' Instagram'});}return mixed.slice(0,6000);
}

// One user-initiated external search includes every selected sector and country.
export function externalSearchQuery(settings){
 const quote=value=>'"'+String(value).replace(/["\\]/g,' ').trim()+'"';
 const countries=COUNTRIES.filter(c=>settings.countries?.includes(c.code)).map(c=>c.name),sectors=terms(settings.segment);
 if(!countries.length||!sectors.length)return '';
 const cities=String(settings.cities||'').split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean);
 return ['site:instagram.com','('+[...new Set(sectors)].map(quote).join(' OR ')+')',cities.length?'('+cities.map(quote).join(' OR ')+')':'','('+countries.map(quote).join(' OR ')+')'].filter(Boolean).join(' ');
}
