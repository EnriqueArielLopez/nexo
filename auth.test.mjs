import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Accounts} from './auth.mjs';

function fixture(){
 const dir=mkdtempSync(path.join(os.tmpdir(),'nexo-auth-'));let now=1_800_000_000_000;
 const accounts=new Accounts(dir,{now:()=>now});
 const user=accounts.create('Cuenta QA','clave-ficticia-qa');
 return {accounts,user,advance:ms=>now+=ms,now:()=>now,close(){accounts.close();rmSync(dir,{recursive:true,force:true});}};
}
function fail(a,name='Cuenta QA'){assert.throws(()=>a.login(name,'incorrecta'),e=>e.code!=='LOGIN_LOCKED'&&/incorrectos/.test(e.message));}
function lock(a,name='Cuenta QA'){
 for(let i=0;i<4;i++)fail(a,name);
 let error;assert.throws(()=>a.login(name,'incorrecta'),e=>(error=e,e.code==='LOGIN_LOCKED'));return error;
}

test('cinco fallos bloquean 15 minutos; los intentos bloqueados no prolongan la espera',()=>{
 const f=fixture();try{
  const first=lock(f.accounts);
  assert.equal(first.status,429);assert.equal(first.retryAfterSeconds,900);assert.equal(first.retryAt,f.now()+900_000);
  f.advance(1_234);
  assert.throws(()=>f.accounts.login('  CUENTA QA  ','clave-ficticia-qa'),e=>e.code==='LOGIN_LOCKED'&&e.retryAt===first.retryAt&&e.retryAfterSeconds===899);
  f.advance(898_766);
  assert.equal(f.accounts.login('Cuenta QA','clave-ficticia-qa').id,f.user.id,'la credencial correcta entra en el límite exacto');
 }finally{f.close();}
});

test('al vencer el bloqueo un error nuevo no reutiliza los cinco fallos anteriores',()=>{
 const f=fixture();try{
  lock(f.accounts);f.advance(900_000);
  fail(f.accounts);fail(f.accounts);fail(f.accounts);fail(f.accounts);
  assert.throws(()=>f.accounts.login('Cuenta QA','incorrecta'),e=>e.code==='LOGIN_LOCKED'&&e.retryAfterSeconds===900);
  f.advance(900_000);fail(f.accounts);
  assert.equal(f.accounts.login('Cuenta QA','clave-ficticia-qa').id,f.user.id);
  for(let i=0;i<4;i++)fail(f.accounts);
  assert.equal(f.accounts.login('Cuenta QA','clave-ficticia-qa').id,f.user.id,'el ingreso correcto reinicia los fallos');
 }finally{f.close();}
});

test('el bloqueo se limita a la cuenta y también protege nombres inexistentes',()=>{
 const f=fixture();try{
  const second=f.accounts.create('Otra QA','otra-clave-ficticia');lock(f.accounts);
  assert.equal(f.accounts.login('Otra QA','otra-clave-ficticia').id,second.id);
  const unknown=lock(f.accounts,'No existe');assert.equal(unknown.retryAfterSeconds,900);
  assert.throws(()=>f.accounts.login('No existe','clave-ficticia-qa'),e=>e.code==='LOGIN_LOCKED');
 }finally{f.close();}
});
