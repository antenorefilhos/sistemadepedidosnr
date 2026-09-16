import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

export function Toast({ tone, message, onClose }: { tone: 'success' | 'error'; message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  const cls = tone === 'success'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-red-50 border-red-200 text-red-800'
  return (
    <div className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg ${cls} max-w-md`}>
      {tone === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <p className="text-sm">{message}</p>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}
