import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from './core.mjs';
import {parseSearchResults,webCandidate,queryPlan,matchGeography,inferServices,isPublicAddress,PublicWebDiscovery,discoverWeb} from './web-discovery.mjs';
const settings={lastSeed:'https://www.instagram.com/proveedor_qa/',segment:'Hoteles',countries:['AR'],cities:'Salta',offer:'Creación de contenido',sender:'Marca QA',maxResults:100};
const profile={services:'creación de contenido y fotografía'};
const result=(h='hotel_qa')=>({url:'https://www.instagram.com/'+h+'/',title:'Hotel QA (@'+h+') - Instagram',snippet:'Hotel en Salta, Argentina. Reservas por WhatsApp. Habitaciones y spa.'});
const page=items=>items.map(r=>`<h2><a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(r.url)}&amp;rut=x">${r.title}</a></h2><a class="result__snippet">${r.snippet}</a>`).join('');
function fixture(){const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-web-'));const store=new Store(dir);store.saveSettings({...settings,businessTier:'all'});return {store,close(){store.close();rmSync(dir,{recursive:true,force:true});}};}
test('parser web conserva URLs, nombres, acentos y evidencia sin confundir resultados',()=>{
 const r=parseSearchResults(page([result(),{...result('otro_hotel'),title:'Hotel &amp; Café',snippet:'México &amp; España'}]));assert.equal(r.length,2);assert.equal(r[0].url,result().url);assert.equal(r[1].title,'Hotel & Café');assert.equal(r[1].snippet,'México & España');
});
test('la búsqueda web aplica rubro, país y ciudad comprobados en el texto',()=>{
 const lead=webCandidate(result(),settings,profile);assert.equal(lead.country,'Argentina');assert.equal(lead.city,'Salta');assert.equal(lead.qualification.status,'review');assert.equal(lead.qualification.feed,'unverified');assert.equal(lead.qualification.business,'unknown');assert.ok(lead.message.includes(profile.services));
 for(const r of [{...result(),snippet:'Hotel en Salta, Uruguay.'},{...result(),snippet:'Hotel en Córdoba, Argentina.'},{...result(),title:'Cafetería QA',snippet:'Cafetería en Salta, Argentina.'},{...result(),url:'https://www.instagram.com/p/abc/'},{...result(),snippet:'Hotel en Salta, Argentina. Cerrado definitivamente.'}])assert.equal(webCandidate(r,settings,profile),null);
 assert.equal(webCandidate(result('proveedor_qa'),settings,profile),null);assert.equal(webCandidate(result(),settings,profile,['hotel_qa']),null);
 assert.equal(matchGeography('Hotel Salta',settings),null);assert.equal(matchGeography('Hotel en Salta 🇦🇷',settings).country,'Argentina');
 for(const r of [{url:'https://instagram.com/hotelargroma/',title:'Argentina Hotel',snippet:'10 Followers - Argentina Hotel on Instagram: "In the heart of Rome, Italy."'},{url:'https://instagram.com/hotelargmx/',title:'Hotel Argentina',snippet:'Hotel Argentina on Instagram: "República de Argentina 407, Aguascalientes, México"'}])assert.equal(webCandidate(r,{...settings,cities:''},profile),null);
});
test('el rubro puede ser gastronomía sin reservas de hotel ni datos de feed inventados',()=>{
 const r={...result('restaurante_qa'),title:'Restaurante QA',snippet:'Restaurante en Salta, Argentina. Menú y pedidos.'};assert.ok(webCandidate(r,{...settings,segment:'Gastronomía'},profile));assert.equal(webCandidate(r,settings,profile),null);
});
test('la oferta se identifica en biografía pública y no se deduce solo por tener Instagram',async()=>{
 assert.match(inferServices('Community Manager & Content Creator'),/gestión de redes.*creación de contenido/);assert.equal(inferServices('Instagram 200 followers'), '');
 assert.equal(inferServices('See Instagram photos and videos from Mi cuenta'), '');
 const web=new PublicWebDiscovery({delayMs:0,read:async()=>({html:page([{url:settings.lastSeed,title:'Community Manager & Content Creator',snippet:'Mi cuenta'}])})});
 const p=await web.profile(settings.lastSeed,{offer:''});assert.match(p.services,/creación de contenido/);assert.equal(p.fromContext,false);
 const empty=new PublicWebDiscovery({delayMs:0,read:async()=>({html:'<html>Sin resultados</html>'})});await assert.rejects(()=>empty.profile(settings.lastSeed,{offer:''}),/Qué ofrecés/);
 const explicit=await empty.profile(settings.lastSeed,{offer:'Venta de software'});assert.equal(explicit.services,'Venta de software');assert.equal(empty.calls,1);
});
test('cada consulta conserva países y ciudades; no expande la ubicación al no encontrar',()=>{
 const plan=queryPlan({...settings,cities:'Salta; Jujuy',countries:['AR','UY']});assert.equal(plan.length,16);assert.ok(plan.every(p=>p.q.includes('site:instagram.com')&&/Salta|Jujuy/.test(p.q)&&/Argentina|Uruguay/.test(p.q)));
});
test('direcciones privadas y metadatos no se consideran sitios públicos',()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','::1','::ffff:127.0.0.1','fe80::1','fd00::1'])assert.equal(isPublicAddress(ip),false,ip);
 for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(isPublicAddress(ip),true,ip);
});
test('guarda hasta100 candidatos sin API, conserva fuentes y no duplica cuentas',async()=>{
 const f=fixture();try{let n=0,saves=0;const web=new PublicWebDiscovery({delayMs:0,read:async()=>({html:page(Array.from({length:20},()=>result('hotel_web_'+n++)))})});
 f.store.saveSettings({countries:['AR','UY','CL','PE']});const state=await discoverWeb({store:f.store,seed:settings.lastSeed,web,save:async()=>{saves++;}});assert.equal(state.status,'completed');assert.equal(state.found,100);assert.equal(state.qualified,0);assert.equal(state.review,100);assert.equal(state.usage.paidApiCalls,0);assert.equal(f.store.list().length,100);assert.equal(saves,5);assert.ok(f.store.list().every(l=>l.source.startsWith('https://www.instagram.com/')&&l.approved===0));
 }finally{f.close();}
});
test('duplicados, bloqueo del buscador y cancelación conservan candidatos reales',async()=>{
 for(const mode of ['duplicate','blocked','cancel']){const f=fixture();try{let n=0,cancel=false;const web=new PublicWebDiscovery({delayMs:0,read:async()=>{n++;if(n===2&&mode==='blocked')return {html:'<html>anomaly-modal captcha</html>'};return {html:page([result()])};}});
 const state=await discoverWeb({store:f.store,seed:settings.lastSeed,web,cancelled:()=>cancel,save:async()=>{if(mode==='cancel')cancel=true;}});assert.equal(state.found,1);assert.equal(f.store.list().length,1);assert.equal(state.status,mode==='blocked'?'failed':mode==='cancel'?'paused':'completed');if(mode==='blocked')assert.match(state.error,/verificación humana/);assert.equal(f.store.job('lastSearch').found,1);
 }finally{f.close();}}
});
