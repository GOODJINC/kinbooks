import React, { useState } from 'react'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface ReceiptViewerModalProps {
  isOpen: boolean
  imageUrl: string | null
  title?: string
  onClose: () => void
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  isOpen,
  imageUrl,
  title = '영수증 원본 확인',
  onClose,
}) => {
  useEscapeKey(isOpen, onClose)

  const [scale, setScale] = useState(1)

  if (!isOpen || !imageUrl) return null

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5))
  const handleResetZoom = () => setScale(1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-700/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 text-white z-10">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">{title}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="축소"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="확대"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <a
              href={imageUrl}
              download="receipt.webp"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="다운로드 / 새 창에서 열기"
            >
              <Download className="w-4 h-4" />
            </a>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="닫기 (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[320px] max-h-[78vh] bg-slate-950/50 select-none">
          <img
            src={imageUrl}
            alt="영수증 사진"
            style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
            className="max-w-full max-h-full object-contain rounded-xl shadow-lg cursor-grab active:cursor-grabbing"
            onDoubleClick={handleResetZoom}
          />
        </div>

        {/* Bottom hint */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800/80 text-center text-[11px] text-slate-400">
          더블 클릭 시 원래 크기로 복원됩니다 · ESC 키를 눌러 닫을 수 있습니다
        </div>
      </div>
    </div>
  )
}
