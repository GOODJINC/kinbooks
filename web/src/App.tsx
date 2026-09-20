import { useState, useEffect, useCallback } from 'react'
import { api, clearToken } from './api'
import type {
  User,
  Book,
  Account,
  Category,
  Transaction,
  MonthlySummary,
  ReceiptSettings,
  PersonalPreferences,
  SystemConfig,
} from './types'
import { Header } from './components/Header'
import { BottomNav, type TabType } from './components/BottomNav'
import { TransactionList } from './components/TransactionList'
import { CalendarView } from './components/CalendarView'
import { AccountsView } from './components/AccountsView'
import { StatsView } from './components/StatsView'
import { TransactionModal } from './components/TransactionModal'
import { AuthModal } from './components/AuthModal'
import { CreateBookModal } from './components/CreateBookModal'
import { BookDetailModal } from './components/BookDetailModal'
import { InviteModal } from './components/InviteModal'
import { SettingsModal } from './components/SettingsModal'
import { AdminView } from './components/AdminView'
import { ReceiptViewerModal } from './components/common/ReceiptViewerModal'
import { BookOpen } from 'lucide-react'

const defaultPreferences: PersonalPreferences = {
  theme: 'system',
  expenseColor: '#ef4444',
  incomeColor: '#10b981',
  currencyFormat: 'suffix_won',
  dateFormat: 'iso',
  timeFormat: '24h',
  weekStart: 0,
}

