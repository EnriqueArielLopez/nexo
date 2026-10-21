import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {claudeSearchRequest,inCountries} from './campaign.mjs';
import {Claude} from './providers.mjs';
import {qualify} from './qualification.mjs';
import {Accounts} from './auth.mjs';
import {Store} from './core.mjs';
const filters={lastSeed:'https://instagram.com/proveedor_prueba/',offer:'Fotografía comercial',segment:'Gastronomía',countries:['AR'],cities:'Córdoba',maxResults:100};
test('pedido para Claude conserva perfil, oferta, rubro, países, ciudad y exclusiones',()=>{
 const r=claudeSearchRequest(filters);for(const value of ['proveedor_prueba','Fotografía comercial','Gastronomía','Argentina','Córdoba','100','nexo_conocidos','nexo_guardar_hoteles','No envíes'])assert.ok(r.includes(value),value);
 assert.ok(!r.includes('20 hoteles'));assert.ok(claudeSearchRequest({...filters,cities:''}).includes('Sin restricción de ciudad'));
 assert.equal(inCountries('Perú',filters),false);assert.equal(inCountries('argentina',filters),true);assert.equal(inCountries('AR',filters),true);
});
test('búsqueda API devuelve el rubro y país elegidos, omite otros, duplicados y proveedor',async()=>{
 const original=global.fetch,source='https://restaurante.test/';const audit={hotel_confirmed:true,hotel_source:source,business_status:'operating',business_signal:'appointments',business_source:source,business_observation:'Turnos disponibles',feed_status:'sparse',feed_source:source,feed_observation:'Tiene 5 publicaciones',posts_count:5,service_fit:'Fotografía del menú'};
 const lead={handle:'restaurante_prueba',name:'Restaurante',segment:'Gastronomía',country:'Argentina',city:'Córdoba',language:'es',source,audit};let calls=0;
 global.fetch=async(url,options)=>{const b=JSON.parse(options.body);calls++;if(b.tools[0].name==='web_search'){assert.match(b.system,/EXCLUSIVAMENTE del rubro/);const f=JSON.parse(b.messages[0].content);assert.equal(f.tipo,'Gastronomía');return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'web_search_result',url:source},{type:'text',text:'Evidencia'}]}));}
 const f=JSON.parse(b.messages[0].content);assert.equal(f.rubro,'Gastronomía');assert.equal(f.ciudades,'Córdoba');return new Response(JSON.stringify({content:[{type:'tool_use',name:'guardar_candidatos',input:{summary:'Prueba',leads:[lead,{...lead,handle:'hotel_otro',segment:'Hoteles'},{...lead,handle:'otro_pais',country:'Perú'},{...lead,handle:'ya_guardado'},{...lead,handle:'proveedor_prueba'}]}}]}));};
 try{const ai=new Claude('fake','fake');ai.profile={services:'Fotografía'};const r=await ai.search(filters.lastSeed,filters,['ya_guardado']);assert.deepEqual(r.leads.map(l=>l.handle),['restaurante_prueba']);assert.equal(r.leads[0].qualification.status,'ready');assert.equal(calls,2);}finally{global.fetch=original;}
 for(const signal of ['direct_sales','appointments','active_catalog'])assert.equal(qualify({...audit,business_signal:signal},[source]).status,'ready');
});
test('conector de Claude comparte filtros y guarda restaurantes sin API ni hoteles obligatorios',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-mcp-test-'));const accounts=new Accounts(dir);accounts.create('QA Nexo','clave-ficticia-local');accounts.close();const store=new Store(dir);store.saveSettings(filters);store.close();
 const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','mcp.mjs'],{env:{...process.env,NEXO_DATA_DIR:dir},stdio:['pipe','pipe','pipe']});let buf='';const pending=new Map();child.stdout.on('data',chunk=>{buf+=chunk;let n;while((n=buf.indexOf('\n'))>=0){const msg=JSON.parse(buf.slice(0,n));buf=buf.slice(n+1);pending.get(msg.id)?.(msg.result);pending.delete(msg.id);}});let id=0;
 const call=(method,params)=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(Error('MCP timeout')),10000);pending.set(n,r=>{clearTimeout(timer);resolve(r);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});
 try{const list=await call('tools/list');assert.ok(list.tools.some(t=>t.name==='nexo_guardar_hoteles'));const state=await call('tools/call',{name:'nexo_estado'});const settings=JSON.parse(state.content[0].text);assert.equal(settings.tipo,'Gastronomía');assert.equal(settings.ciudades,'Córdoba');assert.deepEqual(settings.paises,['Argentina']);
 const h={instagram:'restaurante_mcp',nombre:'QA Restaurante',pais:'Argentina',ciudad:'Córdoba',fuente:'https://example.com/',propuesta:'Fotografía para tu menú',evidencia:{operativo:'operating',senal_comercial:'direct_sales',fuente_comercial:'https://example.com/',observacion_comercial:'Menú y pedidos disponibles',estado_feed:'sparse',fuente_feed:'https://example.com/',observacion_feed:'5 publicaciones',cantidad_posts:5,encaje_con_oferta:'Fotos del menú'}};
 const result=await call('tools/call',{name:'nexo_guardar_hoteles',arguments:{hoteles:[h,{...h,instagram:'restaurante_peru',pais:'Perú'}]}});assert.equal(result.isError,undefined);assert.equal(JSON.parse(result.content[0].text).nuevos,1);
 const clients=await call('tools/call',{name:'nexo_clientes',arguments:{vista:'prioritarios'}});assert.equal(JSON.parse(clients.content[0].text).total,1);
 }finally{child.stdin.end();await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
