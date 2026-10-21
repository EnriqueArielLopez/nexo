import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from './core.mjs';
import {premiumSignals} from './prospecting.mjs';
import {webCandidate,queryPlan,discoverWeb} from './web-discovery.mjs';
import {prepareBatch,approveBatch} from './batches.mjs';
import {exportWorkbook} from './export-portable.mjs';
import {readImport,ingest} from './imports.mjs';
import {websiteProfiles} from './website-prospects.mjs';
import {compose,fill} from './mailer.mjs';
const settings={lastSeed:'https://instagram.com/proveedor/',countries:['ES'],segment:'Hoteles',cities:'',businessTier:'premium',sender:'Mila',offer:'contenido',template:'Hola {cliente} (@{nombre}), soy {remitente}. Vi {cuenta} en {ciudad}. Ofrezco {servicio}.'};
const candidate=(h='hotel_qa',snippet='Hotel de 3 estrellas en Madrid, España. Reservas: reservas@hotel-qa.example')=>({url:'https://instagram.com/'+h+'/',title:'Hotel QA',snippet});
function fixture(){const dir=mkdtempSync(path.join(path.resolve('qa'),'nexo-premium-'));const store=new Store(dir);store.saveSettings(settings);return {dir,store,close(){store.close();rmSync(dir,{recursive:true,force:true});}};}
test('categoría 3 a 5, ciudades amplias y descarte de los falsos positivos reales observados',()=>{
 for(const text of ['Hotel 3 estrellas','Hotel tres estrellas','Hotel 4-star','Hotel ⭐⭐⭐','Hotel de cinco estrellas'])assert.ok(premiumSignals(text).length,text);
 assert.equal(premiumSignals('Luxury hotel de 2 estrellas').length,0);
 const lead=webCandidate(candidate(),settings,{services:'contenido'});assert.equal(lead.qualification.capacityToPay,'unverified');assert.equal(lead.qualification.feed,'unverified');assert.equal(lead.email,'reservas@hotel-qa.example');assert.match(lead.message,/Hola Hotel QA/);
 for(const text of ['Hotel en Madrid, España. Hostal económico.','Travel | Tips. Find hotel deals in España.','Alquiler vacacional apartamentos y hoteles en Madrid, España. Lujo'])assert.equal(webCandidate(candidate('cuenta_qa',text),settings,{services:'contenido'}),null);
 const plan=queryPlan(settings);assert.ok(plan.length>100);for(const city of ['Madrid','Barcelona','Marbella','Sevilla','Tenerife'])assert.ok(plan.some(p=>p.city===city));
});
test('pocas publicaciones indexadas priorizan revisión pero nunca confirman inactividad',()=>{
 const low=webCandidate(candidate('pocas','Hotel 4 estrellas en Madrid, España. 8 Posts'),settings,{services:'contenido'}),high=webCandidate(candidate('muchas','Hotel 4 estrellas en Madrid, España. 1,014 Posts'),settings,{services:'contenido'});
 assert.equal(low.qualification.indexedPosts,8);assert.equal(high.qualification.indexedPosts,1014);assert.ok(low.score>high.score);assert.equal(low.qualification.status,'review');assert.equal(low.qualification.feed,'unverified');assert.equal(low.qualification.lastPost,'');
});
test('respaldo conserva archivados y cambiar plantilla invalida la huella de una tanda',()=>{const a=fixture(),b=fixture();try{
 const lead=webCandidate(candidate(),settings,{services:'contenido'});ingest(a.store,[lead]);const ids=a.store.list().map(l=>l.id),before=prepareBatch(a.store,ids);a.store.saveSettings({template:'Otro mensaje para {cliente}'});assert.notEqual(before.token,prepareBatch(a.store,ids).token);assert.equal(a.store.archiveResults(),1);
 const backup=readImport({format:'json',content:JSON.stringify({format:'nexo-backup-v1',leads:a.store.list({includeArchived:true}),history:a.store.history()})});assert.equal(ingest(b.store,backup).added,1);assert.equal(b.store.list().length,0);assert.equal(b.store.list({includeArchived:true}).length,1);assert.equal(b.store.restoreResults(),1);
 }finally{a.close();b.close();}});
