import {handle,httpUrl,email} from './identity.mjs';
export {handle,httpUrl,email} from './identity.mjs';
import {normalizeSector} from './business-sectors.mjs';
import {personalize,DEFAULT_TEMPLATE} from './templates.mjs';
const OLD_TEMPLATE='Hola, equipo de {hotel}. Soy {remitente}. Me gustaría conversar sobre {servicio}. ¿Les interesa que les comparta una propuesta breve? Si prefieren que no los contacte, me avisan y lo registro.';
import { DatabaseSync } from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {COUNTRIES,SEGMENTS} from './geography.mjs';

export const defaults = {offer:'',region:'Argentina, Uruguay y España',template:DEFAULT_TEMPLATE,sender:'',daily:25,monthly:3000,model:'claude-sonnet-4-6',graphVersion:'v24.0',emailDaily:20,emailMonthly:300,emailSubject:'Propuesta para {hotel}',smtpHost:'smtp.gmail.com',smtpPort:465,smtpUser:'',emailFrom:'',attachment:'',autoEmail:false,autoEmailTime:'09:00',autoEmailCount:10};
const dayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'});
export function day(date=new Date()) { return dayFormatter.format(date); }
export function twoMonths(iso) { const d=new Date(iso); const n=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+2); const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(n,end)); return d.toISOString(); }
const clean=(x,n=3000)=>String(x??'').trim().slice(0,n);
const channelOf=c=>c==='email'?'email':'instagram';
Object.assign(defaults,{countries:['AR','UY','ES'],cities:'',segment:'Hoteles',maxResults:20,lastSeed:'',businessTier:'premium',searchDepth:'quick',verifyActivity:false,clearOnSearch:true});
export class Store {
 constructor(dir){mkdirSync(dir,{recursive:true});this.db=new DatabaseSync(path.join(dir,'prospectos.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY, handle TEXT UNIQUE NOT NULL, name TEXT, country TEXT, city TEXT, language TEXT, reason TEXT, source TEXT, message TEXT, approved INTEGER DEFAULT 0, dnc INTEGER DEFAULT 0, demo INTEGER DEFAULT 0, created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,lead_id INTEGER NOT NULL,at TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL,receipt TEXT,message TEXT,account TEXT);
 CREATE TABLE IF NOT EXISTS inbound(handle TEXT PRIMARY KEY,recipient TEXT NOT NULL,at TEXT NOT NULL,account TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS event_lead ON events(lead_id,at);
 UPDATE events SET status='uncertain' WHERE status='pending';
 CREATE TABLE IF NOT EXISTS jobs(name TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS schedules(id INTEGER PRIMARY KEY,lead_id INTEGER NOT NULL,channel TEXT NOT NULL,at TEXT NOT NULL,status TEXT NOT NULL,note TEXT DEFAULT '',created TEXT NOT NULL);`);
 this.db.exec("CREATE INDEX IF NOT EXISTS event_latest ON events(lead_id,at DESC,id DESC) WHERE status IN ('sent','pending','uncertain'); CREATE INDEX IF NOT EXISTS event_counts ON events(status,at,channel); CREATE INDEX IF NOT EXISTS event_contact_latest ON events(lead_id,at DESC,id DESC) WHERE status IN ('sent','pending','uncertain','contacted'); CREATE INDEX IF NOT EXISTS schedule_lead ON schedules(lead_id,status);");
 const columns=this.db.prepare('PRAGMA table_info(leads)').all().map(c=>c.name);if(!columns.includes('score'))this.db.exec('ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 50; ALTER TABLE leads ADD COLUMN score_reason TEXT DEFAULT "";');if(!columns.includes('qualification'))this.db.exec("ALTER TABLE leads ADD COLUMN qualification TEXT DEFAULT ''");if(!columns.includes('archived'))this.db.exec('ALTER TABLE leads ADD COLUMN archived INTEGER DEFAULT 0');if(!columns.includes('email'))this.db.exec("ALTER TABLE leads ADD COLUMN email TEXT DEFAULT ''");if(!columns.includes('activity'))this.db.exec("ALTER TABLE leads ADD COLUMN activity TEXT DEFAULT ''");
 if(!columns.includes('message_custom')){
  this.db.exec('ALTER TABLE leads ADD COLUMN message_custom INTEGER NOT NULL DEFAULT 0');
  // Preserve legacy drafts conservatively; only matching generated text follows the base template.
  const settings=this.settings(),mark=this.db.prepare('UPDATE leads SET message_custom=1 WHERE id=?');
  for(const lead of this.db.prepare('SELECT * FROM leads').all())if(lead.message&&lead.message!==personalize(settings.template,lead,settings))mark.run(lead.id);
 }
  for(const r of this.db.prepare("SELECT id,activity FROM leads WHERE activity LIKE '%\"source\":\"profile\"%' AND qualification LIKE '%\"status\":\"review\"%'").all())this.promote(r.id,JSON.parse(r.activity)); }
 settings(){const r=this.db.prepare('SELECT data FROM settings WHERE id=1').get();const v={...defaults,...(r?JSON.parse(r.data):{})};if(v.template===OLD_TEMPLATE)v.template=DEFAULT_TEMPLATE;v.segment=normalizeSector(v.segment);return v;}
 saveSettings(v){
  const s={...this.settings()};
  for(const k of ['offer','region','template','sender','model','graphVersion','cities','lastSeed','emailSubject','smtpHost','smtpUser','emailFrom','attachment','instagramSender'])if(k in v)s[k]=clean(v[k],k==='template'?2000:1000);
  if('smtpPort'in v){const n=Number(v.smtpPort);if(![25,465,587,2525].includes(n))throw Error('Puerto de email inválido (usá 465 o 587).');s.smtpPort=n;}
  if('daily'in v&&Number(v.daily)>100)throw Error('Para cuidar tu cuenta, el máximo por día en Instagram es 100 mensajes.');
  for(const k of ['daily','monthly','emailDaily','emailMonthly'])if(k in v){const n=Number(v[k]);if(!Number.isInteger(n)||n<1||n>10000)throw Error('Elegí un cupo entre 1 y 10000.');s[k]=n;}
  if('countries'in v){if(!Array.isArray(v.countries)||!v.countries.length||v.countries.some(c=>!COUNTRIES.some(x=>x.code===c)))throw Error('Seleccioná al menos un país de la lista.');s.countries=[...new Set(v.countries)];}
  if('businessTier'in v){if(!['premium','all'].includes(v.businessTier))throw Error('Categoría inválida.');s.businessTier=v.businessTier;}
  if('searchDepth'in v){if(!['quick','deep'].includes(v.searchDepth))throw Error('Modo de búsqueda inválido.');s.searchDepth=v.searchDepth;}
  for(const k of ['verifyActivity','clearOnSearch'])if(k in v)s[k]=v[k]===true;
  if('segment'in v){const list=[...new Set((Array.isArray(v.segment)?v.segment.map(normalizeSector):normalizeSector(v.segment).split(/\s*,\s*/)).filter(Boolean))];if(!list.length||list.some(x=>!SEGMENTS.includes(x)))throw Error('Elegí al menos un rubro de la lista.');s.segment=list.join(', ');}
  if('maxResults'in v){const n=Number(v.maxResults);if(!Number.isInteger(n)||n<1||n>100)throw Error('Podés buscar entre 1 y 100 clientes por vez.');s.maxResults=n;}
  if('countries'in v||'cities'in v)s.region=COUNTRIES.filter(c=>s.countries.includes(c.code)).map(c=>c.name).join(', ')+(s.cities?'. Ciudades o zonas: '+s.cities:'');
  if('autoEmail'in v)s.autoEmail=v.autoEmail===true;if('autoEmailTime'in v){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.autoEmailTime))throw Error('Elegí una hora válida (HH:MM).');s.autoEmailTime=v.autoEmailTime;}if('autoEmailCount'in v){const n=Number(v.autoEmailCount);if(!Number.isInteger(n)||n<1||n>200)throw Error('La tanda diaria admite entre 1 y 200 emails.');s.autoEmailCount=n;}
  if(!/^v\d+\.\d+$/.test(s.graphVersion))throw Error('Versión de Meta inválida.');
  this.db.prepare('INSERT OR REPLACE INTO settings VALUES(1,?)').run(JSON.stringify(s));return s;
 }
 add(v,{demo=false}={}){const h=handle(v.handle||v.instagram);const existing=this.db.prepare('SELECT id,demo FROM leads WHERE handle=?').get(h);if(existing){const restored=this.db.prepare("UPDATE leads SET archived=0,approved=0 WHERE id=? AND archived=1 AND dnc=0 AND activity NOT LIKE '%\"verdict\":\"active\"%' AND NOT EXISTS(SELECT 1 FROM events WHERE lead_id=leads.id) AND NOT EXISTS(SELECT 1 FROM schedules WHERE lead_id=leads.id AND status IN ('pending','due'))").run(existing.id).changes;if(restored&&httpUrl(v.source)&&v.language==='es'){let mail='';try{mail=email(v.email);}catch{}const settings=this.settings();this.db.prepare("UPDATE leads SET name=?,country=?,city=?,reason=?,source=?,message=CASE WHEN message_custom=1 THEN message ELSE ? END,email=?,activity='',qualification='' WHERE id=?").run(clean(v.name,200)||h,clean(v.country,100),clean(v.city,100),clean(v.reason),httpUrl(v.source),clean(v.message||personalize(settings.template,{...v,name:clean(v.name)||h,handle:h},settings),2000),mail,existing.id);}return {id:existing.id,added:!!restored};} if(!demo&&(!httpUrl(v.source)||v.language!=='es'))throw Error('Se necesita una fuente pública y evidencia de idioma español.');const s=this.settings();const msg=clean(v.message||personalize(s.template,{...v,name:clean(v.name)||h,handle:h},s),2000); let mail='';try{mail=email(v.email);}catch{}const result=this.db.prepare('INSERT INTO leads(handle,name,country,city,language,reason,source,message,demo,created,email,message_custom) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(h,clean(v.name,200),clean(v.country,100),clean(v.city,100),'es',clean(v.reason),httpUrl(v.source),msg,Number(demo),new Date().toISOString(),mail,Number(v.message_custom===1||v.message_custom===true||(v.message_custom===undefined&&!!v.message&&msg!==clean(personalize(s.template,{...v,name:clean(v.name)||h,handle:h},s),2000))));return {id:Number(result.lastInsertRowid),added:true};}
 update(id,v){const r=this.get(id);if(!r)throw Error('Contacto inexistente.'); if(v.qualificationReviewed===true){let audit={};try{audit=JSON.parse(r.qualification||'{}');}catch{}this.setQualification(id,{...audit,status:'ready',manual:true,label:'Revisado por vos',checkedAt:new Date().toISOString(),stories:'unverified'});} const message='message'in v?clean(v.message,2000):r.message,mail='email'in v?email(v.email):r.email||'';this.db.prepare('UPDATE leads SET message=?,approved=?,dnc=?,email=?,message_custom=? WHERE id=?').run(message,'approved'in v?Number(v.approved===true):r.approved,'dnc'in v?Number(v.dnc===true):r.dnc,mail,'messageCustom'in v?Number(v.messageCustom===true):'message'in v?1:r.message_custom||0,id);}
 setScore(id,score,reason=''){this.db.prepare('UPDATE leads SET score=?,score_reason=? WHERE id=?').run(Math.max(0,Math.min(100,Math.round(score===undefined||score===null||score===''?50:Number.isFinite(Number(score))?Number(score):50))),clean(reason,1000),id);}
 setQualification(id,audit){this.db.prepare('UPDATE leads SET qualification=? WHERE id=?').run(JSON.stringify(audit),id);}
 // What the real profile shows (last post, stories). Accounts that post often don't need the service, so they're skipped.
 setActivity(id,v,now=new Date()){if(!this.get(id))throw Error('Contacto inexistente.');const a=activityOf(v,now);this.db.prepare('UPDATE leads SET activity=? WHERE id=?').run(JSON.stringify(a),id);this.promote(id,a);return a;}
 // A hotel whose own profile shows it posts little is exactly who Nexo looks for: it's ready to contact, not left to review.
 promote(id,a){if(a.source!=='profile'||!['inactive','irregular'].includes(a.verdict))return;let q;try{q=JSON.parse(this.get(id)?.qualification||'');}catch{return;}if(q?.status!=='review'||q.manual)return;this.setQualification(id,{...q,status:'ready',feed:'verified',feedSource:'https://www.instagram.com/'+this.get(id).handle+'/',label:a.verdict==='inactive'?'Verificado en su perfil · casi no publica':'Verificado en su perfil · publica de forma irregular',feedDetail:'Fechas leídas en su perfil: '+(a.lastPost?'última publicación el '+a.lastPost:'sin publicaciones')+', '+a.weeks+' de las últimas 12 semanas con publicaciones.',checkedAt:new Date().toISOString()});}
 job(name){const r=this.db.prepare('SELECT data FROM jobs WHERE name=?').get(name);return r?JSON.parse(r.data):null;}
 setJob(name,v){this.db.prepare('INSERT OR REPLACE INTO jobs VALUES(?,?)').run(name,JSON.stringify(v));}
 get(id){return this.db.prepare('SELECT * FROM leads WHERE id=?').get(Number(id));}
 counts(now=new Date(),demo=false,channel='instagram'){
  const d=day(now),month=d.slice(0,7),next=new Date(month+'-01T00:00:00-03:00');next.setUTCMonth(next.getUTCMonth()+1);
  return this.db.prepare(`SELECT COALESCE(SUM(e.at>=? AND e.at<?),0) daily,COUNT(*) monthly FROM events e JOIN leads l ON l.id=e.lead_id WHERE l.demo=? AND e.status IN ('sent','pending','uncertain') AND e.at>=? AND e.at<? AND e.channel${channelOf(channel)==='email'?"='email'":"<>'email'"}`).get(new Date(d+'T00:00:00-03:00').toISOString(),new Date(new Date(d+'T00:00:00-03:00').getTime()+864e5).toISOString(),Number(demo),new Date(month+'-01T00:00:00-03:00').toISOString(),next.toISOString());
 }
 // Cheap identities for discovery; never recompute quotas or read the complete planilla.
 knownHandles(){return this.db.prepare("SELECT handle FROM leads WHERE archived=0 OR dnc=1 OR EXISTS(SELECT 1 FROM events WHERE lead_id=leads.id) OR EXISTS(SELECT 1 FROM schedules WHERE lead_id=leads.id AND status IN ('pending','due'))").all().map(l=>l.handle);}

 gate(lead,now=new Date(),api=false,account='',channel='instagram',cached=null){const s=cached?.settings||this.settings(),mail=channelOf(channel)==='email';if(lead.archived)return 'Resultado archivado';if(lead.dnc)return 'No contactar';const last=cached?cached.last:this.db.prepare("SELECT * FROM events WHERE lead_id=? AND status IN ('sent','pending','uncertain','contacted') ORDER BY at DESC,id DESC LIMIT 1").get(lead.id);if(last?.status==='uncertain'||last?.status==='pending')return 'Envío sin confirmar: conciliar antes de continuar';if(last)return 'Ya contactado';if(activeAccount(lead))return 'Cuenta activa: publica seguido';if(lead.qualification){try{if(JSON.parse(lead.qualification).status!=='ready')return 'Verificá el negocio y su oportunidad antes de contactar';}catch{return 'Verificá el negocio y su oportunidad antes de contactar';}}if(!lead.approved)return 'Revisar negocio, idioma y propuesta';if(!lead.message?.trim())return 'Escribí una propuesta';if(mail&&!lead.email)return 'Falta el email del negocio';const c=cached?.counts||this.counts(now,!!lead.demo,channel);if(c.daily>=(mail?s.emailDaily:s.daily))return mail?'Cupo diario de email agotado':'Cupo diario agotado';if(c.monthly>=(mail?s.emailMonthly:s.monthly))return mail?'Cupo mensual de email agotado':'Cupo mensual agotado';if(mail&&lead.demo)return 'La demo no envía mensajes';if(api){if(lead.demo)return 'La demo no envía mensajes';const i=this.db.prepare('SELECT * FROM inbound WHERE handle=? AND account=?').get(lead.handle,account);if(!i||new Date(i.at)>now||now-new Date(i.at)>=24*3600000)return 'Requiere mensaje entrante en las últimas 24 h';}return '';}
 list({includeArchived=false}={}){
  const now=new Date(),settings=this.settings(),counts=new Map();
  const rows=this.db.prepare(`SELECT l.*,e.at last,e.status eventStatus,e.channel lastChannel FROM leads l LEFT JOIN events e ON e.id=(SELECT id FROM events WHERE lead_id=l.id AND status IN ('sent','pending','uncertain','contacted') ORDER BY at DESC,id DESC LIMIT 1) ${includeArchived?'':'WHERE l.archived=0'} ORDER BY l.score DESC,l.id DESC`).all();
  const quota=(l,channel)=>{const key=Number(!!l.demo)+channel;if(!counts.has(key))counts.set(key,this.counts(now,!!l.demo,channel));return counts.get(key);};
  return rows.map(l=>{const last=l.last?{at:l.last,status:l.eventStatus}:null;return {...l,last:l.last||'',next:l.last&&l.eventStatus!=='contacted'?twoMonths(l.last):'',eventStatus:l.eventStatus||'',lastChannel:l.lastChannel||'',block:this.gate(l,now,false,'','instagram',{settings,last,counts:quota(l,'instagram')}),emailBlock:this.gate(l,now,false,'','email',{settings,last,counts:quota(l,'email')})};});
 }

 reserve(id,{now=new Date(),api=false,account='',channel='instagram'}={}){this.db.exec('BEGIN IMMEDIATE');try{const l=this.get(id);if(!l)throw Error('Contacto inexistente.');const reason=this.gate(l,now,api,account,channel);if(reason)throw Error(reason);const e=this.db.prepare('INSERT INTO events(lead_id,at,channel,status,message,account) VALUES(?,?,?,?,?,?)').run(l.id,now.toISOString(),channelOf(channel)==='email'?'email':api?'instagram-api':l.demo?'demo':'manual','pending',l.message,account||(channelOf(channel)==='email'?l.email:''));this.db.exec('COMMIT');return {event:Number(e.lastInsertRowid),lead:l};}catch(e){this.db.exec('ROLLBACK');throw e;}}
 finish(id,status,receipt=''){this.db.prepare('UPDATE events SET status=?,receipt=? WHERE id=?').run(status,clean(receipt,300),id);if(status==='sent'){const e=this.db.prepare('SELECT lead_id,channel FROM events WHERE id=?').get(id);if(e)this.db.prepare(`UPDATE schedules SET status='sent',note='Enviado' WHERE lead_id=? AND status IN ('pending','due') AND channel${e.channel==='email'?"='email'":"<>'email'"}`).run(e.lead_id);}}
 // Positive evidence is durable and independent of quotas, approval and proposal text.
 rememberContact(id,receipt='Conversación previa detectada en Instagram'){
  this.db.exec('BEGIN IMMEDIATE');try{
   const lead=this.get(id);if(!lead)throw Error('Contacto inexistente.');
   const prior=this.db.prepare("SELECT id FROM events WHERE lead_id=? AND status IN ('sent','pending','uncertain','contacted') LIMIT 1").get(lead.id);
   if(!prior){this.db.prepare("INSERT INTO events(lead_id,at,channel,status,receipt,message,account) VALUES(?,?,'instagram-browser','contacted',?,'','')").run(lead.id,new Date().toISOString(),clean(receipt,300));
    this.db.prepare("UPDATE schedules SET status='cancelled',note='Ya existe una conversación en Instagram' WHERE lead_id=? AND status IN ('pending','due')").run(lead.id);}
   this.db.exec('COMMIT');return !prior;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 history(){return this.db.prepare('SELECT e.*,l.name,l.handle,l.demo FROM events e JOIN leads l ON l.id=e.lead_id ORDER BY e.id DESC').all();}
 // Scheduled sends: email ones are sent by Nexo at their time; Instagram ones become due reminders.
 schedule(ids,channel,at){channel=channelOf(channel);const when=new Date(at);if(!Number.isFinite(when.getTime()))throw Error('Elegí una fecha y hora válidas.');if(when-Date.now()>366*864e5)throw Error('Programá envíos dentro del próximo año.');const ok=[],skipped=[];for(const id of [...new Set(ids.map(Number))].slice(0,200)){const l=this.get(id);if(!l){skipped.push(id+': inexistente');continue;}if(this.db.prepare("SELECT 1 FROM schedules WHERE lead_id=? AND status='pending'").get(id)){skipped.push(l.name+': ya está programado');continue;}const block=this.gate({...l,approved:1},new Date(),false,'',channel);if(block&&!/Cupo/.test(block)){skipped.push(l.name+': '+block);continue;}this.update(id,{approved:true});this.db.prepare("INSERT INTO schedules(lead_id,channel,at,status,created) VALUES(?,?,?,'pending',?)").run(id,channel,when.toISOString(),new Date().toISOString());ok.push(l.name);}return {ok,skipped};}
 schedules(){return this.db.prepare("SELECT s.*,l.name,l.handle,l.email FROM schedules s JOIN leads l ON l.id=s.lead_id WHERE s.status IN ('pending','due') OR s.at>? ORDER BY s.at,s.id").all(new Date(Date.now()-7*864e5).toISOString());}
 cancelSchedule(id){this.db.prepare("UPDATE schedules SET status='cancelled',note='Cancelado' WHERE id=? AND status IN ('pending','due')").run(Number(id));}
 due(now=new Date()){return this.db.prepare("SELECT * FROM schedules WHERE status='pending' AND at<=? ORDER BY at,id").all(now.toISOString());}
 setSchedule(id,status,note=''){this.db.prepare('UPDATE schedules SET status=?,note=? WHERE id=?').run(status,clean(note,300),id);}
 archiveResults({keepIds=[]}={}){const keep=[...new Set(keepIds.map(Number).filter(Number.isSafeInteger))];return Number(this.db.prepare("UPDATE leads SET archived=1,approved=0 WHERE archived=0 AND NOT EXISTS(SELECT 1 FROM events WHERE lead_id=leads.id) AND NOT EXISTS(SELECT 1 FROM schedules WHERE lead_id=leads.id AND status IN ('pending','due'))"+(keep.length?' AND id NOT IN ('+keep.map(()=>'?').join(',')+')':'')).run(...keep).changes);}

 restoreResults(){return Number(this.db.prepare('UPDATE leads SET archived=0 WHERE archived=1').run().changes);}
 close(){this.db.close();}
}
// Activity = how regularly the account posts over the last 12 weeks, not just whether it posted lately.
// Active (doesn't need the service): posts in 8+ of 12 weeks and posted in the last 3 weeks. Irregular: 3-7 weeks. Otherwise almost inactive.
// When the 12 posts read from the profile all fall inside the window, the account posts faster than we can see, so only that span counts.
// Active: posted in 5 of the last 12 weeks (about every two weeks or more) and in the last 3. Those aren't clients.
export const WEEKS=12,ACTIVE_WEEKS=5,IRREGULAR_WEEKS=3,SAMPLE=12;
export function activityOf(v,now=new Date()){const raw=Array.isArray(v.dates)?v.dates:v.lastPost?[v.lastPost]:[];const dates=raw.slice(0,60).map(d=>new Date(d));if(dates.some(d=>!Number.isFinite(d.getTime())||d-now>864e5))throw Error('Fecha de publicación inválida (usá AAAA-MM-DD).');dates.sort((x,y)=>y-x);const week=7*864e5,source=v.by==='user'?'user':v.source==='index'?'index':'profile';const inWindow=dates.filter(d=>now-d<WEEKS*week),weeks=new Set(inWindow.map(d=>Math.floor(Math.max(0,now-d)/week))).size;const truncated=source==='profile'&&dates.length>=SAMPLE&&inWindow.length===dates.length;const span=truncated?Math.max(1,Math.min(WEEKS,Math.floor((now-dates[dates.length-1])/week)+1)):WEEKS;const ratio=weeks/span;const last=dates[0]||null,days=last?Math.max(0,Math.floor((now-last)/864e5)):null;const verdict=v.active===true?'active':v.active===false?'inactive':!dates.length?(source==='index'?'unknown':'inactive'):ratio>=ACTIVE_WEEKS/WEEKS&&days<=21?'active':ratio>=IRREGULAR_WEEKS/WEEKS?'irregular':'inactive';return {checkedAt:now.toISOString(),lastPost:last?last.toISOString().slice(0,10):'',days,weeks,span,posts:dates.length,story:v.story===true,verdict,source,note:clean(v.note||'',300)};}
export function activeAccount(lead){try{return JSON.parse(lead.activity||'{}').verdict==='active';}catch{return false;}}
