import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

export default function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (barcode: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [manualFallback, setManualFallback] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const zxingRef = useRef<any>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)
  const scanningRef = useRef(true)

  useEffect(() => {
    let mounted = true

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        if ('BarcodeDetector' in window) {
          detectorRef.current = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
          })
          scanLoop()
          return
        }

        // Safari/iOS nao tem BarcodeDetector (e so do Chromium). Sem isto o
        // iPhone abria a camera e caia direto na digitacao manual. O ZXing
        // decodifica em JS; so carrega aqui pra nao pesar quem tem o nativo.
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (!mounted) return
          const reader = new BrowserMultiFormatReader()
          zxingRef.current = reader
          const controls = await reader.decodeFromVideoElement(videoRef.current!, (result) => {
            if (!result || !scanningRef.current) return
            scanningRef.current = false
            onResult(result.getText())
          })
          zxingControlsRef.current = controls
        } catch {
          if (!mounted) return
          setManualFallback(true)
          setError('Nao foi possivel iniciar a leitura. Digite o codigo manualmente.')
        }
      } catch {
        if (!mounted) return
        setManualFallback(true)
        setError('Camera nao disponivel. Digite o codigo manualmente.')
      }
    }

    const scanLoop = async () => {
      if (!mounted || !scanningRef.current) return
      const video = videoRef.current
      const detector = detectorRef.current
      if (!video || !detector || video.readyState < 2) {
        requestAnimationFrame(scanLoop)
        return
      }
      try {
        const barcodes = await detector.detect(video)
        if (barcodes.length > 0 && scanningRef.current) {
          scanningRef.current = false
          const code = barcodes[0].rawValue
          onResult(code)
          return
        }
      } catch { /* ignore detection errors */ }
      if (mounted && scanningRef.current) {
        requestAnimationFrame(scanLoop)
      }
    }

    startCamera()

    return () => {
      mounted = false
      scanningRef.current = false
      // Sem parar o ZXing a camera continua ligada depois de fechar o modal.
      zxingControlsRef.current?.stop()
      zxingControlsRef.current = null
      zxingRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [onResult])

  if (manualFallback) {
    return (
      <div className="space-y-4">
        {error && <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">{error}</p>}
        <input
          type="text"
          inputMode="numeric"
          placeholder="Digite o codigo de barras"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && manualCode.trim() && onResult(manualCode.trim())}
          autoFocus
          className="w-full h-12 px-4 rounded-xl border border-gray-200 text-lg text-center tracking-widest focus:outline-none focus:border-brand-500"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium">
            Cancelar
          </button>
          <button
            onClick={() => manualCode.trim() && onResult(manualCode.trim())}
            disabled={!manualCode.trim()}
            className="flex-1 h-12 rounded-xl bg-brand-500 text-white font-semibold disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3/4 h-1/3 border-2 border-white/60 rounded-xl" />
        </div>
        <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <Camera size={12} />
          Aponte para o codigo
        </div>
      </div>
      <button onClick={onClose} className="w-full h-11 rounded-xl border border-gray-200 text-gray-600 font-medium flex items-center justify-center gap-2">
        <X size={16} />
        Fechar Camera
      </button>
    </div>
  )
}
