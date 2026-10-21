import {handle} from './core.mjs';
import {ingest} from './imports.mjs';
export async function discover100({store,search,seed,progress=()=>{},save=async()=>{},cancelled=()=>false}){
 const state={status:'running',found:0,target:100,stage:'Analizando tu perfil',summary:''};const known=new Set(store.list().map(l=>l.handle));let empty=0;progress({...state});
 try{for(let batch=0;batch<10&&!cancelled()&&state.found<100;batch++){state.stage=`Buscando grupo ${batch+1} de 10`;progress({...state});const result=await search(seed,{...store.settings(),maxResults:Math.min(10,100-state.found)},[...known]);if(cancelled())break;const valid=result.leads.filter(l=>{try{return !known.has(handle(l.handle));}catch{return false;}});const count=ingest(store,valid);store.list().forEach(l=>known.add(l.handle));state.found+=count.added;state.summary=result.summary;progress({...state});await save().catch(()=>{});empty=count.added?0:empty+1;if(empty>=2)break;}
 state.status=cancelled()?'paused':'completed';state.stage=cancelled()?'Búsqueda detenida':`${state.found} clientes nuevos con evidencia. No se completan faltantes con perfiles inventados.`;
 }catch(e){state.status='failed';state.error=e.message;state.stage='La búsqueda se detuvo; los resultados obtenidos se conservaron.';}progress({...state});store.setJob('lastSearch',{...state,seed,at:new Date().toISOString()});return state;
}