export function App() {
  // User & Auth
  const [user, setUser] = useState<User | null>(null)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Public System Config
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null)

  // Admin View State
  const [isAdminViewOpen, setIsAdminViewOpen] = useState<boolean>(() => {
    return window.location.pathname === '/admin' || window.location.hash === '#admin'
  })

  // Ledgers / Books
  const [books, setBooks] = useState<Book[]>([])
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [defaultBookId, setDefaultBookId] = useState<string | null>(() => {
    return localStorage.getItem('kinbooks_default_book_id')
  })

  // Navigation & Views (timeline, calendar, accounts, stats)
  const [currentTab, setCurrentTab] = useState<TabType>('timeline')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Book Data
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<MonthlySummary | null>(null)

  // Modals & Editing
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isCreateBookOpen, setIsCreateBookOpen] = useState(false)
  const [isBookDetailOpen, setIsBookDetailOpen] = useState(false)
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<Book | null>(null)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Receipt Image Full Viewer Modal
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string | null>(null)

  // Personal Preferences
  const [preferences, setPreferences] = useState<PersonalPreferences>(() => {
    try {
      const saved = localStorage.getItem('kinbooks_personal_preferences')
      if (saved) return { ...defaultPreferences, ...JSON.parse(saved) }
    } catch {}
    return defaultPreferences
  })

  const updatePreferences = (newPref: PersonalPreferences) => {
    setPreferences(newPref)
    localStorage.setItem('kinbooks_personal_preferences', JSON.stringify(newPref))
  }

  // Receipt Compression Settings
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(() => {
    try {
      const saved = localStorage.getItem('kinbooks_receipt_settings')
      if (saved) return JSON.parse(saved)
    } catch {}
    return { enableCompression: true, quality: 80 }
  })

  const updateReceiptSettings = (newSettings: ReceiptSettings) => {
    setReceiptSettings(newSettings)
    localStorage.setItem('kinbooks_receipt_settings', JSON.stringify(newSettings))
  }

  // Apply Theme effect
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (
        preferences.theme === 'dark' ||
        (preferences.theme === 'system' && prefersDark)
      ) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
    applyTheme()
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', applyTheme)
    return () => mql.removeEventListener('change', applyTheme)
  }, [preferences.theme])

  // Admin Route popstate listener
  useEffect(() => {
    const checkAdminRoute = () => {
      if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
        setIsAdminViewOpen(true)
      }
    }
    window.addEventListener('popstate', checkAdminRoute)
    window.addEventListener('hashchange', checkAdminRoute)
    return () => {
      window.removeEventListener('popstate', checkAdminRoute)
      window.removeEventListener('hashchange', checkAdminRoute)
    }
  }, [])

  // Load System Public Config
  const loadSystemConfig = useCallback(async () => {
    try {
      const cfg = await api.getPublicConfig()
      setSystemConfig(cfg)
    } catch (err) {
      console.error('Failed to load system config', err)
    }
  }, [])

  // Load Book Data
  const loadBookData = useCallback(async (bookId: string, month: string) => {
    try {
      const [accList, catList, txList, sumData] = await Promise.all([
        api.getAccounts(bookId),
        api.getCategories(bookId),
        api.getTransactions(bookId, {
          start_date: `${month}-01 00:00:00`,
          end_date: `${month}-31 23:59:59`,
        }),
        api.getSummary(bookId, month),
      ])
      setAccounts(Array.isArray(accList) ? accList : [])
      setCategories(Array.isArray(catList) ? catList : [])
      setTransactions(Array.isArray(txList) ? txList : [])
      setSummary(sumData || null)
    } catch (err: any) {
      console.error('Failed to load book data', err)
    }
  }, [])

  // Initial Auth & Config Check
  useEffect(() => {
    const init = async () => {
      loadSystemConfig()
      try {
        const me = await api.getMe()
        setUser(me)
        const userBooks = await api.getBooks()
        setBooks(userBooks)
        if (userBooks.length > 0) {
          const savedDefault = localStorage.getItem('kinbooks_default_book_id')
          const initialBook =
            (savedDefault && userBooks.find((b) => b.id === savedDefault)) || userBooks[0]
          setCurrentBook(initialBook)
          await loadBookData(initialBook.id, currentMonth)
        }

        // Check for invitation URL token (e.g. ?token=xxx)
        const params = new URLSearchParams(window.location.search)
        const token = params.get('token')
        if (token) {
          try {
            const inviteRes = await api.acceptInvitation(token)
            alert(`[초대 완료] '${inviteRes.book_name}' 가계부에 합류했습니다!`)
            window.history.replaceState({}, document.title, window.location.pathname)
            const refreshedBooks = await api.getBooks()
            setBooks(refreshedBooks)
            const joined = refreshedBooks.find((b) => b.id === inviteRes.book_id)
            if (joined) setCurrentBook(joined)
          } catch (e: any) {
            alert(`초대 수락 오류: ${e.message}`)
          }
        }
      } catch {
        setIsAuthOpen(true)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [currentMonth, loadBookData, loadSystemConfig])

  // Change Month handler
  const handleMonthChange = (month: string) => {
    setCurrentMonth(month)
    if (currentBook) {
      loadBookData(currentBook.id, month)
    }
  }

  // Select Book handler
  const handleSelectBook = (book: Book) => {
    setCurrentBook(book)
    loadBookData(book.id, currentMonth)
  }

  // Set Default Book handler
  const handleSetDefaultBook = (bookId: string) => {
    setDefaultBookId(bookId)
    localStorage.setItem('kinbooks_default_book_id', bookId)
  }

  // Open Book Detail Modal
  const handleOpenBookDetail = (book: Book) => {
    setSelectedBookForDetail(book)
    setIsBookDetailOpen(true)
  }

  // Book updated handler
  const handleBookUpdated = (updatedBook: Book) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === updatedBook.id ? { ...b, ...updatedBook } : b))
    )
    if (currentBook?.id === updatedBook.id) {
      setCurrentBook((prev) => (prev ? { ...prev, ...updatedBook } : prev))
    }
    if (selectedBookForDetail?.id === updatedBook.id) {
      setSelectedBookForDetail((prev) => (prev ? { ...prev, ...updatedBook } : prev))
    }
  }

  // Delete Transaction handler
  const handleDeleteTx = async (id: string) => {
    try {
      await api.deleteTransaction(id)
      if (currentBook) {
        loadBookData(currentBook.id, currentMonth)
      }
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`)
    }
  }

  // Edit Transaction handler (opens modal in edit mode)
  const handleEditTx = (tx: Transaction) => {
    setEditingTransaction(tx)
    setIsTxModalOpen(true)
  }

  // Open New Transaction Modal
  const handleOpenNewTx = () => {
    setEditingTransaction(null)
    setIsTxModalOpen(true)
  }

  // Logout handler
  const handleLogout = () => {
    clearToken()
    setUser(null)
    setBooks([])
    setCurrentBook(null)
    setIsAdminViewOpen(false)
    setIsAuthOpen(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">
            {systemConfig?.app_name || '가계부'}를 불러오는 중...
          </p>
        </div>
      </div>
    )
  }

  // Admin View Active
  if (isAdminViewOpen) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AdminView
          onBack={() => {
            setIsAdminViewOpen(false)
            if (window.location.pathname === '/admin') {
              window.history.pushState({}, '', '/')
            }
          }}
          onRefreshSystemConfig={loadSystemConfig}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100">
      {/* Header with ledger switcher & profile menu */}
      <Header
        user={user}
        books={books}
        currentBook={currentBook}
        defaultBookId={defaultBookId}
        systemConfig={systemConfig}
        onSelectBook={handleSelectBook}
        onOpenCreateBook={() => setIsCreateBookOpen(true)}
        onOpenBookDetail={handleOpenBookDetail}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdmin={() => {
          setIsAdminViewOpen(true)
          window.history.pushState({}, '', '/admin')
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24">
        {!currentBook ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs my-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">선택된 가계부가 없습니다</h2>
            <p className="text-xs text-slate-400 mb-6">
              새로운 가계부를 생성하여 수입과 지출 관리를 시작해보세요.
            </p>
            <button
              onClick={() => setIsCreateBookOpen(true)}
              className="py-2.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
            >
              새 가계부 만들기
            </button>
          </div>
        ) : (
          <>
            {currentTab === 'timeline' && (
              <TransactionList
                transactions={transactions}
                summary={summary}
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                onDeleteTransaction={handleDeleteTx}
                onEditTransaction={handleEditTx}
                onViewReceipt={(url) => setReceiptViewerUrl(url)}
              />
            )}

            {currentTab === 'calendar' && (
              <CalendarView
                transactions={transactions}
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                onEditTransaction={handleEditTx}
                onViewReceipt={(url) => setReceiptViewerUrl(url)}
              />
            )}

            {currentTab === 'accounts' && (
              <AccountsView
                bookId={currentBook.id}
                accounts={accounts}
                onRefresh={() => loadBookData(currentBook.id, currentMonth)}
                onEditTransaction={handleEditTx}
              />
            )}

            {currentTab === 'stats' && (
              <StatsView
                bookId={currentBook.id}
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation (내역, 달력, +, 자산, 통계) */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAddModal={handleOpenNewTx}
      />

      {/* Transaction Create / Edit Modal */}
      {currentBook && (
        <TransactionModal
          isOpen={isTxModalOpen}
          onClose={() => {
            setIsTxModalOpen(false)
            setEditingTransaction(null)
          }}
          bookId={currentBook.id}
          accounts={accounts}
          categories={categories}
          initialTransaction={editingTransaction}
          receiptSettings={receiptSettings}
          onSuccess={() => loadBookData(currentBook.id, currentMonth)}
        />
      )}

      {/* Create Book Modal */}
      <CreateBookModal
        isOpen={isCreateBookOpen}
        onClose={() => setIsCreateBookOpen(false)}
        onSuccess={(newBook) => {
          setBooks((prev) => [...prev, newBook])
          setCurrentBook(newBook)
          loadBookData(newBook.id, currentMonth)
        }}
      />

      {/* Book Detail & Settings Modal */}
      <BookDetailModal
        isOpen={isBookDetailOpen}
        onClose={() => {
          setIsBookDetailOpen(false)
          setSelectedBookForDetail(null)
        }}
        book={selectedBookForDetail}
        isDefault={selectedBookForDetail?.id === defaultBookId}
        onSetDefault={handleSetDefaultBook}
        onBookUpdated={handleBookUpdated}
      />

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        currentBook={currentBook}
      />

      {/* Settings Modal (Personal Settings) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onUserUpdated={(updated) => setUser(updated)}
        currentBook={currentBook}
        categories={categories}
        onRefreshCategories={() => {
          if (currentBook) {
            loadBookData(currentBook.id, currentMonth)
          }
        }}
        receiptSettings={receiptSettings}
        onUpdateReceiptSettings={updateReceiptSettings}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        systemConfig={systemConfig}
      />

      {/* Receipt Full Viewer Modal */}
      <ReceiptViewerModal
        isOpen={!!receiptViewerUrl}
        imageUrl={receiptViewerUrl}
        onClose={() => setReceiptViewerUrl(null)}
      />

      {/* Auth Modal (Login/Register) */}
      <AuthModal
        isOpen={isAuthOpen}
        onSuccess={async (authedUser) => {
          setUser(authedUser)
          setIsAuthOpen(false)
          const userBooks = await api.getBooks()
          setBooks(userBooks)
          if (userBooks.length > 0) {
            const savedDefault = localStorage.getItem('kinbooks_default_book_id')
            const initialBook =
              (savedDefault && userBooks.find((b) => b.id === savedDefault)) || userBooks[0]
            setCurrentBook(initialBook)
            loadBookData(initialBook.id, currentMonth)
          }
        }}
      />
    </div>
  )
}

export default App
