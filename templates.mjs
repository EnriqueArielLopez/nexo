export function personalize(text,lead,settings){
 const own=String(settings.lastSeed||'').match(/instagram\.com\/([a-z0-9._]+)/i)?.[1]||settings.instagramSender;
 const values={hotel:lead.name||lead.handle,cliente:lead.name||lead.handle,nombre:lead.name||lead.handle,cuenta:'@'+lead.handle,ciudad:lead.city||'',remitente:settings.sender||(own?'@'+own:''),servicio:settings.offer||''};
 return String(text||'').replace(/\{(hotel|cliente|nombre|cuenta|ciudad|remitente|servicio)\}/g,(_,key)=>values[key]);
}
