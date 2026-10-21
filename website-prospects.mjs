// Read public hotel websites when a search result provides structured hotel data.
// A site's own Instagram link connects the evidence to the account; no guessed handles.
import {premiumSignals,isDirectory} from './prospecting.mjs';
import {COUNTRIES} from './geography.mjs';
export function websiteProfiles({url,html},result){
 const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const objects=[];const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}objects.push(v);if(v['@graph'])walk(v['@graph']);};
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 const hotels=objects.filter(v=>[v['@type']].flat().some(t=>/^(Hotel|Resort|Motel|LodgingBusiness)$/.test(t)));
 if(hotels.length!==1)return [];const hotel=hotels[0];if(!hotel.name||isDirectory(result.title+' '+result.snippet))return [];
 const address=hotel.address||{},country=typeof address.addressCountry==='object'?address.addressCountry.name:address.addressCountry;
 const rating=Number(hotel.starRating?.ratingValue);const stars=rating>=3&&rating<=5?rating+' estrellas':'';
 const description=clean([hotel.description,result.snippet].filter(Boolean).join(' ')).slice(0,1600);
 if(hotel.url){try{if(new URL(hotel.url,url).hostname!==new URL(url).hostname)return [];}catch{return [];}}
 const snippet=[hotel.name,stars,address.addressLocality,COUNTRIES.find(c=>c.code===country)?.name||country,description].filter(Boolean).join(', ');
 if(!premiumSignals(snippet,url).length)return [];
 const links=[...html.matchAll(/(?:href\s*=\s*["'])(https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9._]+\/?)["']/gi)].map(m=>m[1]);
 const sameAs=[hotel.sameAs||[]].flat().filter(v=>typeof v==='string'&&/^https:\/\/(www\.)?instagram\.com\//i.test(v));
 const handles=[...new Set([...sameAs,...links].map(v=>{try{const u=new URL(v);return 'https://www.instagram.com/'+u.pathname.split('/').filter(Boolean).join('/')+'/';}catch{return '';}}).filter(Boolean))];if(handles.length!==1)return [];
 const mail=typeof hotel.email==='string'?hotel.email.replace(/^mailto:/,''):'';
 return [{url:handles[0],title:clean(hotel.name),snippet:snippet+(mail?' · Contacto '+mail:''),evidenceUrl:url}];
}
