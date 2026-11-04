// Registers this Nexo copy as the "nexo" connector in the Claude app (chat and Code) on this PC.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createInterface} from 'node:readline/promises';
const app=path.dirname(fileURLToPath(import.meta.url));
const entry={command:path.join(app,'..','bin','node.exe'),args:['--disable-warning=ExperimentalWarning',path.join(app,'mcp.mjs')],env:{NEXO_DATA_DIR:path.join(process.env.LOCALAPPDATA||os.homedir(),'NexoClientes','Datos')}};
entry.env.NEXO_DATA_DIR=process.env.NEXO_DATA_DIR||entry.env.NEXO_DATA_DIR;
const accountsFile=path.join(entry.env.NEXO_DATA_DIR,'cuentas.sqlite');
if(fs.existsSync(accountsFile)){const db=new DatabaseSync(accountsFile,{readOnly:true});const users=db.prepare('SELECT name FROM users ORDER BY name').all();db.close();let chosen=process.env.NEXO_USUARIO||'';if(!chosen&&users.length===1)chosen=users[0].name;if(!chosen&&users.length>1){console.log('Elegí el espacio de Nexo que podrá consultar Claude:');users.forEach((u,i)=>console.log(`${i+1}. ${u.name}`));const rl=createInterface({input:process.stdin,output:process.stdout});try{chosen=users[Number(await rl.question('Número de espacio: '))-1]?.name||'';}finally{rl.close();}}if(users.length&&!users.some(u=>u.name===chosen))throw Error('No se seleccionó un espacio válido. No se modificó el conector.');if(chosen)entry.env.NEXO_USUARIO=chosen;}
const local=process.env.LOCALAPPDATA||'',roaming=process.env.APPDATA||'';
const desktop=[path.join(roaming,'Claude','claude_desktop_config.json')];
try{for(const d of fs.readdirSync(path.join(local,'Claude-Data')))desktop.push(path.join(local,'Claude-Data',d,'claude_desktop_config.json'));}catch{}
const targets=[...desktop.filter((f,i)=>i===0||fs.existsSync(f)).map(f=>[f,{}]),[path.join(os.homedir(),'.claude.json'),{type:'stdio'}]];
let done=0;
for(const [file,extra]of targets){try{let data={};if(fs.existsSync(file)){data=JSON.parse(fs.readFileSync(file,'utf8'));if(!fs.existsSync(file+'.antes-de-nexo'))fs.copyFileSync(file,file+'.antes-de-nexo');}else if(!fs.existsSync(path.dirname(file)))continue;data.mcpServers={...data.mcpServers,nexo:{...extra,...entry}};fs.writeFileSync(file,JSON.stringify(data,null,2));done++;console.log('Conectado: '+file);}catch(e){console.log('No se pudo actualizar '+file+': '+e.message);}}
console.log(done?'\nListo. Cerrá y volvé a abrir la app de Claude; vas a ver el conector "nexo".':'\nNo se encontró la app de Claude. Instalala desde claude.ai/download y volvé a ejecutar este archivo.');
