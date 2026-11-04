import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const hash=x=>createHash('sha256').update(x).digest('hex');
const LOGIN_LIMIT=5,LOGIN_WAIT=15*60e3;
const loginKey=name=>String(name||'').trim().normalize('NFKC').toLowerCase();
function locked(until,now){return Object.assign(Error('Demasiados intentos fallidos. Esperá antes de volver a intentar.'),{code:'LOGIN_LOCKED',status:429,retryAt:until,retryAfterSeconds:Math.max(1,Math.ceil((until-now)/1000))});}
export class Accounts {
 constructor(root,{now=Date.now}={}){this.root=root;this.now=now;mkdirSync(root,{recursive:true});this.db=new DatabaseSync(path.join(root,'cuentas.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL,legacy INTEGER DEFAULT 0);CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS vault(user_id TEXT PRIMARY KEY,cipher TEXT NOT NULL);`);this.attempts=new Map();}
 count(){return this.db.prepare('SELECT COUNT(*) n FROM users').get().n;}
 create(name,password){name=String(name||'').trim().normalize('NFKC');if(name.length<2||name.length>50||!/^[\p{L}\p{N} ._-]+$/u.test(name))throw Error('Usá un nombre de 2 a 50 caracteres, sin símbolos especiales.');if(typeof password!=='string'||password.length<10||password.length>128)throw Error('La contraseña debe tener entre 10 y 128 caracteres.');if(this.db.prepare('SELECT name FROM users').all().some(u=>u.name.toLowerCase()===name.toLowerCase()))throw Error('Ese nombre ya existe. Iniciá sesión.');const id=randomUUID(),salt=randomBytes(24).toString('hex'),digest=scryptSync(password,salt,64).toString('hex');const legacy=this.count()===0?1:0;this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,name,salt,digest,legacy);return {id,name,legacy};}
 login(name,password){
  const key=loginKey(name),now=this.now();let a=this.attempts.get(key)||{n:0,until:0};
  if(a.until>now)throw locked(a.until,now);
  // An expired lock starts a new attempt cycle; old failures must not lock again immediately.
  if(a.until){this.attempts.delete(key);a={n:0,until:0};}
  const u=this.db.prepare('SELECT * FROM users').all().find(u=>loginKey(u.name)===key);
  const value=scryptSync(String(password||'').slice(0,128),u?.salt||'nexo-invalid',64);
  if(!u||!timingSafeEqual(value,Buffer.from(u.password,'hex'))){
   const next={n:a.n+1,until:a.n+1>=LOGIN_LIMIT?now+LOGIN_WAIT:0};this.attempts.set(key,next);
   if(next.until)throw locked(next.until,now);
   throw Error('Nombre o contraseña incorrectos. Revisá tu nombre de cuenta local, sin @.');
  }
  this.attempts.delete(key);return {id:u.id,name:u.name,legacy:u.legacy};
 }
 issue(user,remember=true){const token=randomBytes(32).toString('base64url');this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+(remember?7*864e5:12*36e5));return token;}
 resolve(cookie=''){const token=String(cookie).split(';').map(s=>s.trim()).find(s=>s.startsWith('nexo_session='))?.slice(13);if(!token)return null;const u=this.db.prepare('SELECT u.id,u.name,u.legacy,s.expires FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now());return u||null;}
 revoke(cookie=''){const token=String(cookie).split(';').map(s=>s.trim()).find(s=>s.startsWith('nexo_session='))?.slice(13);if(token)this.db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));}
 folder(user){return user.legacy?this.root:path.join(this.root,'perfiles',user.id);}
 saved(id){return this.db.prepare('SELECT cipher FROM vault WHERE user_id=?').get(id)?.cipher||'';}
 save(id,cipher){if(cipher)this.db.prepare('INSERT OR REPLACE INTO vault VALUES(?,?)').run(id,cipher);else this.db.prepare('DELETE FROM vault WHERE user_id=?').run(id);}
 close(){this.db.close();}
}
