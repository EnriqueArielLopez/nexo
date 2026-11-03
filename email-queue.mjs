import {emailLead} from './mailer.mjs';

// Only recipient ids and message fingerprints persist. Credentials stay in memory.
export class EmailQueue {
 constructor({store,dir,save=async()=>{},send=emailLead,delayMs=4000}){
  Object.assign(this,{store,dir,save,send,delayMs});this.active=false;
  this.state=store.job('emailQueue')||{status:'idle',items:[],sent:0,failed:0,message:''};
  if(this.state.status==='running'){this.state.status='paused';this.state.message='La tanda se interrumpió. Revisá el historial antes de reanudar.';this.persist();}
 }
 persist(){this.store.setJob('emailQueue',this.state);}
 start(ids,smtp){
  if(this.active)throw Error('Ya hay una tanda de email en curso.');
  if(!smtp.pass||!smtp.user)throw Error('Configurá tu email en Ajustes.');
  if(!Array.isArray(ids)||!ids.length||ids.length>100)throw Error('Elegí entre 1 y 100 emails.');
  const items=[...new Set(ids.map(Number))].map(id=>{
   const l=this.store.get(id);if(!l)throw Error('Cliente inexistente.');
   return {id,name:l.name,email:l.email,text:l.message,status:'pending',note:''};
  });
  this.state={status:'running',items,sent:0,failed:0,message:'Enviando emails en segundo plano…'};
  this.launch(smtp);return this.state;
 }
 resume(smtp){
  if(this.active)throw Error('La tanda todavía está en curso.');
  if(!smtp.pass||!smtp.user)throw Error('Configurá tu email en Ajustes.');
  if(!this.state.items.some(i=>i.status==='pending'))throw Error('No hay emails pendientes.');
  this.state.status='running';this.launch(smtp);return this.state;
 }
 launch(smtp){
  this.cancel=false;this.active=true;this.persist();
  this.done=this.run(smtp).catch(e=>{this.state.status='paused';this.state.message=e.message;})
   .finally(()=>{this.active=false;this.persist();});
 }
 stop(){if(this.active){this.cancel=true;this.wake?.();this.state.message='Deteniendo después del email en curso…';this.persist();}}
 clear(){if(this.active)throw Error('Detené la tanda de email antes de limpiarla.');this.state={status:'idle',items:[],sent:0,failed:0,message:''};this.persist();}
 async run(smtp){
  for(const item of this.state.items){
   if(this.cancel)break;if(item.status!=='pending')continue;
   const l=this.store.get(item.id);
   if(!l||l.email!==item.email||l.message!==item.text){this.state.status='paused';this.state.message='Cambió un destinatario o propuesta. Revisá y prepará otra tanda.';return;}
   this.state.message='Enviando email a '+item.name;this.persist();
   try{
    await this.send(this.store,this.dir,smtp,item.id);item.status='sent';item.note='Enviado';this.state.sent++;
   }catch(e){
    // emailLead reserves the event before SMTP: an uncertain response must be reconciled.
    const last=this.store.db.prepare("SELECT status FROM events WHERE lead_id=? ORDER BY id DESC LIMIT 1").get(item.id);
    if(/Cupo/.test(e.message)){this.state.status='paused';this.state.message=e.message;return;}
    item.status='failed';item.note=e.message;this.state.failed++;
    this.state.status='paused';this.state.message=last?.status==='uncertain'?'Hay un email sin confirmar. Revisá el historial antes de continuar.':e.message;
    this.persist();await this.save().catch(()=>{});return;
   }
   this.persist();await this.save().catch(()=>{});
   if(!this.cancel&&this.state.items.some(i=>i.status==='pending'))await new Promise(resolve=>{
    const timer=setTimeout(()=>{this.wake=null;resolve();},this.delayMs);
    this.wake=()=>{clearTimeout(timer);this.wake=null;resolve();};
   });
  }
  this.state.status=this.cancel?'paused':'done';
  this.state.message=`${this.cancel?'Tanda pausada':'Tanda terminada'}: ${this.state.sent} emails enviados, ${this.state.failed} sin enviar.`;
 }
}
