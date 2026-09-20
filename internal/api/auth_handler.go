package api

import (
	"net/http"

	"github.com/kinbooks/kinbooks/internal/auth"
	"github.com/kinbooks/kinbooks/internal/db"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db        *gorm.DB
	jwtSecret string
}

func NewAuthHandler(database *gorm.DB, secret string) *AuthHandler {
	return &AuthHandler{db: database, jwtSecret: secret}
}

type RegisterRequest struct {
	Username    string `json:"username"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	if req.DisplayName == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "이름과 비밀번호를 입력해 주세요."})
	}

	if req.Username == "" && req.Email != "" {
		// Fallback username to email prefix if not specified
		req.Username = req.Email
	}

	if req.Username == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "아이디(계정명)를 입력해 주세요."})
	}

	var existing models.User
	if err := h.db.Where("email = ? OR username = ?", req.Email, req.Username).First(&existing).Error; err == nil {
		if existing.Username == req.Username {
			return c.JSON(http.StatusConflict, map[string]string{"error": "이미 사용 중인 아이디입니다."})
		}
		return c.JSON(http.StatusConflict, map[string]string{"error": "이미 등록된 이메일 주소입니다."})
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "비밀번호 암호화에 실패했습니다."})
	}

	// First registered user automatically becomes the system Administrator
	var userCount int64
	h.db.Model(&models.User{}).Count(&userCount)
	isAdmin := userCount == 0

	user := models.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hash,
		DisplayName:  req.DisplayName,
		IsAdmin:      isAdmin,
	}

	if err := h.db.Create(&user).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "회원가입 처리 중 오류가 발생했습니다."})
	}

	// Create default personal book for the user
	personalBook := models.Book{
		Name:        user.DisplayName + "의 개인 가계부",
		Description: "기본 개인 가계부",
		Currency:    "KRW",
		CreatedByID: user.ID,
	}
	if err := h.db.Create(&personalBook).Error; err == nil {
		// Add as OWNER
		h.db.Create(&models.BookMember{
			BookID: personalBook.ID,
			UserID: user.ID,
			Role:   models.RoleOwner,
		})
		// Seed default categories
		_ = db.SeedDefaultCategories(h.db, personalBook.ID)
		// Seed a default cash wallet
		h.db.Create(&models.Account{
			BookID: personalBook.ID,
			Name:   "현금 지갑",
			Type:   models.AccountTypeCash,
			Color:  "#10b981",
		})
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.DisplayName, h.jwtSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "토큰 발급에 실패했습니다."})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"token": token,
		"user": map[string]interface{}{
			"id":           user.ID,
			"username":     user.Username,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"is_admin":     user.IsAdmin,
			"totp_enabled": user.TOTPEnabled,
		},
	})
}

type LoginRequest struct {
	UsernameOrEmail string `json:"username_or_email"`
	Email           string `json:"email"`
	Password        string `json:"password"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	identifier := req.UsernameOrEmail
	if identifier == "" {
		identifier = req.Email
	}

	if identifier == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "아이디/이메일과 비밀번호를 입력해 주세요."})
	}

	var user models.User
	if err := h.db.Where("username = ? OR email = ?", identifier, identifier).First(&user).Error; err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "아이디/이메일 또는 비밀번호가 일치하지 않습니다."})
	}

	if !auth.CheckPasswordHash(req.Password, user.PasswordHash) {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "아이디/이메일 또는 비밀번호가 일치하지 않습니다."})
	}

	if !user.IsActive {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "비활성화된 계정입니다. 관리자에게 문의하세요."})
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.DisplayName, h.jwtSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "토큰 생성에 실패했습니다."})
	}

	// Set auth cookie for seamless browser/PWA experience
	cookie := new(http.Cookie)
	cookie.Name = "kinbooks_token"
	cookie.Value = token
	cookie.Path = "/"
	cookie.HttpOnly = true
	c.SetCookie(cookie)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"token": token,
		"user": map[string]interface{}{
			"id":           user.ID,
			"username":     user.Username,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"is_admin":     user.IsAdmin,
			"totp_enabled": user.TOTPEnabled,
		},
	})
}

func (h *AuthHandler) Me(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "사용자를 찾을 수 없습니다."})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":           user.ID,
		"username":     user.Username,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"is_admin":     user.IsAdmin,
		"totp_enabled": user.TOTPEnabled,
	})
}

type UpdateProfileRequest struct {
	DisplayName     string `json:"display_name"`
	Email           string `json:"email"`
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *AuthHandler) UpdateProfile(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var req UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "사용자를 찾을 수 없습니다."})
	}

	if req.DisplayName != "" {
		user.DisplayName = req.DisplayName
	}

	if req.Email != "" && req.Email != user.Email {
		var check models.User
		if err := h.db.Where("email = ? AND id != ?", req.Email, userID).First(&check).Error; err == nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "이미 다른 계정에서 사용 중인 이메일입니다."})
		}
		user.Email = req.Email
	}

	if req.NewPassword != "" {
		if req.CurrentPassword == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "현재 비밀번호를 입력해 주세요."})
		}
		if !auth.CheckPasswordHash(req.CurrentPassword, user.PasswordHash) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "현재 비밀번호가 올바르지 않습니다."})
		}
		hash, err := auth.HashPassword(req.NewPassword)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "비밀번호 암호화 실패"})
		}
		user.PasswordHash = hash
	}

	if err := h.db.Save(&user).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "프로필 수정 실패"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":           user.ID,
		"username":     user.Username,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"is_admin":     user.IsAdmin,
		"totp_enabled": user.TOTPEnabled,
	})
}
