import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from './core.mjs';
import {discoverWeb} from './web-discovery.mjs';
import {ExtensionBridge} from './extension-bridge.mjs';
import {InstagramSender} from './instagram-sender.mjs';
import {EmailQueue} from './email-queue.mjs';

function fixture(){
 const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-reliability-')),store=new Store(dir);
 store.saveSettings({daily:100,businessTier:'all',countries:['AR'],cities:'Salta',maxResults:2,offer:'Fotografía'});
 return {dir,store,close(){store.close();rmSync(dir,{recursive:true,force:true});}};
}
function add(store,h){const id=store.add({handle:h,name:h,email:h+'@example.com',source:'https://example.com',language:'es'}).id;store.update(id,{approved:true});return id;}
const candidate=h=>({url:`https://www.instagram.com/${h}/`,title:`Hotel ${h}`,snippet:'Hotel en Salta, Argentina. Reservas de habitaciones.'});

test('búsqueda rápida obtiene candidatos sin inspecciones ni consultas de actividad',async()=>{
 const f=fixture();try{let reads=0;const web={profile:async()=>({services:'Fotografía'}),search:async()=>{reads++;return [candidate('rapido_a'),candidate('rapido_b')];}};
 const result=await discoverWeb({store:f.store,seed:'proveedor',web,verifyActivity:false,inspect:()=>{throw Error('No debe abrir Instagram');},maxQueries:2});
 assert.equal(result.found,2);assert.equal(reads,1);assert.equal(result.qualified,0);assert.equal(result.verification,'on-demand');
 assert.ok(f.store.list().every(l=>!l.activity&&JSON.parse(l.qualification).status==='review'));
 }finally{f.close();}
});

test('el cursor depende de los filtros, y el presupuesto rápido limita una búsqueda vacía',async()=>{
 const f=fixture();try{const queries=[];const web={profile:async()=>({services:'Fotografía'}),search:async q=>{queries.push(q);return [];}};
 const run=()=>discoverWeb({store:f.store,seed:'proveedor',web,verifyActivity:false,maxQueries:1});
 await run();const first=queries.at(-1);await run();assert.notEqual(queries.at(-1),first);
 f.store.saveSettings({cities:'Córdoba'});await run();assert.match(queries.at(-1),/Córdoba/);assert.doesNotMatch(queries.at(-1),/reservas/);
 assert.equal(queries.length,3);
 }finally{f.close();}
});

test('limpieza conserva historial, bajas, programados y destinatarios de una tanda activa',()=>{
 const f=fixture();try{const ids=Array.from({length:6},(_,i)=>add(f.store,'conservar_'+i));
 const event=f.store.reserve(ids[0]);f.store.finish(event.event,'sent','FICTICIO');
 f.store.update(ids[1],{dnc:true});f.store.schedule([ids[2]],'email',new Date(Date.now()+864e5).toISOString());
 assert.equal(f.store.archiveResults({keepIds:[ids[3]]}),3);
 assert.equal(f.store.get(ids[0]).archived,0);assert.equal(f.store.get(ids[2]).archived,0);assert.equal(f.store.get(ids[3]).archived,0);
 assert.ok(f.store.knownHandles().includes('conservar_1'),'la baja nunca reaparece');
 assert.equal(f.store.restoreResults(),3);assert.equal(f.store.get(ids[1]).dnc,1);assert.equal(f.store.history().length,1);
 }finally{f.close();}
});

test('listado y gates coinciden; los cupos respetan medianoche argentina y cambio de mes',()=>{
 const f=fixture();try{const a=add(f.store,'zona_a'),b=add(f.store,'zona_b');
 const event=f.store.reserve(a,{now:new Date('2026-11-01T02:30:00Z')});f.store.finish(event.event,'sent','FICTICIO');
 assert.deepEqual({...f.store.counts(new Date('2026-11-01T02:45:00Z'))},{daily:1,monthly:1});
 assert.deepEqual({...f.store.counts(new Date('2026-11-01T03:01:00Z'))},{daily:0,monthly:0});
 for(const l of f.store.list()){assert.equal(l.block,f.store.gate(f.store.get(l.id)));assert.equal(l.emailBlock,f.store.gate(f.store.get(l.id),new Date(),false,'','email'));}
 assert.equal(f.store.get(b).archived,0);
 }finally{f.close();}
});

test('redescubrir un archivado usa los datos nuevos sin duplicar ni recuperar una aprobación vieja',()=>{
 const f=fixture();try{const id=add(f.store,'renovado');f.store.setActivity(id,{dates:['2025-01-01'],source:'profile'});f.store.archiveResults();
 const r=f.store.add({handle:'renovado',name:'Nombre actualizado',city:'Córdoba',country:'Argentina',source:'https://example.com/nuevo',language:'es',message:'Propuesta actualizada'});
 assert.equal(r.id,id);assert.equal(r.added,true);const l=f.store.get(id);assert.equal(l.name,'Nombre actualizado');assert.equal(l.city,'Córdoba');assert.equal(l.message,'Propuesta actualizada');assert.equal(l.approved,0);assert.equal(l.activity,'');
 assert.equal(f.store.list().length,1);
 }finally{f.close();}
});

