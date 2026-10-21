// Populate an artifact-tool-authored template with only the included Node runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {zip,unzip} from './zip.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const col=i=>String.fromCharCode(65+i);
const values=(arr,row,styles=[],height=75)=>`<row r="${row}" ht="${height}" customHeight="1">`+arr.map((v,i)=>`<c r="${col(i)}${row}" s="${styles[i]||styles[styles.length-1]||0}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')+'</row>';
function stylesFor(sheet,row){const data=sheet.match(new RegExp('<(?:\\w+:)?row\\b[^>]*\\br="'+row+'"[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?row>'))?.[1]||'';return [...data.matchAll(/<(?:\w+:)?c\b[^>]*\br="([A-Z]+)\d+"[^>]*>/g)].map(m=>Number(m[0].match(/\bs="(\d+)"/)?.[1]||0));}
function worksheet(rows,lastCol,styles,tableId=''){const end=Math.max(rows.length,1);return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastCol}${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="${tableId?5:1}" topLeftCell="A${tableId?6:2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${Array.from({length:lastCol.charCodeAt(0)-64},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${[29,42,20,22,14,43,24,24,18,64,50,50,16,16,32][i]}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,i)=>values(r,i+1,styles(i),tableId?([34,20,20,8,30][i]||75):i?75:30)).join('')}</sheetData>${tableId?'<mergeCells count="3"><mergeCell ref="A1:F1"/><mergeCell ref="A2:N2"/><mergeCell ref="A3:N3"/></mergeCells>':''}${tableId?`<tableParts count="1"><tablePart r:id="${xml(tableId)}"/></tableParts>`:''}</worksheet>`;}
export async function exportWorkbook(snapshot,dest){
 const files=unzip(await fs.readFile(path.join(base,'assets/base.xlsx')));const original=files.get('xl/worksheets/sheet1.xml').toString();const historyOriginal=files.get('xl/worksheets/sheet2.xml').toString();
 const title=stylesFor(original,1),meta=stylesFor(original,2),header=stylesFor(original,5),sent=stylesFor(original,6),normal=stylesFor(original,7);const histHead=stylesFor(historyOriginal,1),histBody=stylesFor(historyOriginal,2);
 const tableId=original.match(/<(?:\w+:)?tablePart\b[^>]*\b(?:\w+:)?id="([^"]+)"/)?.[1];if(!tableId)throw Error('La plantilla no contiene la tabla de clientes.');
 const headers=['Hotel','Instagram','País','Ciudad','Idioma','Estado / acción pendiente','Último envío','Próximo contacto','No contactar','Propuesta','Motivo / evidencia','Fuente pública','Tipo','Afinidad estimada','Email'];
 const leads=snapshot.leads;const rows=[['NEXO · CLIENTES'],['Actualizado '+snapshot.generated],['Cupos internos: '+snapshot.settings.daily+'/día y '+snapshot.settings.monthly+'/mes'],[],headers,...leads.map(l=>[l.name,`https://www.instagram.com/${l.handle}/`,l.country,l.city,'Español',l.block||'Disponible',l.eventStatus==='sent'?l.last:'',l.eventStatus==='sent'?l.next:'',l.dnc?'Sí':'No',l.message,l.reason,l.source,l.demo?'DEMO FICTICIA':'Real',Number.isFinite(Number(l.score))?Number(l.score):50,l.email||''])];
 if(!leads.length)rows.push(Array(15).fill(''));
 files.set('xl/worksheets/sheet1.xml',Buffer.from(worksheet(rows,'O',i=>i===0?title:i<4?meta:i===4?header:leads[i-5]?.eventStatus==='sent'?sent:normal,tableId)));
 const history=[['Fecha UTC','Hotel','Instagram','Canal','Resultado','Confirmación','Propuesta enviada','Cuenta','Tipo'],...snapshot.history.map(e=>[e.at,e.name,e.handle,e.channel,e.status,e.receipt,e.message,e.account,e.demo?'DEMO':'Real'])];
 files.set('xl/worksheets/sheet2.xml',Buffer.from(worksheet(history,'I',i=>i?histBody:histHead)));
 for(const [name,content]of files)if(/^xl\/tables\/table\d+\.xml$/.test(name)){let table=content.toString().replace(/\bref="[^"]+"/g,`ref="A5:O${rows.length}"`);table=table.replace(/(<(?:\w+:)?tableColumns\b[^>]*\bcount=")13"/,(_,prefix)=>prefix+'15"').replace(/<\/(\w+:)?tableColumns>/,(_,prefix='')=>`<${prefix}tableColumn id="14" name="Afinidad estimada"/><${prefix}tableColumn id="15" name="Email"/></${prefix}tableColumns>`);files.set(name,Buffer.from(table));}
 await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest+'.tmp',zip(files));await fs.rename(dest+'.tmp',dest);
}
if(process.argv[2])await exportWorkbook(JSON.parse(await fs.readFile(process.argv[2],'utf8')),process.argv[3]);
