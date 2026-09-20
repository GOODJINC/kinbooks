package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/kinbooks/kinbooks/internal/models"
	"gorm.io/gorm"
)

type ParserService struct {
	db *gorm.DB
}

func NewParserService(db *gorm.DB) *ParserService {
	return &ParserService{db: db}
}

type ParsedTransaction struct {
	Type         models.TransactionType `json:"type"`
	Amount       int64                  `json:"amount"`
	Payee        string                 `json:"payee"`
	TransactedAt string                 `json:"transacted_at"` // RFC3339
	AccountID    *string                `json:"account_id,omitempty"`
	AccountName  string                 `json:"account_name,omitempty"`
	CategoryID   *string                `json:"category_id,omitempty"`
	CategoryName string                 `json:"category_name,omitempty"`
	Memo         string                 `json:"memo"`
	Confidence   string                 `json:"confidence"` // "AI" or "RULE_BASED"
}

// ParseNaturalLanguage parses a natural language text using either configured LLM or heuristic fallback
func (s *ParserService) ParseNaturalLanguage(userID, bookID, text string) (*ParsedTransaction, error) {
	// 1. Fetch user's AI settings
	var setting models.AISetting
	_ = s.db.Where("user_id = ?", userID).First(&setting)

	// Fetch book's accounts and categories for context
	var accounts []models.Account
	s.db.Where("book_id = ? AND is_active = ?", bookID, true).Find(&accounts)

	var categories []models.Category
	s.db.Where("book_id = ?", bookID).Find(&categories)

	// 2. If AI is enabled and configured, try calling OpenAI-compatible endpoint
	if setting.IsEnabled && setting.BaseURL != "" {
		res, err := s.callLLM(setting, accounts, categories, text)
		if err == nil && res != nil && res.Amount > 0 {
			res.Confidence = "AI"
			return res, nil
		}
	}

	// 3. Smart Heuristic Fallback (Regex + Keyword matching)
	return s.fallbackRuleParse(accounts, categories, text), nil
}

// callLLM calls user-configured OpenAI-compatible endpoint (/chat/completions)
func (s *ParserService) callLLM(setting models.AISetting, accounts []models.Account, categories []models.Category, text string) (*ParsedTransaction, error) {
	baseURL := strings.TrimRight(setting.BaseURL, "/")
	endpoint := baseURL + "/chat/completions"

	accList := make([]string, len(accounts))
	for i, a := range accounts {
		accList[i] = fmt.Sprintf("ID: %s, 이름: %s", a.ID, a.Name)
	}

	catList := make([]string, len(categories))
	for i, c := range categories {
		catList[i] = fmt.Sprintf("ID: %s, 이름: %s, 유형: %s", c.ID, c.Name, c.Type)
	}

	systemPrompt := fmt.Sprintf(`당신은 가계부 회계 파싱 AI입니다.
사용자의 한국어 텍스트에서 금액, 사용처(가맹점), 일시, 거래유형(EXPENSE, INCOME, TRANSFER), 계좌ID, 카테고리ID를 추출하세요.
반드시 다른 설명 없이 순수한 JSON 객체 하나만 출력하세요.

현재 등록된 계좌:
%s

현재 등록된 카테고리:
%s

오늘 날짜: %s

반환 JSON 형식:
{
  "type": "EXPENSE",
  "amount": 9000,
  "payee": "스타벅스",
  "transacted_at": "%s",
  "account_id": "계좌ID",
  "category_id": "카테고리ID",
  "memo": "메모"
}`, strings.Join(accList, "\n"), strings.Join(catList, "\n"), time.Now().Format("2006-01-02"), time.Now().Format(time.RFC3339))

	reqBody := map[string]interface{}{
		"model": setting.Model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": text},
		},
		"temperature": 0.1,
	}

	bodyJSON, _ := json.Marshal(reqBody)
	client := &http.Client{Timeout: 8 * time.Second}
	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(bodyJSON))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if setting.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+setting.APIKey)
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LLM endpoint returned status: %d", resp.StatusCode)
	}

	respBytes, _ := io.ReadAll(resp.Body)
	var chatRes struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &chatRes); err != nil || len(chatRes.Choices) == 0 {
		return nil, fmt.Errorf("invalid LLM response structure")
	}

	content := chatRes.Choices[0].Message.Content
	// Clean markdown code blocks if present
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result ParsedTransaction
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// fallbackRuleParse extracts amount, payee, and date using regex rules
func (s *ParserService) fallbackRuleParse(accounts []models.Account, categories []models.Category, text string) *ParsedTransaction {
	result := &ParsedTransaction{
		Type:         models.TxTypeExpense,
		TransactedAt: time.Now().Format(time.RFC3339),
		Memo:         text,
		Confidence:   "RULE_BASED",
	}

	// 1. Extract Amount (e.g. 15,000원, 9000원, 15000)
	amountRegex := regexp.MustCompile(`([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*(?:원)?`)
	matches := amountRegex.FindStringSubmatch(text)
	if len(matches) > 1 {
		cleanNum := strings.ReplaceAll(matches[1], ",", "")
		if val, err := strconv.ParseInt(cleanNum, 10, 64); err == nil {
			result.Amount = val
		}
	}

	// 2. Check for Income keywords
	incomeKeywords := []string{"월급", "급여", "보너스", "상여", "입금", "용돈받음", "이자"}
	for _, kw := range incomeKeywords {
		if strings.Contains(text, kw) {
			result.Type = models.TxTypeIncome
			break
		}
	}

	// 3. Match Payee
	words := strings.Fields(text)
	for _, w := range words {
		// exclude amount words and common particles
		if !strings.Contains(w, "원") && !strings.Contains(w, "에서") && !strings.Contains(w, "결제") && !strings.Contains(w, "씀") && !strings.Contains(w, "쓴") {
			result.Payee = strings.Trim(w, ",. ")
			break
		}
		if strings.Contains(w, "에서") {
			result.Payee = strings.TrimSuffix(w, "에서")
			break
		}
	}
	if result.Payee == "" {
		result.Payee = "미지정"
	}

	// 4. Match Category by keyword
	for _, cat := range categories {
		if strings.Contains(text, cat.Name) ||
			(cat.Name == "카페/간식" && (strings.Contains(text, "스타벅스") || strings.Contains(text, "커피") || strings.Contains(text, "투썸"))) ||
			(cat.Name == "식비" && (strings.Contains(text, "밥") || strings.Contains(text, "식당") || strings.Contains(text, "배민") || strings.Contains(text, "쿠팡이츠"))) ||
			(cat.Name == "교통/차량" && (strings.Contains(text, "택시") || strings.Contains(text, "지하철") || strings.Contains(text, "주유") || strings.Contains(text, "버스"))) {
			id := cat.ID
			result.CategoryID = &id
			result.CategoryName = cat.Name
			break
		}
	}

	// 5. Default Account
	if len(accounts) > 0 {
		id := accounts[0].ID
		result.AccountID = &id
		result.AccountName = accounts[0].Name
	}

	return result
}
