package api

import (
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(database *gorm.DB) *AdminHandler {
	return &AdminHandler{db: database}
}

// requireAdmin checks if current user is administrator
func (h *AdminHandler) checkAdmin(c echo.Context) (*models.User, error) {
	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "인증이 필요합니다.")
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, echo.NewHTTPError(http.StatusNotFound, "사용자를 찾을 수 없습니다.")
	}

	if !user.IsAdmin {
		return nil, echo.NewHTTPError(http.StatusForbidden, "시스템 관리자(Admin) 권한이 필요합니다.")
	}

	return &user, nil
}

// SystemSettingsMap represents key-value settings for easy JSON handling
type SystemSettingsMap map[string]string

// Default system settings
var defaultSettings = map[string]string{
	"app_name":                   "KinBooks",
	"app_subtitle":               "초경량 오픈소스 가족 가계부",
	"app_logo_url":               "",
	"enable_receipt_compression": "true",
	"receipt_default_quality":    "80",
	"enable_local_ai":            "true",
	"local_ai_base_url":          "http://localhost:11434/v1",
	"local_ai_model":             "qwen2.5:7b",
	"enable_mcp":                 "true",
	"allow_registration":         "true",
	"smtp_enabled":               "false",
	"smtp_host":                  "",
	"smtp_port":                  "587",
	"smtp_username":              "",
	"smtp_password":              "",
	"smtp_from_email":            "",
}

// GetSettings retrieves all system settings
func (h *AdminHandler) GetSettings(c echo.Context) error {
	if _, err := h.checkAdmin(c); err != nil {
		return err
	}

	var settings []models.SystemSetting
	h.db.Find(&settings)

	res := make(map[string]string)
	for k, v := range defaultSettings {
		res[k] = v
	}
	for _, s := range settings {
		res[s.Key] = s.Value
	}

	return c.JSON(http.StatusOK, res)
}

// UpdateSettings updates server-wide settings
func (h *AdminHandler) UpdateSettings(c echo.Context) error {
	if _, err := h.checkAdmin(c); err != nil {
		return err
	}

	var req map[string]string
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for key, val := range req {
			var setting models.SystemSetting
			if err := tx.Where("key = ?", key).First(&setting).Error; err != nil {
				setting = models.SystemSetting{Key: key, Value: val, UpdatedAt: time.Now()}
				if err := tx.Create(&setting).Error; err != nil {
					return err
				}
			} else {
				setting.Value = val
				setting.UpdatedAt = time.Now()
				if err := tx.Save(&setting).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "설정 저장 실패"})
	}

	return h.GetSettings(c)
}

// UserResponse for admin user management
type AdminUserItem struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	IsAdmin     bool      `json:"is_admin"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

// GetUsers lists all users
func (h *AdminHandler) GetUsers(c echo.Context) error {
	if _, err := h.checkAdmin(c); err != nil {
		return err
	}

	var users []models.User
	if err := h.db.Order("created_at asc").Find(&users).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "사용자 목록 조회 실패"})
	}

	var list []AdminUserItem
	for _, u := range users {
		list = append(list, AdminUserItem{
			ID:          u.ID,
			Username:    u.Username,
			Email:       u.Email,
			DisplayName: u.DisplayName,
			IsAdmin:     u.IsAdmin,
			IsActive:    u.IsActive,
			CreatedAt:   u.CreatedAt,
		})
	}

	return c.JSON(http.StatusOK, list)
}

type UpdateUserStatusRequest struct {
	IsAdmin  *bool `json:"is_admin"`
	IsActive *bool `json:"is_active"`
}

// UpdateUser toggles active or admin status
func (h *AdminHandler) UpdateUser(c echo.Context) error {
	adminUser, err := h.checkAdmin(c)
	if err != nil {
		return err
	}

	targetID := c.Param("id")
	if targetID == adminUser.ID {
		// Prevent admin from disabling themselves
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "본인 계정의 관리자 권한이나 활성 상태는 해제할 수 없습니다."})
	}

	var target models.User
	if err := h.db.First(&target, "id = ?", targetID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "대상을 찾을 수 없습니다."})
	}

	var req UpdateUserStatusRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	if req.IsAdmin != nil {
		target.IsAdmin = *req.IsAdmin
	}
	if req.IsActive != nil {
		target.IsActive = *req.IsActive
	}

	if err := h.db.Save(&target).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "사용자 상태 변경 실패"})
	}

	return c.JSON(http.StatusOK, AdminUserItem{
		ID:          target.ID,
		Username:    target.Username,
		Email:       target.Email,
		DisplayName: target.DisplayName,
		IsAdmin:     target.IsAdmin,
		IsActive:    target.IsActive,
		CreatedAt:   target.CreatedAt,
	})
}

// TestMail sends a test email to verify SMTP configuration
type TestMailRequest struct {
	Recipient string `json:"recipient"`
}

func (h *AdminHandler) TestMail(c echo.Context) error {
	if _, err := h.checkAdmin(c); err != nil {
		return err
	}

	var req TestMailRequest
	_ = c.Bind(&req)
	if req.Recipient == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "수신자 이메일 주소를 입력해 주세요."})
	}

	// Fetch SMTP settings
	var settings []models.SystemSetting
	h.db.Find(&settings)
	config := make(map[string]string)
	for k, v := range defaultSettings {
		config[k] = v
	}
	for _, s := range settings {
		config[s.Key] = s.Value
	}

	host := config["smtp_host"]
	port := config["smtp_port"]
	username := config["smtp_username"]
	password := config["smtp_password"]
	from := config["smtp_from_email"]

	if host == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "SMTP 호스트(Host)가 설정되어 있지 않습니다."})
	}
	if from == "" {
		from = username
	}

	auth := smtp.PlainAuth("", username, password, host)
	msg := []byte(fmt.Sprintf("To: %s\r\nFrom: %s\r\nSubject: [KinBooks] SMTP 테스트 메일\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nKinBooks 메일 시스템 설정이 정상적으로 완료되었습니다.\r\n발송 시각: %s\r\n",
		req.Recipient, from, time.Now().Format("2006-01-02 15:04:05")))

	addr := fmt.Sprintf("%s:%s", host, port)
	if err := smtp.SendMail(addr, auth, from, []string{req.Recipient}, msg); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("메일 발송 실패: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "테스트 메일이 성공적으로 발송되었습니다."})
}
