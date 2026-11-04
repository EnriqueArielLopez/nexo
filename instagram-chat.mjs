// Executed inside the sender's tab. Never read the inbox sidebar as chat history.
// Unknown layouts stay unknown: absence of a matching proposal is not proof of an empty chat.
export function readInstagramChat(expectedHandle){
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
 const wanted=String(expectedHandle).toLowerCase();
 const box=document.querySelector('[contenteditable="true"][role="textbox"]');
 const sidebar='[aria-label="Lista de conversaciones"],[aria-label="Conversation list"],[aria-label="Thread list"]';
 const profile=a=>{try{const u=new URL(a.getAttribute('href'),location.href);return /^(www\.)?instagram\.com$/.test(u.hostname)&&u.pathname.replace(/\/+$/,'').toLowerCase()===`/${wanted}`;}catch{return false;}};
 const matches=el=>[...el.querySelectorAll('a[href]')].some(profile);
 const identityLinks=el=>[...el.querySelectorAll('a[href]')].some(a=>{
  if(!profile(a)||a.closest(sidebar))return false;
  const row=a.closest('[role="row"],[data-message-id],[data-testid="message"],[data-testid="message-container"]');
  return !row||/ver perfil|view profile/i.test(row.innerText);
 });
 let pane=null;
 if(box){
  for(let el=box.parentElement;el&&el!==document.body;el=el.parentElement){
   if(el.querySelector(sidebar))break;
   if(identityLinks(el)){pane=el;break;}
  }
 }else{
  // A previously messaged account can have no composer (an invitation, for example).
  for(const link of [...document.querySelectorAll('a[href]')].filter(profile)){
   if(!identityLinks(link.parentElement))continue;
   for(let el=link.parentElement;el&&el!==document.body;el=el.parentElement){
    if(el.querySelector(sidebar))break;
    if(el.querySelector('[role="grid"],[role="log"],[data-message-id]')){pane=el;break;}
   }
   if(pane)break;
  }
 }
 if(!pane)return {identity:false,ready:false,hasMessages:false,messages:[],text:'',draft:box?.innerText||''};
 const rows=[...pane.querySelectorAll('[role="row"],[data-message-id],[data-testid="message"],[data-testid="message-container"]')];
 const messages=rows.filter(row=>{
  if(box&&(row===box||row.contains(box)))return false;
  if(row.getAttribute('aria-busy')==='true'||row.querySelector('[role="progressbar"]'))return false;
  // Instagram's introductory profile card is not a message.
  if(matches(row)&&/ver perfil|view profile/i.test(row.innerText))return false;
  return !!(norm(row.innerText)||row.querySelector('img,video,audio,[aria-label]'));
 }).flatMap(row=>{
  const parts=[...row.querySelectorAll('[dir="auto"]')].filter(el=>!el.querySelector('[dir="auto"]')).map(el=>norm(el.innerText)).filter(Boolean);
  return [...new Set([norm(row.innerText)||'[Mensaje multimedia]',...parts])];
 });
 const text=norm(pane.innerText),busy=!!pane.querySelector('[aria-busy="true"],[role="progressbar"]');
 const timeline=!!pane.querySelector('[role="grid"],[role="log"]');
 const empty=/inicia (?:una|la) conversaci[oó]n|env[ií]a (?:un|tu primer) mensaje|start (?:a |the )?conversation|send (?:a |your first )message|no (?:hay )?mensajes|no messages yet/i.test(text);
 return {identity:true,ready:!busy&&(timeline||empty),hasMessages:messages.length>0,messages,text,draft:box?.innerText||''};
}

export const chatExpression=handle=>`(${readInstagramChat.toString()})(${JSON.stringify(handle)})`;
