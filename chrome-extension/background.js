// Nexo's extension: asks the Nexo app (on this computer only) for the next steps of a send and runs them in its own
// window of this Chrome, signed in to the user's Instagram. It only talks to 127.0.0.1 and with the user's token.
importScripts('config.js');
const BASE=`http://127.0.0.1:${self.NEXO.port}/api/ext/`,HEADERS={'X-Nexo-Token':self.NEXO.token};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let tabId=null,windowId=null,attached=false,lastUse=0,running=false;

// Chrome may restart this worker: the window it was using is remembered for the session.
const ready=chrome.storage.session.get('nexo').then(v=>{if(v.nexo&&tabId===null)({tabId,windowId}=v.nexo);}).catch(()=>{});
const remember=()=>chrome.storage.session.set({nexo:{tabId,windowId}}).catch(()=>{});
async function ensureTab(){
 await ready;
 if(tabId!==null){try{const tab=await chrome.tabs.get(tabId);windowId=tab.windowId;return;}catch{tabId=null;attached=false;}}
 // A window apart, so the user's tabs are never touched.
 const w=await chrome.windows.create({url:'about:blank',focused:false,state:'minimized'});
 windowId=w.id;tabId=w.tabs[0].id;attached=false;await chrome.windows.update(windowId,{state:'minimized'});await remember();
}
async function attach(){await ensureTab();if(!attached){try{await chrome.debugger.attach({tabId},'1.3');}catch(e){if(!/already attached/i.test(String(e?.message)))throw e;}attached=true;await chrome.debugger.sendCommand({tabId},'Emulation.setFocusEmulationEnabled',{enabled:true});}}
chrome.debugger.onDetach.addListener(source=>{if(source.tabId===tabId)attached=false;});
chrome.tabs.onRemoved.addListener(id=>{if(id===tabId){tabId=null;windowId=null;attached=false;}});

// The Target/Browser commands refer to Nexo's window; everything else goes to its tab as is.
async function run({method,params={}}){
 lastUse=Date.now();
 switch(method){
  case 'Target.getTargetInfo':if(tabId===null)throw Error('La ventana de Nexo está cerrada.');await chrome.tabs.get(tabId);return {targetInfo:{targetId:'nexo',type:'page'}};
  case 'Target.getTargets':await ensureTab();return {targetInfos:[{targetId:'nexo',type:'page',url:''}]};
  case 'Target.createTarget':await ensureTab();return {targetId:'nexo'};
  case 'Target.attachToTarget':await attach();return {sessionId:'nexo'};
  case 'Target.activateTarget':await ensureTab();await chrome.windows.update(windowId,{focused:true});await chrome.tabs.update(tabId,{active:true});return {};
  case 'Browser.getWindowForTarget':await ensureTab();return {windowId};
  case 'Browser.setWindowBounds':await ensureTab();await chrome.windows.update(windowId,params.bounds?.windowState==='minimized'?{state:'minimized'}:{state:'normal',focused:true});return {};
  default:await attach();return await chrome.debugger.sendCommand({tabId},method,params)||{};
 }
}

async function loop(){
 if(running)return;running=true;
 try{
  for(;;){
   let commands=[];
   try{const r=await fetch(BASE+'poll',{headers:HEADERS,cache:'no-store'});if(!r.ok){await sleep(15000);continue;}commands=await r.json();}catch{await sleep(5000);continue;}
   for(const command of commands){
    let result,error;try{if(command.expiresAt&&Date.now()>command.expiresAt)throw Error('La operación venció; no se ejecutó.');result=await run(command);}catch(e){error=String(e?.message||e);}
    await fetch(BASE+'result',{method:'POST',headers:{...HEADERS,'content-type':'application/json'},body:JSON.stringify({id:command.id,result,error})}).catch(()=>{});
   }
   // Without work for a while, Chrome's "debugging" bar goes away.
   if(attached&&Date.now()-lastUse>60000){await chrome.debugger.detach({tabId}).catch(()=>{});attached=false;}
   await chrome.runtime.getPlatformInfo();
  }
 }finally{running=false;}
}
chrome.runtime.onStartup.addListener(loop);
chrome.runtime.onInstalled.addListener(loop);
chrome.alarms.create('nexo',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(loop);
loop();
