import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {exportWorkbook} from './export-portable.mjs';
import {Store,day,handle} from './core.mjs';
import {Claude,Instagram} from './providers.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.resolve(process.env.HOTEL_DATA_DIR||path.join(root,'data'));
const port=Number(process.env.PORT||18761);const origin=`http://127.0.0.1:${port}`;
const store=new Store(data);let claudeKey='';let ig=null;let searchBusy=false;let searchSummary='';let exportError='';let exportQueue=Promise.resolve();let exporting=false;
const csrf=randomBytes(32).toString('hex');
function snapshot(){return {generated:new Date().toISOString(),settings:store.settings(),leads:store.list(),history:store.history()};}
function exportExcel(){const snap=snapshot();const task=async()=>{exporting=true;exportError='';try{await exportWorkbook(snap,path.join(data,'Prospectos-hoteles.xlsx'));await fs.copyFile(path.join(data,'Prospectos-hoteles.xlsx'),path.join(data,`Prospectos-${day()}.xlsx`));}catch(e){exportError='No se pudo actualizar el Excel. Si lo tenés abierto, cerralo y volvé a descargar.';throw Error(exportError);}finally{exporting=false;}};const result=exportQueue.catch(()=>{}).then(task);exportQueue=result;result.catch(()=>{});return result;}
function state(){return {...snapshot(),counts:store.counts(),demoCounts:store.counts(new Date(),true),claudeConnected:!!claudeKey,instagram:ig?.account||null,instagramPaused:ig?.paused||false,searchBusy,searchSummary,exporting,exportError,excelPath:path.join(data,'Prospectos-hoteles.xlsx'),leads:store.list().map(l=>({...l,apiBlock:!ig?.account?'Conectá Instagram':ig.paused?'Instagram pausado':store.gate(l,new Date(),true,ig.account.id)}))};}
function json(res,body,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>200000)throw Error('Solicitud demasiado grande.');}return JSON.parse(s||'{}');}
const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
try{if(req.headers.host!==`127.0.0.1:${port}`)return json(res,{error:'Host no permitido'},403);const url=new URL(req.url,origin);if(req.headers.origin&&req.headers.origin!==origin)return json(res,{error:'Origen no permitido'},403);
 if(req.method==='GET'){
  if(url.pathname==='/api/state')return json(res,state());
  if(url.pathname==='/api/session')return json(res,{csrf});
  if(url.pathname==='/api/health')return json(res,{ok:true,app:'nexo',version:'2.0.0'});
  if(url.pathname==='/api/excel'){await exportExcel();res.writeHead(200,{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="Prospectos-hoteles.xlsx"'});return res.end(await fs.readFile(path.join(data,'Prospectos-hoteles.xlsx')));}
  const files={'/':['nexo.html','text/html; charset=utf-8'],'/app.js':['nexo.js','text/javascript; charset=utf-8'],'/style.css':['nexo.css','text/css; charset=utf-8'],'/fonts/Manrope-400.ttf':['fonts/Manrope-400.ttf','font/ttf'],'/fonts/Manrope-500.ttf':['fonts/Manrope-500.ttf','font/ttf'],'/fonts/Manrope-600.ttf':['fonts/Manrope-600.ttf','font/ttf'],'/fonts/Manrope-700.ttf':['fonts/Manrope-700.ttf','font/ttf'],'/fonts/Manrope-800.ttf':['fonts/Manrope-800.ttf','font/ttf'],'/geography.js':['../geography.mjs','text/javascript; charset=utf-8']};const f=files[url.pathname];if(!f)return json(res,{error:'No encontrado'},404);res.writeHead(200,{'content-type':f[1]});return res.end(await fs.readFile(path.join(root,'public',f[0])));
 }
 if(req.method!=='POST')return json(res,{error:'Método no permitido'},405);
 if(req.headers['x-csrf-token']!==csrf||!String(req.headers['content-type']).startsWith('application/json'))return json(res,{error:'Solicitud inválida'},403);
 const v=await body(req);
 switch(url.pathname){
  case '/api/quit':json(res,{ok:true});server.close(async()=>{await exportQueue.catch(()=>{});store.close();process.exit(0);});return;
  case '/api/settings':store.saveSettings(v);break;
  case '/api/claude':{const key=String(v.key||'').trim();if(!key)throw Error('Ingresá tu clave de API de Claude.');await new Claude(key,store.settings().model).call({max_tokens:32,messages:[{role:'user',content:'Respondé solamente OK.'}]});claudeKey=key;break;}
  case '/api/instagram':{const candidate=new Instagram(String(v.token||'').trim(),store.settings().graphVersion);await candidate.connect();ig=candidate;break;}
  case '/api/disconnect':claudeKey='';ig=null;break;
  case '/api/sync':{if(!ig)throw Error('Conectá Instagram con un token oficial.');const result=await ig.sync(store);return json(res,{...result,state:state()});}
  case '/api/search':{if(searchBusy)throw Error('Ya hay una búsqueda en curso.');if(!claudeKey)throw Error('Conectá tu clave de Claude primero.');const seed=handle(v.seed);store.saveSettings({lastSeed:seed});searchBusy=true;try{const result=await new Claude(claudeKey,store.settings().model).search(seed,store.settings(),store.list().filter(x=>!x.demo).map(x=>x.handle));let added=0;for(const lead of result.leads){try{added+=Number(store.add(lead).added);}catch{}}searchSummary=result.summary+`\n${added} perfiles nuevos agregados. Los duplicados conservan su historial.`;await fs.writeFile(path.join(data,'ultima-investigacion.json'),JSON.stringify({seed,at:new Date().toISOString(),...result},null,2));await exportExcel();}finally{searchBusy=false;}break;}
  case '/api/add':store.add(v);await exportExcel();break;
  case '/api/update':store.update(Number(v.id),v);await exportExcel();break;
  case '/api/manual':{if(v.confirm!==true)throw Error('Confirmá que ya enviaste la propuesta manualmente.');const r=store.reserve(Number(v.id));store.finish(r.event,'sent','Confirmado manualmente por usuario');await exportExcel();break;}
  case '/api/send':{if(!ig)throw Error('Conectá Instagram primero.');await ig.send(store,Number(v.id));await exportExcel();break;}
  case '/api/demo':{for(const [i,name,city,country]of [[1,'DEMO · Hotel Brisa','Mar del Plata','Argentina'],[2,'DEMO · Posada del Puerto','Colonia','Uruguay'],[3,'DEMO · Hotel Azahar','Sevilla','España']]){const r=store.add({handle:`demo_hotel_ficticio_${i}`,name,city,country,reason:'Datos ficticios para probar el flujo. No contactar.',source:'https://example.com',message:`DEMO: Hola, equipo de ${name}. Esta propuesta es una simulación.`},{demo:true});store.update(r.id,{approved:true});}await exportExcel();break;}
  case '/api/clear-demo':{store.db.exec('BEGIN IMMEDIATE');try{store.db.exec('DELETE FROM events WHERE lead_id IN (SELECT id FROM leads WHERE demo=1); DELETE FROM leads WHERE demo=1; COMMIT');}catch(e){store.db.exec('ROLLBACK');throw e;}await exportExcel();break;}
  case '/api/reconcile':{const e=store.db.prepare("SELECT * FROM events WHERE id=? AND status='uncertain'").get(Number(v.event));if(!e)throw Error('No existe ese envío pendiente de conciliar.');if(!['sent','failed'].includes(v.status))throw Error('Resultado inválido');store.finish(e.id,v.status,'Conciliado por usuario en Instagram');await exportExcel();break;}
  default:return json(res,{error:'No encontrado'},404);
 }
 json(res,{ok:true,state:state()});
}catch(e){json(res,{error:e.message||'Error inesperado'},400);}});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'La aplicación ya está abierta o el puerto 18761 está ocupado.':e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Nexo: ${origin}`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>{store.close();process.exit(0);}));
