import React, { useState, useEffect, useRef } from 'react'
import type { Account, Category, Transaction, TransactionType, ReceiptSettings } from '../types'
import { api } from '../api'
import { processReceiptImage } from '../utils/imageCompress'
import {
  X,
  CreditCard,
  Check,
  Delete,
  Camera,
  FileText,
  Image as ImageIcon,
  Calculator,
  Layers,
  Calendar,
  Tag,
} from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ReceiptViewerModal } from './common/ReceiptViewerModal'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  bookId: string
  accounts: Account[]
  categories: Category[]
  initialTransaction?: Transaction | null // When editing
  receiptSettings: ReceiptSettings
  onSuccess: () => void
}

const toLocalISOString = (dateOrStr?: string | Date) => {
  const d = dateOrStr ? new Date(dateOrStr) : new Date()
  if (isNaN(d.getTime())) return ''
  const offsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16)
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  bookId,
  accounts,
  categories,
  initialTransaction,
  receiptSettings,
  onSuccess,
}) => {
  useEscapeKey(isOpen, onClose)

  const isEditMode = !!initialTransaction
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  const [showKeypad, setShowKeypad] = useState(false)
  const [isReceiptViewerOpen, setIsReceiptViewerOpen] = useState(false)

  const [txType, setTxType] = useState<TransactionType>(initialTransaction?.type || 'EXPENSE')
  const [amountStr, setAmountStr] = useState(
    initialTransaction ? String(initialTransaction.amount) : '0'
  )
  const [payee, setPayee] = useState(initialTransaction?.payee || '')
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (initialTransaction?.entries) {
      const accEntry = initialTransaction.entries.find((e) => e.account_id)
      if (accEntry?.account_id) return accEntry.account_id
    }
    return accounts[0]?.id || ''
  })
  const [selectedToAccountId, setSelectedToAccountId] = useState<string>(() => {
    if (initialTransaction?.type === 'TRANSFER' && initialTransaction.entries && initialTransaction.entries.length > 1) {
      const toEntry = initialTransaction.entries.find((e) => e.amount > 0 && e.account_id)
      if (toEntry?.account_id) return toEntry.account_id
    }
    return accounts[1]?.id || ''
  })
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    if (initialTransaction?.entries) {
      const catEntry = initialTransaction.entries.find((e) => e.category_id)
      if (catEntry?.category_id) return catEntry.category_id
    }
    return categories[0]?.id || ''
  })
  const [transDate, setTransDate] = useState(() => {
    return toLocalISOString(initialTransaction?.transacted_at)
  })
  const [memo, setMemo] = useState(initialTransaction?.memo || '')
  const [tags, setTags] = useState(initialTransaction?.tags || '')
  const [receiptUrl, setReceiptUrl] = useState(initialTransaction?.receipt_img_url || '')
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Reset or initialize state
  useEffect(() => {
    if (!isOpen) return

    if (initialTransaction) {
      setTxType(initialTransaction.type)
      setAmountStr(String(initialTransaction.amount))
      setPayee(initialTransaction.payee)
      setMemo(initialTransaction.memo || '')
      setTags(initialTransaction.tags || '')
      setReceiptUrl(initialTransaction.receipt_img_url || '')
      setTransDate(toLocalISOString(initialTransaction.transacted_at))

      const accEntry = initialTransaction.entries?.find((e) => e.account_id)
      if (accEntry?.account_id) {
        setSelectedAccountId(accEntry.account_id)
      } else if (accounts[0]?.id) {
        setSelectedAccountId(accounts[0].id)
      }

      const toEntry = initialTransaction.entries?.find((e) => e.amount > 0 && e.account_id)
      if (toEntry?.account_id) {
        setSelectedToAccountId(toEntry.account_id)
      } else if (accounts[1]?.id) {
        setSelectedToAccountId(accounts[1].id)
      }

      const catEntry = initialTransaction.entries?.find((e) => e.category_id)
      if (catEntry?.category_id) {
        setSelectedCategoryId(catEntry.category_id)
      } else if (categories[0]?.id) {
        setSelectedCategoryId(categories[0].id)
      }
    } else {
      // Clean reset for NEW transaction
      setTxType('EXPENSE')
      setAmountStr('0')
      setPayee('')
      setMemo('')
      setTags('')
      setReceiptUrl('')
      setTransDate(toLocalISOString())
      setSelectedAccountId(accounts[0]?.id || '')
      setSelectedToAccountId(accounts[1]?.id || accounts[0]?.id || '')
      setSelectedCategoryId(categories[0]?.id || '')
      setShowKeypad(false)
    }
  }, [isOpen, initialTransaction, accounts, categories])

  // Keypad Logic (synchronizes with amountStr)
  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setAmountStr('0')
      return
    }
    if (val === 'DEL') {
      if (amountStr.length <= 1) {
        setAmountStr('0')
      } else {
        setAmountStr(amountStr.slice(0, -1))
      }
      return
    }
    if (val === '=') {
      try {
        const sanitized = amountStr.replace(/[^0-9+\-*]/g, '')
        // eslint-disable-next-line no-eval
        const evaluated = Function(`"use strict"; return (${sanitized})`)()
        setAmountStr(String(Math.max(0, Math.floor(evaluated))))
      } catch {}
      return
    }

    if (amountStr === '0' && !['+', '-', '*'].includes(val)) {
      setAmountStr(val)
    } else {
      setAmountStr(amountStr + val)
    }
  }

  // Parse numeric amount safely
  const currentAmount = (() => {
    try {
      const sanitized = amountStr.replace(/[^0-9+\-*]/g, '')
      const evaluated = Function(`"use strict"; return (${sanitized})`)()
      return typeof evaluated === 'number' && !isNaN(evaluated) ? Math.max(0, Math.floor(evaluated)) : 0
    } catch {
      return 0
    }
  })()

  // Handle Receipt Upload with WebP compression
  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingReceipt(true)
    try {
      // Compress using canvas utility
      const processed = await processReceiptImage(file, {
        enableCompression: receiptSettings.enableCompression,
        quality: receiptSettings.quality,
      })
      const res = await api.uploadReceipt(processed)
      setReceiptUrl(res.url)
    } catch (err: any) {
      alert(`영수증 업로드 실패: ${err.message}`)
    } finally {
      setIsUploadingReceipt(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Submit Transaction
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentAmount <= 0) {
      alert('금액을 입력해 주세요.')
      amountInputRef.current?.focus()
      return
    }
    if (txType !== 'TRANSFER' && !selectedAccountId) {
      alert('결제 계좌를 선택해 주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        type: txType,
        amount: currentAmount,
        payee: payee || (txType === 'EXPENSE' ? '기타 지출' : '기타 수입'),
        transacted_at: new Date(transDate).toISOString(),
        account_id: selectedAccountId,
        to_account_id: txType === 'TRANSFER' ? selectedToAccountId : undefined,
        category_id: txType !== 'TRANSFER' ? selectedCategoryId : undefined,
        memo,
        tags,
        receipt_img_url: receiptUrl,
      }

      if (isEditMode && initialTransaction) {
        await api.updateTransaction(initialTransaction.id, payload)
      } else {
        await api.createTransaction(bookId, payload)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredCategories = categories.filter((c) =>
    txType === 'EXPENSE' ? c.type === 'EXPENSE' : c.type === 'INCOME'
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
          {/* Tabs: 지출, 수입, 이체 */}
          <div className="flex bg-slate-100 p-1 rounded-full text-xs font-bold">
            <button
              type="button"
              onClick={() => setTxType('EXPENSE')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                txType === 'EXPENSE'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              지출
            </button>
            <button
              type="button"
              onClick={() => setTxType('INCOME')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                txType === 'INCOME'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              수입
            </button>
            <button
              type="button"
              onClick={() => setTxType('TRANSFER')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                txType === 'TRANSFER'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              이체
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-extrabold text-slate-400 mr-2">
              {isEditMode ? '거래 수정' : '새 거래 기록'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Amount Input Display (Keyboard + Keypad Hybrid) */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">금액</span>
            <button
              type="button"
              onClick={() => setShowKeypad(!showKeypad)}
              className={`text-xs px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all ${
                showKeypad
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
              title="가상 계산기 키패드 열기/닫기"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{showKeypad ? '키패드 닫기' : '키패드'}</span>
            </button>
          </div>

          <div
            className="flex items-center gap-1.5 flex-1 justify-end cursor-text"
            onClick={() => {
              amountInputRef.current?.focus()
              if (isMobile) setShowKeypad(true)
            }}
          >
            <input
              ref={amountInputRef}
              type="text"
              inputMode="numeric"
              value={amountStr}
              onFocus={() => {
                if (isMobile) setShowKeypad(true)
              }}
              onChange={(e) => {
                const val = e.target.value
                setAmountStr(val === '' ? '0' : val)
              }}
              className={`text-right text-3xl sm:text-4xl font-black tracking-tight bg-transparent outline-none w-full max-w-[280px] ${
                txType === 'EXPENSE'
                  ? 'text-rose-500'
                  : txType === 'INCOME'
                  ? 'text-blue-600'
                  : 'text-emerald-600'
              }`}
              placeholder="0"
            />
            <span className="text-lg font-bold text-slate-500">원</span>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4"
          onClick={() => {
            // Clicking outside inputs can keep state clean
          }}
        >
          {/* Payee / Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              {txType === 'TRANSFER' ? '이체 설명' : '사용처 / 가맹점'}
            </label>
            <input
              type="text"
              placeholder={txType === 'EXPENSE' ? '스타벅스 강남점' : '월급'}
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" />
              {txType === 'TRANSFER' ? '보내는 계좌' : '결제 / 입금 계좌'}
            </label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => (
                <button
                  type="button"
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    selectedAccountId === acc.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Transfer To Account */}
          {txType === 'TRANSFER' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" />
                받는 계좌
              </label>
              <div className="flex flex-wrap gap-2">
                {accounts.map((acc) => (
                  <button
                    type="button"
                    key={acc.id}
                    onClick={() => setSelectedToAccountId(acc.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedToAccountId === acc.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Chips (지출/수입일 때만) */}
          {txType !== 'TRANSFER' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                카테고리 분류
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-100">
                {filteredCategories.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1 ${
                      selectedCategoryId === cat.id
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {selectedCategoryId === cat.id && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                일시
              </label>
              <input
                type="datetime-local"
                value={transDate}
                onChange={(e) => setTransDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                태그 (쉼표 구분)
              </label>
              <input
                type="text"
                placeholder="외식, 주말, 회식"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none"
              />
            </div>
          </div>

          {/* Detailed Memo / Explanation Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              상세 메모 / 설명
            </label>
            <textarea
              rows={2}
              placeholder="자세한 지출 내역이나 영수증 세부사항을 적어두세요."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Receipt Image Attachment (Module 4) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                영수증 사진 첨부
              </span>
              {receiptSettings.enableCompression && (
                <span className="text-[10px] text-emerald-600 font-semibold">
                  WebP {receiptSettings.quality}% 자동압축 적용
                </span>
              )}
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReceiptFileChange}
            />

            {receiptUrl ? (
              <div className="relative inline-block mt-1">
                <div
                  onClick={() => setIsReceiptViewerOpen(true)}
                  className="cursor-pointer group relative"
                  title="영수증 사진 크게 보기"
                >
                  <img
                    src={receiptUrl}
                    alt="영수증 미리보기"
                    className="w-24 h-24 object-cover rounded-2xl border border-slate-200 shadow-2xs group-hover:opacity-90 transition-opacity"
                  />
                  <span className="absolute bottom-1 right-1 bg-slate-900/75 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                    확대 🔍
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl('')}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600"
                  title="사진 삭제"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingReceipt}
                className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-slate-400" />
                {isUploadingReceipt ? '영수증 압축 및 업로드 중...' : '영수증 사진 촬영 또는 파일 선택'}
              </button>
            )}
          </div>
        </div>

        {/* Embedded Keypad (모바일/터치용 키패드 - 금액 입력 시 또는 토글 시만 노출) */}
        {showKeypad && (
          <div className="bg-slate-100 p-2 sm:p-2.5 border-t border-slate-200 grid grid-cols-4 gap-1.5 sm:gap-2 text-sm sm:text-base font-bold animate-in slide-in-from-bottom-2 duration-150">
            {['7', '8', '9', '+'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="py-2.5 bg-white hover:bg-slate-50 active:bg-slate-200 rounded-xl shadow-2xs text-slate-800 transition-colors"
              >
                {k}
              </button>
            ))}
            {['4', '5', '6', '-'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="py-2.5 bg-white hover:bg-slate-50 active:bg-slate-200 rounded-xl shadow-2xs text-slate-800 transition-colors"
              >
                {k}
              </button>
            ))}
            {['1', '2', '3', 'DEL'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className={`py-2.5 rounded-xl shadow-2xs transition-colors flex items-center justify-center ${
                  k === 'DEL' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                {k === 'DEL' ? <Delete className="w-5 h-5" /> : k}
              </button>
            ))}
            {['C', '0', '00', '='].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className={`py-2.5 rounded-xl shadow-2xs transition-colors ${
                  k === '='
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : k === 'C'
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    : 'bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        {/* Submit Button */}
        <div className="p-3 bg-white border-t border-slate-100">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || currentAmount <= 0}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-md shadow-blue-500/25 active:scale-98 transition-all disabled:opacity-50 text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            <span>{isEditMode ? '수정 완료' : '기록 완료'}</span>
          </button>
        </div>
      </div>

      {/* Receipt Full Viewer Modal */}
      <ReceiptViewerModal
        isOpen={isReceiptViewerOpen}
        imageUrl={receiptUrl}
        title={`${payee || '거래'} 영수증 사진`}
        onClose={() => setIsReceiptViewerOpen(false)}
      />
    </div>
  )
}
