import React, { useState, useEffect } from 'react'
import { api } from '../api'
import type { Book, BookMemberRole } from '../types'
import {
  X,
  BookOpen,
  Star,
  Users,
  UserPlus,
  Copy,
  Check,
  Save,
  ShieldCheck,
  Calendar,
  Coins,
  CheckCircle2,
} from 'lucide-react'

import { useEscapeKey } from '../hooks/useEscapeKey'

interface BookDetailModalProps {
  isOpen: boolean
  onClose: () => void
  book: Book | null
  isDefault: boolean
  onSetDefault: (bookId: string) => void
  onBookUpdated: (updatedBook: Book) => void
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  isOpen,
  onClose,
  book,
  isDefault,
  onSetDefault,
  onBookUpdated,
}) => {
  useEscapeKey(isOpen, onClose)

  const isViewer = book?.role === 'VIEWER'

  const [name, setName] = useState(book?.name || '')
  const [description, setDescription] = useState(book?.description || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Full book details (including members)
  const [fullBook, setFullBook] = useState<Book | null>(null)
  const [isLoadingBook, setIsLoadingBook] = useState(true)

  // Invitation link state
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isOpen || !book) return

    setName(book.name)
    setDescription(book.description || '')
    setInviteUrl(null)
    setSaveSuccess(false)
    setIsLoadingBook(true)

    api
      .getBook(book.id)
      .then((data) => {
        setFullBook(data)
        if (data.description !== undefined) {
          setDescription(data.description || '')
        }
      })
      .catch((err) => {
        console.error('Failed to fetch full book details:', err)
      })
      .finally(() => {
        setIsLoadingBook(false)
      })
  }, [book?.id, book?.name, book?.description, isOpen])

  // Save Book Info
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!book) return
    if (!name.trim()) {
      alert('가계부 이름을 입력해주세요.')
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const updated = await api.updateBook(book.id, {
        name: name.trim(),
        description: description.trim(),
      })
      onBookUpdated(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err: any) {
      alert(`가계부 수정 실패: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Generate Invite Link
  const handleGenerateInvite = async () => {
    if (!book) return
    setIsGeneratingInvite(true)
    try {
      const res = await api.createInvitation(book.id, inviteRole)
      const fullUrl = `${window.location.origin}/?token=${res.token}`
      setInviteUrl(fullUrl)
    } catch (err: any) {
      alert(`초대 링크 생성 실패: ${err.message}`)
    } finally {
      setIsGeneratingInvite(false)
    }
  }

  const handleCopyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const roleLabelMap: Record<BookMemberRole, { label: string; badge: string }> = {
    OWNER: { label: '소유자', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    EDITOR: { label: '편집자', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    VIEWER: { label: '뷰어', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  }

  if (!isOpen || !book) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">가계부 상세 및 설정</h3>
              <p className="text-xs text-slate-400">가계부 정보 확인, 기본 가계부 지정 및 멤버 관리</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 pt-4">
          {/* 1. Default Ledger Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${isDefault ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                <Star className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">기본 가계부 지정</h4>
                  {isDefault && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      기본 지정됨
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  앱을 실행할 때 항상 우선적으로 열리는 가계부로 설정합니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSetDefault(book.id)}
              disabled={isDefault}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                isDefault
                  ? 'bg-amber-500 text-white cursor-default shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-700 border border-slate-300'
              }`}
            >
              {isDefault ? '기본 가계부' : '기본으로 설정'}
            </button>
          </div>

          {/* 2. Basic Info & Description Edit Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                가계부 정보
              </h4>
              {saveSuccess && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 저장 완료!
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                가계부 이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isViewer}
                placeholder="가계부 이름을 입력하세요"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                가계부 설명 및 메모
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isViewer}
                rows={2}
                placeholder="예: 2026년 우리 가족 생활비 및 목표 저축 가계부"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100 resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Read-only metadata chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                <Coins className="w-3.5 h-3.5 text-slate-400" />
                <span>통화: {book.currency || 'KRW'}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>내 권한: {roleLabelMap[book.role || 'EDITOR']?.label || book.role}</span>
              </div>
              {book.created_at && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>생성일: {book.created_at.slice(0, 10)}</span>
                </div>
              )}
            </div>

            {!isViewer && (
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? '저장 중...' : '정보 저장'}
                </button>
              </div>
            )}
          </form>

          {/* 3. Members List */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  참여 중인 인원 ({fullBook?.members?.length || (isLoadingBook ? '...' : 1)}명)
                </h4>
              </div>
            </div>

            {isLoadingBook ? (
              <div className="py-4 text-center text-xs text-slate-400">
                멤버 목록을 불러오는 중...
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {fullBook?.members && fullBook.members.length > 0 ? (
                  fullBook.members.map((m) => {
                    const roleInfo = roleLabelMap[m.role] || { label: m.role, badge: 'bg-slate-100 text-slate-700' }
                    return (
                      <div key={m.id} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                            {m.user?.display_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {m.user?.display_name || '이름 없음'}
                            </p>
                            <p className="text-[11px] text-slate-400">{m.user?.email}</p>
                          </div>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${roleInfo.badge}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-slate-400 py-2">등록된 멤버 정보가 없습니다.</p>
                )}
              </div>
            )}
          </div>

          {/* 4. Family Sharing & Invite Link */}
          {!isViewer && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900">가족 및 동반자 초대 링크</h4>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                초대 링크를 생성하여 가족이나 동반자에게 보내면 가계부에 함께 참여할 수 있습니다. (링크 7일간 유효)
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => setInviteRole('EDITOR')}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                        inviteRole === 'EDITOR'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      편집 권한 (입력/수정)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteRole('VIEWER')}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                        inviteRole === 'VIEWER'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      조회 권한 (보기 전용)
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    disabled={isGeneratingInvite}
                    className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingInvite ? '생성 중...' : '링크 생성'}
                  </button>
                </div>

                {inviteUrl && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-900">생성된 초대 링크:</span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>복사됨!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>복사하기</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="w-full bg-white px-3 py-1.5 rounded-lg border border-blue-200 text-xs text-slate-700 select-all font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
