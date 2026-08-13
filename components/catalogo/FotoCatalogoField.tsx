'use client'

import { useEffect, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Props = {
  fotoAtual?: string | null
  arquivo: File | null
  removida: boolean
  onArquivo: (arquivo: File | null) => void
  onRemover: () => void
  desabilitado?: boolean
}

export function FotoCatalogoField({
  fotoAtual,
  arquivo,
  removida,
  onArquivo,
  onRemover,
  desabilitado
}: Props) {
  const [previewArquivo, setPreviewArquivo] = useState<string | null>(null)

  useEffect(() => {
    if (!arquivo) {
      setPreviewArquivo(null)
      return
    }

    const url = URL.createObjectURL(arquivo)
    setPreviewArquivo(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const preview = previewArquivo || (!removida ? fotoAtual : null)

  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="aspect-square overflow-hidden rounded-2xl border bg-white">
          {preview ? (
            <img src={preview} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-400">
              <Camera size={34} />
              <span className="text-xs">Nenhuma foto selecionada</span>
            </div>
          )}
        </div>

        <div>
          <p className="font-semibold text-slate-900">Foto principal</p>
          <p className="mt-1 text-sm text-slate-500">
            JPG, PNG ou WebP. A imagem será otimizada automaticamente para o ERP e para o site.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700 ${desabilitado ? 'pointer-events-none opacity-50' : ''}`}>
              <Camera size={17} />
              Tirar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={desabilitado}
                onChange={evento => onArquivo(evento.target.files?.[0] || null)}
              />
            </label>

            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${desabilitado ? 'pointer-events-none opacity-50' : ''}`}>
              <ImagePlus size={17} />
              {preview ? 'Trocar pela galeria' : 'Escolher da galeria'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={desabilitado}
                onChange={evento => onArquivo(evento.target.files?.[0] || null)}
              />
            </label>

            {preview && (
              <Button
                type="button"
                variant="danger"
                disabled={desabilitado}
                className="flex items-center gap-2"
                onClick={onRemover}
              >
                <Trash2 size={16} /> Remover foto
              </Button>
            )}
          </div>

          {arquivo && (
            <p className="mt-3 text-xs font-medium text-green-700">
              Nova foto pronta para ser enviada ao salvar o cadastro.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