test('un comando vencido del puente no queda esperando para ejecutarse después',async()=>{
 const bridge=new ExtensionBridge({timeout:10,pollMs:100});bridge.seen=Date.now();
 const call=bridge.call('Input.dispatchKeyEvent',{key:'Enter'});await assert.rejects(call,/no respondió/);
 assert.equal(bridge.queue.length,0);assert.deepEqual(await bridge.poll(),[]);
});

test('el envío normal minimiza, persiste y reanuda solo pendientes, sin robar el foco',async()=>{
 const f=fixture();try{const ids=[add(f.store,'bg_a'),add(f.store,'bg_b')],calls=[];
 const sender=new InstagramSender(f.dir,{store:f.store,pause:[0,0],wait:async()=>{}});
 sender.ensure=async()=>{};sender.minimize=async()=>calls.push('minimized');sender.show=async()=>calls.push('focused');sender.loggedIn=async()=>true;sender.go=async()=>{};
 sender.one=async item=>{calls.push(item.id);sender.log(item,'sent','FICTICIO');sender.stop();return true;};
 sender.start(ids.map(id=>f.store.get(id)));assert.throws(()=>sender.start([f.store.get(ids[1])]),/tanda/);await sender.done;
 assert.equal(sender.state.status,'paused');assert.deepEqual(calls,['minimized',ids[0]]);
 const recovered=new InstagramSender(f.dir,{store:f.store,wait:async()=>{}});assert.equal(recovered.state.items[0].status,'sent');
 sender.one=async item=>{calls.push(item.id);sender.log(item,'sent','FICTICIO');return true;};sender.resume();await sender.done;
 assert.equal(sender.state.sent,2);assert.equal(calls.filter(x=>x===ids[0]).length,1);assert.ok(!calls.includes('focused'));
 }finally{f.close();}
});

test('detener durante el login libera la tanda y no deja un segundo worker activo',async()=>{
 const f=fixture();try{const id=add(f.store,'sin_sesion'),sender=new InstagramSender(f.dir,{store:f.store});let shown;
 const visible=new Promise(r=>shown=r);sender.ensure=async()=>{};sender.minimize=async()=>{};sender.show=async()=>{};sender.loggedIn=async()=>false;sender.go=async()=>{shown();};
 sender.start([f.store.get(id)]);await visible;assert.throws(()=>sender.resume(),/curso/);sender.stop();await sender.done;
 assert.equal(sender.active,false);assert.equal(f.store.history().length,0);
 }finally{f.close();}
});

test('email responde al iniciar, permite seguir trabajando y detener/reanudar sin duplicar',async()=>{
 const f=fixture();try{const ids=[add(f.store,'mail_a'),add(f.store,'mail_b')];let release,started;
 const inFlight=new Promise(r=>started=r),blocked=new Promise(r=>release=r),sent=[];
 const queue=new EmailQueue({store:f.store,dir:f.dir,delayMs:0,send:async(_s,_d,_smtp,id)=>{sent.push(id);started();await blocked;}});
 queue.start(ids,{user:'qa@example.com',pass:'FICTICIO'});await inFlight;assert.equal(queue.active,true);assert.equal(queue.state.sent,0);
 assert.throws(()=>queue.start(ids,{}),/curso/);queue.stop();release();await queue.done;
 assert.equal(queue.state.status,'paused');assert.equal(queue.state.sent,1);
 queue.resume({user:'qa@example.com',pass:'FICTICIO'});await queue.done;assert.deepEqual(sent,ids);assert.equal(queue.state.status,'done');
 assert.ok(!JSON.stringify(f.store.job('emailQueue')).includes('FICTICIO'),'no persiste credenciales');
 }finally{f.close();}
});

test('error de email con resultado incierto pausa la tanda y no pasa al próximo',async()=>{
 const f=fixture();try{const ids=[add(f.store,'incierto_a'),add(f.store,'incierto_b')],calls=[];
 const queue=new EmailQueue({store:f.store,dir:f.dir,delayMs:0,send:async(store,_d,_smtp,id)=>{calls.push(id);const e=store.reserve(id,{channel:'email'});store.finish(e.event,'uncertain','FICTICIO');throw Error('Conexión interrumpida');}});
 queue.start(ids,{user:'qa@example.com',pass:'FICTICIO'});await queue.done;
 assert.equal(queue.state.status,'paused');assert.match(queue.state.message,/sin confirmar/);assert.deepEqual(calls,[ids[0]]);assert.match(f.store.gate(f.store.get(ids[0])),/sin confirmar/);
 }finally{f.close();}
});
