import React, { useState, useEffect } from 'react'
import type { Book, AISetting, APIKey } from '../types'
import { api } from '../api'
import { Bot, Key, Users, Copy, Check, Plus, Trash2 } from 'lucide-react'

interface SettingsViewProps {
  currentBook: Book | null
  onOpenInvite: () => void
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentBook,
  onOpenInvite,
}) => {
  // AI Settings State
  const [aiSetting, setAiSetting] = useState<AISetting>({
    is_enabled: true,
    base_url: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
  })
  const [isAiSaving, setIsAiSaving] = useState(false)

  // API Keys State
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null)
  const [isKeyCopied, setIsKeyCopied] = useState(false)

  // Load Settings & Keys
  useEffect(() => {
    api.getAISettings().then(setAiSetting).catch(() => {})
    api.getAPIKeys().then(setApiKeys).catch(() => {})
  }, [])

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
      alert('API Key 이름을 입력해 주세요.')
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
      const keys = await api.getAPIKeys()
      setApiKeys(keys)
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setIsKeyCopied(true)
    setTimeout(() => setIsKeyCopied(false), 2000)
  }

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Family Sharing Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">가족 및 공유 장부</h3>
              <p className="text-xs text-slate-400">현재 장부: {currentBook?.name}</p>
            </div>
          </div>
          <button
            onClick={onOpenInvite}
            className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            초대 링크 생성
          </button>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-2xl">
          초대 링크를 생성하여 카카오톡이나 메신저로 보내면, 가족 구성원이 링크를 통해 이 가계부에 공동 편집자로 합류할 수 있습니다.
        </p>
      </div>

      {/* 2. Generic AI Settings Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">홈서버 로컬 AI & 외부 LLM 연동</h3>
              <p className="text-xs text-slate-400">OpenAI 호환 표준 엔드포인트</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiSetting.is_enabled}
              onChange={(e) => setAiSetting({ ...aiSetting, is_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
          </label>
        </div>

        <form onSubmit={handleSaveAISetting} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              API Base URL
            </label>
            <input
              type="text"
              placeholder="http://localhost:11434/v1"
              value={aiSetting.base_url}
              onChange={(e) => setAiSetting({ ...aiSetting, base_url: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              홈서버 Ollama, vLLM, LM Studio, 또는 외부 API 주소를 입력하세요.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              모델 이름 (Model Name)
            </label>
            <input
              type="text"
              placeholder="qwen2.5:7b, gemma2:9b 등"
              value={aiSetting.model}
              onChange={(e) => setAiSetting({ ...aiSetting, model: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              API Key (로컬 LLM은 비워두세요)
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={aiSetting.api_key || ''}
              onChange={(e) => setAiSetting({ ...aiSetting, api_key: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isAiSaving}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
          >
            {isAiSaving ? '저장 중...' : 'AI 설정 저장'}
          </button>
        </form>
      </div>

      {/* 3. External API Key & MCP Integration */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">외부 연동 API Key & MCP</h3>
            <p className="text-xs text-slate-400">텔레그램 봇, Antigravity CLI 연동용</p>
          </div>
        </div>

        {/* Newly created raw key display */}
        {createdRawKey && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-800">
                발급된 API Key (지금만 표시됩니다)
              </span>
              <button
                onClick={() => copyToClipboard(createdRawKey)}
                className="text-xs font-bold text-amber-700 flex items-center gap-1 hover:underline"
              >
                {isKeyCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {isKeyCopied ? '복사됨!' : '복사'}
              </button>
            </div>
            <code className="text-[11px] bg-white p-2 rounded block break-all font-mono text-slate-800 border border-amber-100">
              {createdRawKey}
            </code>
          </div>
        )}

        {/* Create Key Form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="키 이름 (예: 텔레그램 봇)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={handleCreateAPIKey}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0"
          >
            키 발급
          </button>
        </div>

        {/* Existing Keys List */}
        <div className="space-y-2">
          {apiKeys.map((k) => (
            <div
              key={k.id}
              className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between text-xs border border-slate-100"
            >
              <div>
                <p className="font-bold text-slate-800">{k.name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{k.key_prefix}</p>
              </div>
              <button
                onClick={() => handleRevokeAPIKey(k.id)}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-colors"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. App Info */}
      <div className="text-center text-xs text-slate-400 space-y-1 pt-2">
        <p className="font-bold text-slate-600">KinBooks v1.0.0</p>
        <p>한국인 맞춤형 초경량 셀프호스팅 가계부 플랫폼</p>
      </div>
    </div>
  )
}
