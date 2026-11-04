import {inflateRawSync,deflateRawSync} from 'node:zlib';
const table=Uint32Array.from({length:256},(_,i)=>{for(let n=0;n<8;n++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
export function crc32(b){let c=0xffffffff;for(const n of b)c=table[(c^n)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function unzip(buffer,{maxBytes=25e6,maxFiles=1000}={}){
 const invalid=()=>{throw Error('Estructura ZIP inválida o no compatible.');};
 const bounds=(p,n)=>{if(!Number.isSafeInteger(p)||p<0||p+n>buffer.length)invalid();};
 if(!Buffer.isBuffer(buffer)||buffer.length<22)invalid();
 let end=buffer.length-22;const first=Math.max(0,end-65535);
 while(end>=first&&(buffer.readUInt32LE(end)!==0x06054b50||end+22+buffer.readUInt16LE(end+20)!==buffer.length))end--;
 if(end<first)invalid();
 const count=buffer.readUInt16LE(end+10),size=buffer.readUInt32LE(end+12),directory=buffer.readUInt32LE(end+16);
 if(count>maxFiles)throw Error('Demasiados archivos en el Excel.');
 if(buffer.readUInt16LE(end+4)||buffer.readUInt16LE(end+6)||buffer.readUInt16LE(end+8)!==count||directory+size!==end)invalid();
 const files=new Map();let p=directory,total=0;const ranges=[];
 for(let i=0;i<count;i++){
  bounds(p,46);if(p+46>end||buffer.readUInt32LE(p)!==0x02014b50)invalid();
  const flags=buffer.readUInt16LE(p+8),method=buffer.readUInt16LE(p+10),len=buffer.readUInt32LE(p+20),rawSize=buffer.readUInt32LE(p+24),n=buffer.readUInt16LE(p+28),extra=buffer.readUInt16LE(p+30),comment=buffer.readUInt16LE(p+32),offset=buffer.readUInt32LE(p+42);
  if(flags&1||![0,8].includes(method)||buffer.readUInt16LE(p+34))invalid();
  bounds(p+46,n+extra+comment);if(p+46+n+extra+comment>end)invalid();
  const name=buffer.subarray(p+46,p+46+n).toString('utf8');
  if(!name||/[\\\x00]/.test(name)||name.startsWith('/')||name.split('/').some(s=>s==='..'||s.includes(':'))||files.has(name))invalid();
  total+=rawSize;if(total>maxBytes)throw Error('El Excel descomprimido es demasiado grande.');
  bounds(offset,30);if(buffer.readUInt32LE(offset)!==0x04034b50||buffer.readUInt16LE(offset+8)!==method||buffer.readUInt16LE(offset+6)!==flags)invalid();
  const localName=buffer.readUInt16LE(offset+26),localExtra=buffer.readUInt16LE(offset+28),start=offset+30+localName+localExtra,stop=start+len;
  bounds(offset+30,localName+localExtra+len);
  if(stop>directory||buffer.subarray(offset+30,offset+30+localName).toString('utf8')!==name||ranges.some(([a,b])=>offset<b&&stop>a))invalid();
  ranges.push([offset,stop]);const b=buffer.subarray(start,stop);
  let raw;try{raw=method===0?b:inflateRawSync(b,{maxOutputLength:Math.max(1,rawSize)});}catch{invalid();}
  if(raw.length!==rawSize||crc32(raw)!==buffer.readUInt32LE(p+16))invalid();
  files.set(name,raw);p+=46+n+extra+comment;
 }
 if(p!==end)invalid();return files;
}
export function zip(files){const chunks=[],central=[];let offset=0;for(const [name,value]of files){const n=Buffer.from(name),raw=Buffer.from(value),b=deflateRawSync(raw),crc=crc32(raw);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(b.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);chunks.push(h,n,b);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=h.length+n.length+b.length;}const directory=Buffer.concat(central);const e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(files.size,8);e.writeUInt16LE(files.size,10);e.writeUInt32LE(directory.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...chunks,directory,e]);}
