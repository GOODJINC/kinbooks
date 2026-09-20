package mcp

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/kinbooks/kinbooks/internal/core"
	"github.com/kinbooks/kinbooks/internal/models"
	"gorm.io/gorm"
)

// MCP JSON-RPC 2.0 Request and Response Types
type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type Response struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id,omitempty"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type ToolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

type Server struct {
	db                *gorm.DB
	accountingService *core.AccountingService
}

func NewServer(db *gorm.DB, accounting *core.AccountingService) *Server {
	return &Server{
		db:                db,
		accountingService: accounting,
	}
}

func (s *Server) GetToolDefinitions() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"name":        "kinbooks_list_books",
			"description": "사용자가 참여 중인 모든 가계부(장부) 목록과 ID를 조회합니다.",
			"inputSchema": map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			"name":        "kinbooks_get_balance",
			"description": "가계부의 모든 계좌(은행, 카드, 현금 등)와 실시간 잔액을 조회합니다.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"book_id": map[string]interface{}{
						"type":        "string",
						"description": "장부 ID (생략 시 첫 번째 장부 자동 선택)",
					},
				},
			},
		},
		{
			"name":        "kinbooks_add_transaction",
			"description": "가계부에 새로운 수입, 지출, 또는 계좌 이체 거래를 기록합니다.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"book_id": map[string]interface{}{
						"type":        "string",
						"description": "장부 ID (생략 시 첫 번째 장부 자동 선택)",
					},
					"type": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"EXPENSE", "INCOME", "TRANSFER"},
						"description": "거래 유형: EXPENSE(지출), INCOME(수입), TRANSFER(이체)",
					},
					"amount": map[string]interface{}{
						"type":        "integer",
						"description": "금액 (예: 9000)",
					},
					"payee": map[string]interface{}{
						"type":        "string",
						"description": "사용처/가맹점 (예: 스타벅스 강남점)",
					},
					"memo": map[string]interface{}{
						"type":        "string",
						"description": "메모 내용",
					},
					"category_name": map[string]interface{}{
						"type":        "string",
						"description": "카테고리명 (예: 식비, 카페/간식, 교통 등)",
					},
					"account_name": map[string]interface{}{
						"type":        "string",
						"description": "결제/입금 계좌명 (예: 신한카드, 국민은행, 현금 지갑)",
					},
				},
				"required": []string{"type", "amount"},
			},
		},
		{
			"name":        "kinbooks_query_spending",
			"description": "특정 기간이나 키워드로 지출/수입 내역을 검색합니다.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"book_id": map[string]interface{}{
						"type":        "string",
						"description": "장부 ID (생략 시 첫 번째 장부)",
					},
					"query": map[string]interface{}{
						"type":        "string",
						"description": "검색어 (가맹점명 또는 메모)",
					},
					"start_date": map[string]interface{}{
						"type":        "string",
						"description": "조회 시작일 (YYYY-MM-DD)",
					},
					"end_date": map[string]interface{}{
						"type":        "string",
						"description": "조회 마감일 (YYYY-MM-DD)",
					},
				},
			},
		},
		{
			"name":        "kinbooks_get_monthly_summary",
			"description": "특정 월(YYYY-MM)의 총수입, 총지출, 순저축액 요약을 조회합니다.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"book_id": map[string]interface{}{
						"type":        "string",
						"description": "장부 ID (생략 시 첫 번째 장부)",
					},
					"month": map[string]interface{}{
						"type":        "string",
						"description": "연월 (YYYY-MM, 생략 시 이번 달)",
					},
				},
			},
		},
	}
}

// HandleRPC processes an incoming JSON-RPC request in the context of an authenticated user
func (s *Server) HandleRPC(userID string, req *Request) *Response {
	switch req.Method {
	case "initialize":
		return &Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"protocolVersion": "2024-11-05",
				"capabilities": map[string]interface{}{
					"tools": map[string]interface{}{},
				},
				"serverInfo": map[string]interface{}{
					"name":    "kinbooks-mcp-server",
					"version": "1.0.0",
				},
			},
		}

	case "notifications/initialized":
		return nil // No response for notifications

	case "tools/list":
		return &Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"tools": s.GetToolDefinitions(),
			},
		}

	case "tools/call":
		var callParams ToolCallParams
		if err := json.Unmarshal(req.Params, &callParams); err != nil {
			return &Response{
				JSONRPC: "2.0",
				ID:      req.ID,
				Error:   &RPCError{Code: -32602, Message: "Invalid tool call params"},
			}
		}

		resultText, err := s.ExecuteTool(userID, callParams.Name, callParams.Arguments)
		if err != nil {
			return &Response{
				JSONRPC: "2.0",
				ID:      req.ID,
				Result: map[string]interface{}{
					"isError": true,
					"content": []map[string]string{
						{"type": "text", "text": fmt.Sprintf("[오류] %v", err)},
					},
				},
			}
		}

		return &Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"content": []map[string]string{
					{"type": "text", "text": resultText},
				},
			},
		}

	default:
		return &Response{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &RPCError{Code: -32601, Message: fmt.Sprintf("Method not found: %s", req.Method)},
		}
	}
}

