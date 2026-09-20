package core

import (
	"errors"
	"time"

	"github.com/kinbooks/kinbooks/internal/models"
	"gorm.io/gorm"
)

type AccountingService struct {
	db *gorm.DB
}

func NewAccountingService(db *gorm.DB) *AccountingService {
	return &AccountingService{db: db}
}

// CreateTransactionParams holds payload to record an expense, income, or transfer
type CreateTransactionParams struct {
	BookID        string                 `json:"book_id"`
	CreatedByID   string                 `json:"created_by_id"`
	Type          models.TransactionType `json:"type"`
	TransactedAt  time.Time              `json:"transacted_at"`
	Amount        int64                  `json:"amount"`
	Payee         string                 `json:"payee"`
	Memo          string                 `json:"memo"`
	Tags          string                 `json:"tags"`
	AccountID     *string                `json:"account_id,omitempty"`     // 지출 출금 계좌 or 수입 입금 계좌
	ToAccountID   *string                `json:"to_account_id,omitempty"`  // 이체 받는 계좌
	CategoryID    *string                `json:"category_id,omitempty"`    // 지출/수입 카테고리
	ReceiptImgURL string                 `json:"receipt_img_url,omitempty"`
}

// RecordTransaction handles double-entry accounting entries atomically
func (s *AccountingService) RecordTransaction(p CreateTransactionParams) (*models.Transaction, error) {
	if p.Amount <= 0 {
		return nil, errors.New("거래 금액은 0보다 커야 합니다")
	}

	var txRecord *models.Transaction

	err := s.db.Transaction(func(tx *gorm.DB) error {
		txRecord = &models.Transaction{
			BookID:        p.BookID,
			CreatedByID:   p.CreatedByID,
			Type:          p.Type,
			TransactedAt:  p.TransactedAt,
			Payee:         p.Payee,
			Amount:        p.Amount,
			Memo:          p.Memo,
			Tags:          p.Tags,
			ReceiptImgURL: p.ReceiptImgURL,
		}

		if err := tx.Create(txRecord).Error; err != nil {
			return err
		}

		switch p.Type {
		case models.TxTypeExpense:
			if p.AccountID == nil || p.CategoryID == nil {
				return errors.New("지출 등록 시 출금 계좌와 카테고리가 필수입니다")
			}
			// 1. Credit: 결제 계좌 잔액 차감 (-Amount)
			entryAccount := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.AccountID,
				Amount:        -p.Amount,
				Note:          "지출 결제",
			}
			if err := tx.Create(&entryAccount).Error; err != nil {
				return err
			}
			// 2. Debit: 비용 카테고리 발생 (+Amount)
			entryCategory := models.Entry{
				TransactionID: txRecord.ID,
				CategoryID:    p.CategoryID,
				Amount:        p.Amount,
				Note:          "지출 비용 발생",
			}
			if err := tx.Create(&entryCategory).Error; err != nil {
				return err
			}

		case models.TxTypeIncome:
			if p.AccountID == nil || p.CategoryID == nil {
				return errors.New("수입 등록 시 입금 계좌와 카테고리가 필수입니다")
			}
			// 1. Debit: 입금 계좌 잔액 증가 (+Amount)
			entryAccount := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.AccountID,
				Amount:        p.Amount,
				Note:          "수입 입금",
			}
			if err := tx.Create(&entryAccount).Error; err != nil {
				return err
			}
			// 2. Credit: 수익 발생 (-Amount for credit balance or categorization)
			entryCategory := models.Entry{
				TransactionID: txRecord.ID,
				CategoryID:    p.CategoryID,
				Amount:        -p.Amount,
				Note:          "수익 발생",
			}
			if err := tx.Create(&entryCategory).Error; err != nil {
				return err
			}

		case models.TxTypeTransfer:
			if p.AccountID == nil || p.ToAccountID == nil {
				return errors.New("이체 등록 시 보내는 계좌와 받는 계좌가 필수입니다")
			}
			if *p.AccountID == *p.ToAccountID {
				return errors.New("보내는 계좌와 받는 계좌가 동일할 수 없습니다")
			}
			// 1. 보내는 계좌 잔액 차감 (-Amount)
			fromEntry := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.AccountID,
				Amount:        -p.Amount,
				Note:          "계좌 이체 출금",
			}
			if err := tx.Create(&fromEntry).Error; err != nil {
				return err
			}
			// 2. 받는 계좌 잔액 증가 (+Amount)
			toEntry := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.ToAccountID,
				Amount:        p.Amount,
				Note:          "계좌 이체 입금",
			}
			if err := tx.Create(&toEntry).Error; err != nil {
				return err
			}

		default:
			return errors.New("지원되지 않는 거래 유형입니다")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Re-load transaction with full entries, account and category preloads
	s.db.Preload("Entries.Account").Preload("Entries.Category").Preload("CreatedBy").First(txRecord, "id = ?", txRecord.ID)
	return txRecord, nil
}

