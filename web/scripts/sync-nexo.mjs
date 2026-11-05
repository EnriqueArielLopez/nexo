import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
let defaultSource='../nexo';try{await fs.access('../public/nexo.html');defaultSource='..';}catch{}
const source=path.resolve(process.argv[2]||defaultSource),destination=path.resolve('lib/generated');
await fs.mkdir(destination,{recursive:true});
const assets={};
const shared=['geography.mjs','business-sectors.mjs','identity.mjs','templates.mjs','campaign.mjs','prospecting.mjs','prospect-policy.mjs'];
for(const name of shared){const body=await fs.readFile(path.join(source,name),'utf8');assets['/'+name]={body};await fs.writeFile(path.join(destination,name),body);}
assets['/geography.js']=assets['/geography.mjs'];
for(const [url,file]of [['/app.js','nexo.js'],['/style.css','nexo.css'],['/contact-review.mjs','contact-review.mjs'],['/device-store.mjs','device-store.mjs'],['/device-io.mjs','device-io.mjs'],['/device.mjs','device.mjs']])assets[url]={body:await fs.readFile(path.join(source,'public',file),'utf8')};
let html=await fs.readFile(path.join(source,'public/nexo.html'),'utf8');html=html.replace(/<html\b/,'<html data-device="true"').replace('</head>','<meta name="theme-color" content="#193d35"><meta name="description" content="Encontrá negocios y guardá tu agenda de oportunidades en este dispositivo."><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg"></head>').replace(/(<section\b[^>]*id="loginScreen")/,'$1 hidden').replace(/<body>/,'<body><p id="deviceBoot" class="device-note" role="status">Abriendo tu agenda en este dispositivo…</p>');assets['/']={body:html};
for(const weight of [400,500,600,700,800])assets['/fonts/Manrope-'+weight+'.ttf']={base64:true,body:(await fs.readFile(path.join(source,'public/fonts/Manrope-'+weight+'.ttf'))).toString('base64')};
assets['/fonts/OFL.txt']={body:await fs.readFile(path.join(source,'public/fonts/OFL.txt'),'utf8')};
assets['/favicon.svg']={body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#193d35"/><path d="M33 96V39q0-12 12-12h9l41 70V39q0-12-12-12" fill="none" stroke="#e5c291" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>'};
assets['/manifest.webmanifest']={body:JSON.stringify({id:'/',name:'Nexo · Mi agenda',short_name:'Nexo',lang:'es',start_url:'/',scope:'/',display:'standalone',background_color:'#f7f4ee',theme_color:'#193d35',icons:[{src:'/favicon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]})};
for(const name of ['PRIVACIDAD.md','SECURITY.md'])assets['/'+name]={body:await fs.readFile(path.join(source,name),'utf8')};
const revision=createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0,16);
for(const [name,asset] of Object.entries(assets))if(/\.(m?js)$/.test(name))asset.body=asset.body.replace(/(['"])([^'"\s]+\.m?js)\1/g,(_,quote,url)=>quote+url+'?v='+revision+quote);
assets['/'].body=assets['/'].body.replace(/(src|href)="(\/(?:app\.js|style\.css))"/g,(_,attribute,url)=>attribute+'="'+url+'?v='+revision+'"');
const cached=Object.keys(assets).filter(k=>!k.endsWith('.md')).map(k=>/\.(m?js|css)$/.test(k)?k+'?v='+revision:k);
assets['/sw.js']={body:`const CACHE='nexo-device-${revision}';const FILES=${JSON.stringify(cached)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nexo-device-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request).then(r=>r||new Response('Conectate a Internet para cargar esta parte de Nexo.',{status:503}))));});`};
await fs.writeFile(path.join(destination,'assets.ts'),'export const assets: Record<string,{body:string,base64?:boolean}> = '+JSON.stringify(assets)+';\n');
console.log(JSON.stringify({assets:Object.keys(assets).length,sharedModules:shared.length,source}));
