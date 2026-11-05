import type {Metadata} from 'next';
export const metadata:Metadata={title:'Nexo · Tu agenda de oportunidades',description:'Encontrá negocios, prepará propuestas y guardá tu agenda en este dispositivo.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
