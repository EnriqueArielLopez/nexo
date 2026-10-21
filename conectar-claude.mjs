// Registers this Nexo copy as the "nexo" connector in the Claude app (chat and Code) on this PC.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.dirname(fileURLToPath(import.meta.url));
const entry={command:path.join(app,'..','bin','node.exe'),args:['--disable-warning=ExperimentalWarning',path.join(app,'mcp.mjs')],env:{NEXO_DATA_DIR:path.join(process.env.LOCALAPPDATA||os.homedir(),'NexoClientes','Datos')}};
const local=process.env.LOCALAPPDATA||'',roaming=process.env.APPDATA||'';
const desktop=[path.join(roaming,'Claude','claude_desktop_config.json')];
try{for(const d of fs.readdirSync(path.join(local,'Claude-Data')))desktop.push(path.join(local,'Claude-Data',d,'claude_desktop_config.json'));}catch{}
const targets=[...desktop.filter((f,i)=>i===0||fs.existsSync(f)).map(f=>[f,{}]),[path.join(os.homedir(),'.claude.json'),{type:'stdio'}]];
let done=0;
for(const [file,extra]of targets){try{let data={};if(fs.existsSync(file)){data=JSON.parse(fs.readFileSync(file,'utf8'));if(!fs.existsSync(file+'.antes-de-nexo'))fs.copyFileSync(file,file+'.antes-de-nexo');}else if(!fs.existsSync(path.dirname(file)))continue;data.mcpServers={...data.mcpServers,nexo:{...extra,...entry}};fs.writeFileSync(file,JSON.stringify(data,null,2));done++;console.log('Conectado: '+file);}catch(e){console.log('No se pudo actualizar '+file+': '+e.message);}}
console.log(done?'\nListo. Cerrá y volvé a abrir la app de Claude; vas a ver el conector "nexo".':'\nNo se encontró la app de Claude. Instalala desde claude.ai/download y volvé a ejecutar este archivo.');
