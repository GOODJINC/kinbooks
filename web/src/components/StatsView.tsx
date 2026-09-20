import React, { useState, useEffect } from 'react'
import type { CategoryStatItem } from '../types'
import { api } from '../api'
import { ChevronLeft, ChevronRight, ChevronDown, PieChart, TrendingDown } from 'lucide-react'
import { MonthPickerModal } from './common/MonthPickerModal'

interface StatsViewProps {
  bookId: string
  currentMonth: string // YYYY-MM
  onMonthChange: (month: string) => void
}

export const StatsView: React.FC<StatsViewProps> = ({
  bookId,
  currentMonth,
  onMonthChange,
}) => {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [stats, setStats] = useState<CategoryStatItem[]>([])
  const [totalExpense, setTotalExpense] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [y, m] = currentMonth.split('-').map(Number)

  useEffect(() => {
    setIsLoading(true)
    api
      .getCategoryStats(bookId, currentMonth)
      .then((res) => {
        setStats(res.categories || [])
        setTotalExpense(res.total_expense || 0)
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false))
  }, [bookId, currentMonth])

  const handlePrevMonth = () => {
    const prev = new Date(y, m - 2, 1)
    onMonthChange(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const next = new Date(y, m, 1)
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  const formatKRW = (num: number) => num.toLocaleString('ko-KR')

  return (
    <div className="space-y-4 pb-20">
      {/* Month Header Card */}
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
              {y}년 {m}월 지출 통계
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

        {/* Total Expense Display */}
        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-800">이달의 총 지출</p>
              <p className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5">
                {formatKRW(totalExpense)}원
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {stats.length}개 카테고리
          </span>
        </div>
      </div>

      {/* Category Breakdown Card */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-4 h-4 text-blue-600" />
          <h3 className="font-extrabold text-slate-900 text-sm">카테고리별 지출 비중</h3>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold">
            통계를 분석하는 중...
          </div>
        ) : stats.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold">
            이달의 지출 내역이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Multi-segment Progress Bar */}
            <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
              {stats.map((cat) => (
                <div
                  key={cat.category_id}
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color || '#3b82f6',
                  }}
                  title={`${cat.category_name}: ${cat.percentage.toFixed(1)}%`}
                  className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                />
              ))}
            </div>

            {/* Category Rank List */}
            <div className="divide-y divide-slate-100 pt-2">
              {stats.map((cat, idx) => (
                <div key={cat.category_id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 text-slate-400 font-extrabold text-[11px] text-center">
                      {idx + 1}
                    </span>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || '#3b82f6' }}
                    />
                    <div>
                      <span className="font-bold text-slate-800 text-sm">{cat.category_name}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <span className="font-black text-slate-900 text-sm tracking-tight">
                    {formatKRW(cat.total_amount)}원
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
