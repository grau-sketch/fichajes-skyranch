'use client'

export default function BotonImprimir({ texto = 'Imprimir / PDF' }: { texto?: string }) {
  return (
    <button type="button" className="btn no-imprimir" onClick={() => window.print()}>
      {texto}
    </button>
  )
}
