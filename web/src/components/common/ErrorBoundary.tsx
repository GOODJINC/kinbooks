import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  private handleReset = () => {
    window.location.reload()
  }

  private handleClearCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const reg of registrations) {
          await reg.unregister()
        }
      }
    } catch {}
    localStorage.clear()
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">화면 렌더링 중 오류가 발생했습니다</h2>
            <p className="text-xs text-slate-500 mb-4">
              아래 에러 내용을 확인하시거나 페이지를 새로고침해 보세요.
            </p>

            <div className="p-3 bg-slate-900 text-rose-300 rounded-2xl text-xs font-mono overflow-auto max-h-48 mb-6 whitespace-pre-wrap break-all">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                새로고침
              </button>
              <button
                type="button"
                onClick={this.handleClearCache}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="브라우저 캐시 및 임시 저장소 초기화"
              >
                <Trash2 className="w-4 h-4" />
                캐시 초기화
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
