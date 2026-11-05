import {searchConfiguration} from '../../../lib/public-search';
export function GET(){return Response.json(searchConfiguration(),{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});}
