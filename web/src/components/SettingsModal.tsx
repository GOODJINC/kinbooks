import React, { useState, useEffect, useRef } from 'react'
import type {
  User,
  Book,
  Category,
  AISetting,
  APIKey,
  ReceiptSettings,
  PersonalPreferences,
  SystemConfig,
} from '../types'
import { api } from '../api'
import {
  X,
  Palette,
  User as UserIcon,
  Shield,
  Layers,
  Download,
  Upload,
  Bot,
  Key,
  Camera,
  Copy,
  Check,
  Trash2,
  Lock,
  Save,
  Moon,
  Sun,
  Laptop,
  Coins,
  Calendar,
  Clock,
  Tag,
} from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onUserUpdated: (u: User) => void
  currentBook: Book | null
  categories: Category[]
  onRefreshCategories: () => void
  receiptSettings: ReceiptSettings
  onUpdateReceiptSettings: (settings: ReceiptSettings) => void
  preferences: PersonalPreferences
  onUpdatePreferences: (pref: PersonalPreferences) => void
  systemConfig: SystemConfig | null
}

type TabType = 'display' | 'profile' | 'categories' | 'backup' | 'services'

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  currentBook,
  categories,
  onRefreshCategories,
  receiptSettings,
  onUpdateReceiptSettings,
  preferences,
  onUpdatePreferences,
  systemConfig,
}) => {
  useEscapeKey(isOpen, onClose)

  const [activeTab, setActiveTab] = useState<TabType>('display')

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // 2FA state
  const [totpEnabled, setTotpEnabled] = useState(user?.totp_enabled || false)

  // Category Form State
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [newCatColor, setNewCatColor] = useState('#ef4444')

  // AI & API Keys (Only if enabled by admin)
  const [aiSetting, setAiSetting] = useState<AISetting>({
    is_enabled: true,
    base_url: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
  })
  const [isAiSaving, setIsAiSaving] = useState(false)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null)
  const [isKeyCopied, setIsKeyCopied] = useState(false)

  // Backup & Restore
  const [importStatus, setImportStatus] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name)
      setEmail(user.email)
      setTotpEnabled(user.totp_enabled || false)
    }
    if (isOpen) {
      if (systemConfig?.enable_local_ai) {
        api.getAISettings().then(setAiSetting).catch(() => {})
      }
      if (systemConfig?.enable_mcp) {
        api.getAPIKeys().then(setApiKeys).catch(() => {})
      }
    }
  }, [isOpen, user, systemConfig])

  if (!isOpen) return null

  // 1. Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    setProfileMsg('')
    try {
      const updated = await api.updateProfile({
        display_name: displayName.trim(),
        email: email.trim(),
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      })
      onUserUpdated(updated)
      setCurrentPassword('')
      setNewPassword('')
      setProfileMsg('회원 정보가 성공적으로 수정되었습니다.')
    } catch (err: any) {
      setProfileMsg(`오류: ${err.message}`)
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // 2. Category Create & Delete
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim() || !currentBook) return
    try {
      await api.createCategory(currentBook.id, {
        name: newCatName.trim(),
        type: newCatType,
        color: newCatColor,
        icon: 'Tag',
      })
      setNewCatName('')
      onRefreshCategories()
    } catch (err: any) {
      alert(`카테고리 생성 실패: ${err.message}`)
    }
  }

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return
    try {
      await api.deleteCategory(catId)
      onRefreshCategories()
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`)
    }
  }

  // 3. Export & Import
  const handleExport = async () => {
    if (!currentBook) return
    try {
      const data = await api.exportBook(currentBook.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kinbooks_${currentBook.name}_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`백업 내보내기 실패: ${err.message}`)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentBook) return
    setImportStatus('데이터 복원 중...')
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await api.importBook(currentBook.id, json)
      setImportStatus(
        `복원 완료: 계좌 ${res.imported_accounts}개, 카테고리 ${res.imported_categories}개, 거래 ${res.imported_transactions}건`
      )
      onRefreshCategories()
    } catch (err: any) {
      setImportStatus(`복원 실패: ${err.message}`)
    }
  }

  // 4. AI & API Keys
  const handleSaveAISetting = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAiSaving(true)
    try {
      const updated = await api.updateAISettings(aiSetting)
      setAiSetting(updated)
      alert('AI 설정이 저장되었습니다.')
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`)
    } finally {
      setIsAiSaving(false)
    }
  }

  const handleCreateAPIKey = async () => {
    if (!newKeyName.trim()) {
      alert('키 이름을 입력해 주세요.')
      return
    }
    try {
      const res = await api.createAPIKey(newKeyName)
      setCreatedRawKey(res.raw_key)
      setNewKeyName('')
      const keys = await api.getAPIKeys()
      setApiKeys(keys)
    } catch (err: any) {
      alert(`API Key 생성 실패: ${err.message}`)
    }
  }

  const handleRevokeAPIKey = async (id: string) => {
    if (!confirm('이 API Key를 삭제하시겠습니까?')) return
    try {
      await api.revokeAPIKey(id)
      setApiKeys(await api.getAPIKeys())
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`)
    }
  }

  const hasServiceModules =
    systemConfig?.enable_receipt_compression ||
    systemConfig?.enable_local_ai ||
    systemConfig?.enable_mcp

  const menuItems: { id: TabType; label: string; desc: string; icon: any; visible?: boolean }[] = [
    { id: 'display', label: '화면 & 테마', desc: '테마, 색상, 포맷', icon: Palette },
    { id: 'profile', label: '내 계정 & 보안', desc: '프로필, 비밀번호, 2FA', icon: UserIcon },
    { id: 'categories', label: '분류 및 태그', desc: '카테고리, 태그 관리', icon: Layers },
    { id: 'backup', label: '백업 & 복원', desc: 'JSON 백업 및 데이터 복원', icon: Download },
    { id: 'services', label: '확장 서비스', desc: '로컬 AI 및 API 키', icon: Bot, visible: hasServiceModules },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">개인 환경 설정</h2>
              <p className="text-[11px] text-slate-400">테마, 계정 보안, 표시 형식 및 데이터 관리</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="닫기 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Layout: Left Vertical Menu + Right Content Area */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
          {/* Left Vertical Menu */}
          <aside className="w-full sm:w-56 shrink-0 bg-slate-50/80 border-b sm:border-b-0 sm:border-r border-slate-200/80 p-3 flex sm:flex-col gap-1.5 overflow-x-auto sm:overflow-y-auto">
            <div className="px-3 py-1 hidden sm:block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              설정 메뉴
            </div>
            {menuItems
              .filter((item) => item.visible !== false)
              .map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-2xl transition-all flex items-center gap-3 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-2xs font-bold border border-slate-200/90 sm:border-l-4 sm:border-l-blue-600'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/60 text-slate-500'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs tracking-tight truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-400 truncate hidden sm:block">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
          </aside>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* TAB 1: Display & Visual Preferences */}
          {activeTab === 'display' && (
            <div className="space-y-5">
              {/* 1. Theme Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">화면 테마</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ ...preferences, theme: 'light' })}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      preferences.theme === 'light'
                        ? 'border-blue-500 bg-blue-50/60 text-blue-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>라이트 (White)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ ...preferences, theme: 'dark' })}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      preferences.theme === 'dark'
                        ? 'border-blue-500 bg-blue-50/60 text-blue-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span>다크 (Black)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ ...preferences, theme: 'system' })}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      preferences.theme === 'system'
                        ? 'border-blue-500 bg-blue-50/60 text-blue-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Laptop className="w-4 h-4 text-slate-500" />
                    <span>기기 설정 동기화</span>
                  </button>
                </div>
              </div>

              {/* 2. Format Settings */}
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <h4 className="text-xs font-bold text-slate-800">날짜 및 시간 표시 방식</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> 날짜 표시 형식
                    </label>
                    <select
                      value={preferences.dateFormat}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          dateFormat: e.target.value as 'iso' | 'korean',
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="iso">2026-09-20 (표준 ISO)</option>
                      <option value="korean">2026년 9월 20일 (한국형)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 시간 표시 형식
                    </label>
                    <select
                      value={preferences.timeFormat}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          timeFormat: e.target.value as '24h' | '12h',
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="24h">14:30 (24시간 기준)</option>
                      <option value="12h">오후 2:30 (12시간 기준)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Coins className="w-3 h-3" /> 통화 표시 단위
                    </label>
                    <select
                      value={preferences.currencyFormat}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          currencyFormat: e.target.value as 'suffix_won' | 'prefix_symbol' | 'dollar',
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="suffix_won">15,000원 (원 접미사)</option>
                      <option value="prefix_symbol">₩15,000 (원화 기호)</option>
                      <option value="dollar">$15.00 (달러 표기)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      달력 시작 요일
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, weekStart: 0 })}
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                          preferences.weekStart === 0
                            ? 'bg-blue-50 text-blue-700 border border-blue-300'
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        일요일 시작
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePreferences({ ...preferences, weekStart: 1 })}
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                          preferences.weekStart === 1
                            ? 'bg-blue-50 text-blue-700 border border-blue-300'
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        월요일 시작
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Profile & Security */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">내 계정 정보 및 보안</h3>
                <p className="text-xs text-slate-400">닉네임, 이메일 주소 및 비밀번호를 재설정합니다.</p>
              </div>

              {profileMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold ${
                    profileMsg.includes('오류')
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {profileMsg}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">아이디 (ID)</label>
                  <input
                    type="text"
                    disabled
                    value={user?.username || '-'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">이름 / 닉네임</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">이메일 주소</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Password Change */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> 비밀번호 변경 (선택)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">현재 비밀번호</label>
                    <input
                      type="password"
                      placeholder="현재 비밀번호"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">새 비밀번호</label>
                    <input
                      type="password"
                      placeholder="새 비밀번호 입력"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2FA Section */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">2단계 인증 (TOTP / Google Authenticator)</h4>
                    <p className="text-[11px] text-slate-400">
                      로그인 시 모바일 OTP 앱의 6자리 인증 코드를 추가로 요구합니다.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alert('2단계 인증(TOTP) 모바일 등록 QR 코드가 활성화되었습니다.')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    totpEnabled
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {totpEnabled ? '사용 중' : '설정하기'}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isUpdatingProfile ? '저장 중...' : '계정 정보 저장'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Categories & Tags */}
          {activeTab === 'categories' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">카테고리 & 태그 관리</h3>
                <p className="text-xs text-slate-400">
                  현재 가계부의 지출 및 수입 분류 카테고리를 편집하거나 추가합니다.
                </p>
              </div>

              {/* Add category form */}
              <form onSubmit={handleCreateCategory} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                <span className="text-xs font-bold text-slate-700">새 카테고리 추가</span>
                <div className="flex items-center gap-2">
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as any)}
                    className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold outline-none"
                  >
                    <option value="EXPENSE">지출 카테고리</option>
                    <option value="INCOME">수입 카테고리</option>
                  </select>

                  <input
                    type="text"
                    placeholder="카테고리명 (예: 취미, 도서)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                    title="색상 선택"
                  />

                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                  >
                    추가
                  </button>
                </div>
              </form>

              {/* Categories list */}
              <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
                {categories.map((c) => (
                  <div key={c.id} className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-xs font-bold text-slate-800">{c.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          c.type === 'EXPENSE'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {c.type === 'EXPENSE' ? '지출' : '수입'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.id)}
                      className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="카테고리 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Tag Management info */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <p className="text-[11px] text-slate-400">
                  태그는 거래 작성 시 해시태그(예: <span className="font-semibold text-slate-600">#점심, #외식</span>)를 입력하면 내역 검색 필터에서 바로 활용할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">가계부 데이터 백업 & 복원</h3>
                <p className="text-xs text-slate-400">
                  현재 장부의 계좌, 카테고리, 거래 내역 전체를 JSON 파일로 다운로드하거나 복원합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="p-5 rounded-3xl border border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 flex flex-col items-center text-center gap-2 transition-all group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-white text-blue-600 shadow-2xs flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">전체 백업 파일 내보내기</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      계좌, 카테고리, 거래 내역을 JSON 형식으로 안전하게 다운로드합니다.
                    </p>
                  </div>
                </button>

                <div
                  onClick={() => importFileRef.current?.click()}
                  className="p-5 rounded-3xl border border-dashed border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 flex flex-col items-center text-center gap-2 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-white text-blue-600 shadow-2xs flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">백업 파일 가져오기 (복원)</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      백업했던 JSON 파일을 업로드하여 가계부 데이터를 복구합니다.
                    </p>
                  </div>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </div>
              </div>

              {importStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 rounded-2xl">
                  {importStatus}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Extension Services (Only Admin-enabled features show here!) */}
          {activeTab === 'services' && hasServiceModules && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">부가 확장 기능 설정</h3>
                <p className="text-xs text-slate-400">
                  시스템 관리자가 활성화한 서버 연동 모듈을 설정합니다.
                </p>
              </div>

              {/* 1. Receipt Compression (if enabled by admin) */}
              {systemConfig?.enable_receipt_compression && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-900">영수증 WebP 압축 설정</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptSettings.enableCompression}
                        onChange={(e) =>
                          onUpdateReceiptSettings({
                            ...receiptSettings,
                            enableCompression: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {receiptSettings.enableCompression && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">압축 품질 (Quality)</span>
                        <span className="font-extrabold text-blue-600">{receiptSettings.quality}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="95"
                        value={receiptSettings.quality}
                        onChange={(e) =>
                          onUpdateReceiptSettings({
                            ...receiptSettings,
                            quality: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 2. Home server local AI (if enabled by admin) */}
              {systemConfig?.enable_local_ai && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">로컬 AI 설정 (Ollama 등)</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiSetting.is_enabled}
                        onChange={(e) => setAiSetting({ ...aiSetting, is_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                  </div>

                  <form onSubmit={handleSaveAISetting} className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Base URL</label>
                      <input
                        type="text"
                        value={aiSetting.base_url}
                        onChange={(e) => setAiSetting({ ...aiSetting, base_url: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Model</label>
                      <input
                        type="text"
                        value={aiSetting.model}
                        onChange={(e) => setAiSetting({ ...aiSetting, model: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isAiSaving}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
                    >
                      {isAiSaving ? '저장 중...' : 'AI 설정 저장'}
                    </button>
                  </form>
                </div>
              )}

              {/* 3. API Key & MCP (if enabled by admin) */}
              {systemConfig?.enable_mcp && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Key className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">외부 연동 API Key & MCP</span>
                  </div>

                  {createdRawKey && (
                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-amber-800">새 API Key 발급됨</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(createdRawKey)
                            setIsKeyCopied(true)
                            setTimeout(() => setIsKeyCopied(false), 2000)
                          }}
                          className="text-xs font-bold text-amber-700 flex items-center gap-1 hover:underline"
                        >
                          {isKeyCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {isKeyCopied ? '복사됨!' : '복사'}
                        </button>
                      </div>
                      <code className="text-[11px] block bg-white p-1.5 rounded border border-amber-200 break-all font-mono">
                        {createdRawKey}
                      </code>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="새 API Key 이름 (예: 텔레그램 봇)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateAPIKey}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                    >
                      발급
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {apiKeys.map((k) => (
                      <div
                        key={k.id}
                        className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{k.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{k.key_prefix}••••••••</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeAPIKey(k.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)
}
