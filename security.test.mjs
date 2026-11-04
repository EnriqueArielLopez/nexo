import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {scryptSync} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {zip,unzip,crc32} from './zip.mjs';
import {readImport} from './imports.mjs';
import {Accounts} from './auth.mjs';
import {compose,mailConfig} from './mailer.mjs';
import {pinnedLookup,isPublicAddress,publicUrl} from './web-discovery.mjs';
import {vault} from './vault.mjs';

test('ZIP: tamaño real, límites, duplicados y directorios truncados se rechazan',()=>{
 const valid=zip(new Map([['a.xml','datos ficticios']]));assert.equal(unzip(valid).get('a.xml').toString(),'datos ficticios');
 assert.throws(()=>unzip(valid,{maxBytes:1}),/grande/);
 const forged=Buffer.from(valid),end=forged.length-22,central=forged.readUInt32LE(end+16),len=forged.readUInt32LE(central+20),start=30+forged.readUInt16LE(26);
 forged.writeUInt16LE(0,8);forged.writeUInt16LE(0,central+10);forged.writeUInt32LE(0,central+24);forged.writeUInt32LE(crc32(forged.subarray(start,start+len)),central+16);
 assert.throws(()=>unzip(forged),/ZIP inválida/,'método almacenado no puede mentir sobre bytes descomprimidos');
 for(const b of [Buffer.alloc(0),valid.subarray(0,valid.length-5)])assert.throws(()=>unzip(b),/ZIP inválida/);
 const two=zip(new Map([['a.xml','uno'],['b.xml','dos']]));const p=two.readUInt32LE(two.length-6);const second=p+46+5;
 const offset=two.readUInt32LE(second+42);two.write('a.xml',second+46);two.write('a.xml',offset+30);assert.throws(()=>unzip(two),/ZIP inválida/);
 assert.throws(()=>unzip(zip(new Map([['../secret.xml','x']]))),/ZIP inválida/);
});

test('importación: referencias dispersas, columnas y celdas abusivas tienen límites',()=>{
 const xlsx=ref=>zip(new Map([['xl/worksheets/sheet1.xml',`<worksheet><sheetData><row><c r="${ref}1" t="inlineStr"><is><t>Instagram</t></is></c></row></sheetData></worksheet>`]])).toString('base64');
 for(const ref of ['ZZZZZZZZZ','XFD','IW'])assert.throws(()=>readImport({format:'xlsx',content:xlsx(ref)}),/límite|columnas/);
 for(const xml of ['<worksheet>'+ '<row>'.repeat(5000),'<!DOCTYPE x [<!ENTITY e SYSTEM "file:///C:/Windows/win.ini">]><worksheet/>'])assert.throws(()=>readImport({format:'xlsx',content:zip(new Map([['xl/worksheets/sheet1.xml',xml]])).toString('base64')}),/XML/);
 assert.throws(()=>readImport({format:'csv',content:Array(258).fill('campo').join(',')}),/columnas/);
 assert.throws(()=>readImport({format:'csv',content:'Instagram\n'+ 'a'.repeat(32001)}),/celda/);
 assert.equal(readImport({format:'csv',content:'Instagram,Nombre\nqa_ficticio,Ejemplo'}).length,1);
});

test('acceso: bloqueo persiste al reiniciar y cambiar de nombre no evita el límite global',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-security-auth-'));let a;let now=Date.now();
 try{a=new Accounts(dir,{now:()=>now});a.create('QA','clave-ficticia-123');
  for(let i=0;i<5;i++)assert.throws(()=>a.login('QA','incorrecta'));
  a.close();a=new Accounts(dir,{now:()=>now});assert.throws(()=>a.login('QA','clave-ficticia-123'),e=>e.code==='LOGIN_LOCKED');
  for(let i=0;i<15;i++)assert.throws(()=>a.login('desconocido'+i,'incorrecta'));
  assert.throws(()=>a.login('otro nombre','incorrecta'),e=>e.code==='LOGIN_LOCKED'&&e.retryAfterSeconds===60);
  now+=900000;assert.equal(a.login('QA','clave-ficticia-123').name,'QA');
 }finally{a?.close();rmSync(dir,{recursive:true,force:true});}
});

test('contraseñas antiguas migran al trabajo reforzado después de un acceso válido',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-security-hash-'));const a=new Accounts(dir);
 try{const u=a.create('QA','clave-ficticia-123');const row=a.db.prepare('SELECT * FROM users WHERE id=?').get(u.id);assert.ok(row.password.startsWith('v2:'));
  a.db.prepare('UPDATE users SET password=? WHERE id=?').run(scryptSync('clave-ficticia-123',row.salt,64).toString('hex'),u.id);
  assert.equal(a.login('QA','clave-ficticia-123').id,u.id);assert.ok(a.db.prepare('SELECT password FROM users WHERE id=?').get(u.id).password.startsWith('v2:'));
 }finally{a.close();rmSync(dir,{recursive:true,force:true});}
});

test('correo: no se admiten inyección SMTP/encabezados ni conexiones sin TLS',async()=>{
 const args={from:'qa@example.com',to:'destino@example.com',subject:'Prueba',text:'FICTICIO'};
 for(const field of ['from','to','subject','fromName'])await assert.rejects(compose({...args,[field]:'qa@example.com\r\nBcc: otro@example.com'}),/inválido/);
 for(const port of [25,2525,80])assert.throws(()=>mailConfig({host:'smtp.example.com',port,user:'qa@example.com',pass:'FICTICIO'}),/TLS/);
 const message=await compose({...args,fromName:'Nombre <otro@example.com>'});assert.match(message,/From: =\?UTF-8\?B\?/);assert.ok(!message.split('\r\n')[0].includes('<otro@example.com>'));
});

