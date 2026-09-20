import React, { useState, useEffect } from 'react'
import { api } from '../api'
import type { Account, Transaction, CardBillingInfo } from '../types'
import {
  X,
  CreditCard,
  Building2,
  Banknote,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Layers,
} from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface AccountDetailModalProps {
  isOpen: boolean
  onClose: () => void
  account: Account | null
  bookId: string
  onEditTransaction: (tx: Transaction) => void
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  isOpen,
  onClose,
  account,
  bookId,
  onEditTransaction,
}) => {
  useEscapeKey(isOpen, onClose)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [billingInfo, setBillingInfo] = useState<CardBillingInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !account) return

    setIsLoading(true)
    const promises: Promise<any>[] = [
      api.getTransactions(bookId, { account_id: account.id }),
    ]

    if (account.type === 'CARD') {
      promises.push(api.getCardBilling(account.id).catch(() => null))
    }

    Promise.all(promises)
      .then(([txList, cardBilling]) => {
        setTransactions(txList || [])
        if (cardBilling) setBillingInfo(cardBilling)
      })
      .catch((err) => {
        console.error('Failed to load account transactions:', err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [isOpen, account, bookId])

  if (!isOpen || !account) return null

  const formatKRW = (num: number) => num.toLocaleString('ko-KR')

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) {
        const datePart = isoString.slice(0, 10)
        const timePart = isoString.slice(11, 16)
        return timePart ? `${datePart} ${timePart}` : datePart
      }
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${y}-${m}-${day} ${hours}:${minutes}`
    } catch {
      return (isoString || '').slice(0, 16).replace('T', ' ')
    }
  }

  const typeConfig: Record<string, { label: string; icon: any }> = {
    BANK: { label: '은행 계좌', icon: Building2 },
    CARD: { label: '신용/체크카드', icon: CreditCard },
    CASH: { label: '현금 지갑', icon: Banknote },
    INVESTMENT: { label: '투자 자산', icon: TrendingUp },
    LOAN: { label: '대출/부채', icon: Layers },
  }

  const TypeIcon = typeConfig[account.type]?.icon || CreditCard

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: account.color || '#3b82f6' }}
            >
              <TypeIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base">{account.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  {typeConfig[account.type]?.label || account.type}
                </span>
              </div>
              <p className="text-xs text-slate-400">계좌 상세 정보 및 거래 내역</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">현재 잔액</span>
            <span
              className={`text-lg font-black tracking-tight ${
                account.current_balance < 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {formatKRW(account.current_balance)}원
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-200/60">
            <span>초기 시작 잔액</span>
            <span className="font-medium text-slate-600">{formatKRW(account.initial_balance)}원</span>
          </div>

          {account.type === 'CARD' && billingInfo && (
            <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">결제일 (매월)</span>
                <span className="font-bold text-blue-600">{account.billing_day}일</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">다음 결제 예정액</span>
                <span className="font-bold text-rose-500">
                  {formatKRW(billingInfo.estimated_billing)}원
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              해당 계좌 거래 내역 ({transactions.length}건)
            </span>
            <span className="text-[11px] text-slate-400">클릭하여 수정/삭제</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">
                거래 내역을 불러오는 중...
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                해당 계좌로 기록된 거래 내역이 없습니다.
              </div>
            ) : (
              transactions.map((t) => {
                const isExpense = t.type === 'EXPENSE'
                const isIncome = t.type === 'INCOME'
                const isTransfer = t.type === 'TRANSFER'
                const catName = t.entries?.find((e) => e.category)?.category?.name || '미분류'

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      onClose()
                      onEditTransaction(t)
                    }}
                    className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isExpense
                            ? 'bg-rose-50 text-rose-500'
                            : isIncome
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {isExpense && <ArrowUpRight className="w-4 h-4" />}
                        {isIncome && <ArrowDownLeft className="w-4 h-4" />}
                        {isTransfer && <ArrowRightLeft className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {t.payee}
                          </p>
                          {t.receipt_img_url && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold">
                              영수증
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {formatDateTime(t.transacted_at)}
                          </span>
                          <span>·</span>
                          <span>{isTransfer ? '계좌 이체' : catName}</span>
                        </div>
                        {t.memo && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{t.memo}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-xs font-black ${
                        isExpense
                          ? 'text-rose-500'
                          : isIncome
                          ? 'text-blue-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {isExpense ? '-' : isIncome ? '+' : ''}
                      {formatKRW(t.amount)}원
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
