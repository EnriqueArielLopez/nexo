import {COUNTRIES} from './geography.mjs';
import {handle} from './core.mjs';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function inCountries(country,settings){
 if(!settings.countries?.length)return true;
 return COUNTRIES.some(c=>settings.countries.includes(c.code)&&[norm(c.code),norm(c.name)].includes(norm(country)));
}
export function isNewProspect(value,seed='',known=[]){
 try{const candidate=handle(value);return (!seed||candidate!==handle(seed))&&!(known instanceof Set?known.has(candidate):known.some(h=>handle(h)===candidate));}catch{return false;}
}
export function claudeSearchRequest(settings){
 const countries=COUNTRIES.filter(c=>settings.countries.includes(c.code)).map(c=>c.name).join(', ');
 return `Usá el conector Nexo. Primero consultá nexo_estado y nexo_conocidos. Analizá MI perfil de Instagram ${settings.lastSeed||'(pedime mi perfil)'} para identificar mis servicios${settings.offer?': '+settings.offer:''}. Buscá hasta ${settings.maxResults||100} clientes potenciales del rubro ${settings.segment} en ${countries}${settings.cities?'; exclusivamente en estas ciudades o zonas: '+settings.cities:'. Sin restricción de ciudad'}. Respetá estos filtros, priorizá el encaje concreto con mi oferta y respaldá la identidad, actividad comercial y oportunidad con fuentes públicas. No inventes datos ni interpretes un Instagram inaccesible como inactivo. Excluí mi propia cuenta y las cuentas ya guardadas. Guardá los resultados y sus propuestas con nexo_guardar_hoteles; los casos sin evidencia suficiente quedan Por verificar. No envíes mensajes ni emails.`;
}
