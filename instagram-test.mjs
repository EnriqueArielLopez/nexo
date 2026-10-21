import {randomBytes} from 'node:crypto';
import {handle} from './core.mjs';
export async function previewInstagramTest({store,instagram,budget,target,text,now}){
 if(!instagram?.account)throw Error('Primero conectá la cuenta que enviará el mensaje.');const recipient=handle(target);
 if(recipient===instagram.account.username.toLowerCase())throw Error('Elegí otra cuenta para probar como cliente. La cuenta que envía es @'+recipient+'.');
 const message=String(text||'').trim();if(!message||message.length>1000)throw Error('Escribí un mensaje de prueba de hasta 1000 caracteres.');await instagram.sync(store);now=now??Date.now();
 const inbound=store.db.prepare('SELECT * FROM inbound WHERE handle=? AND account=?').get(recipient,instagram.account.id);if(!inbound||Date.parse(inbound.at)>now||now-Date.parse(inbound.at)>=24*3600e3)throw Error('Esa cuenta debe escribir primero a @'+instagram.account.username+' desde Instagram. Después volvé a preparar la prueba.');
 const existing=store.db.prepare('SELECT * FROM leads WHERE handle=?').get(recipient);const lead=existing||{id:-1,handle:recipient,demo:0,dnc:0,email:''};const block=store.gate({...lead,qualification:'',approved:1,message},new Date(now),true,instagram.account.id)||budget?.gate(instagram.account.id,recipient,store.settings(),new Date(now));if(block)throw Error(block);
 return {nonce:randomBytes(24).toString('base64url'),account:instagram.account.id,from:instagram.account.username,target:recipient,text:message,expiresAt:now+5*60e3};
}
export async function sendInstagramTest({store,instagram,preview,nonce,confirm,now=Date.now()}){
 if(confirm!==true||!preview||preview.nonce!==nonce||preview.expiresAt<=now||preview.account!==instagram?.account?.id)throw Error('La prueba no está confirmada o venció. Preparala de nuevo.');
 // Consume before any external call. Repeating the request never resends the test.
 preview.expiresAt=0;let lead=store.db.prepare('SELECT * FROM leads WHERE handle=?').get(preview.target),original=lead?{...lead}:null;
 if(!lead){const result=store.add({handle:preview.target,name:'Prueba · @'+preview.target,language:'es',source:'https://www.instagram.com/'+preview.target+'/',message:preview.text,reason:'Prueba de conexión oficial autorizada por el usuario.'});lead=store.get(result.id);}
 try{store.update(lead.id,{message:preview.text,approved:true,qualificationReviewed:true});const receipt=await instagram.send(store,lead.id);return {messageId:receipt.message_id,from:preview.from,to:preview.target};}
 finally{if(original){store.update(lead.id,{message:original.message,approved:!!original.approved});store.db.prepare('UPDATE leads SET qualification=? WHERE id=?').run(original.qualification,lead.id);}}
}
