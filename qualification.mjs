import {httpUrl} from './core.mjs';
const clean=(v,n=700)=>String(v??'').trim().slice(0,n);
export const FEED_LABELS={sparse:'Pocas publicaciones',outdated:'Instagram desactualizado',incomplete:'Contenido incompleto',adequate:'Contenido suficiente',unverified:'Feed sin verificar'};
// Priority combines evidence of an operating hotel with a visible content gap.
// It deliberately does not estimate revenue, willingness to buy, or story activity.
export function qualify(raw={},sources=[],now=new Date()){
 const known=new Set(sources.map(httpUrl).filter(Boolean));const evidence=v=>known.has(httpUrl(v))?httpUrl(v):'';
 const hotelSource=evidence(raw.hotel_source),businessSource=evidence(raw.business_source),feedSource=evidence(raw.feed_source);
 const business=['operating','closed','unknown'].includes(raw.business_status)?raw.business_status:'unknown';
 const signal=['direct_booking','booking_listing','recent_reviews','direct_sales','appointments','active_catalog','none'].includes(raw.business_signal)?raw.business_signal:'none';
 const businessDetail=clean(raw.business_observation),feedDetail=clean(raw.feed_observation);
 let feed=Object.hasOwn(FEED_LABELS,raw.feed_status)?raw.feed_status:'unverified';
 const posts=Number.isInteger(raw.posts_count)&&raw.posts_count>=0?raw.posts_count:null;
 const date=/^\d{4}-\d{2}-\d{2}$/.test(raw.last_post||'')?new Date(raw.last_post+'T12:00:00Z'):null;
 const lastPost=date&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===raw.last_post&&date<=now?raw.last_post:'';
 if(!feedSource||!feedDetail||feed==='sparse'&&(posts===null||posts>12)||feed==='outdated'&&(!lastPost||now-date<90*864e5))feed='unverified';
 const hotel=raw.hotel_confirmed===true&&!!hotelSource;
 const reviewDate=/^\d{4}-\d{2}-\d{2}$/.test(raw.business_date||'')?new Date(raw.business_date+'T12:00:00Z'):null;
 const currentReview=reviewDate&&Number.isFinite(reviewDate.getTime())&&reviewDate<=now&&now-reviewDate<=365*864e5;
 const commercial=hotel&&business==='operating'&&signal!=='none'&&!!businessSource&&!!businessDetail&&(signal!=='recent_reviews'||currentReview);
 const gap=['sparse','outdated','incomplete'].includes(feed);
 const fit=clean(raw.service_fit);
 const ready=!!(commercial&&gap&&fit);
 const score=ready?Math.min(95,65+({direct_booking:15,booking_listing:10,recent_reviews:5,direct_sales:15,appointments:15,active_catalog:10}[signal]||0)+(feed==='outdated'?10:feed==='sparse'?8:5)+(fit?5:0)):commercial?40:15;
 const issues=[];if(!hotel)issues.push('Falta confirmar que sea un negocio real');if(!commercial)issues.push(business==='closed'?'Posible negocio cerrado: descartar':'Falta evidencia de actividad comercial');if(!gap)issues.push(feed==='adequate'?'No se detectó una carencia de contenido':'Falta revisar el feed');if(!fit)issues.push('Falta vincularlo con tus servicios');
 return {version:1,status:ready?'ready':'review',hotel,hotelSource,business:commercial?'operating':business,businessSignal:signal,businessSource,businessDetail,feed,feedSource,feedDetail,postsCount:posts,lastPost,stories:'unverified',fit,score,label:ready?FEED_LABELS[feed]:issues.join(' · '),checkedAt:now.toISOString(),manual:false};
}
export function auditOf(lead){try{return typeof lead.qualification==='string'?JSON.parse(lead.qualification):lead.qualification||null;}catch{return null;}}
export function auditReason(a){return [a.label,a.businessDetail,a.feedDetail,a.fit,'Historias: no verificadas.'].filter(Boolean).join(' · ');}