test('red pública: DNS queda fijado al socket y se bloquean redes reservadas y transiciones IPv6',async()=>{
 const records=[{address:'8.8.8.8',family:4}],lookup=pinnedLookup(records);records[0].address='127.0.0.1';
 lookup('dominio.example',{},(error,address)=>{assert.equal(error,null);assert.equal(address,'8.8.8.8');});
 for(const ip of ['192.0.2.1','198.51.100.4','203.0.113.8','2002:7f00:1::','2001:db8::1','64:ff9b::7f00:1'])assert.equal(isPublicAddress(ip),false,ip);
 assert.throws(()=>pinnedLookup([{address:'127.0.0.1',family:4}]),/privada/);
 for(const url of ['http://127.0.0.1/','http://2130706433/','http://[::ffff:127.0.0.1]/','http://localhost/','file:///C:/Windows/win.ini'])await assert.rejects(publicUrl(url),/privada|públicos/);
});

test('extensión: impide leer otras pestañas, archivos, cookies completas y comandos ajenos',async()=>{
 let url='about:blank';const sent=[];
 const ctx=vm.createContext({self:{NEXO:{port:18761,token:'FICTICIO'}},importScripts(){},URL,Date,Promise,setTimeout,
  chrome:{storage:{session:{get:async()=>({}),set:async()=>{}}},windows:{create:async()=>({id:7,tabs:[{id:9}]}),update:async()=>{}},tabs:{get:async()=>({windowId:7}),onRemoved:{addListener(){}}},debugger:{getTargets:async()=>[{tabId:9,url}],attach:async()=>{},detach:async()=>{},sendCommand:async(_,method,params)=>{sent.push({method,params});return {cookies:[{name:'sessionid',value:'SECRETO FICTICIO'},{name:'ds_user_id',value:'ID FICTICIO'}]};},onDetach:{addListener(){}}},runtime:{onStartup:{addListener(){}},onInstalled:{addListener(){}}},alarms:{create(){},onAlarm:{addListener(){}}}}});
 vm.runInContext(readFileSync(new URL('./chrome-extension/background.js',import.meta.url),'utf8').replace(/loop\(\);\s*$/,'')+'\nglobalThis.runTest=run;',ctx);
 for(const method of ['Network.getAllCookies','Storage.getCookies','Browser.close'])await assert.rejects(ctx.runTest({method}),/permitido/);
 for(const target of ['file:///C:/Windows/win.ini','https://mail.google.com/','https://instagram.com.evil.example/','https://user:pass@www.instagram.com/'])await assert.rejects(ctx.runTest({method:'Page.navigate',params:{url:target}}),/Instagram/);
 const result=await ctx.runTest({method:'Network.getCookies',params:{urls:['https://www.instagram.com/']}});assert.equal(JSON.stringify(result),'{"cookies":[{"name":"ds_user_id","value":"present"}]}');
 url='https://mail.google.com/';const before=sent.length;await assert.rejects(ctx.runTest({method:'Runtime.evaluate',params:{expression:'document.cookie'}}),/ventana de Instagram/);assert.equal(sent.length,before);
});

test('MCP: herramientas de envío no se ofrecen ni aceptan y no se descifra la bóveda',async()=>{
 const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','mcp.mjs'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>err+=v);
 const closed=new Promise(resolve=>child.on('close',resolve));child.stdin.end([{id:1,method:'tools/list'},{id:2,method:'tools/call',params:{name:'nexo_enviar_emails',arguments:{confirmado_por_usuario:true}}}].map(v=>JSON.stringify(v)).join('\n')+'\n');
 await closed;assert.equal(child.exitCode,0,err);const replies=out.trim().split('\n').map(v=>JSON.parse(v));const tools=replies.find(v=>v.id===1).result.tools;
 assert.ok(!tools.some(t=>['nexo_enviar_emails','nexo_programar'].includes(t.name)));assert.equal(replies.find(v=>v.id===2).result.isError,true);
});

test('MCP: con varios espacios no toma otra cuenta por defecto o ante un nombre equivocado',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-security-mcp-'));const a=new Accounts(dir);a.create('QA Uno','clave-ficticia-123');a.create('QA Dos','clave-ficticia-123');a.close();
 try{for(const wanted of ['', 'QA Inexistente','QA Dos']){
  const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','mcp.mjs'],{env:{...process.env,NEXO_DATA_DIR:dir,NEXO_USUARIO:wanted},windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';child.stdout.on('data',v=>out+=v);child.stderr.resume();const closed=new Promise(resolve=>child.once('close',resolve));child.stdin.end(JSON.stringify({id:1,method:'tools/call',params:{name:'nexo_estado'}})+'\n');await closed;
  const reply=JSON.parse(out.trim()).result;if(wanted==='QA Dos'){assert.ok(!reply.isError);assert.equal(JSON.parse(reply.content[0].text).cuenta_nexo,'QA Dos');}else{assert.equal(reply.isError,true);assert.match(reply.content[0].text,/NEXO_USUARIO/);}
 }}finally{rmSync(dir,{recursive:true,force:true});}
});

test('DPAPI: conexión ficticia se cifra y recupera sin poner secretos en argumentos', {skip:process.platform!=='win32'},async()=>{
 const secret={key:'CLAVE TOTALMENTE FICTICIA',smtpPass:'CONTRASEÑA FICTICIA'};
 const cipher=await vault('seal',secret);assert.ok(!cipher.includes(secret.key));assert.deepEqual(await vault('open',cipher),secret);
 await assert.rejects(vault('otro',secret),/inválida/);await assert.rejects(vault('open','A'.repeat(65537)),/límite/);
});
