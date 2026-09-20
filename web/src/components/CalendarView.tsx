import React, { useState, useEffect } from 'react'
import type { Transaction } from '../types'
import { ChevronLeft, ChevronRight, ChevronDown, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react'
import { MonthPickerModal } from './common/MonthPickerModal'

interface CalendarViewProps {
  transactions: Transaction[]
  currentMonth: string // YYYY-MM
  onMonthChange: (month: string) => void
  onEditTransaction: (tx: Transaction) => void
  onViewReceipt?: (url: string) => void
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  transactions,
  currentMonth,
  onMonthChange,
  onEditTransaction,
  onViewReceipt,
}) => {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (today.startsWith(currentMonth)) {
      return today
    }
    return `${currentMonth}-01`
  })

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (today.startsWith(currentMonth)) {
      setSelectedDate(today)
    } else {
      setSelectedDate(`${currentMonth}-01`)
    }
  }, [currentMonth])

  const [y, m] = currentMonth.split('-').map(Number)
  const firstDayOfMonth = new Date(y, m - 1, 1).getDay() // 0 is Sunday
  const daysInMonth = new Date(y, m, 0).getDate()

  // Calculate daily totals
  const safeTransactions = Array.isArray(transactions) ? transactions : []
  const dailyTotals: Record<string, { expense: number; income: number }> = {}
  safeTransactions.forEach((t) => {
    if (!t || !t.transacted_at) return
    const dStr = t.transacted_at.slice(0, 10)
    if (!dailyTotals[dStr]) dailyTotals[dStr] = { expense: 0, income: 0 }
    if (t.type === 'EXPENSE') dailyTotals[dStr].expense += (t.amount || 0)
    if (t.type === 'INCOME') dailyTotals[dStr].income += (t.amount || 0)
  })

  // Selected date transactions
  const selectedDayTransactions = safeTransactions.filter((t) =>
    Boolean(t && t.transacted_at && t.transacted_at.startsWith(selectedDate))
  )

  const handlePrevMonth = () => {
    const prev = new Date(y, m - 2, 1)
    onMonthChange(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const next = new Date(y, m, 1)
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  const weekHeaders = ['일', '월', '화', '수', '목', '금', '토']
  const formatKRW = (num: number) => num.toLocaleString('ko-KR')

  return (
    <div className="space-y-4 pb-20">
      {/* Calendar Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-slate-200">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsMonthPickerOpen(true)}
            className="text-lg font-black text-slate-800 tracking-tight hover:text-blue-600 flex items-center gap-1.5 px-3 py-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            title="연/월 빠른 이동"
          >
            <span>
              {y}년 {m}월
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

        {/* Days of week */}
        <div className="grid grid-cols-7 mb-2 text-center text-xs font-bold">
          {weekHeaders.map((d, i) => (
            <div
              key={d}
              className={`py-1 ${
                i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-16 sm:min-h-20 p-1" />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
            const data = dailyTotals[dateStr]
            const isSelected = selectedDate === dateStr
            const isToday =
              new Date().toISOString().slice(0, 10) === dateStr

            const colIndex = (firstDayOfMonth + i) % 7
            const isSunday = colIndex === 0
            const isSaturday = colIndex === 6

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDate(dateStr)}
                className={`min-h-16 sm:min-h-20 p-1 rounded-2xl flex flex-col justify-between text-left transition-all border ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                    : isToday
                    ? 'border-indigo-200 bg-indigo-50/30'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-bold leading-none ${
                      isSunday
                        ? 'text-rose-500'
                        : isSaturday
                        ? 'text-blue-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </div>

                {/* Badges for income/expense */}
                <div className="w-full space-y-0.5 mt-1 overflow-hidden">
                  {data?.income ? (
                    <div className="text-[10px] font-bold text-blue-600 truncate bg-blue-50/80 px-1 rounded">
                      +{formatKRW(data.income)}
                    </div>
                  ) : null}
                  {data?.expense ? (
                    <div className="text-[10px] font-bold text-rose-500 truncate bg-rose-50/80 px-1 rounded">
                      -{formatKRW(data.expense)}
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Day Details Section */}
      {selectedDate && (
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="font-extrabold text-slate-800 text-sm">
              {selectedDate.slice(5, 7)}월 {selectedDate.slice(8, 10)}일 상세 내역
            </span>
            <span className="text-xs text-slate-400">
              총 {selectedDayTransactions.length}건
            </span>
          </div>

          {selectedDayTransactions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              해당 날짜에 기록된 거래가 없습니다.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {selectedDayTransactions.map((t) => {
                const isExpense = t.type === 'EXPENSE'
                const isIncome = t.type === 'INCOME'
                const isTransfer = t.type === 'TRANSFER'
                const accountName = t.entries?.find((e) => e.account)?.account?.name || '현금'
                const categoryName = t.entries?.find((e) => e.category)?.category?.name || '미분류'

                return (
                  <div
                    key={t.id}
                    onClick={() => onEditTransaction(t)}
                    className="py-3 px-2 -mx-2 flex items-center justify-between rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group"
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
                          <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
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
                        <p className="text-[11px] text-slate-400">
                          {isTransfer ? '계좌 이체' : categoryName} · {accountName}
                          {t.created_by?.display_name && (
                            <> · <span className="text-indigo-600 font-medium">{t.created_by.display_name}</span></>
                          )}
                        </p>
                        {t.memo && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {t.memo}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-sm sm:text-base font-extrabold ${
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
                  </div>
                )
              })}
            </div>
          )}
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
