import { DatabaseSync } from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {COUNTRIES,SEGMENTS} from './geography.mjs';

export const defaults = {offer:'',region:'Argentina, Uruguay y España',template:'Hola, equipo de {hotel}. Soy {remitente}. Me gustaría conversar sobre {servicio}. ¿Les interesa que les comparta una propuesta breve? Si prefieren que no los contacte, me avisan y lo registro.',sender:'',daily:5,monthly:50,model:'claude-sonnet-4-6',graphVersion:'v24.0'};
export function day(date=new Date()) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function twoMonths(iso) { const d=new Date(iso); const n=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+2); const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(n,end)); return d.toISOString(); }
export function handle(input) { let s=String(input||'').trim(); if(s.startsWith('@')) s=s.slice(1);if(/^(www\.)?instagram\.com\//i.test(s))s='https://'+s; if(/^https?:/i.test(s)){const u=new URL(s); if(!['instagram.com','www.instagram.com'].includes(u.hostname)||u.pathname.split('/').filter(Boolean).length!==1) throw Error('Ingresá el enlace de un perfil de Instagram, no una publicación.'); s=u.pathname.split('/')[1];} if(!/^[a-zA-Z0-9._]{1,30}$/.test(s)||['p','reel','reels','stories','explore','accounts','direct'].includes(s.toLowerCase()))throw Error('Perfil de Instagram inválido.'); return s.toLowerCase(); }
export function httpUrl(value) { try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';} }
const clean=(x,n=3000)=>String(x??'').trim().slice(0,n);
Object.assign(defaults,{countries:['AR','UY','ES'],cities:'',segment:'Hoteles',maxResults:12,lastSeed:''});
export class Store {
 constructor(dir){mkdirSync(dir,{recursive:true});this.db=new DatabaseSync(path.join(dir,'prospectos.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY, handle TEXT UNIQUE NOT NULL, name TEXT, country TEXT, city TEXT, language TEXT, reason TEXT, source TEXT, message TEXT, approved INTEGER DEFAULT 0, dnc INTEGER DEFAULT 0, demo INTEGER DEFAULT 0, created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,lead_id INTEGER NOT NULL,at TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL,receipt TEXT,message TEXT,account TEXT);
 CREATE TABLE IF NOT EXISTS inbound(handle TEXT PRIMARY KEY,recipient TEXT NOT NULL,at TEXT NOT NULL,account TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS event_lead ON events(lead_id,at);
 UPDATE events SET status='uncertain' WHERE status='pending';`); }
 settings(){const r=this.db.prepare('SELECT data FROM settings WHERE id=1').get();return {...defaults,...(r?JSON.parse(r.data):{})};}
 saveSettings(v){
  const s={...this.settings()};
  for(const k of ['offer','region','template','sender','model','graphVersion','cities','lastSeed'])if(k in v)s[k]=clean(v[k],k==='template'?2000:1000);
  for(const k of ['daily','monthly'])if(k in v){const n=Number(v[k]);if(!Number.isInteger(n)||n<1||n>10000)throw Error('Elegí un cupo entre 1 y 10000.');s[k]=n;}
  if('countries'in v){if(!Array.isArray(v.countries)||!v.countries.length||v.countries.some(c=>!COUNTRIES.some(x=>x.code===c)))throw Error('Seleccioná al menos un país de la lista.');s.countries=[...new Set(v.countries)];}
  if('segment'in v){if(!SEGMENTS.includes(v.segment))throw Error('Elegí un tipo de alojamiento de la lista.');s.segment=v.segment;}
  if('maxResults'in v){const n=Number(v.maxResults);if(!Number.isInteger(n)||n<1||n>30)throw Error('Podés buscar entre 1 y 30 clientes por vez.');s.maxResults=n;}
  if('countries'in v||'cities'in v)s.region=COUNTRIES.filter(c=>s.countries.includes(c.code)).map(c=>c.name).join(', ')+(s.cities?'. Ciudades o zonas: '+s.cities:'');
  if(!/^v\d+\.\d+$/.test(s.graphVersion))throw Error('Versión de Meta inválida.');
  this.db.prepare('INSERT OR REPLACE INTO settings VALUES(1,?)').run(JSON.stringify(s));return s;
 }
 add(v,{demo=false}={}){const h=handle(v.handle||v.instagram);const existing=this.db.prepare('SELECT id,demo FROM leads WHERE handle=?').get(h);if(existing)return {id:existing.id,added:false}; if(!demo&&(!httpUrl(v.source)||v.language!=='es'))throw Error('Se necesita una fuente pública y evidencia de idioma español.');const s=this.settings();const msg=clean(v.message||s.template.replaceAll('{hotel}',clean(v.name)||h).replaceAll('{remitente}',s.sender||'[tu nombre]').replaceAll('{servicio}',s.offer||'[tu servicio]').replaceAll('{ciudad}',clean(v.city)),2000); const result=this.db.prepare('INSERT INTO leads(handle,name,country,city,language,reason,source,message,demo,created) VALUES(?,?,?,?,?,?,?,?,?,?)').run(h,clean(v.name,200),clean(v.country,100),clean(v.city,100),'es',clean(v.reason),httpUrl(v.source),msg,Number(demo),new Date().toISOString());return {id:Number(result.lastInsertRowid),added:true};}
 update(id,v){const r=this.get(id);if(!r)throw Error('Contacto inexistente.'); const message='message'in v?clean(v.message,2000):r.message;this.db.prepare('UPDATE leads SET message=?,approved=?,dnc=? WHERE id=?').run(message,'approved'in v?Number(v.approved===true):r.approved,'dnc'in v?Number(v.dnc===true):r.dnc,id);}
 get(id){return this.db.prepare('SELECT * FROM leads WHERE id=?').get(Number(id));}
 counts(now=new Date(),demo=false){const rows=this.db.prepare("SELECT at FROM events e JOIN leads l ON l.id=e.lead_id WHERE l.demo=? AND status IN ('sent','pending','uncertain')").all(Number(demo));const d=day(now);return {daily:rows.filter(x=>day(new Date(x.at))===d).length,monthly:rows.filter(x=>day(new Date(x.at)).slice(0,7)===d.slice(0,7)).length};}
 gate(lead,now=new Date(),api=false,account=''){const s=this.settings();if(lead.dnc)return 'No contactar';if(!lead.approved)return 'Revisar hotel, idioma y propuesta';if(!lead.message?.trim())return 'Escribí una propuesta';const last=this.db.prepare("SELECT * FROM events WHERE lead_id=? AND status IN ('sent','pending','uncertain') ORDER BY at DESC,id DESC LIMIT 1").get(lead.id);if(last?.status==='uncertain'||last?.status==='pending')return 'Envío sin confirmar: conciliar antes de continuar';if(last&&twoMonths(last.at)>now.toISOString())return 'Espera hasta '+day(new Date(twoMonths(last.at)));const c=this.counts(now,!!lead.demo);if(c.daily>=s.daily)return 'Cupo diario agotado';if(c.monthly>=s.monthly)return 'Cupo mensual agotado';if(api){if(lead.demo)return 'La demo no envía mensajes';const i=this.db.prepare('SELECT * FROM inbound WHERE handle=? AND account=?').get(lead.handle,account);if(!i||new Date(i.at)>now||now-new Date(i.at)>=24*3600000)return 'Requiere mensaje entrante en las últimas 24 h';}return '';}
 list(){return this.db.prepare('SELECT * FROM leads ORDER BY id DESC').all().map(l=>{const e=this.db.prepare("SELECT * FROM events WHERE lead_id=? AND status IN ('sent','pending','uncertain') ORDER BY at DESC,id DESC LIMIT 1").get(l.id);return {...l,last:e?.at||'',next:e?twoMonths(e.at):'',eventStatus:e?.status||'',block:this.gate(l)};});}
 reserve(id,{now=new Date(),api=false,account=''}={}){this.db.exec('BEGIN IMMEDIATE');try{const l=this.get(id);if(!l)throw Error('Contacto inexistente.');const reason=this.gate(l,now,api,account);if(reason)throw Error(reason);const e=this.db.prepare('INSERT INTO events(lead_id,at,channel,status,message,account) VALUES(?,?,?,?,?,?)').run(l.id,now.toISOString(),api?'instagram-api':l.demo?'demo':'manual','pending',l.message,account);this.db.exec('COMMIT');return {event:Number(e.lastInsertRowid),lead:l};}catch(e){this.db.exec('ROLLBACK');throw e;}}
 finish(id,status,receipt=''){this.db.prepare('UPDATE events SET status=?,receipt=? WHERE id=?').run(status,clean(receipt,300),id);}
 history(){return this.db.prepare('SELECT e.*,l.name,l.handle,l.demo FROM events e JOIN leads l ON l.id=e.lead_id ORDER BY e.id DESC').all();}
 close(){this.db.close();}
}
