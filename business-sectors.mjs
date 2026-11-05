export const GENERAL_COMMERCE='Comercios en general';
export const LODGING_SECTORS=['Hoteles','Hoteles boutique','Resorts','Posadas','Apart hoteles','Hostales'];
export const COMMERCE_TERMS=['tienda','cafetería','ferretería','indumentaria','restaurante','peluquería','panadería','librería','perfumería','gimnasio','mueblería','veterinaria','joyería','florería','almacén','óptica','juguetería','repuestos','decoración','calzado','tecnología','estética','pastelería','inmobiliaria','turismo','clínica','negocio local'];
export const sectorList=value=>[...new Set(String(value||'').split(/\s*,\s*/).filter(Boolean).map(v=>v==='Comercios'?GENERAL_COMMERCE:v))];
export const lodgingOnly=value=>{const list=sectorList(value);return list.length>0&&list.every(v=>LODGING_SECTORS.includes(v));};
export const generalCommerce=value=>sectorList(value).includes(GENERAL_COMMERCE);
export const normalizeSector=value=>sectorList(value).join(', ');
