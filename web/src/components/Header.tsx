import React, { useState } from 'react'
import type { Book, User, SystemConfig } from '../types'
import { BookOpen, ChevronDown, Plus, LogOut, Settings as SettingsIcon, Shield } from 'lucide-react'

interface HeaderProps {
  user: User | null
  books: Book[]
  currentBook: Book | null
  defaultBookId: string | null
  systemConfig?: SystemConfig | null
  onSelectBook: (book: Book) => void
  onOpenCreateBook: () => void
  onOpenBookDetail: (book: Book) => void
  onOpenSettings: () => void
  onOpenAdmin?: () => void
  onLogout: () => void
}

export const Header: React.FC<HeaderProps> = ({
  user,
  books,
  currentBook,
  defaultBookId,
  systemConfig,
  onSelectBook,
  onOpenCreateBook,
  onOpenBookDetail,
  onOpenSettings,
  onOpenAdmin,
  onLogout,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const brandName = systemConfig?.app_name || 'KinBooks'

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 h-15 flex items-center justify-between">
        {/* Left: Brand & Book Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline text-slate-900">
              {brandName}
            </span>
          </div>

          {/* Book Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-sm font-semibold text-slate-800"
            >
              <span className="max-w-[130px] sm:max-w-[180px] truncate">
                {currentBook?.name || '가계부 선택'}
              </span>
              {defaultBookId === currentBook?.id && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold">
                  기본
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                {currentBook?.role || 'MEMBER'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-20 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>내 가계부 목록</span>
                    <span className="text-[10px] font-normal lowercase text-slate-400">설정 아이콘으로 상세 확인</span>
                  </div>
                  {(books || []).map((b) => {
                    const isSelected = currentBook?.id === b.id
                    const isDefault = defaultBookId === b.id

                    return (
                      <div
                        key={b.id}
                        className={`w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBook(b)
                            setDropdownOpen(false)
                          }}
                          className={`flex-1 text-left flex items-center gap-2 min-w-0 pr-2 py-1 ${
                            isSelected ? 'text-blue-600 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          <span className="text-sm truncate">{b.name}</span>
                          {isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                              기본
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                            {b.role}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDropdownOpen(false)
                            onOpenBookDetail(b)
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-100/60 transition-colors shrink-0"
                          title="가계부 상세 정보 및 설정"
                        >
                          <SettingsIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      onOpenCreateBook()
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 font-medium flex items-center gap-2 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    새 가계부 만들기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Profile Menu Only (Invite moved to Book Details) */}
        <div className="flex items-center gap-2">
          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 transition-colors flex items-center justify-center font-bold text-xs text-slate-700"
            >
              {user?.display_name?.charAt(0) || 'U'}
            </button>

            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-20">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {user?.display_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    {user?.is_admin && onOpenAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          onOpenAdmin()
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 transition-colors font-bold"
                      >
                        <Shield className="w-4 h-4 text-indigo-600" />
                        관리자 콘솔 (Admin)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        onOpenSettings()
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium"
                    >
                      <SettingsIcon className="w-4 h-4 text-slate-400" />
                      환경 설정
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        onLogout()
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
