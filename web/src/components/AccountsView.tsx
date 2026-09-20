import React, { useState } from 'react'
import type { Account, AccountType, Transaction } from '../types'
import { api } from '../api'
import { Building2, CreditCard, Banknote, TrendingUp, AlertCircle, Plus, X } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { AccountDetailModal } from './AccountDetailModal'

interface AccountsViewProps {
  bookId: string
  accounts: Account[]
  onRefresh: () => void
  onEditTransaction: (tx: Transaction) => void
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  bookId,
  accounts,
  onRefresh,
  onEditTransaction,
}) => {
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null)
  useEscapeKey(showAddModal, () => setShowAddModal(false))

  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<AccountType>('BANK')
  const [newAccInitBal, setNewAccInitBal] = useState('0')
  const [newAccBillingDay, setNewAccBillingDay] = useState('14')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Net worth calculation
  const safeAccounts = Array.isArray(accounts) ? accounts : []
  const totalAssets = safeAccounts
    .filter((a) => a && a.type !== 'CARD' && a.type !== 'LOAN')
    .reduce((sum, a) => sum + (a.current_balance || 0), 0)

  const totalLiabilities = safeAccounts
    .filter((a) => a && (a.type === 'CARD' || a.type === 'LOAN'))
    .reduce((sum, a) => sum + Math.abs(a.current_balance || 0), 0)

  const netWorth = totalAssets - totalLiabilities
  const formatKRW = (num?: number) => (num || 0).toLocaleString('ko-KR')

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccName.trim()) {
      alert('계좌 이름을 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.createAccount(bookId, {
        name: newAccName,
        type: newAccType,
        initial_balance: parseInt(newAccInitBal, 10) || 0,
        billing_day: parseInt(newAccBillingDay, 10) || 14,
        color: '#3b82f6',
      })
      setShowAddModal(false)
      setNewAccName('')
      setNewAccInitBal('0')
      onRefresh()
    } catch (err: any) {
      alert(`계좌 생성 실패: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'BANK':
        return <Building2 className="w-5 h-5 text-blue-600" />
      case 'CARD':
        return <CreditCard className="w-5 h-5 text-indigo-600" />
      case 'CASH':
        return <Banknote className="w-5 h-5 text-emerald-600" />
      case 'INVESTMENT':
        return <TrendingUp className="w-5 h-5 text-amber-600" />
      case 'LOAN':
        return <AlertCircle className="w-5 h-5 text-rose-500" />
    }
  }

  const getTypeName = (type: AccountType) => {
    switch (type) {
      case 'BANK':
        return '은행 통장'
      case 'CARD':
        return '카드'
      case 'CASH':
        return '현금'
      case 'INVESTMENT':
        return '투자'
      case 'LOAN':
        return '대출/부채'
    }
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Net Worth Banner */}
      <div className="bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <p className="text-xs font-semibold text-slate-400">총 순자산 (자산 - 부채)</p>
        <p className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
          {formatKRW(netWorth)}원
        </p>

        <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-700/60 text-xs">
          <div>
            <span className="text-slate-400">보유 자산</span>
            <p className="text-base font-bold text-emerald-400 mt-0.5">
              {formatKRW(totalAssets)}원
            </p>
          </div>
          <div>
            <span className="text-slate-400">카드/부채 합계</span>
            <p className="text-base font-bold text-rose-400 mt-0.5">
              {formatKRW(totalLiabilities)}원
            </p>
          </div>
        </div>
      </div>

      {/* Account List Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="font-extrabold text-slate-800 text-sm">내 계좌 목록 ({accounts.length})</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          계좌 추가
        </button>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            onClick={() => setSelectedAccountForDetail(acc)}
            className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:shadow-xs hover:border-blue-400 transition-all flex flex-col justify-between cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                  {getAccountIcon(acc.type)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {acc.name}
                  </h4>
                  <span className="text-[11px] font-medium text-slate-400">
                    {getTypeName(acc.type)}
                  </span>
                </div>
              </div>

              {acc.type === 'CARD' && acc.billing_day > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                  매월 {acc.billing_day}일 결제
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-xs text-slate-400">현재 잔액</span>
              <span
                className={`text-lg font-black tracking-tight ${
                  acc.current_balance < 0 ? 'text-rose-500' : 'text-slate-900'
                }`}
              >
                {formatKRW(acc.current_balance)}원
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">새 계좌 추가</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  계좌 / 카드 이름
                </label>
                <input
                  type="text"
                  placeholder="예: 신한카드 Mr.Life, 국민 주거래"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  계좌 유형
                </label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as AccountType)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BANK">은행 통장</option>
                  <option value="CARD">신용 / 체크카드</option>
                  <option value="CASH">현금 지갑</option>
                  <option value="INVESTMENT">주식 / 투자</option>
                  <option value="LOAN">대출 / 부채</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  초기 시작 잔액 (원)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={newAccInitBal}
                  onChange={(e) => setNewAccInitBal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {newAccType === 'CARD' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    카드 결제일 (1~31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="14"
                    value={newAccBillingDay}
                    onChange={(e) => setNewAccBillingDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md shadow-blue-500/25 transition-all text-sm mt-2"
              >
                {isSubmitting ? '추가 중...' : '계좌 등록하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Account Details & Transactions Modal */}
      <AccountDetailModal
        isOpen={!!selectedAccountForDetail}
        account={selectedAccountForDetail}
        bookId={bookId}
        onClose={() => setSelectedAccountForDetail(null)}
        onEditTransaction={onEditTransaction}
      />
    </div>
  )
}
