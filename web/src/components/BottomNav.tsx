import React from 'react'
import { ReceiptText, CalendarDays, Plus, Wallet, PieChart } from 'lucide-react'

export type TabType = 'timeline' | 'calendar' | 'accounts' | 'stats'

interface BottomNavProps {
  currentTab: TabType
  onSelectTab: (tab: TabType) => void
  onOpenAddModal: () => void
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddModal,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between relative">
        {/* 1. 내역 */}
        <button
          onClick={() => onSelectTab('timeline')}
          className={`flex flex-col items-center justify-center w-14 py-1 transition-colors ${
            currentTab === 'timeline' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ReceiptText className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">내역</span>
        </button>

        {/* 2. 달력 */}
        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex flex-col items-center justify-center w-14 py-1 transition-colors ${
            currentTab === 'calendar' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <CalendarDays className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">달력</span>
        </button>

        {/* 3. 중앙 플로팅 추가 버튼 */}
        <div className="relative -top-5 flex justify-center">
          <button
            onClick={onOpenAddModal}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/35 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
            aria-label="거래 추가"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. 자산 */}
        <button
          onClick={() => onSelectTab('accounts')}
          className={`flex flex-col items-center justify-center w-14 py-1 transition-colors ${
            currentTab === 'accounts' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Wallet className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">자산</span>
        </button>

        {/* 5. 통계 (기존 설정 대신 통계 탭 탑재!) */}
        <button
          onClick={() => onSelectTab('stats')}
          className={`flex flex-col items-center justify-center w-14 py-1 transition-colors ${
            currentTab === 'stats' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <PieChart className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">통계</span>
        </button>
      </div>
    </nav>
  )
}
