export type User = {
  id: string
  username?: string
  email: string
  display_name: string
  is_admin?: boolean
  totp_enabled?: boolean
}

export type BookMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type BookMember = {
  id: string
  book_id: string
  user_id: string
  role: BookMemberRole
  user?: User
  created_at?: string
}

export type Book = {
  id: string
  name: string
  description?: string
  currency: string
  role?: BookMemberRole
  created_by_id?: string
  created_at: string
  members?: BookMember[]
}

export type AccountType = 'BANK' | 'CARD' | 'CASH' | 'INVESTMENT' | 'LOAN'

export type Account = {
  id: string
  book_id: string
  name: string
  type: AccountType
  initial_balance: number
  current_balance: number
  billing_day: number
  settlement_start_day: number
  settlement_end_day: number
  color: string
  is_active: boolean
}

export type CategoryType = 'EXPENSE' | 'INCOME'

export type Category = {
  id: string
  book_id: string
  parent_id?: string
  name: string
  type: CategoryType
  icon?: string
  color: string
  order: number
}

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER'

export type Entry = {
  id: string
  transaction_id: string
  account_id?: string
  category_id?: string
  amount: number
  note?: string
  account?: Account
  category?: Category
}

export type Transaction = {
  id: string
  book_id: string
  created_by_id: string
  type: TransactionType
  transacted_at: string
  payee: string
  amount: number
  memo?: string
  tags?: string
  receipt_img_url?: string
  created_by?: User
  entries?: Entry[]
}

export type MonthlySummary = {
  total_expense: number
  total_income: number
  net_savings: number
  daily_stats?: Record<string, number>
}

export type CardBillingInfo = {
  account_id: string
  account_name: string
  billing_day: number
  next_billing_date: string
  estimated_billing: number
  current_month_spend: number
}

export type APIKey = {
  id: string
  user_id: string
  name: string
  key_prefix: string
  raw_key?: string
  created_at: string
  last_used_at?: string
  is_active: boolean
}

export type AISetting = {
  id?: string
  user_id?: string
  is_enabled: boolean
  base_url: string
  model: string
  api_key?: string
}

export type ParsedTransaction = {
  type: TransactionType
  amount: number
  payee: string
  transacted_at: string
  account_id?: string
  account_name?: string
  category_id?: string
  category_name?: string
  memo?: string
  confidence: string
}

export type CategoryStatItem = {
  category_id: string
  category_name: string
  color: string
  total_amount: number
  percentage: number
}

export type CategoryStatsResponse = {
  total_expense: number
  categories: CategoryStatItem[]
}

export type ReceiptSettings = {
  enableCompression: boolean
  quality: number // 50 ~ 95
}

export type SystemConfig = {
  app_name: string
  app_subtitle?: string
  app_logo_url?: string
  enable_receipt_compression: boolean
  receipt_default_quality: number
  enable_local_ai: boolean
  enable_mcp: boolean
  allow_registration: boolean
}

export type AdminUser = {
  id: string
  username: string
  email: string
  display_name: string
  is_admin: boolean
  is_active: boolean
  created_at: string
}

export type PersonalPreferences = {
  theme: 'light' | 'dark' | 'system'
  expenseColor: string
  incomeColor: string
  currencyFormat: 'suffix_won' | 'prefix_symbol' | 'dollar'
  dateFormat: 'iso' | 'korean'
  timeFormat: '24h' | '12h'
  weekStart: 0 | 1
}


