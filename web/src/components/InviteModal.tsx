import React, { useState } from 'react'
import { api } from '../api'
import type { Book } from '../types'
import { X, UserPlus, Copy, Check, Link } from 'lucide-react'

import { useEscapeKey } from '../hooks/useEscapeKey'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  currentBook: Book | null
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  currentBook,
}) => {
  useEscapeKey(isOpen, onClose)

  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerateLink = async () => {
    if (!currentBook) return
    setIsLoading(true)
    try {
      const res = await api.createInvitation(currentBook.id, role)
      const fullUrl = `${window.location.origin}/join?token=${res.token}`
      setInviteUrl(fullUrl)
    } catch (err: any) {
      alert(`초대 링크 생성 실패: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (!isOpen || !currentBook) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">가족 초대 링크 생성</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          <span className="font-bold text-slate-800">[{currentBook.name}]</span> 가계부에 가족이나 동반자를 초대합니다. 초대 링크는 7일간 유효합니다.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">
              부여할 권한
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('EDITOR')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  role === 'EDITOR'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                편집자 (기본 부부)
              </button>
              <button
                type="button"
                onClick={() => setRole('VIEWER')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  role === 'VIEWER'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                조회 전용 (자녀/모임)
              </button>
            </div>
          </div>

          {!inviteUrl ? (
            <button
              type="button"
              onClick={handleGenerateLink}
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md shadow-blue-500/25 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <Link className="w-4 h-4" />
              {isLoading ? '링크 생성 중...' : '초대 링크 만들기'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <p className="text-[11px] font-bold text-blue-800 mb-1">생성된 초대 URL</p>
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="w-full bg-white px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-700 border border-blue-200 outline-none select-all"
                />
              </div>

              <button
                type="button"
                onClick={copyToClipboard}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-md transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {isCopied ? '초대 링크가 복사되었습니다!' : '카카오톡/문자로 보낼 링크 복사'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
