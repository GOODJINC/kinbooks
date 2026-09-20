package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kinbooks/kinbooks/internal/core"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type ExportImportHandler struct {
	db                *gorm.DB
	accountingService *core.AccountingService
}

func NewExportImportHandler(database *gorm.DB, accService *core.AccountingService) *ExportImportHandler {
	return &ExportImportHandler{
		db:                database,
		accountingService: accService,
	}
}

type ExportAccountItem struct {
	Name               string             `json:"name"`
	Type               models.AccountType `json:"type"`
	InitialBalance     int64              `json:"initial_balance"`
	BillingDay         int                `json:"billing_day"`
	SettlementStartDay int                `json:"settlement_start_day"`
	SettlementEndDay   int                `json:"settlement_end_day"`
	Color              string             `json:"color"`
}

type ExportCategoryItem struct {
	Name  string              `json:"name"`
	Type  models.CategoryType `json:"type"`
	Icon  string              `json:"icon"`
	Color string              `json:"color"`
	Order int                 `json:"order"`
}

type ExportTransactionItem struct {
	Type         models.TransactionType `json:"type"`
	Payee        string                 `json:"payee"`
	Amount       int64                  `json:"amount"`
	TransactedAt string                 `json:"transacted_at"`
	AccountName  string                 `json:"account_name"`
	ToAccount    string                 `json:"to_account_name,omitempty"`
	CategoryName string                 `json:"category_name,omitempty"`
	Memo         string                 `json:"memo"`
	Tags         string                 `json:"tags"`
}

type BookExportData struct {
	Version      string                  `json:"version"`
	ExportedAt   string                  `json:"exported_at"`
	BookName     string                  `json:"book_name"`
	Currency     string                  `json:"currency"`
	Accounts     []ExportAccountItem     `json:"accounts"`
	Categories   []ExportCategoryItem    `json:"categories"`
	Transactions []ExportTransactionItem `json:"transactions"`
}

// ExportBookData exports accounts, categories, and transactions of a book as JSON
func (h *ExportImportHandler) ExportBookData(c echo.Context) error {
	userID := c.Get("user_id").(string)
	bookID := c.Param("bookId")

	var member models.BookMember
	if err := h.db.Where("book_id = ? AND user_id = ?", bookID, userID).First(&member).Error; err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "장부 접근 권한이 없습니다."})
	}

	var book models.Book
	if err := h.db.First(&book, "id = ?", bookID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "장부를 찾을 수 없습니다."})
	}

	var accounts []models.Account
	h.db.Where("book_id = ?", bookID).Find(&accounts)

	var categories []models.Category
	h.db.Where("book_id = ?", bookID).Find(&categories)

	var transactions []models.Transaction
	h.db.Preload("Entries.Account").Preload("Entries.Category").Where("book_id = ?", bookID).Order("transacted_at asc").Find(&transactions)

	exportData := BookExportData{
		Version:    "1.0",
		ExportedAt: time.Now().Format(time.RFC3339),
		BookName:   book.Name,
		Currency:   book.Currency,
	}

	for _, a := range accounts {
		exportData.Accounts = append(exportData.Accounts, ExportAccountItem{
			Name:               a.Name,
			Type:               a.Type,
			InitialBalance:     a.InitialBalance,
			BillingDay:         a.BillingDay,
			SettlementStartDay: a.SettlementStartDay,
			SettlementEndDay:   a.SettlementEndDay,
			Color:              a.Color,
		})
	}

	for _, cat := range categories {
		exportData.Categories = append(exportData.Categories, ExportCategoryItem{
			Name:  cat.Name,
			Type:  cat.Type,
			Icon:  cat.Icon,
			Color: cat.Color,
			Order: cat.Order,
		})
	}

	for _, tx := range transactions {
		item := ExportTransactionItem{
			Type:         tx.Type,
			Payee:        tx.Payee,
			Amount:       tx.Amount,
			TransactedAt: tx.TransactedAt.Format("2006-01-02 15:04:05"),
			Memo:         tx.Memo,
			Tags:         tx.Tags,
		}

		if tx.Type == models.TxTypeTransfer {
			for _, e := range tx.Entries {
				if e.Amount < 0 && e.Account != nil {
					item.AccountName = e.Account.Name
				} else if e.Amount > 0 && e.Account != nil {
					item.ToAccount = e.Account.Name
				}
			}
		} else {
			for _, e := range tx.Entries {
				if e.Account != nil {
					item.AccountName = e.Account.Name
				}
				if e.Category != nil {
					item.CategoryName = e.Category.Name
				}
			}
		}

		exportData.Transactions = append(exportData.Transactions, item)
	}

	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=kinbooks_%s_%s.json", book.Name, time.Now().Format("20060102")))
	return c.JSON(http.StatusOK, exportData)
}

