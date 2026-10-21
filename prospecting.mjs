export const COUNTRY_CITIES={
 ES:['Madrid','Barcelona','Marbella','Málaga','Sevilla','Valencia','Granada','Alicante','Benidorm','Palma de Mallorca','Ibiza','San Sebastián','Bilbao','Santander','Salamanca','Toledo','Segovia','Cádiz','Estepona','Ronda','Sitges','Girona','Tarragona','Lanzarote','Tenerife','Costa Adeje','Gran Canaria','Las Palmas','Oviedo','Gijón','Burgos','Valladolid','Almería','Murcia','Jerez de la Frontera','Puerto de la Cruz','Torremolinos','Nerja','León','Santiago de Compostela'],
 AR:['Buenos Aires','Mar del Plata','Mendoza','San Carlos de Bariloche','Puerto Iguazú','Ushuaia','El Calafate','Villa Carlos Paz','Salta','San Martín de los Andes','Villa La Angostura','Pinamar','Cariló','San Rafael','Tucumán','San Miguel de Tucumán','Yerba Buena','Tafí Viejo','Tafí del Valle'],
 UY:['Montevideo','Punta del Este','Colonia del Sacramento','Piriápolis','José Ignacio'],
 CL:['Santiago de Chile','Viña del Mar','Puerto Varas','San Pedro de Atacama','Pucón'],
 CO:['Bogotá','Medellín','Cartagena de Indias','Barranquilla','Pereira','Manizales'],
 MX:['Ciudad de México','Cancún','Playa del Carmen','Tulum','Puerto Vallarta','Los Cabos','Guadalajara','Aguascalientes','San Miguel de Allende'],
 PE:['Cusco','Cuzco','Arequipa','Miraflores'],BO:['Cochabamba','Santa Cruz de la Sierra'],EC:['Quito','Guayaquil','Cuenca'],PY:['Asunción','Encarnación'],PA:['Ciudad de Panamá'],CR:['San José de Costa Rica','Tamarindo'],DO:['Punta Cana','La Romana'],PR:['San Juan de Puerto Rico']
};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function premiumSignals(text,source=''){
 const s=norm(text);const signals=[];
 if(/\b(?:1|2|una|dos)\s*(?:[-–]\s*)?(?:estrellas|stars?)\b/.test(s))return signals;
 const rules=[[/\b(?:3|4|5|tres|cuatro|cinco)\s*(?:[-–]\s*)?(?:estrellas|stars?|star\b)|\b[345]\s*[★⭐*]|[★⭐]{3,5}/,'Categoría de 3 a 5 estrellas'],[/\bluxury\b|\blujo\b|\bgran lujo\b/,'Oferta de lujo'],[/\bmichelin\b/,'Mención Michelin'],[/\bboutique\b[\s\S]{0,160}\b(?:spa|gourmet|suites|golf)\b|\b(?:spa|gourmet|suites|golf)\b[\s\S]{0,160}\bboutique\b/,'Boutique con servicios de categoría'],[/\b(?:resort|hotel)\b[\s\S]{0,100}\b(?:golf|private beach|playa privada)\b/,'Servicios de resort'],[/\b(?:[5-9]\d|[1-9]\d{2,})\s+(?:habitaciones|rooms|suites)\b/,'Escala comercial publicada']];
 for(const [re,label]of rules){const match=s.match(re);if(match)signals.push({label,excerpt:match[0].slice(0,200),source});}
 return signals;
}
export const isDirectory=text=>/gu[ií]a de hoteles|directorio de hoteles|agregador|travel\s*(?:\||\/)?[\s\S]{0,80}\btips\b|find hotel deals|hotel deals in|travel blogger|asesoramos y gestionamos sus reservas|recomendaciones de hoteles|alquiler vacacional apartamentos y hoteles/i.test(text);
