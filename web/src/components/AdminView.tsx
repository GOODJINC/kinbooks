import React, { useState, useEffect } from 'react'
import { api } from '../api'
import type { AdminUser } from '../types'
import {
  Shield,
  Layers,
  Settings,
  Mail,
  Users,
  CheckCircle2,
  Save,
  ArrowLeft,
  Send,
  Sparkles,
  Camera,
  Key,
} from 'lucide-react'

interface AdminViewProps {
  onBack: () => void
  onRefreshSystemConfig: () => void
}

type AdminTab = 'general' | 'modules' | 'mail' | 'users'

export const AdminView: React.FC<AdminViewProps> = ({ onBack, onRefreshSystemConfig }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('general')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Test mail state
  const [testMailRecipient, setTestMailRecipient] = useState('')
  const [isSendingMail, setIsSendingMail] = useState(false)
  const [mailStatusMsg, setMailStatusMsg] = useState('')

  const loadAdminData = async () => {
    setIsLoading(true)
    try {
      const [sets, userList] = await Promise.all([
        api.getAdminSettings(),
        api.getAdminUsers(),
      ])
      setSettings(sets)
      setUsers(userList)
    } catch (err: any) {
      alert(`관리자 데이터 조회 실패: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const updated = await api.updateAdminSettings(settings)
      setSettings(updated)
      onRefreshSystemConfig()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err: any) {
      alert(`설정 저장 실패: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleUserAdmin = async (u: AdminUser) => {
    try {
      const updated = await api.updateAdminUser(u.id, { is_admin: !u.is_admin })
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)))
    } catch (err: any) {
      alert(`관리자 권한 변경 실패: ${err.message}`)
    }
  }

  const handleToggleUserActive = async (u: AdminUser) => {
    try {
      const updated = await api.updateAdminUser(u.id, { is_active: !u.is_active })
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)))
    } catch (err: any) {
      alert(`계정 상태 변경 실패: ${err.message}`)
    }
  }

  const handleSendTestMail = async () => {
    if (!testMailRecipient.trim()) {
      alert('테스트 메일을 받을 이메일 주소를 입력해 주세요.')
      return
    }
    setIsSendingMail(true)
    setMailStatusMsg('')
    try {
      const res = await api.testAdminMail(testMailRecipient.trim())
      setMailStatusMsg(res.message || '메일 발송 성공')
    } catch (err: any) {
      setMailStatusMsg(`실패: ${err.message}`)
    } finally {
      setIsSendingMail(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-bold">관리자 콘솔을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="가계부 화면으로 돌아가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                시스템 관리자 콘솔 (Admin)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold flex items-center gap-1">
                <Shield className="w-3 h-3" /> 관리자 전용
              </span>
            </div>
            <p className="text-xs text-slate-400">
              가계부 앱 브랜딩, 서버 전역 기능 모듈, 메일 시스템 및 사용자 계정을 관리합니다.
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            저장되었습니다
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>기본 정보 & 브랜딩</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('modules')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'modules'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>서버 기능 모듈 제어</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mail')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'mail'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>메일(SMTP) 시스템</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>회원 계정 관리 ({users.length})</span>
        </button>
      </div>

      {/* Tab 1: General & Branding */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">앱 이름 & 브랜딩 설정</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              헤더 상단과 브라우저 타이틀에 표시될 서비스 명칭을 변경할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">앱 서비스 명칭</label>
              <input
                type="text"
                value={settings.app_name || ''}
                onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
                placeholder="예: 우리집 가계부, KinBooks"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">부제목 / 슬로건</label>
              <input
                type="text"
                value={settings.app_subtitle || ''}
                onChange={(e) => setSettings({ ...settings, app_subtitle: e.target.value })}
                placeholder="예: 초경량 가족 가계부"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">로고 / 아이콘 이미지 URL (선택)</label>
            <input
              type="text"
              value={settings.app_logo_url || ''}
              onChange={(e) => setSettings({ ...settings, app_logo_url: e.target.value })}
              placeholder="https://example.com/logo.png 또는 비워둠"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">신규 사용자 회원가입 허용</p>
              <p className="text-[11px] text-slate-400">비활성화 시 기존 사용자만 로그인할 수 있습니다.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_registration === 'true'}
                onChange={(e) => setSettings({ ...settings, allow_registration: e.target.checked ? 'true' : 'false' })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '저장 중...' : '브랜딩 설정 저장'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Feature Modules Control */}
      {activeTab === 'modules' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">서버 전역 기능 모듈 활성화</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              여기서 기능을 비활성화하면, 일반 사용자의 환경 설정 메뉴에서도 해당 기능이 완전히 숨겨집니다.
            </p>
          </div>

          <div className="space-y-4 divide-y divide-slate-100">
            {/* 1. Receipt Compression */}
            <div className="pt-3 first:pt-0 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">영수증 WebP 자동 압축 모듈</h4>
                  <p className="text-[11px] text-slate-400">
                    스마트폰 고용량 사진을 80~150KB 수준의 WebP로 압축하여 홈서버 디스크를 절약합니다.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_receipt_compression === 'true'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enable_receipt_compression: e.target.checked ? 'true' : 'false',
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            {/* 2. Home Server Local AI */}
            <div className="pt-3 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">홈서버 로컬 AI 자연어 파서 연동</h4>
                  <p className="text-[11px] text-slate-400">
                    Ollama, vLLM 등의 로컬 LLM을 통한 자연어 거래 입력 지원 여부입니다. 비활성화 시 사용자 설정에서 숨겨집니다.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_local_ai === 'true'}
                  onChange={(e) =>
                    setSettings({ ...settings, enable_local_ai: e.target.checked ? 'true' : 'false' })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>

            {/* 3. API Key & MCP */}
            <div className="pt-3 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">외부 연동 API Key & MCP Server</h4>
                  <p className="text-[11px] text-slate-400">
                    텔레그램 봇, Antigravity CLI, 외부 AI가 가계부에 접근하는 API Key 및 MCP 기능 허용 여부입니다.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_mcp === 'true'}
                  onChange={(e) =>
                    setSettings({ ...settings, enable_mcp: e.target.checked ? 'true' : 'false' })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '저장 중...' : '모듈 설정 저장'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Mail (SMTP) Settings */}
      {activeTab === 'mail' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">SMTP 메일 서버 연동</h3>
                <p className="text-xs text-slate-400">
                  비밀번호 재설정이나 알림 전송을 위한 SMTP 메일 발신 서버를 설정합니다.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smtp_enabled === 'true'}
                  onChange={(e) =>
                    setSettings({ ...settings, smtp_enabled: e.target.checked ? 'true' : 'false' })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">SMTP 호스트 (Host)</label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={settings.smtp_host || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">SMTP 포트 (Port)</label>
                <input
                  type="text"
                  placeholder="587"
                  value={settings.smtp_port || '587'}
                  onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">SMTP 계정 ID / 이메일</label>
                <input
                  type="text"
                  placeholder="example@gmail.com"
                  value={settings.smtp_username || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">SMTP 비밀번호 / 앱 비밀번호</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={settings.smtp_password || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">발신자 이메일 주소 (From Email)</label>
              <input
                type="text"
                placeholder="noreply@kinbooks.app"
                value={settings.smtp_from_email || ''}
                onChange={(e) => setSettings({ ...settings, smtp_from_email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '저장 중...' : '메일 설정 저장'}
              </button>
            </div>
          </form>

          {/* Test Mail Form */}
          <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Send className="w-4 h-4 text-blue-600" />
              SMTP 발송 테스트
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="수신할 이메일 주소"
                value={testMailRecipient}
                onChange={(e) => setTestMailRecipient(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSendTestMail}
                disabled={isSendingMail}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
              >
                {isSendingMail ? '발송 중...' : '테스트 발송'}
              </button>
            </div>
            {mailStatusMsg && (
              <p className="text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                {mailStatusMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: User Accounts Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">등록된 회원 계정 관리</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              각 회원의 관리자 권한 부여 및 로그인 활성/정지 상태를 설정할 수 있습니다.
            </p>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 pb-2">
                  <th className="py-2.5 px-3">사용자</th>
                  <th className="py-2.5 px-3">아이디 (ID)</th>
                  <th className="py-2.5 px-3">이메일</th>
                  <th className="py-2.5 px-3">가입일</th>
                  <th className="py-2.5 px-3 text-center">관리자 권한</th>
                  <th className="py-2.5 px-3 text-center">계정 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                          {u.display_name?.charAt(0) || 'U'}
                        </div>
                        <span className="font-bold text-slate-900">{u.display_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-700">{u.username || '-'}</td>
                    <td className="py-3 px-3 text-slate-500">{u.email}</td>
                    <td className="py-3 px-3 text-slate-400">{u.created_at?.slice(0, 10)}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleUserAdmin(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          u.is_admin
                            ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {u.is_admin ? '★ 관리자' : '일반 회원'}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleUserActive(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          u.is_active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {u.is_active ? '정상 활성' : '이용 정지'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
