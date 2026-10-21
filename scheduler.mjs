import {day} from './core.mjs';
import {auditOf} from './qualification.mjs';
import {emailLead} from './mailer.mjs';
// Runs scheduled sends. Email goes out automatically; Instagram turns into a "due" reminder the user (or Claude) completes.
const hm=(now=new Date())=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
export function planDaily(store,now=new Date()){
 const s=store.settings();if(!s.autoEmail||hm(now)<s.autoEmailTime||store.job('autoEmailDay')===day(now))return null;
 store.setJob('autoEmailDay',day(now));
 const busy=new Set(store.schedules().filter(x=>['pending','due'].includes(x.status)).map(x=>x.lead_id));
 const ids=store.list().filter(l=>!l.demo&&auditOf(l)?.status==='ready'&&!busy.has(l.id)&&!store.gate({...l,approved:1},now,false,'','email')).slice(0,s.autoEmailCount).map(l=>l.id);
 return ids.length?store.schedule(ids,'email',now):{ok:[],skipped:[]};
}
export async function runSchedules({store,dir,smtp,now=new Date(),pause=4000,onSent=async()=>{}}){
 planDaily(store,now);let sent=0,hold=!smtp.pass||!smtp.user?'Esperando: configurá tu email en Ajustes':'';
 for(const job of store.due(now)){
  if(job.channel!=='email'){store.setSchedule(job.id,'due','Toca enviarlo por Instagram');continue;}
  // Once email can't go out this round (no mailbox or quota used up), the rest wait with the reason.
  if(hold){store.setSchedule(job.id,'pending',hold);continue;}
  try{await emailLead(store,dir,smtp,job.lead_id);store.setSchedule(job.id,'sent','Enviado');sent++;await onSent();await new Promise(r=>setTimeout(r,pause));}
  catch(e){if(/Cupo/.test(e.message)){hold='Esperando cupo: '+e.message;store.setSchedule(job.id,'pending',hold);continue;}store.setSchedule(job.id,'failed',e.message);}
 }
 return sent;
}
