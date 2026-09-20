import type {
  User,
  Book,
  Account,
  Category,
  Transaction,
  MonthlySummary,
  CardBillingInfo,
  APIKey,
  AISetting,
  ParsedTransaction,
  SystemConfig,
  AdminUser,
} from './types'

const BASE_URL = '/api/v1'

function getToken(): string | null {
  return localStorage.getItem('kinbooks_token')
}

export function setToken(token: string) {
  localStorage.setItem('kinbooks_token', token)
}

export function clearToken() {
  localStorage.removeItem('kinbooks_token')
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
    }
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error || `HTTP error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  // Public System Config
  getPublicConfig: () => request<SystemConfig>('/system/config'),

  // Auth
  register: (data: { username: string; email: string; password: string; display_name: string }) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { username_or_email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => request<User>('/auth/me'),

  updateProfile: (data: {
    display_name?: string
    email?: string
    current_password?: string
    new_password?: string
  }) =>
    request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Books
  getBooks: () => request<Book[]>('/books'),
  createBook: (data: { name: string; description?: string; currency?: string }) =>
    request<Book>('/books', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBook: (id: string) => request<Book>(`/books/${id}`),
  updateBook: (id: string, data: { name?: string; description?: string }) =>
    request<Book>(`/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  createInvitation: (bookId: string, role = 'EDITOR') =>
    request<{ token: string; expires_at: string }>(`/books/${bookId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
  acceptInvitation: (token: string) =>
    request<{ message: string; book_id: string; book_name: string }>(`/invitations/${token}/accept`, {
      method: 'POST',
    }),

  // Accounts
  getAccounts: (bookId: string) => request<Account[]>(`/books/${bookId}/accounts`),
  createAccount: (bookId: string, data: Partial<Account>) =>
    request<Account>(`/books/${bookId}/accounts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCardBilling: (accountId: string) => request<CardBillingInfo>(`/cards/${accountId}/billing`),

  // Categories
  getCategories: (bookId: string) => request<Category[]>(`/books/${bookId}/categories`),
  createCategory: (bookId: string, data: Partial<Category>) =>
    request<Category>(`/books/${bookId}/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCategory: (id: string, data: Partial<Category>) =>
    request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Backup: Export & Import
  exportBook: (bookId: string) => request<any>(`/books/${bookId}/export`),
  importBook: (bookId: string, data: any) =>
    request<{ message: string; imported_accounts: number; imported_categories: number; imported_transactions: number }>(
      `/books/${bookId}/import`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  // Transactions
  getTransactions: (bookId: string, params: { q?: string; start_date?: string; end_date?: string; category_id?: string; account_id?: string } = {}) => {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set('q', params.q)
    if (params.start_date) searchParams.set('start_date', params.start_date)
    if (params.end_date) searchParams.set('end_date', params.end_date)
    if (params.category_id) searchParams.set('category_id', params.category_id)
    if (params.account_id) searchParams.set('account_id', params.account_id)
    const query = searchParams.toString()
    return request<Transaction[]>(`/books/${bookId}/transactions${query ? `?${query}` : ''}`)
  },

  createTransaction: (bookId: string, data: {
    type: string
    amount: number
    payee: string
    transacted_at: string
    account_id?: string
    to_account_id?: string
    category_id?: string
    memo?: string
    tags?: string
  }) =>
    request<Transaction>(`/books/${bookId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTransaction: (id: string, data: {
    type: string
    amount: number
    payee: string
    transacted_at: string
    account_id?: string
    to_account_id?: string
    category_id?: string
    memo?: string
    tags?: string
    receipt_img_url?: string
  }) =>
    request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTransaction: (id: string) =>
    request<{ message: string }>(`/transactions/${id}`, {
      method: 'DELETE',
    }),

  getSummary: (bookId: string, month?: string) => {
    const q = month ? `?month=${month}` : ''
    return request<MonthlySummary>(`/books/${bookId}/summary${q}`)
  },

  getCategoryStats: (bookId: string, month?: string) => {
    const q = month ? `?month=${month}` : ''
    return request<{ total_expense: number; categories: import('./types').CategoryStatItem[] }>(`/books/${bookId}/stats/categories${q}`)
  },

  uploadReceipt: async (file: File | Blob): Promise<{ url: string }> => {
    const token = getToken()
    const formData = new FormData()
    formData.append('file', file, 'receipt.webp')

    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${BASE_URL}/receipts/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || '영수증 업로드 실패')
    }

    return res.json()
  },


  // AI & Natural Language
  getAISettings: () => request<AISetting>('/ai/settings'),
  updateAISettings: (data: Partial<AISetting>) =>
    request<AISetting>('/ai/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  parseText: (bookId: string, text: string) =>
    request<ParsedTransaction>('/ai/parse', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, text }),
    }),

  // API Keys
  getAPIKeys: () => request<APIKey[]>('/apikeys'),
  createAPIKey: (name: string) =>
    request<APIKey & { raw_key: string }>('/apikeys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  revokeAPIKey: (id: string) =>
    request<{ message: string }>(`/apikeys/${id}`, {
      method: 'DELETE',
    }),

  // Admin
  getAdminSettings: () => request<Record<string, string>>('/admin/settings'),
  updateAdminSettings: (data: Record<string, string>) =>
    request<Record<string, string>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getAdminUsers: () => request<AdminUser[]>('/admin/users'),
  updateAdminUser: (id: string, data: { is_admin?: boolean; is_active?: boolean }) =>
    request<AdminUser>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  testAdminMail: (recipient: string) =>
    request<{ message: string }>('/admin/mail/test', {
      method: 'POST',
      body: JSON.stringify({ recipient }),
    }),
}
