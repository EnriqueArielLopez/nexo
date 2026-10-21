import tls from 'node:tls';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
// Minimal SMTP client (465 implicit TLS or 587 STARTTLS) so Nexo sends from the user's own mailbox without extra packages.
const b64=s=>Buffer.from(String(s)).toString('base64');
const header=s=>/^[\x20-\x7e]*$/.test(s)?s:`=?UTF-8?B?${b64(s)}?=`;
const wrap=s=>s.replace(/.{1,76}/g,'$&\r\n');
const TYPES={'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export const ATTACHMENT_TYPES=Object.keys(TYPES);
export function attachmentDir(dir){return path.join(dir,'adjuntos');}
export function fill(text,lead,settings){return String(text||'').replaceAll('{hotel}',lead.name||lead.handle).replaceAll('{ciudad}',lead.city||'').replaceAll('{remitente}',settings.sender||'').replaceAll('{servicio}',settings.offer||'');}
export async function compose({from,fromName,to,subject,text,attachment}){
 const boundary='nexo-'+randomBytes(12).toString('hex');const domain=from.split('@')[1]||'localhost';
 const head=[`From: ${fromName?header(fromName)+' ':''}<${from}>`,`To: <${to}>`,`Subject: ${header(subject)}`,`Date: ${new Date().toUTCString()}`,`Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`,'MIME-Version: 1.0'];
 const body=['Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(b64(text))].join('\r\n');
 if(!attachment)return [...head,body].join('\r\n');
 const name=path.basename(attachment),data=await fs.readFile(attachment);
 return [...head,`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,body,`--${boundary}`,`Content-Type: ${TYPES[path.extname(name).toLowerCase()]||'application/octet-stream'}; name="${header(name)}"`,'Content-Transfer-Encoding: base64',`Content-Disposition: attachment; filename="${header(name)}"`,'',wrap(data.toString('base64')),`--${boundary}--`,''].join('\r\n');
}
function session(socket){let buffer='',waiting=null;const lines=[];
 const feed=()=>{if(!waiting)return;const done=lines.findIndex(l=>/^\d{3} /.test(l));if(done<0)return;const reply=lines.splice(0,done+1);const w=waiting;waiting=null;w.resolve({code:Number(reply.at(-1).slice(0,3)),text:reply.join('\n')});};
 const onData=d=>{buffer+=d.toString();let i;while((i=buffer.indexOf('\r\n'))>=0){lines.push(buffer.slice(0,i));buffer=buffer.slice(i+2);}feed();};
 socket.on('data',onData);
 return {read:()=>new Promise((resolve,reject)=>{waiting={resolve,reject};socket.once('error',reject);feed();}),detach:()=>socket.off('data',onData)};
}
export async function sendMail({host,port,user,pass},message,{from,to}){
 if(!host||!user||!pass)throw Error('Configurá tu email en Ajustes de Nexo (servidor, usuario y contraseña de aplicación).');
 let socket=await new Promise((resolve,reject)=>{const s=port===465?tls.connect({host,port,servername:host},()=>resolve(s)):net.connect({host,port},()=>resolve(s));s.setTimeout(60000,()=>s.destroy(Error('El servidor de email no respondió.')));s.once('error',e=>reject(Error('No se pudo conectar al servidor de email: '+e.message)));});
 let io=session(socket);
 const cmd=async(line,ok)=>{if(line!==null)socket.write(line+'\r\n');const r=await io.read();if(!ok.includes(r.code)){const e=Error(`El servidor de email rechazó la operación (${r.code}). ${r.text.split('\n').at(-1).slice(4,200)}`);e.code=r.code;throw e;}return r;};
 try{await cmd(null,[220]);let ehlo=await cmd('EHLO nexo.local',[250]);
  if(port!==465){if(!/STARTTLS/i.test(ehlo.text))throw Error('El servidor no ofrece conexión segura. Usá el puerto 465.');await cmd('STARTTLS',[220]);io.detach();socket=await new Promise((resolve,reject)=>{const s=tls.connect({socket,servername:host},()=>resolve(s));s.once('error',reject);});io=session(socket);await cmd('EHLO nexo.local',[250]);}
  await cmd('AUTH LOGIN',[334]);await cmd(b64(user),[334]);
  try{await cmd(b64(pass),[235]);}catch(e){throw Error('Usuario o contraseña de email incorrectos. En Gmail usá una contraseña de aplicación.');}
  if(!message)return {ok:true};
  await cmd(`MAIL FROM:<${from}>`,[250]);await cmd(`RCPT TO:<${to}>`,[250,251]);await cmd('DATA',[354]);
  let r;try{r=await cmd(message.replace(/\r\n\./g,'\r\n..')+'\r\n.',[250]);}catch(e){if(!e.code)e.uncertain=true;throw e;}
  return {ok:true,receipt:r.text.slice(4,200)};
 }finally{try{socket.write('QUIT\r\n');}catch{}socket.end();}
}
export async function emailLead(store,dir,smtp,id){
 const s=store.settings();const {event,lead}=store.reserve(id,{channel:'email'});
 try{const file=s.attachment?path.join(attachmentDir(dir),path.basename(s.attachment)):null;const message=await compose({from:s.smtpUser,fromName:s.emailFrom||s.sender,to:lead.email,subject:fill(s.emailSubject,lead,s),text:lead.message,attachment:file});const r=await sendMail(smtp,message,{from:s.smtpUser,to:lead.email});store.finish(event,'sent',r.receipt||'Aceptado por el servidor de email');return {to:lead.email,hotel:lead.name};}
 catch(e){store.finish(event,e.uncertain?'uncertain':'failed',e.message);throw e;}
}
