export function cleanName(v){return String(v||'').replace(/\s*[•·]\s*Instagram( photos and videos| fotos y videos)?.*$/i,'').replace(/\s*\(@[^)]*\)?.*$/,'').replace(/\s+\|\s+.*$/,'').trim();}
// Several versions separated by a line with "---": each client gets one, always the same one, so messages don't all read alike.
export const VERSION_SEPARATOR=/\n\s*-{3,}\s*\n/;
export const DEFAULT_TEMPLATE=['¡Hola, equipo de {cliente}! 👋 Soy {remitente} y hago contenido para Instagram. Estuve viendo su perfil y se me ocurrieron un par de ideas de reels para mostrar mejor lo que tienen{en_ciudad}. ¿Les mando 2 o 3 ejemplos, sin compromiso? Si no les interesa, me avisan y no les escribo más 🙂',
 'Hola {cliente}, ¿cómo están? Soy {remitente}. Trabajo con negocios como el suyo armando fotos, reels y el feed de Instagram para que quien los encuentra tenga ganas de ir. Tengo una idea puntual para ustedes, ¿se las paso por acá? Y si prefieren que no les escriba, no hay problema.',
 '¡Hola! Les escribo por {cliente} 😊 Soy {remitente} y me dedico a las redes de negocios{en_ciudad}. Muchas veces un par de reels bien pensados hacen que más gente los elija. Si quieren, les cuento cómo lo haría con ustedes, cortito y sin compromiso. Si no les interesa, me dicen y listo.'].join('\n---\n');
const pick=(versions,key)=>{let h=0;for(const ch of String(key))h=(h*31+ch.charCodeAt(0))>>>0;return versions[h%versions.length];};
export function personalize(text,lead,settings){
 const own=String(settings.lastSeed||'').match(/instagram\.com\/([a-z0-9._]+)/i)?.[1]||settings.instagramSender;
 const name=cleanName(lead.name)||lead.handle;const city=String(lead.city||'').trim();
 const values={hotel:name,cliente:name,nombre:name,cuenta:'@'+lead.handle,ciudad:city,en_ciudad:city?' en '+city:'',remitente:settings.sender||(own?'@'+own:''),servicio:settings.offer||''};
 const versions=String(text||'').split(VERSION_SEPARATOR).map(v=>v.trim()).filter(Boolean);
 return pick(versions.length?versions:[''],lead.handle||name).replace(/\{(hotel|cliente|nombre|cuenta|ciudad|en_ciudad|remitente|servicio)\}/g,(_,key)=>values[key]);
}
