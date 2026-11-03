import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from './core.mjs';
import {InstagramSender,postDate} from './instagram-sender.mjs';

const A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
// The post code a post published that day would have (its id starts with the time since Instagram's epoch).
const codeOf=d=>{let id=BigInt(new Date(d+'T12:00:00Z').getTime()-1314220021721)<<23n,c='';for(let i=0;i<11;i++){c=A[Number(id%64n)]+c;id/=64n;}return c;};
const recent=n=>Array.from({length:n},(_,i)=>new Date(Date.now()-(i*7+1)*864e5).toISOString().slice(0,10));
// A fake Instagram behind the DevTools protocol: profiles, chats with a text box, and what Enter does.
function fakeInstagram(profiles,{history={}}={}){
 let url='about:blank',box='';const chats={...history},calls=[];
 const handleOf=()=>url.split('/').filter(Boolean).pop();
 const client={close(){},async call(method,params={}){calls.push([method,params]);switch(method){
  case 'Target.getTargets':return {targetInfos:[{type:'page',targetId:'t1',url}]};
  case 'Target.attachToTarget':return {sessionId:'s1'};
  case 'Browser.getWindowForTarget':return {windowId:1};
  case 'Network.getCookies':return {cookies:[{name:'ds_user_id',value:'1'}]};
  case 'Page.navigate':url=params.url;box='';return {};
  case 'Input.insertText':box+=params.text;return {};
  case 'Input.dispatchKeyEvent':if(params.type==='keyDown'&&params.key==='Enter'){if(params.modifiers===8)box+='\n';else{chats[handleOf()]=(chats[handleOf()]||'')+' '+box;box='';}}return {};
  case 'Runtime.evaluate':{const e=params.expression;
   if(e==='document.readyState')return {result:{value:'complete'}};
   if(e.startsWith('(async()=>{const wait')){const p=profiles[handleOf()];return {result:{value:p?{title:p.title,text:p.text||'',codes:(p.dates||[]).map(codeOf),empty:!(p.dates||[]).length}:{title:'Instagram',text:'Esta página no está disponible.',codes:[],empty:false}}};}
   if(e.includes('getBoundingClientRect'))return {result:{value:url.startsWith('https://ig.me/m/')?{x:10,y:10,text:box}:null}};
   // The open conversation, or the whole page, whose list of chats shows previews of the messages sent to others.
   if(e.includes('Lista de conversaciones'))return {result:{value:url.startsWith('https://ig.me/m/')?'Chat @'+handleOf()+' '+(chats[handleOf()]||'')+' '+box:''}};
   if(e.includes('innerText'))return {result:{value:Object.entries(chats).map(([h,t])=>h+' Tú: '+t).join(' ')+(url.startsWith('https://ig.me/m/')?' Chat @'+handleOf()+' '+(chats[handleOf()]||'')+' '+box:'')}};
   return {result:{value:null}};}
  default:return {};}}};
 return {client,chats,calls};
}
function fixture(){const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-sender-'));const store=new Store(dir);store.saveSettings({daily:100});return {store,close(){store.close();rmSync(dir,{recursive:true,force:true});}};}
const lead=(store,handle,activity)=>{const id=store.add({handle,name:handle,source:'https://www.instagram.com/'+handle+'/',language:'es',country:'México'}).id;store.update(id,{message:'¡Hola!\nSoy Mica.',approved:true,qualificationReviewed:true});if(activity)store.setActivity(id,{dates:activity,source:'profile'});return {...store.get(id),message:'¡Hola!\nSoy Mica.'};};

test('envío automático: revisa el perfil, pega con saltos de línea, envía, confirma, registra y saltea a los que no van',async()=>{
 const f=fixture();try{
  const ig=fakeInstagram({hotel_sol:{title:'Hotel Sol (@hotel_sol)',dates:recent(2).concat(['2025-01-01'])},barber:{title:'Barbería Top (@barber)',dates:recent(1)},activo:{title:'Posada Activa (@activo)',dates:recent(12)},yaescrito:{title:'Hostal Viejo (@yaescrito)',dates:recent(1)}},{history:{yaescrito:'¡Hola! Soy Mica.'}});
  const items=['hotel_sol','barber','activo','fantasma','yaescrito'].map(h=>lead(f.store,h));
  const s=new InstagramSender(f.store.dir||os.tmpdir(),{store:f.store,connect:async()=>ig.client,readFile:async()=>'9222\n/devtools/browser/abc',pause:[0,0],wait:async()=>{}});
  s.start(items);await s.done;
  const by=Object.fromEntries(s.state.items.map(i=>[i.handle,i]));
  assert.equal(s.state.status,'done');
  assert.ok(ig.calls.some(([m,p])=>m==='Browser.setWindowBounds'&&p.bounds.windowState==='minimized'));
  assert.ok(!ig.calls.some(([m])=>m==='Target.activateTarget'),'una tanda con sesión no roba el foco');
  assert.equal(by.hotel_sol.status,'sent');assert.match(ig.chats.hotel_sol,/¡Hola!\nSoy Mica\./);
  assert.ok(ig.calls.some(([m,p])=>m==='Input.dispatchKeyEvent'&&p.key==='Enter'&&p.modifiers===8),'salto de línea con Shift+Enter');
  assert.equal(by.barber.status,'skipped');assert.match(by.barber.note,/No es un alojamiento/);assert.equal(f.store.get(items[1].id).dnc,1);
  assert.equal(by.activo.status,'skipped');assert.match(by.activo.note,/Publica seguido/);assert.equal(ig.chats.activo,undefined);
  assert.equal(by.fantasma.status,'skipped');assert.match(by.fantasma.note,/ya no existe/);
  assert.equal(by.yaescrito.status,'sent');assert.equal(ig.chats.yaescrito,'¡Hola! Soy Mica.','no se le escribe dos veces');
  assert.equal(f.store.gate({...f.store.get(items[0].id),approved:1,qualification:''}),'Ya contactado');
  assert.equal(f.store.counts().daily,2);
 }finally{f.close();}
});
test('envío automático: sin sesión de Instagram abre el inicio de sesión y no envía nada',async()=>{
 const f=fixture();try{
  const ig=fakeInstagram({});const base=ig.client.call;ig.client.call=async(m,p)=>m==='Network.getCookies'?{cookies:[]}:base(m,p);
  const s=new InstagramSender(os.tmpdir(),{store:f.store,connect:async()=>ig.client,readFile:async()=>'9222\n/devtools/browser/abc',pause:[0,0],wait:async()=>{}});
  s.loginWait=2;s.start([lead(f.store,'hotel_sol')]);await s.done;
  assert.equal(s.state.status,'login');assert.ok(ig.calls.some(([m,p])=>m==='Page.navigate'&&/accounts\/login/.test(p.url)));assert.equal(f.store.counts().daily,0);
 }finally{f.close();}
});
test('las fechas salen del código de cada publicación, sin abrirla',()=>{
 assert.equal(postDate('Deawu9VkSEG'),'2026-10-13');assert.equal(postDate(codeOf('2025-03-02')),'2025-03-02');assert.equal(postDate('$$$'),'');
});

test('una desconexión después de reservar el envío queda incierta y no se reintenta',async()=>{
 const f=fixture();try{
  const ig=fakeInstagram({hotel_corte:{title:'Hotel Corte',dates:['2025-01-01']}}),base=ig.client.call;
  ig.client.call=async(m,p)=>{if(m==='Input.dispatchKeyEvent'&&p.type==='keyDown'&&p.key==='Enter'&&p.modifiers===0)throw Error('Conexión cortada al enviar');return base(m,p);};
  const s=new InstagramSender(os.tmpdir(),{store:f.store,connect:async()=>ig.client,readFile:async()=>'9222\n/devtools/browser/abc',wait:async()=>{}});
  s.start([lead(f.store,'hotel_corte')]);await s.done;
  assert.equal(s.state.status,'paused');assert.equal(f.store.history()[0].status,'uncertain');
  assert.match(f.store.list()[0].block,/sin confirmar/);assert.equal(f.store.counts().daily,1);
  assert.throws(()=>s.resume(),/No hay envíos pendientes/);
 }finally{f.close();}
});
test('envío automático: si falta iniciar sesión, espera a que entre y sigue solo',async()=>{
 const f=fixture();try{
  const ig=fakeInstagram({hotel_sol:{title:'Hotel Sol (@hotel_sol)',dates:['2025-01-01']}});let checks=0;const base=ig.client.call;ig.client.call=async(m,p)=>m==='Network.getCookies'?{cookies:++checks>2?[{name:'ds_user_id',value:'1'}]:[]}:base(m,p);
  const s=new InstagramSender(os.tmpdir(),{store:f.store,connect:async()=>ig.client,readFile:async()=>'9222\n/devtools/browser/abc',pause:[0,0],wait:async()=>{}});
  s.start([lead(f.store,'hotel_sol')]);await s.done;
  assert.equal(s.state.status,'done');assert.equal(s.state.sent,1);
 }finally{f.close();}
});
test('envío desde el Chrome de la usuaria: la extensión recibe los comandos por el puente y los ejecuta',async()=>{
 const {ExtensionBridge,Extensions}=await import('./extension-bridge.mjs');
 const f=fixture();try{
  const ig=fakeInstagram({hotel_sol:{title:'Hotel Sol (@hotel_sol)',dates:['2025-01-01']}});const bridge=new ExtensionBridge({pollMs:50});let on=true;
  // The extension: asks for commands and answers each one.
  (async()=>{while(on){for(const c of await bridge.poll()){try{bridge.result({id:c.id,result:await ig.client.call(c.method,c.params)});}catch(e){bridge.result({id:c.id,error:e.message});}}}})();
  await new Promise(r=>setTimeout(r,10));
  const s=new InstagramSender(os.tmpdir(),{store:f.store,bridge,launch:()=>{throw Error('no debe abrir otra ventana');},pause:[0,0],wait:async()=>{}});
  s.start([lead(f.store,'hotel_sol')]);await s.done;on=false;
  assert.equal(s.state.status,'done');assert.equal(s.state.sent,1);assert.match(ig.chats.hotel_sol,/Soy Mica/);
  const idle=new InstagramSender(os.tmpdir(),{store:f.store,bridge:new ExtensionBridge(),pause:[0,0],wait:async()=>{}});
  idle.start([lead(f.store,'otro_hotel')]);await idle.done;assert.equal(idle.state.status,'error');assert.match(idle.state.message,/Chrome no está conectado/);
  const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-ext-'));try{const x=new Extensions(dir,path.resolve('chrome-extension'),18761);const folder=await x.install('u1');const again=new Extensions(dir,path.resolve('chrome-extension'),18761);await again.load();const token=(await again.token('u1'));assert.match(token,/^[a-f0-9]{48}$/);assert.ok(again.byToken(token));assert.equal(again.byToken('x'.repeat(48)),null);assert.ok(folder.endsWith('u1'));}finally{rmSync(dir,{recursive:true,force:true});}
 }finally{f.close();}
});
