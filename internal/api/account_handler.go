package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/kinbooks/kinbooks/internal/core"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type AccountHandler struct {
	db                *gorm.DB
	accountingService *core.AccountingService
}

func NewAccountHandler(database *gorm.DB, accounting *core.AccountingService) *AccountHandler {
	return &AccountHandler{db: database, accountingService: accounting}
}

func (h *AccountHandler) GetAccounts(c echo.Context) error {
	bookID := c.Param("bookId")

	accounts, err := h.accountingService.CalculateAccountBalances(bookID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "계좌 목록 조회 실패"})
	}

	return c.JSON(http.StatusOK, accounts)
}

type CreateAccountRequest struct {
	Name               string             `json:"name"`
	Type               models.AccountType `json:"type"`
	InitialBalance     int64              `json:"initial_balance"`
	BillingDay         int                `json:"billing_day"`
	SettlementStartDay int                `json:"settlement_start_day"`
	SettlementEndDay   int                `json:"settlement_end_day"`
	Color              string             `json:"color"`
}

func (h *AccountHandler) CreateAccount(c echo.Context) error {
	bookID := c.Param("bookId")

	var req CreateAccountRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	if req.Name == "" || req.Type == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "계좌 이름과 유형은 필수입니다."})
	}

	if req.Color == "" {
		req.Color = "#6366f1"
	}

	account := models.Account{
		BookID:             bookID,
		Name:               req.Name,
		Type:               req.Type,
		InitialBalance:     req.InitialBalance,
		BillingDay:         req.BillingDay,
		SettlementStartDay: req.SettlementStartDay,
		SettlementEndDay:   req.SettlementEndDay,
		Color:              req.Color,
		IsActive:           true,
	}

	if err := h.db.Create(&account).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "계좌 생성 실패"})
	}

	account.CurrentBalance = account.InitialBalance
	return c.JSON(http.StatusCreated, account)
}

func (h *AccountHandler) UpdateAccount(c echo.Context) error {
	id := c.Param("id")

	var account models.Account
	if err := h.db.First(&account, "id = ?", id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "계좌를 찾을 수 없습니다."})
	}

	var req CreateAccountRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	if req.Name != "" {
		account.Name = req.Name
	}
	if req.Type != "" {
		account.Type = req.Type
	}
	account.BillingDay = req.BillingDay
	account.SettlementStartDay = req.SettlementStartDay
	account.SettlementEndDay = req.SettlementEndDay
	if req.Color != "" {
		account.Color = req.Color
	}

	if err := h.db.Save(&account).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "계좌 수정 실패"})
	}

	return c.JSON(http.StatusOK, account)
}

type CardBillingInfo struct {
	AccountID         string `json:"account_id"`
	AccountName       string `json:"account_name"`
	BillingDay        int    `json:"billing_day"`
	NextBillingDate   string `json:"next_billing_date"`
	EstimatedBilling  int64  `json:"estimated_billing"`
	CurrentMonthSpend int64  `json:"current_month_spend"`
}

func (h *AccountHandler) GetCardBillingInfo(c echo.Context) error {
	accountID := c.Param("id")

	var account models.Account
	if err := h.db.First(&account, "id = ?", accountID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "계좌를 찾을 수 없습니다."})
	}

	now := time.Now()
	// Calculate current month's spending on this card (negative amounts in entries)
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Nanosecond)

	var monthSpend int64
	h.db.Model(&models.Entry{}).
		Where("account_id = ? AND amount < 0 AND created_at >= ? AND created_at <= ?", accountID, startOfMonth, endOfMonth).
		Select("COALESCE(ABS(SUM(amount)), 0)").
		Scan(&monthSpend)

	nextBilling := fmt.Sprintf("%04d-%02d-%02d", now.Year(), now.Month(), account.BillingDay)
	if account.BillingDay <= 0 {
		account.BillingDay = 14
	}

	return c.JSON(http.StatusOK, CardBillingInfo{
		AccountID:         account.ID,
		AccountName:       account.Name,
		BillingDay:        account.BillingDay,
		NextBillingDate:   nextBilling,
		EstimatedBilling:  monthSpend,
		CurrentMonthSpend: monthSpend,
	})
}