// ExecuteTool executes the specific domain tool
func (s *Server) ExecuteTool(userID, toolName string, args map[string]interface{}) (string, error) {
	// Helper to resolve book ID
	resolveBookID := func(explicitID string) (string, error) {
		if explicitID != "" {
			return explicitID, nil
		}
		var member models.BookMember
		if err := s.db.Where("user_id = ?", userID).First(&member).Error; err != nil {
			return "", fmt.Errorf("등록된 장부가 없습니다")
		}
		return member.BookID, nil
	}

	switch toolName {
	case "kinbooks_list_books":
		var members []models.BookMember
		if err := s.db.Preload("Book").Where("user_id = ?", userID).Find(&members).Error; err != nil {
			return "", err
		}
		var sb strings.Builder
		sb.WriteString("=== [KinBooks] 참여 중인 가계부 목록 ===\n")
		for _, m := range members {
			sb.WriteString(fmt.Sprintf("- %s (ID: %s, 권한: %s, 통화: %s)\n", m.Book.Name, m.Book.ID, m.Role, m.Book.Currency))
		}
		return sb.String(), nil

	case "kinbooks_get_balance":
		rawBookID, _ := args["book_id"].(string)
		bookID, err := resolveBookID(rawBookID)
		if err != nil {
			return "", err
		}

		accounts, err := s.accountingService.CalculateAccountBalances(bookID)
		if err != nil {
			return "", err
		}

		var sb strings.Builder
		sb.WriteString("=== [KinBooks] 계좌별 실시간 잔액 ===\n")
		var totalBalance int64
		for _, acc := range accounts {
			sb.WriteString(fmt.Sprintf("- %s (%s): %s원\n", acc.Name, acc.Type, formatMoney(acc.CurrentBalance)))
			totalBalance += acc.CurrentBalance
		}
		sb.WriteString(fmt.Sprintf("----------------------------------\n총 순자산 합계: %s원\n", formatMoney(totalBalance)))
		return sb.String(), nil

	case "kinbooks_add_transaction":
		rawBookID, _ := args["book_id"].(string)
		bookID, err := resolveBookID(rawBookID)
		if err != nil {
			return "", err
		}

		txTypeStr, _ := args["type"].(string)
		txType := models.TransactionType(txTypeStr)
		amountFloat, ok := args["amount"].(float64)
		if !ok || amountFloat <= 0 {
			return "", fmt.Errorf("금액이 올바르지 않습니다")
		}
		amount := int64(amountFloat)
		payee, _ := args["payee"].(string)
		memo, _ := args["memo"].(string)
		categoryName, _ := args["category_name"].(string)
		accountName, _ := args["account_name"].(string)

		// 1. Resolve Account
		var account models.Account
		if accountName != "" {
			s.db.Where("book_id = ? AND name LIKE ?", bookID, "%"+accountName+"%").First(&account)
		}
		if account.ID == "" {
			// Default account
			s.db.Where("book_id = ? AND is_active = ?", bookID, true).First(&account)
		}
		if account.ID == "" {
			return "", fmt.Errorf("등록 가능한 계좌가 없습니다. 계좌를 먼저 생성해 주세요")
		}

		// 2. Resolve Category
		var category models.Category
		if categoryName != "" {
			s.db.Where("book_id = ? AND name LIKE ?", bookID, "%"+categoryName+"%").First(&category)
		}
		if category.ID == "" {
			// Fallback category
			targetType := models.CategoryExpense
			if txType == models.TxTypeIncome {
				targetType = models.CategoryIncome
			}
			s.db.Where("book_id = ? AND type = ?", bookID, targetType).First(&category)
		}

		accID := account.ID
		catID := category.ID

		txRecord, err := s.accountingService.RecordTransaction(core.CreateTransactionParams{
			BookID:       bookID,
			CreatedByID:  userID,
			Type:         txType,
			TransactedAt: time.Now(),
			Amount:       amount,
			Payee:        payee,
			Memo:         memo,
			AccountID:    &accID,
			CategoryID:   &catID,
		})
		if err != nil {
			return "", err
		}

		// Get updated account balance
		updatedAccs, _ := s.accountingService.CalculateAccountBalances(bookID)
		var currentBal int64
		for _, a := range updatedAccs {
			if a.ID == accID {
				currentBal = a.CurrentBalance
				break
			}
		}

		typeKor := "지출"
		if txType == models.TxTypeIncome {
			typeKor = "수입"
		} else if txType == models.TxTypeTransfer {
			typeKor = "이체"
		}

		return fmt.Sprintf("[KinBooks 기록 완료] %s %s원 등록 완료!\n- 사용처: %s\n- 분류: %s\n- 결제수단: %s (현재 잔액: %s원)\n- 일시: %s",
			typeKor, formatMoney(txRecord.Amount), txRecord.Payee, category.Name, account.Name, formatMoney(currentBal),
			txRecord.TransactedAt.Format("2006-01-02 15:04")), nil

	case "kinbooks_query_spending":
		rawBookID, _ := args["book_id"].(string)
		bookID, err := resolveBookID(rawBookID)
		if err != nil {
			return "", err
		}

		query, _ := args["query"].(string)
		startDate, _ := args["start_date"].(string)
		endDate, _ := args["end_date"].(string)

		dbQuery := s.db.Preload("Entries.Account").Preload("Entries.Category").Where("book_id = ?", bookID)
		if query != "" {
			dbQuery = dbQuery.Where("payee LIKE ? OR memo LIKE ?", "%"+query+"%", "%"+query+"%")
		}
		if startDate != "" {
			dbQuery = dbQuery.Where("transacted_at >= ?", startDate+" 00:00:00")
		}
		if endDate != "" {
			dbQuery = dbQuery.Where("transacted_at <= ?", endDate+" 23:59:59")
		}

		var list []models.Transaction
		if err := dbQuery.Order("transacted_at DESC").Limit(20).Find(&list).Error; err != nil {
			return "", err
		}

		if len(list) == 0 {
			return "조건에 맞는 거래 내역이 없습니다.", nil
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("=== [KinBooks] 거래 내역 조회 (%d건) ===\n", len(list)))
		var totalAmount int64
		for _, tx := range list {
			catName := "미분류"
			accName := "미지정"
			for _, entry := range tx.Entries {
				if entry.Category != nil {
					catName = entry.Category.Name
				}
				if entry.Account != nil {
					accName = entry.Account.Name
				}
			}
			sb.WriteString(fmt.Sprintf("[%s] %s | %s | %s원 | %s (%s)\n",
				tx.TransactedAt.Format("01/02 15:04"), tx.Type, tx.Payee, formatMoney(tx.Amount), catName, accName))
			if tx.Type == models.TxTypeExpense {
				totalAmount += tx.Amount
			}
		}
		sb.WriteString(fmt.Sprintf("----------------------------------\n조회된 지출 합계: %s원\n", formatMoney(totalAmount)))
		return sb.String(), nil

	case "kinbooks_get_monthly_summary":
		rawBookID, _ := args["book_id"].(string)
		bookID, err := resolveBookID(rawBookID)
		if err != nil {
			return "", err
		}
		month, _ := args["month"].(string)
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

		s.db.Model(&models.Transaction{}).
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

		return fmt.Sprintf("=== [KinBooks] %s 월간 가계부 요약 ===\n- 총 수입: %s원\n- 총 지출: %s원\n- 순 저축/잔여: %s원\n",
			month, formatMoney(totalInc), formatMoney(totalExp), formatMoney(totalInc-totalExp)), nil

	default:
		return "", fmt.Errorf("지원되지 않는 도구입니다: %s", toolName)
	}
}

func formatMoney(n int64) string {
	in := fmt.Sprintf("%d", n)
	out := make([]byte, 0, len(in)+len(in)/3)
	sign := ""
	if strings.HasPrefix(in, "-") {
		sign = "-"
		in = in[1:]
	}

	for i, c := range in {
		if i > 0 && (len(in)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, byte(c))
	}
	return sign + string(out)
}
