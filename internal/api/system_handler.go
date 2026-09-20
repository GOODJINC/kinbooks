package api

import (
	"net/http"
	"strconv"

	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type SystemHandler struct {
	db *gorm.DB
}

func NewSystemHandler(database *gorm.DB) *SystemHandler {
	return &SystemHandler{db: database}
}

type PublicSystemConfig struct {
	AppName                  string `json:"app_name"`
	AppSubtitle              string `json:"app_subtitle"`
	AppLogoURL               string `json:"app_logo_url"`
	EnableReceiptCompression bool   `json:"enable_receipt_compression"`
	ReceiptDefaultQuality    int    `json:"receipt_default_quality"`
	EnableLocalAI            bool   `json:"enable_local_ai"`
	EnableMCP                bool   `json:"enable_mcp"`
	AllowRegistration        bool   `json:"allow_registration"`
}

func (h *SystemHandler) GetPublicConfig(c echo.Context) error {
	var settings []models.SystemSetting
	h.db.Find(&settings)

	configMap := make(map[string]string)
	for k, v := range defaultSettings {
		configMap[k] = v
	}
	for _, s := range settings {
		configMap[s.Key] = s.Value
	}

	quality, _ := strconv.Atoi(configMap["receipt_default_quality"])
	if quality <= 0 {
		quality = 80
	}

	res := PublicSystemConfig{
		AppName:                  configMap["app_name"],
		AppSubtitle:              configMap["app_subtitle"],
		AppLogoURL:               configMap["app_logo_url"],
		EnableReceiptCompression: configMap["enable_receipt_compression"] == "true",
		ReceiptDefaultQuality:    quality,
		EnableLocalAI:            configMap["enable_local_ai"] == "true",
		EnableMCP:                configMap["enable_mcp"] == "true",
		AllowRegistration:        configMap["allow_registration"] == "true",
	}

	return c.JSON(http.StatusOK, res)
}
