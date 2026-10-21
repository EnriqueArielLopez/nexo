import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserWebDiscovery,SearchBrowser,DevtoolsConnection,isSearchUrl,waitForHuman} from './browser-search.mjs';
const html='<a class="result__a" href="https://www.instagram.com/hotel_qa/">Hotel QA</a><a class="result__snippet">Hotel en España. Reservas.</a>';
test('el navegador solo abre el buscador público, sin leer perfiles personales ni webs arbitrarias',async()=>{
 for(const url of ['https://html.duckduckgo.com/html/?q=hotel','https://duckduckgo.com/?q=hotel'])assert.equal(isSearchUrl(url),true);
 for(const url of ['http://127.0.0.1:18761','file:///C:/private','https://duckduckgo.com.evil.test/','https://instagram.com/private','https://user:pass@duckduckgo.com/'])assert.equal(isSearchUrl(url),false);
 const browser=new SearchBrowser('qa/no-browser-started');await assert.rejects(()=>browser.navigate('https://example.com'),/Solo se permite/);
 browser.ensure=async()=>{};browser.client={call:async()=>({result:{value:{url:'https://mail.example.com/',otherPage:true}}})};await assert.rejects(()=>browser.current(),/no leerá esa página/);
});
test('CAPTCHA pausa hasta confirmación humana y reanuda leyendo la misma página sin recargar',async()=>{
 let reads=0,current=0,shown=0,continueUser,waiting=false;
 const browser={read:async()=>{reads++;return {url:'https://html.duckduckgo.com/html/?q=hotel',html:'anomaly-modal'};},current:async()=>{current++;return {html};},show:async()=>{shown++;}};
 const web=new BrowserWebDiscovery({browser,delayMs:0,onChallenge:()=>new Promise(resolve=>{waiting=true;continueUser=resolve;})});
 const pending=web.search('hotel');await new Promise(r=>setTimeout(r,0));assert.equal(waiting,true);assert.equal(current,0);assert.equal(reads,1);continueUser();const result=await pending;assert.equal(result.length,1);assert.equal(reads,1);assert.equal(current,1);assert.equal(shown,1);
});
test('si la verificación sigue presente vuelve a esperar; no la resuelve ni cambia de buscador',async()=>{
 let confirmations=0,current=0;
 const browser={read:async()=>({html:'anomaly-modal'}),current:async()=>({html:++current===1?'anomaly-modal':html}),show:async()=>{}};
 const web=new BrowserWebDiscovery({browser,delayMs:0,onChallenge:async()=>{confirmations++;}});const result=await web.search('hotel');assert.equal(confirmations,2);assert.equal(result.length,1);
});
test('detener una búsqueda mientras espera libera el trabajo y permite uno nuevo',async()=>{
 const controller=new AbortController();let resume;
 const waiting=waitForHuman(controller.signal,r=>{resume=r;});controller.abort();await assert.rejects(()=>waiting,/detenida/);resume();
 let nextResume;const next=waitForHuman(new AbortController().signal,r=>{nextResume=r;});nextResume();await next;
});
test('página siguiente espera la verificación humana y no vuelve a navegar',async()=>{
 let next=0,current=0,shown=0,confirm;
 const browser={next:async()=>{next++;return {html:'anomaly-modal',url:'https://html.duckduckgo.com/html/'};},show:async()=>{shown++;},current:async()=>{current++;return {html};}};
 const web=new BrowserWebDiscovery({browser,delayMs:0,onChallenge:()=>new Promise(resolve=>{confirm=resolve;})});web.query='hotel';const pending=web.nextPage();await new Promise(r=>setTimeout(r,0));assert.equal(next,1);assert.equal(current,0);confirm();assert.equal((await pending).length,1);assert.equal(shown,1);assert.equal(next,1);assert.equal(current,1);
});
test('sin formulario siguiente o ante CAPTCHA el controlador no avanza',async()=>{
 const browser=new SearchBrowser('qa/no-browser-started');browser.lastHtml='anomaly-modal';let calls=0;browser.client={call:async()=>{calls++;return {result:{value:false}};}};
 assert.equal(await browser.next(),null);assert.equal(calls,0);browser.lastHtml='<html>última página</html>';assert.equal(await browser.next(),null);assert.equal(calls,1);
});
test('transporte de navegador asocia respuestas y rechaza operaciones pendientes al cerrar',async()=>{
 class Socket extends EventTarget{readyState=1;sent=[];send(value){this.sent.push(JSON.parse(value));}close(){this.readyState=3;this.dispatchEvent(new Event('close'));}}
 const socket=new Socket(),client=new DevtoolsConnection(socket);const reply=client.call('Target.createTarget',{url:'about:blank'});assert.equal(socket.sent[0].method,'Target.createTarget');socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:1,result:{targetId:'qa'}})}));assert.deepEqual(await reply,{targetId:'qa'});
 const pending=client.call('Page.enable',{},'session-qa');assert.equal(socket.sent[1].sessionId,'session-qa');client.close();await assert.rejects(()=>pending,/cerró/);
 await assert.rejects(()=>DevtoolsConnection.connect('ws://192.168.1.1:9222/devtools/browser/abc'),/inválida/);
});