test('la web propia aporta estrellas oficiales, cuenta enlazada y email sin adivinarlos',()=>{
 const hotel={'@type':'Hotel',name:'Hotel QA',url:'https://hotel-qa.example/',starRating:{ratingValue:3},address:{addressLocality:'Madrid',addressCountry:'ES'},email:'reservas@hotel-qa.example'};
 const page={url:hotel.url,html:'<script type="application/ld+json">'+JSON.stringify(hotel)+'</script><a href="https://instagram.com/hotel_qa/">Instagram</a><a href="https://www.instagram.com/hotel_qa/">IG</a>'};
 const results=websiteProfiles(page,{title:'Hotel QA',snippet:'Hotel en Madrid'});assert.equal(results.length,1);const l=webCandidate(results[0],settings,{services:'contenido'});assert.equal(l.source,hotel.url);assert.equal(l.email,hotel.email);assert.equal(l.qualification.categorySignals[0].source,hotel.url);
 assert.equal(websiteProfiles({...page,html:page.html+'<a href="https://instagram.com/otra_cuenta/">Otra cuenta</a>'},{title:'QA',snippet:''}).length,0);
 assert.equal(websiteProfiles({...page,html:page.html.replace('"Hotel"','"Review"')},{title:'QA',snippet:''}).length,0);
});
test('email contiene texto personalizado y adjunto íntegro sin enviar a un servidor',async()=>{const f=fixture();try{const attachment=path.join(f.dir,'Propuesta.pdf'),data=Buffer.from('%PDF-1.4 QA FICTICIO');await import('node:fs/promises').then(fs=>fs.writeFile(attachment,data));const text=fill('Hola {cliente}, vi {cuenta}',{name:'Hotel QA',handle:'hotel_qa'},settings);const mime=await compose({from:'qa@example.com',to:'hotel@example.com',subject:'Propuesta QA',text,attachment});assert.ok(mime.includes(Buffer.from(text).toString('base64')));assert.ok(mime.includes(data.toString('base64')));assert.match(mime,/application\/pdf/);}finally{f.close();}});
test('paginación descubre nuevas cuentas y evita ciclos de páginas repetidas',async()=>{const f=fixture();try{let page=0;const web={calls:0,profile:async()=>({services:'contenido'}),search:async()=>{page=0;return [candidate('pagina_1')];},nextPage:async()=>{page++;return [candidate(page===1?'pagina_2':'pagina_2')];}};const s=await discoverWeb({store:f.store,seed:settings.lastSeed,web});assert.equal(s.found,2);assert.equal(s.ids.length,2);assert.ok(s.rejected.duplicates>0);assert.equal(s.outcome,'partial');}finally{f.close();}});
test('el presupuesto ampliado no corta en 180 páginas ni solicita una cuarta página descartada',async()=>{const f=fixture();try{f.store.saveSettings({maxResults:1});let query=0,page=0,nextCalls=0;const response=()=>[candidate('presupuesto_'+query+'_'+page,query>60?'Hotel 3 estrellas en Madrid, España.':'Hotel 3 estrellas en Miami, Estados Unidos.')];const web={calls:0,profile:async()=>({services:'contenido'}),search:async()=>{query++;page=0;return response();},nextPage:async()=>{nextCalls++;page++;return response();}};const result=await discoverWeb({store:f.store,seed:settings.lastSeed,web});assert.equal(result.found,1);assert.equal(result.pages,181);assert.equal(query,61);assert.equal(nextCalls,120);}finally{f.close();}});
test('100 seleccionados, tanda top5, plantilla personalizada y Excel conserva100 con envío registrado',async()=>{const f=fixture();try{
 for(let i=0;i<100;i++){const result=f.store.add({handle:'qa_ficticio_'+i,name:'FICTICIO '+i,country:'España',language:'es',source:'https://example.com/',email:'qa'+i+'@example.com'});f.store.setScore(result.id,i);f.store.setQualification(result.id,{method:'public-web',status:'review'});}
 const ids=f.store.list().map(l=>l.id),batch=prepareBatch(f.store,ids);assert.equal(batch.items.length,5);assert.equal(batch.skipped.length,95);assert.equal(batch.items[0].name,'FICTICIO 99');assert.match(batch.items[0].message,/Hola FICTICIO 99/);assert.match(batch.items[0].message,/@qa_ficticio_99/);assert.equal(f.store.history().length,0);assert.equal(f.store.get(ids[0]).approved,0);
 const email=prepareBatch(f.store,ids,'email');assert.equal(email.items.length,20);
 approveBatch(f.store,batch);const e=f.store.reserve(batch.items[0].id);f.store.finish(e.event,'sent','QA FICTICIO, ningún mensaje real');
 const dest=path.join(f.dir,'Clientes.xlsx');await exportWorkbook({settings:f.store.settings(),leads:f.store.list(),history:f.store.history(),generated:new Date().toISOString()},dest);const rows=readImport({format:'xlsx',content:readFileSync(dest).toString('base64')});assert.equal(rows.length,100);assert.equal(rows.filter(l=>l.last).length,1);
 assert.equal(prepareBatch(f.store,ids).items.length,4);assert.ok(!prepareBatch(f.store,ids).items.some(l=>l.id===e.lead.id));
 assert.equal(f.store.archiveResults(),99);assert.equal(f.store.list().length,1);assert.equal(f.store.history().length,1);assert.equal(f.store.list({includeArchived:true}).length,100);assert.equal(f.store.restoreResults(),99);assert.equal(f.store.list().length,100);
 }finally{f.close();}});
test('limpiar preserva bajas y programados; redescubrir un archivado no duplica filas',()=>{const f=fixture();try{
 for(let i=0;i<3;i++){const r=f.store.add({handle:'limpiar_'+i,name:'QA',language:'es',source:'https://example.com'});f.store.setQualification(r.id,{method:'public-web',status:'ready'});f.store.update(r.id,{approved:true});}
 const [a,b,c]=f.store.list();f.store.update(a.id,{dnc:true});f.store.schedule([b.id],'instagram',new Date(Date.now()+864e5).toISOString());assert.equal(f.store.archiveResults(),1);assert.match(f.store.gate(f.store.get(c.id)),/archivado/);const restored=f.store.add({handle:c.handle});assert.equal(restored.added,true);assert.equal(f.store.list().length,3);assert.equal(f.store.history().length,0);
 }finally{f.close();}});
