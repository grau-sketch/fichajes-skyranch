import Vista from './Vista'

export const metadata = { title: 'Demo · Ficha' }

export default function DemoPersona({ params }: { params: { id: string } }) {
  return <Vista id={params.id} />
}
