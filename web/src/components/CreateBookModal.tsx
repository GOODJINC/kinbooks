import React, { useState } from 'react'
import { api } from '../api'
import type { Book } from '../types'
import { X, BookOpen } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface CreateBookModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newBook: Book) => void
}

export const CreateBookModal: React.FC<CreateBookModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  useEscapeKey(isOpen, onClose)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('KRW')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('가계부 이름을 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.createBook({
        name,
        description,
        currency,
      })
      onSuccess(res)
      onClose()
    } catch (err: any) {
      alert(`가계부 생성 실패: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">새 가계부 만들기</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              가계부(장부) 이름
            </label>
            <input
              type="text"
              placeholder="예: 우리 가족 공용 장부, 동기 모임 회비"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              설명 (선택)
            </label>
            <input
              type="text"
              placeholder="부부 공동 생활비 관리"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              기본 통화
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="KRW">대한민국 원화 (₩ KRW)</option>
              <option value="USD">미국 달러 ($ USD)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md shadow-blue-500/25 transition-all text-xs sm:text-sm mt-2 disabled:opacity-50"
          >
            {isSubmitting ? '생성 중...' : '가계부 생성하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
