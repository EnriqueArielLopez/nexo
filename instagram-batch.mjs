import {createHash} from 'node:crypto';
import {prepareBatch,approveBatch} from './batches.mjs';
export async function previewOfficialBatch({store,instagram,budget,ids}){
 if(!instagram?.account)throw Error('Conectá Instagram mediante la autorización oficial.');if(instagram.paused)throw Error('Instagram está pausado. Revisá el error antes de continuar.');await instagram.sync(store);
 const account=instagram.account,s=store.settings(),counts=budget?.counts(account.id)||{daily:0,monthly:0};
 const batch=prepareBatch(store,ids,'instagram',{eligibility:lead=>store.gate({...lead,qualification:'',approved:1},new Date(),true,account.id)||budget?.gate(account.id,lead.handle,s)||''});
 const left=Math.max(0,Math.min(s.daily-counts.daily,s.monthly-counts.monthly));batch.limit=Math.min(batch.limit,left);
 for(const l of batch.items.splice(left))batch.skipped.push({id:l.id,reason:'Queda para otra tanda por el cupo compartido de Instagram'});
 batch.account={id:account.id,username:account.username};batch.token=createHash('sha256').update(JSON.stringify([account.id,batch.items.map(l=>[l.id,l.message,l.score])])).digest('hex');return batch;
}
export async function startOfficialBatch({store,instagram,budget,queue,ids,token,confirm}){
 if(confirm!==true)throw Error('Revisá y confirmá las propuestas de la tanda.');const batch=await previewOfficialBatch({store,instagram,budget,ids});if(token!==batch.token)throw Error('La cuenta, las propuestas o los destinatarios habilitados cambiaron. Revisá la tanda nuevamente.');if(!batch.items.length)throw Error('No hay destinatarios habilitados dentro del cupo disponible.');approveBatch(store,batch);queue.start(batch.items.map(l=>l.id));return batch;
}
