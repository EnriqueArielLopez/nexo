import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

export async function exportWorkbook(snapshot,dest,{preview=false}={}) {
 const wb=Workbook.create();const sh=wb.worksheets.add('Hoteles');const hist=wb.worksheets.add('Historial');
 const headers=['Hotel','Instagram','País','Ciudad','Idioma','Estado / acción pendiente','Último envío','Próximo contacto','No contactar','Propuesta','Motivo / evidencia','Fuente pública','Tipo'];
 const literal=v=>typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v;
 const rows=snapshot.leads.map(l=>[l.name,`https://www.instagram.com/${l.handle}/`,l.country,l.city,'Español',l.block||'Disponible (gestión manual)',l.last?l.last.slice(0,19).replace('T',' '):'',l.next?l.next.slice(0,10):'',l.dnc?'Sí':'No',l.message,l.reason,l.source,l.demo?'DEMO FICTICIA':'Real'].map(literal));
 sh.getRange('A1:F1').merge();sh.getRange('A1').values=[['HOTEL · PROSPECTOS']];sh.getRange('A2:M2').merge();sh.getRange('A2').values=[['Actualizado '+snapshot.generated+' · Horario Argentina · El historial de la aplicación controla los recontactos.']];sh.getRange('A3:M3').merge();sh.getRange('A3').values=[['Cupos internos: '+snapshot.settings.daily+'/día y '+snapshot.settings.monthly+'/mes. No son límites garantizados por Instagram.']];
 sh.getRange('A5:M5').values=[headers];if(rows.length)sh.getRange(`A6:M${5+rows.length}`).values=rows;
 sh.getRange(`A1:M${Math.max(6,5+rows.length)}`).format.font.name='Aptos';sh.getRange('A1:M3').format.fill='#102E32';sh.getRange('A1:M3').format.font.color='#FFFFFF';sh.getRange('A1').format.font.size=22;sh.getRange('A5:M5').format.fill='#18796C';sh.getRange('A5:M5').format.font.color='#FFFFFF';sh.getRange('A5:M5').format.font.bold=true;
 sh.getRange('A:M').format.columnWidthPx=150;sh.getRange('A:A').format.columnWidthPx=220;sh.getRange('B:B').format.columnWidthPx=290;sh.getRange('F:F').format.columnWidthPx=290;sh.getRange('J:J').format.columnWidthPx=460;sh.getRange('K:L').format.columnWidthPx=340;sh.getRange(`A5:M${Math.max(6,5+rows.length)}`).format.wrapText=true;sh.getRange(`A6:M${Math.max(6,5+rows.length)}`).format.rowHeightPx=115;sh.getRange('A1:M1').format.rowHeightPx=45;sh.getRange('A5:M5').format.rowHeightPx=42;sh.getRange('A5:M1000').format.verticalAlignment='top';sh.freezePanes.freezeRows(5);
 if(rows.length)sh.tables.add(`A5:M${5+rows.length}`,true,'HotelesProspectos');
 snapshot.leads.forEach((l,i)=>{if(l.last)sh.getRange(`A${i+6}:M${i+6}`).format.font.color='#677B7C';if(l.dnc)sh.getRange(`A${i+6}:M${i+6}`).format.fill='#FCE7E7';});
 const history=[['Fecha UTC','Hotel','Instagram','Canal','Resultado','Confirmación','Propuesta enviada','Cuenta','Tipo'],...snapshot.history.map(e=>[e.at,e.name,e.handle,e.channel,e.status,e.receipt,e.message,e.account,e.demo?'DEMO':'Real'].map(literal))];hist.getRange(`A1:I${history.length}`).values=history;hist.getRange('A1:I1').format.fill='#102E32';hist.getRange('A1:I1').format.font.color='#FFFFFF';hist.getRange('A:I').format.columnWidthPx=190;hist.getRange('G:G').format.columnWidthPx=440;hist.getRange(`A1:I${history.length}`).format.wrapText=true;hist.getRange(`A1:I${history.length}`).format.rowHeightPx=90;hist.freezePanes.freezeRows(1);
 await fs.mkdir(path.dirname(dest),{recursive:true});
 const out=await SpreadsheetFile.exportXlsx(wb);const temp=dest+'.tmp';await out.save(temp);
 const python=process.env.HOTEL_PYTHON||path.join(process.env.USERPROFILE||'','/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
 const stamp=spawnSync(python,[path.join(path.dirname(fileURLToPath(import.meta.url)),'stamp-xlsx.py'),temp,JSON.stringify(snapshot.leads.map((l,i)=>l.eventStatus==='sent'?i+6:0).filter(Boolean))],{windowsHide:true,encoding:'utf8'});
 if(stamp.status!==0)throw Error('No se pudo aplicar el tachado de Excel: '+(stamp.error?.message||stamp.stderr));
 await fs.rename(temp,dest);
 if(preview){const p=await wb.render({sheetName:'Hoteles',range:'A1:F9',scale:1,format:'png'});await fs.writeFile(dest+'.png',new Uint8Array(await p.arrayBuffer()));console.log((await wb.inspect({kind:'region',sheetId:'Hoteles',range:'A5:I9',maxChars:2000})).ndjson);}
}
if(process.argv[2])await exportWorkbook(JSON.parse(await fs.readFile(process.argv[2],'utf8')),process.argv[3],{preview:process.argv.includes('--preview')});
