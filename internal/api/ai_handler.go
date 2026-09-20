package api

import (
	"net/http"

	"github.com/kinbooks/kinbooks/internal/ai"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type AIHandler struct {
	db     *gorm.DB
	parser *ai.ParserService
}

func NewAIHandler(database *gorm.DB, parserService *ai.ParserService) *AIHandler {
	return &AIHandler{
		db:     database,
		parser: parserService,
	}
}

func (h *AIHandler) GetSettings(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var setting models.AISetting
	if err := h.db.Where("user_id = ?", userID).First(&setting).Error; err != nil {
		// Return default setting
		setting = models.AISetting{
			UserID:    userID,
			IsEnabled: true,
			BaseURL:   "http://localhost:11434/v1",
			Model:     "qwen2.5:7b",
		}
	}

	return c.JSON(http.StatusOK, setting)
}

type UpdateAISettingRequest struct {
	IsEnabled bool   `json:"is_enabled"`
	BaseURL   string `json:"base_url"`
	Model     string `json:"model"`
	APIKey    string `json:"api_key"`
}

func (h *AIHandler) UpdateSettings(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var req UpdateAISettingRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	var setting models.AISetting
	if err := h.db.Where("user_id = ?", userID).First(&setting).Error; err != nil {
		setting = models.AISetting{
			UserID:    userID,
			IsEnabled: req.IsEnabled,
			BaseURL:   req.BaseURL,
			Model:     req.Model,
			APIKey:    req.APIKey,
		}
		h.db.Create(&setting)
	} else {
		setting.IsEnabled = req.IsEnabled
		if req.BaseURL != "" {
			setting.BaseURL = req.BaseURL
		}
		if req.Model != "" {
			setting.Model = req.Model
		}
		setting.APIKey = req.APIKey
		h.db.Save(&setting)
	}

	return c.JSON(http.StatusOK, setting)
}

type ParseTextRequest struct {
	BookID string `json:"book_id"`
	Text   string `json:"text"`
}

func (h *AIHandler) ParseText(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var req ParseTextRequest
	if err := c.Bind(&req); err != nil || req.Text == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "파싱할 텍스트를 입력해 주세요."})
	}

	bookID := req.BookID
	if bookID == "" {
		var member models.BookMember
		if err := h.db.Where("user_id = ?", userID).First(&member).Error; err == nil {
			bookID = member.BookID
		}
	}

	parsed, err := h.parser.ParseNaturalLanguage(userID, bookID, req.Text)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, parsed)
}
