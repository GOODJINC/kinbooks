import React, { useState } from 'react'
import type { Transaction, MonthlySummary } from '../types'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
} from 'lucide-react'
import { MonthPickerModal } from './common/MonthPickerModal'

interface TransactionListProps {
  transactions: Transaction[]
  summary: MonthlySummary | null
  currentMonth: string // YYYY-MM
  onMonthChange: (month: string) => void
  onDeleteTransaction: (id: string) => void
  onEditTransaction: (tx: Transaction) => void
  onViewReceipt?: (url: string) => void
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  summary,
  currentMonth,
  onMonthChange,
  onDeleteTransaction,
  onEditTransaction,
  onViewReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)

  // Month Navigation
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    onMonthChange(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const next = new Date(y, m, 1)
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  // Filter Transactions
  const safeTransactions = Array.isArray(transactions) ? transactions : []
  const filtered = safeTransactions.filter((t) => {
    if (!t) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      t.payee?.toLowerCase().includes(q) ||
      t.memo?.toLowerCase().includes(q) ||
      t.tags?.toLowerCase().includes(q)
    )
  })

  // Group by Date (YYYY-MM-DD)
  const grouped: Record<string, Transaction[]> = {}
  filtered.forEach((t) => {
    if (!t) return
    const dateKey = (t.transacted_at || '').slice(0, 10) || '기타'
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(t)
  })

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const formatKRW = (num?: number) => (num || 0).toLocaleString('ko-KR')

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Month Picker & Top Summary Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setIsMonthPickerOpen(true)}
            className="text-lg font-black text-slate-800 tracking-tight hover:text-blue-600 flex items-center gap-1.5 px-3 py-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            title="연/월 빠른 이동"
          >
            <span>
              {currentMonth.split('-')[0]}년 {currentMonth.split('-')[1]}월
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Part Monthly Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="p-2 rounded-2xl bg-blue-50/50">
            <p className="text-[11px] font-bold text-slate-400">총 수입</p>
            <p className="text-sm sm:text-base font-extrabold text-blue-600 truncate mt-0.5">
              +{formatKRW(summary?.total_income || 0)}원
            </p>
          </div>
          <div className="p-2 rounded-2xl bg-rose-50/50">
            <p className="text-[11px] font-bold text-slate-400">총 지출</p>
            <p className="text-sm sm:text-base font-extrabold text-rose-500 truncate mt-0.5">
              -{formatKRW(summary?.total_expense || 0)}원
            </p>
          </div>
          <div className="p-2 rounded-2xl bg-slate-50">
            <p className="text-[11px] font-bold text-slate-400">순 저축</p>
            <p
              className={`text-sm sm:text-base font-extrabold truncate mt-0.5 ${
                (summary?.net_savings || 0) >= 0 ? 'text-slate-800' : 'text-rose-500'
              }`}
            >
              {formatKRW(summary?.net_savings || 0)}원
            </p>
          </div>
        </div>
      </div>

      {/* 2. Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="가맹점, 메모, 태그로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9.5 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* 3. Daily Timeline List */}
      {sortedDates.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <p className="text-sm font-bold text-slate-400">등록된 내역이 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1">하단의 + 버튼을 눌러 첫 지출을 기록해 보세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((dateStr) => {
            const dayTxs = grouped[dateStr]
            const dateObj = new Date(dateStr)
            const weekDays = ['일', '월', '화', '수', '목', '금', '토']
            const dayName = weekDays[dateObj.getDay()]

            // Daily expense sum
            const dailyExpense = dayTxs
              .filter((t) => t.type === 'EXPENSE')
              .reduce((sum, t) => sum + t.amount, 0)

            return (
              <div key={dateStr} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xs">
                {/* Date Header */}
                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-sm">
                      {dateStr.slice(5, 7)}월 {dateStr.slice(8, 10)}일
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        dayName === '일'
                          ? 'bg-rose-100 text-rose-600'
                          : dayName === '토'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {dayName}요일
                    </span>
                  </div>
                  {dailyExpense > 0 && (
                    <span className="font-bold text-rose-500">
                      -{formatKRW(dailyExpense)}원
                    </span>
                  )}
                </div>

                {/* Day Transactions */}
                <div className="divide-y divide-slate-100">
                  {dayTxs.map((t) => {
                    const isExpense = t.type === 'EXPENSE'
                    const isIncome = t.type === 'INCOME'
                    const isTransfer = t.type === 'TRANSFER'

                    const accountName = t.entries?.find((e) => e.account)?.account?.name || '현금'
                    const categoryName = t.entries?.find((e) => e.category)?.category?.name || '미분류'

                    return (
                      <div
                        key={t.id}
                        onClick={() => onEditTransaction(t)}
                        className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                              isExpense
                                ? 'bg-rose-50 text-rose-500'
                                : isIncome
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {isExpense && <ArrowUpRight className="w-5 h-5" />}
                            {isIncome && <ArrowDownLeft className="w-5 h-5" />}
                            {isTransfer && <ArrowRightLeft className="w-5 h-5" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-slate-900 leading-snug">
                                {t.payee}
                              </p>
                              {t.receipt_img_url && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onViewReceipt?.(t.receipt_img_url!)
                                  }}
                                  className="px-1.5 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[9px] font-bold cursor-pointer transition-colors"
                                  title="영수증 사진 크게 보기"
                                >
                                  영수증 🔍
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <span>{isTransfer ? '계좌 이체' : categoryName}</span>
                              <span>·</span>
                              <span>{accountName}</span>
                              {t.created_by?.display_name && (
                                <>
                                  <span>·</span>
                                  <span className="text-indigo-600 font-medium">
                                    {t.created_by.display_name}
                                  </span>
                                </>
                              )}
                            </div>
                            {t.memo && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {t.memo}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Amount & Delete */}
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-sm sm:text-base font-extrabold tracking-tight ${
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

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('이 거래를 삭제하시겠습니까?')) {
                                onDeleteTransaction(t.id)
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fast Month Picker Modal */}
      <MonthPickerModal
        isOpen={isMonthPickerOpen}
        currentMonth={currentMonth}
        onSelectMonth={onMonthChange}
        onClose={() => setIsMonthPickerOpen(false)}
      />
    </div>
  )
}
