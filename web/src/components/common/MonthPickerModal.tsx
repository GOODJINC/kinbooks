import React, { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface MonthPickerModalProps {
  isOpen: boolean
  currentMonth: string // YYYY-MM
  onSelectMonth: (month: string) => void
  onClose: () => void
}

export const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  isOpen,
  currentMonth,
  onSelectMonth,
  onClose,
}) => {
  useEscapeKey(isOpen, onClose)

  const [initialYear, initialMonth] = currentMonth.split('-').map(Number)
  const [selectedYear, setSelectedYear] = useState<number>(initialYear || new Date().getFullYear())

  useEffect(() => {
    if (isOpen) {
      const [y] = currentMonth.split('-').map(Number)
      if (y) setSelectedYear(y)
    }
  }, [isOpen, currentMonth])

  if (!isOpen) return null

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  const thisMonthStr = `${thisYear}-${String(thisMonth).padStart(2, '0')}`

  const months = [
    { num: 1, label: '1월' },
    { num: 2, label: '2월' },
    { num: 3, label: '3월' },
    { num: 4, label: '4월' },
    { num: 5, label: '5월' },
    { num: 6, label: '6월' },
    { num: 7, label: '7월' },
    { num: 8, label: '8월' },
    { num: 9, label: '9월' },
    { num: 10, label: '10월' },
    { num: 11, label: '11월' },
    { num: 12, label: '12월' },
  ]

  const handlePickMonth = (mNum: number) => {
    const formatted = `${selectedYear}-${String(mNum).padStart(2, '0')}`
    onSelectMonth(formatted)
    onClose()
  }

  const handleQuickJump = (targetStr: string) => {
    onSelectMonth(targetStr)
    onClose()
  }

  // Quick preset calculations
  const lastMonthDate = new Date(thisYear, thisMonth - 2, 1)
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
  const oneYearAgoStr = `${thisYear - 1}-${String(thisMonth).padStart(2, '0')}`

  // Year options for fast dropdown
  const yearOptions: number[] = []
  for (let y = thisYear - 10; y <= thisYear + 5; y++) {
    yearOptions.push(y)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl relative border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">연도 및 월 빠른 이동</h3>
              <p className="text-[11px] text-slate-400">원하는 연도와 월을 한 번에 선택하세요</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Year Selector */}
        <div className="flex items-center justify-between px-2 py-1 mb-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSelectedYear((prev) => prev - 1)}
            className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-blue-600 shadow-2xs transition-all"
            title="이전 연도"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="font-black text-base text-slate-800 bg-transparent py-1 px-2 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSelectedYear((prev) => prev + 1)}
            className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-blue-600 shadow-2xs transition-all"
            title="다음 연도"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {months.map(({ num, label }) => {
            const isSelected =
              selectedYear === initialYear && num === initialMonth
            const isThisMonth =
              selectedYear === thisYear && num === thisMonth

            return (
              <button
                key={num}
                type="button"
                onClick={() => handlePickMonth(num)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : isThisMonth
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'
                }`}
              >
                {label}
                {isThisMonth && !isSelected && (
                  <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </button>
            )
          })}
        </div>

        {/* Quick presets */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> 빠른 바로가기:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickJump(thisMonthStr)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 font-semibold transition-colors"
            >
              이번 달
            </button>
            <button
              type="button"
              onClick={() => handleQuickJump(lastMonthStr)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 font-semibold transition-colors"
            >
              지난달
            </button>
            <button
              type="button"
              onClick={() => handleQuickJump(oneYearAgoStr)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 font-semibold transition-colors"
            >
              1년 전
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