// UpdateTransactionParams holds payload to modify an existing transaction
type UpdateTransactionParams struct {
	ID            string                 `json:"id"`
	Type          models.TransactionType `json:"type"`
	TransactedAt  time.Time              `json:"transacted_at"`
	Amount        int64                  `json:"amount"`
	Payee         string                 `json:"payee"`
	Memo          string                 `json:"memo"`
	Tags          string                 `json:"tags"`
	AccountID     *string                `json:"account_id,omitempty"`
	ToAccountID   *string                `json:"to_account_id,omitempty"`
	CategoryID    *string                `json:"category_id,omitempty"`
	ReceiptImgURL string                 `json:"receipt_img_url,omitempty"`
}

// UpdateTransaction updates a transaction and re-creates its double-entry movements atomically
func (s *AccountingService) UpdateTransaction(p UpdateTransactionParams) (*models.Transaction, error) {
	if p.Amount <= 0 {
		return nil, errors.New("거래 금액은 0보다 커야 합니다")
	}

	var txRecord models.Transaction
	if err := s.db.First(&txRecord, "id = ?", p.ID).Error; err != nil {
		return nil, errors.New("거래를 찾을 수 없습니다")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Delete old entries
		if err := tx.Where("transaction_id = ?", p.ID).Delete(&models.Entry{}).Error; err != nil {
			return err
		}

		// 2. Update master transaction fields
		txRecord.Type = p.Type
		txRecord.Amount = p.Amount
		txRecord.TransactedAt = p.TransactedAt
		txRecord.Payee = p.Payee
		txRecord.Memo = p.Memo
		txRecord.Tags = p.Tags
		if p.ReceiptImgURL != "" {
			txRecord.ReceiptImgURL = p.ReceiptImgURL
		}

		if err := tx.Save(&txRecord).Error; err != nil {
			return err
		}

		// 3. Create new entries
		switch p.Type {
		case models.TxTypeExpense:
			if p.AccountID == nil || p.CategoryID == nil {
				return errors.New("지출 시 출금 계좌와 카테고리가 필수입니다")
			}
			entryAccount := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.AccountID,
				Amount:        -p.Amount,
				Note:          "지출 결제",
			}
			if err := tx.Create(&entryAccount).Error; err != nil {
				return err
			}
			entryCategory := models.Entry{
				TransactionID: txRecord.ID,
				CategoryID:    p.CategoryID,
				Amount:        p.Amount,
				Note:          "지출 비용 발생",
			}
			if err := tx.Create(&entryCategory).Error; err != nil {
				return err
			}

		case models.TxTypeIncome:
			if p.AccountID == nil || p.CategoryID == nil {
				return errors.New("수입 시 입금 계좌와 카테고리가 필수입니다")
			}
			entryAccount := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.AccountID,
				Amount:        p.Amount,
				Note:          "수입 입금",
			}
			if err := tx.Create(&entryAccount).Error; err != nil {
				return err
			}
			entryCategory := models.Entry{
				TransactionID: txRecord.ID,
				CategoryID:    p.CategoryID,
				Amount:        -p.Amount,
				Note:          "수익 발생",
			}
			if err := tx.Create(&entryCategory).Error; err != nil {
				return err
			}

		case models.TxTypeTransfer:
			if p.AccountID == nil || p.ToAccountID == nil {
				return errors.New("이체 시 보내는 계좌와 받는 계좌가 필수입니다")
			}
			fromEntry := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.AccountID,
				Amount:        -p.Amount,
				Note:          "계좌 이체 출금",
			}
			if err := tx.Create(&fromEntry).Error; err != nil {
				return err
			}
			toEntry := models.Entry{
				TransactionID: txRecord.ID,
				AccountID:     p.ToAccountID,
				Amount:        p.Amount,
				Note:          "계좌 이체 입금",
			}
			if err := tx.Create(&toEntry).Error; err != nil {
				return err
			}

		default:
			return errors.New("지원되지 않는 거래 유형입니다")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	s.db.Preload("Entries.Account").Preload("Entries.Category").Preload("CreatedBy").First(&txRecord, "id = ?", txRecord.ID)
	return &txRecord, nil
}


// CalculateAccountBalances calculates real-time account balances based on initial + sum(entries)
func (s *AccountingService) CalculateAccountBalances(bookID string) ([]models.Account, error) {
	var accounts []models.Account
	if err := s.db.Where("book_id = ? AND is_active = ?", bookID, true).Find(&accounts).Error; err != nil {
		return nil, err
	}

	type EntrySum struct {
		AccountID string
		Total     int64
	}
	var sums []EntrySum

	err := s.db.Model(&models.Entry{}).
		Select("account_id, COALESCE(SUM(amount), 0) as total").
		Where("account_id IN (SELECT id FROM accounts WHERE book_id = ?)", bookID).
		Group("account_id").
		Scan(&sums).Error

	if err != nil {
		return nil, err
	}

	sumMap := make(map[string]int64)
	for _, sum := range sums {
		sumMap[sum.AccountID] = sum.Total
	}

	for i := range accounts {
		delta := sumMap[accounts[i].ID]
		accounts[i].CurrentBalance = accounts[i].InitialBalance + delta
	}

	return accounts, nil
}
