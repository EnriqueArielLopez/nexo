import {personalize} from './templates.mjs';
import {createHash} from 'node:crypto';
export function prepareBatch(store,ids,channel='instagram'){
 if(!Array.isArray(ids)||!ids.length||ids.length>100)throw Error('Seleccioná entre 1 y 100 clientes.');
 channel=channel==='email'?'email':'instagram';const settings=store.settings(),counts=store.counts(new Date(),false,channel);settings.offer=settings.offer||store.job('lastSearch')?.profile?.services||'';
 const limit=Math.max(0,Math.min((channel==='email'?settings.emailDaily:settings.daily)-counts.daily,(channel==='email'?settings.emailMonthly:settings.monthly)-counts.monthly));
 const selected=new Set(ids.map(Number)),skipped=[],items=[];
 for(const lead of store.list().filter(l=>selected.has(l.id))){
  if(lead.demo||lead.eventStatus||lead.dnc){skipped.push({id:lead.id,reason:'Ya contactado, envío pendiente, baja o ejemplo'});continue;}
  const message=personalize(settings.template,lead,settings),block=store.gate({...lead,message,approved:1,qualification:''},new Date(),false,'',channel);
  if(block&&!/Cupo/.test(block)){skipped.push({id:lead.id,reason:block});continue;}
  if(items.length>=limit){skipped.push({id:lead.id,reason:'Queda para otra tanda por el cupo disponible'});continue;}
  items.push({...lead,message});
 }
 const token=createHash('sha256').update(JSON.stringify([channel,items.map(l=>[l.id,l.message,l.email,l.score]),settings.attachment,settings.emailSubject])).digest('hex');
 return {channel,selected:ids.length,limit,items,skipped,token};
}
export function approveBatch(store,batch){for(const lead of batch.items)store.update(lead.id,{message:lead.message,qualificationReviewed:true,approved:true});}
