package api

import (
	"net/http"

	"github.com/kinbooks/kinbooks/internal/auth"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type APIKeyHandler struct {
	db *gorm.DB
}

func NewAPIKeyHandler(database *gorm.DB) *APIKeyHandler {
	return &APIKeyHandler{db: database}
}

func (h *APIKeyHandler) GetAPIKeys(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var keys []models.APIKey
	if err := h.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "API Key 목록 조회 실패"})
	}

	return c.JSON(http.StatusOK, keys)
}

type CreateAPIKeyRequest struct {
	Name string `json:"name"`
}

func (h *APIKeyHandler) CreateAPIKey(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var req CreateAPIKeyRequest
	if err := c.Bind(&req); err != nil || req.Name == "" {
		req.Name = "외부 연동 키"
	}

	rawKey, apiKey, err := auth.CreateAPIKey(userID, req.Name)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "API Key 생성 실패"})
	}

	if err := h.db.Create(&apiKey).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "API Key 저장 실패"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":           apiKey.ID,
		"name":         apiKey.Name,
		"key_prefix":   apiKey.KeyPrefix,
		"raw_key":      rawKey, // Only returned on creation
		"created_at":   apiKey.CreatedAt,
		"instructions": "이 API Key는 다시 표시되지 않으므로 안전한 곳에 보관하세요. Authorization: Bearer <key> 또는 X-API-Key: <key> 헤더로 사용합니다.",
	})
}

func (h *APIKeyHandler) RevokeAPIKey(c echo.Context) error {
	userID := c.Get("user_id").(string)
	id := c.Param("id")

	var apiKey models.APIKey
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&apiKey).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "API Key를 찾을 수 없습니다."})
	}

	apiKey.IsActive = false
	if err := h.db.Save(&apiKey).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "API Key 비활성화 실패"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "API Key가 비활성화되었습니다."})
}
