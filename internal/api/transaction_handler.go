package api

import (
	"net/http"
	"time"

	"github.com/kinbooks/kinbooks/internal/core"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type TransactionHandler struct {
	db                *gorm.DB
	accountingService *core.AccountingService
}

func NewTransactionHandler(database *gorm.DB, accounting *core.AccountingService) *TransactionHandler {
	return &TransactionHandler{db: database, accountingService: accounting}
}

type CreateTxRequest struct {
	Type          models.TransactionType `json:"type"`
	TransactedAt  string                 `json:"transacted_at"` // RFC3339 or "2026-09-20T16:00:00"
	Amount        int64                  `json:"amount"`
	Payee         string                 `json:"payee"`
	Memo          string                 `json:"memo"`
	Tags          string                 `json:"tags"`
	AccountID     *string                `json:"account_id,omitempty"`
	ToAccountID   *string                `json:"to_account_id,omitempty"`
	CategoryID    *string                `json:"category_id,omitempty"`
	ReceiptImgURL string                 `json:"receipt_img_url,omitempty"`
}

func (h *TransactionHandler) CreateTransaction(c echo.Context) error {
	userID := c.Get("user_id").(string)
	bookID := c.Param("bookId")

	var req CreateTxRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	transDate := time.Now()
	if req.TransactedAt != "" {
		parsed, err := time.Parse(time.RFC3339, req.TransactedAt)
		if err == nil {
			transDate = parsed
		} else {
			parsedSimple, err := time.Parse("2006-01-02T15:04:05", req.TransactedAt)
			if err == nil {
				transDate = parsedSimple
			} else {
				parsedDateOnly, err := time.Parse("2006-01-02", req.TransactedAt)
				if err == nil {
					transDate = parsedDateOnly
				}
			}
		}
	}

	txRecord, err := h.accountingService.RecordTransaction(core.CreateTransactionParams{
		BookID:        bookID,
		CreatedByID:   userID,
		Type:          req.Type,
		TransactedAt:  transDate,
		Amount:        req.Amount,
		Payee:         req.Payee,
		Memo:          req.Memo,
		Tags:          req.Tags,
		AccountID:     req.AccountID,
		ToAccountID:   req.ToAccountID,
		CategoryID:    req.CategoryID,
		ReceiptImgURL: req.ReceiptImgURL,
	})

	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, txRecord)
}

func (h *TransactionHandler) GetTransactions(c echo.Context) error {
	bookID := c.Param("bookId")
	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")
	query := c.QueryParam("q")
	categoryID := c.QueryParam("category_id")
	accountID := c.QueryParam("account_id")

	dbQuery := h.db.Preload("Entries.Account").Preload("Entries.Category").Preload("CreatedBy").
		Where("book_id = ?", bookID)

	if startDate != "" {
		dbQuery = dbQuery.Where("transacted_at >= ?", startDate)
	}
	if endDate != "" {
		dbQuery = dbQuery.Where("transacted_at <= ?", endDate)
	}
	if query != "" {
		dbQuery = dbQuery.Where("payee LIKE ? OR memo LIKE ? OR tags LIKE ?", "%"+query+"%", "%"+query+"%", "%"+query+"%")
	}
	if categoryID != "" {
		dbQuery = dbQuery.Where("id IN (SELECT transaction_id FROM entries WHERE category_id = ?)", categoryID)
	}
	if accountID != "" {
		dbQuery = dbQuery.Where("id IN (SELECT transaction_id FROM entries WHERE account_id = ?)", accountID)
	}

	transactions := make([]models.Transaction, 0)
	if err := dbQuery.Order("transacted_at DESC").Limit(100).Find(&transactions).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "거래 내역 조회 실패"})
	}

	return c.JSON(http.StatusOK, transactions)
}

func (h *TransactionHandler) DeleteTransaction(c echo.Context) error {
	id := c.Param("id")

	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Delete double-entry lines
		if err := tx.Where("transaction_id = ?", id).Delete(&models.Entry{}).Error; err != nil {
			return err
		}
		// Delete master transaction
		return tx.Where("id = ?", id).Delete(&models.Transaction{}).Error
	})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "거래 삭제 실패"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "거래가 성공적으로 삭제되었습니다."})
}

type SummaryResponse struct {
	TotalExpense int64            `json:"total_expense"`
	TotalIncome  int64            `json:"total_income"`
	NetSavings   int64            `json:"net_savings"`
	DailyStats   map[string]int64 `json:"daily_stats"`
}