// ImportBookData imports accounts, categories, and transactions into a book
func (h *ExportImportHandler) ImportBookData(c echo.Context) error {
	userID := c.Get("user_id").(string)
	bookID := c.Param("bookId")

	var member models.BookMember
	if err := h.db.Where("book_id = ? AND user_id = ?", bookID, userID).First(&member).Error; err != nil || member.Role == models.RoleViewer {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "장부 편집 권한이 없습니다."})
	}

	var importData BookExportData
	if err := json.NewDecoder(c.Request().Body).Decode(&importData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "유효하지 않은 백업 JSON 파일입니다."})
	}

	accountMap := make(map[string]*models.Account)
	categoryMap := make(map[string]*models.Category)

	var existingAccounts []models.Account
	h.db.Where("book_id = ?", bookID).Find(&existingAccounts)
	for i := range existingAccounts {
		accountMap[existingAccounts[i].Name] = &existingAccounts[i]
	}

	var existingCategories []models.Category
	h.db.Where("book_id = ?", bookID).Find(&existingCategories)
	for i := range existingCategories {
		categoryMap[existingCategories[i].Name] = &existingCategories[i]
	}

	accCreated := 0
	catCreated := 0
	txCreated := 0

	// 1. Import Accounts
	for _, accItem := range importData.Accounts {
		if _, exists := accountMap[accItem.Name]; !exists {
			newAcc := models.Account{
				BookID:             bookID,
				Name:               accItem.Name,
				Type:               accItem.Type,
				InitialBalance:     accItem.InitialBalance,
				BillingDay:         accItem.BillingDay,
				SettlementStartDay: accItem.SettlementStartDay,
				SettlementEndDay:   accItem.SettlementEndDay,
				Color:              accItem.Color,
			}
			if err := h.db.Create(&newAcc).Error; err == nil {
				accountMap[newAcc.Name] = &newAcc
				accCreated++
			}
		}
	}

	// 2. Import Categories
	for _, catItem := range importData.Categories {
		if _, exists := categoryMap[catItem.Name]; !exists {
			newCat := models.Category{
				BookID: bookID,
				Name:   catItem.Name,
				Type:   catItem.Type,
				Icon:   catItem.Icon,
				Color:  catItem.Color,
				Order:  catItem.Order,
			}
			if err := h.db.Create(&newCat).Error; err == nil {
				categoryMap[newCat.Name] = &newCat
				catCreated++
			}
		}
	}

	// 3. Import Transactions
	for _, txItem := range importData.Transactions {
		transDate, err := time.Parse("2006-01-02 15:04:05", txItem.TransactedAt)
		if err != nil {
			transDate = time.Now()
		}

		acc := accountMap[txItem.AccountName]
		var accID *string
		if acc != nil {
			accID = &acc.ID
		}

		toAcc := accountMap[txItem.ToAccount]
		var toAccID *string
		if toAcc != nil {
			toAccID = &toAcc.ID
		}

		cat := categoryMap[txItem.CategoryName]
		var catID *string
		if cat != nil {
			catID = &cat.ID
		}

		createParam := core.CreateTransactionParams{
			BookID:        bookID,
			CreatedByID:   userID,
			Type:          txItem.Type,
			Payee:         txItem.Payee,
			Amount:        txItem.Amount,
			TransactedAt:  transDate,
			AccountID:     accID,
			ToAccountID:   toAccID,
			CategoryID:    catID,
			Memo:          txItem.Memo,
			Tags:          txItem.Tags,
		}

		if _, err := h.accountingService.RecordTransaction(createParam); err == nil {
			txCreated++
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":               "데이터를 성공적으로 가져왔습니다.",
		"imported_accounts":     accCreated,
		"imported_categories":   catCreated,
		"imported_transactions": txCreated,
	})
}
