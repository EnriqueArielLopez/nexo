import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('extensión: crea la ventana minimizada y recupera emulación de foco tras una desconexión',async()=>{
 const calls=[],listeners={};
 const context=vm.createContext({self:{NEXO:{port:18761,token:'FICTICIO'}},importScripts(){},Date,Promise,setTimeout,
  chrome:{storage:{session:{get:async()=>({}),set:async()=>{}}},
   windows:{create:async opts=>{calls.push(['create',opts]);return {id:7,tabs:[{id:9}]};},update:async(id,opts)=>calls.push(['window',opts])},
   tabs:{get:async()=>({windowId:7}),update:async()=>{throw Error('No debe activar una pestaña');},onRemoved:{addListener(){}}},
   debugger:{attach:async()=>calls.push(['attach']),sendCommand:async(_,method,params)=>{calls.push([method,params]);return {};},onDetach:{addListener:fn=>listeners.detach=fn}},
   runtime:{onStartup:{addListener(){}},onInstalled:{addListener(){}}},alarms:{create(){},onAlarm:{addListener(){}}}}
 });
 const source=readFileSync(new URL('./chrome-extension/background.js',import.meta.url),'utf8').replace(/loop\(\);\s*$/,'');
 vm.runInContext(source+'\nglobalThis.testRun=run;',context);
 await context.testRun({method:'Page.enable'});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(([m])=>m==='create')[1])),{url:'about:blank',focused:false,state:'minimized'});
 assert.ok(!calls.some(([m,p])=>m==='window'&&p.focused));
 listeners.detach({tabId:9});await context.testRun({method:'Page.navigate',params:{url:'about:blank'}});
 assert.equal(calls.filter(([m])=>m==='attach').length,2);
 assert.equal(calls.filter(([m,p])=>m==='Emulation.setFocusEmulationEnabled'&&p.enabled).length,2);
});