func (h *TransactionHandler) GetMonthlySummary(c echo.Context) error {
	bookID := c.Param("bookId")
	month := c.QueryParam("month") // YYYY-MM
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	start := month + "-01 00:00:00"
	end := month + "-31 23:59:59"

	type Result struct {
		Type  models.TransactionType
		Total int64
	}
	var results []Result

	h.db.Model(&models.Transaction{}).
		Select("type, COALESCE(SUM(amount), 0) as total").
		Where("book_id = ? AND transacted_at >= ? AND transacted_at <= ?", bookID, start, end).
		Group("type").
		Scan(&results)

	var totalExp, totalInc int64
	for _, r := range results {
		if r.Type == models.TxTypeExpense {
			totalExp = r.Total
		} else if r.Type == models.TxTypeIncome {
			totalInc = r.Total
		}
	}

	return c.JSON(http.StatusOK, SummaryResponse{
		TotalExpense: totalExp,
		TotalIncome:  totalInc,
		NetSavings:   totalInc - totalExp,
	})
}

type UpdateTxRequest struct {
	Type          models.TransactionType `json:"type"`
	TransactedAt  string                 `json:"transacted_at"`
	Amount        int64                  `json:"amount"`
	Payee         string                 `json:"payee"`
	Memo          string                 `json:"memo"`
	Tags          string                 `json:"tags"`
	AccountID     *string                `json:"account_id,omitempty"`
	ToAccountID   *string                `json:"to_account_id,omitempty"`
	CategoryID    *string                `json:"category_id,omitempty"`
	ReceiptImgURL string                 `json:"receipt_img_url,omitempty"`
}

func (h *TransactionHandler) UpdateTransaction(c echo.Context) error {
	id := c.Param("id")

	var req UpdateTxRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	transDate := time.Now()
	if req.TransactedAt != "" {
		if parsed, err := time.Parse(time.RFC3339, req.TransactedAt); err == nil {
			transDate = parsed
		} else if parsedSimple, err := time.Parse("2006-01-02T15:04:05", req.TransactedAt); err == nil {
			transDate = parsedSimple
		} else if parsedDateOnly, err := time.Parse("2006-01-02", req.TransactedAt); err == nil {
			transDate = parsedDateOnly
		}
	}

	txRecord, err := h.accountingService.UpdateTransaction(core.UpdateTransactionParams{
		ID:            id,
		Type:          req.Type,
		TransactedAt:  transDate,
		Amount:        req.Amount,
		Payee:         req.Payee,
		Memo:          req.Memo,
		Tags:          req.Tags,
		AccountID:     req.AccountID,
		ToAccountID:   req.ToAccountID,
		CategoryID:    req.CategoryID,
		ReceiptImgURL: req.ReceiptImgURL,
	})

	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, txRecord)
}

type CategoryStatItem struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Color        string  `json:"color"`
	TotalAmount  int64   `json:"total_amount"`
	Percentage   float64 `json:"percentage"`
}

func (h *TransactionHandler) GetCategoryStats(c echo.Context) error {
	bookID := c.Param("bookId")
	month := c.QueryParam("month") // YYYY-MM
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	start := month + "-01 00:00:00"
	end := month + "-31 23:59:59"

	type Result struct {
		CategoryID   string
		CategoryName string
		Color        string
		Total        int64
	}
	var results []Result

	// Get total expense per category in this month
	err := h.db.Table("entries").
		Select("entries.category_id, categories.name as category_name, categories.color, SUM(entries.amount) as total").
		Joins("JOIN categories ON categories.id = entries.category_id").
		Joins("JOIN transactions ON transactions.id = entries.transaction_id").
		Where("transactions.book_id = ? AND transactions.transacted_at >= ? AND transactions.transacted_at <= ? AND entries.amount > 0 AND transactions.type = ?",
			bookID, start, end, models.TxTypeExpense).
		Group("entries.category_id, categories.name, categories.color").
		Order("total DESC").
		Scan(&results).Error

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "통계 조회 실패"})
	}

	var overallTotal int64
	for _, r := range results {
		overallTotal += r.Total
	}

	stats := make([]CategoryStatItem, 0, len(results))
	for _, r := range results {
		pct := 0.0
		if overallTotal > 0 {
			pct = float64(r.Total) / float64(overallTotal) * 100.0
		}
		stats = append(stats, CategoryStatItem{
			CategoryID:   r.CategoryID,
			CategoryName: r.CategoryName,
			Color:        r.Color,
			TotalAmount:  r.Total,
			Percentage:   pct,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"total_expense": overallTotal,
		"categories":    stats,
	})
}

