package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BaseUUID defines the standard model base with UUID as primary key
type BaseUUID struct {
	ID        string         `gorm:"type:text;primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (base *BaseUUID) BeforeCreate(tx *gorm.DB) (err error) {
	if base.ID == "" {
		base.ID = uuid.New().String()
	}
	return
}

// User represents a system account
type User struct {
	BaseUUID
	Username     string `gorm:"uniqueIndex" json:"username"`
	Email        string `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"not null" json:"-"`
	DisplayName  string `gorm:"not null" json:"display_name"`
	TOTPSecret   string `json:"-"`
	TOTPEnabled  bool   `gorm:"default:false" json:"totp_enabled"`
	IsActive     bool   `gorm:"default:true" json:"is_active"`
	IsAdmin      bool   `gorm:"default:false" json:"is_admin"`
}

// SystemSetting stores server-wide configurations managed by administrators
type SystemSetting struct {
	Key       string    `gorm:"primaryKey" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Book represents an individual or shared ledger (가계부)
type Book struct {
	BaseUUID
	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description"`
	Currency    string `gorm:"default:'KRW'" json:"currency"`
	CreatedByID string `gorm:"not null" json:"created_by_id"`
	CreatedBy   User   `gorm:"foreignKey:CreatedByID" json:"-"`

	Members      []BookMember  `gorm:"foreignKey:BookID" json:"members,omitempty"`
	Accounts     []Account     `gorm:"foreignKey:BookID" json:"accounts,omitempty"`
	Categories   []Category    `gorm:"foreignKey:BookID" json:"categories,omitempty"`
	Transactions []Transaction `gorm:"foreignKey:BookID" json:"-"`
}

// BookMemberRole defines permission levels
type BookMemberRole string

const (
	RoleOwner  BookMemberRole = "OWNER"
	RoleEditor BookMemberRole = "EDITOR"
	RoleViewer BookMemberRole = "VIEWER"
)

// BookMember maps users to books with specific roles
type BookMember struct {
	BaseUUID
	BookID string         `gorm:"index;not null" json:"book_id"`
	UserID string         `gorm:"index;not null" json:"user_id"`
	Role   BookMemberRole `gorm:"not null;default:'EDITOR'" json:"role"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Book Book `gorm:"foreignKey:BookID" json:"-"`
}

// Invitation allows sharing a book via token URL
type Invitation struct {
	BaseUUID
	BookID      string         `gorm:"index;not null" json:"book_id"`
	Token       string         `gorm:"uniqueIndex;not null" json:"token"`
	Role        BookMemberRole `gorm:"not null;default:'EDITOR'" json:"role"`
	CreatedByID string         `gorm:"not null" json:"created_by_id"`
	ExpiresAt   time.Time      `json:"expires_at"`
	IsAccepted  bool           `gorm:"default:false" json:"is_accepted"`
	AcceptedBy  string         `json:"accepted_by,omitempty"`

	Book Book `gorm:"foreignKey:BookID" json:"book,omitempty"`
}

// AccountType defines categories of financial accounts
type AccountType string

const (
	AccountTypeBank       AccountType = "BANK"       // 은행 통장
	AccountTypeCard       AccountType = "CARD"       // 신용/체크카드
	AccountTypeCash       AccountType = "CASH"       // 현금 지갑
	AccountTypeInvestment AccountType = "INVESTMENT" // 주식/투자
	AccountTypeLoan       AccountType = "LOAN"       // 대출/부채
)

// Account represents a bank, credit card, cash wallet, etc.
type Account struct {
	BaseUUID
	BookID             string      `gorm:"index;not null" json:"book_id"`
	Name               string      `gorm:"not null" json:"name"`
	Type               AccountType `gorm:"not null" json:"type"`
	InitialBalance     int64       `gorm:"default:0" json:"initial_balance"`
	CurrentBalance     int64       `gorm:"-" json:"current_balance"`
	BillingDay         int         `gorm:"default:0" json:"billing_day"`           // 카드 결제일 (1~31)
	SettlementStartDay int         `gorm:"default:1" json:"settlement_start_day"` // 실적 산정 시작일
	SettlementEndDay   int         `gorm:"default:31" json:"settlement_end_day"`  // 실적 산정 마감일
	Color              string      `gorm:"default:'#6366f1'" json:"color"`
	IsActive           bool        `gorm:"default:true" json:"is_active"`
}

// CategoryType defines expense vs income
type CategoryType string

const (
	CategoryExpense CategoryType = "EXPENSE"
	CategoryIncome  CategoryType = "INCOME"
)

// Category represents spending/earning classification (식비, 교통 등)
type Category struct {
	BaseUUID
	BookID   string       `gorm:"index;not null" json:"book_id"`
	ParentID *string      `gorm:"index" json:"parent_id,omitempty"` // 대분류/소분류
	Name     string       `gorm:"not null" json:"name"`
	Type     CategoryType `gorm:"not null" json:"type"`
	Icon     string       `json:"icon"`
	Color    string       `gorm:"default:'#10b981'" json:"color"`
	Order    int          `gorm:"default:0" json:"order"`
}

// TransactionType defines UI-facing transaction action
type TransactionType string

const (
	TxTypeExpense  TransactionType = "EXPENSE"  // 지출
	TxTypeIncome   TransactionType = "INCOME"   // 수입
	TxTypeTransfer TransactionType = "TRANSFER" // 이체
)

// Transaction groups double-entry movements under a single human event
type Transaction struct {
	BaseUUID
	BookID        string          `gorm:"index;not null" json:"book_id"`
	CreatedByID   string          `gorm:"not null" json:"created_by_id"`
	Type          TransactionType `gorm:"not null" json:"type"`
	TransactedAt  time.Time       `gorm:"index;not null" json:"transacted_at"`
	Payee         string          `json:"payee"` // 사용처 (스타벅스 등)
	Amount        int64           `gorm:"not null" json:"amount"`
	Memo          string          `json:"memo"`
	Tags          string          `json:"tags"` // JSON array string e.g. ["외식", "주말"]
	ReceiptImgURL string          `json:"receipt_img_url,omitempty"`

	CreatedBy User    `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	Entries   []Entry `gorm:"foreignKey:TransactionID" json:"entries,omitempty"`
}

// Entry is the atomic double-entry bookkeeping record
type Entry struct {
	BaseUUID
	TransactionID string  `gorm:"index;not null" json:"transaction_id"`
	AccountID     *string `gorm:"index" json:"account_id,omitempty"`
	CategoryID    *string `gorm:"index" json:"category_id,omitempty"`
	Amount        int64   `gorm:"not null" json:"amount"` // 양수: 입금/증가, 음수: 출금/감소
	Note          string  `json:"note"`

	Account  *Account  `gorm:"foreignKey:AccountID" json:"account,omitempty"`
	Category *Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
}

// APIKey allows external tools and agents (Telegram, MCP, CLI) to authenticate
type APIKey struct {
	BaseUUID
	UserID     string     `gorm:"index;not null" json:"user_id"`
	Name       string     `gorm:"not null" json:"name"`
	KeyPrefix  string     `gorm:"not null" json:"key_prefix"` // e.g. "kin_live_ab12"
	KeyHash    string     `gorm:"not null" json:"-"`          // SHA-256 hash of secret key
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	IsActive   bool       `gorm:"default:true" json:"is_active"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}

// AISetting stores user-configured generic OpenAI-compatible LLM endpoint
type AISetting struct {
	BaseUUID
	UserID    string `gorm:"uniqueIndex;not null" json:"user_id"`
	IsEnabled bool   `gorm:"default:true" json:"is_enabled"`
	BaseURL   string `gorm:"default:'http://localhost:11434/v1'" json:"base_url"` // Ollama, vLLM, OpenAI, etc.
	Model     string `gorm:"default:'qwen2.5:7b'" json:"model"`
	APIKey    string `json:"api_key,omitempty"` // Optional API key for cloud LLMs
}

