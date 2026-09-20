package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/kinbooks/kinbooks/internal/db"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type BookHandler struct {
	db *gorm.DB
}

func NewBookHandler(database *gorm.DB) *BookHandler {
	return &BookHandler{db: database}
}

type BookResponse struct {
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Currency    string                `json:"currency"`
	Role        models.BookMemberRole `json:"role"`
	CreatedAt   time.Time             `json:"created_at"`
}

func (h *BookHandler) GetBooks(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var members []models.BookMember
	if err := h.db.Preload("Book").Where("user_id = ?", userID).Find(&members).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "장부 목록을 불러오지 못했습니다."})
	}

	result := make([]BookResponse, 0, len(members))
	for _, m := range members {
		result = append(result, BookResponse{
			ID:          m.Book.ID,
			Name:        m.Book.Name,
			Description: m.Book.Description,
			Currency:    m.Book.Currency,
			Role:        m.Role,
			CreatedAt:   m.Book.CreatedAt,
		})
	}

	return c.JSON(http.StatusOK, result)
}

type CreateBookRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Currency    string `json:"currency"`
}

func (h *BookHandler) CreateBook(c echo.Context) error {
	userID := c.Get("user_id").(string)

	var req CreateBookRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "장부 이름을 입력해 주세요."})
	}

	if req.Currency == "" {
		req.Currency = "KRW"
	}

	book := models.Book{
		Name:        req.Name,
		Description: req.Description,
		Currency:    req.Currency,
		CreatedByID: userID,
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&book).Error; err != nil {
			return err
		}

		// Add creator as OWNER
		member := models.BookMember{
			BookID: book.ID,
			UserID: userID,
			Role:   models.RoleOwner,
		}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}

		// Seed standard categories
		if err := db.SeedDefaultCategories(tx, book.ID); err != nil {
			return err
		}

		// Seed default cash account
		cashAcc := models.Account{
			BookID: book.ID,
			Name:   "공용 현금/지갑",
			Type:   models.AccountTypeCash,
			Color:  "#10b981",
		}
		return tx.Create(&cashAcc).Error
	})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "장부 생성 중 오류가 발생했습니다."})
	}

	return c.JSON(http.StatusCreated, BookResponse{
		ID:          book.ID,
		Name:        book.Name,
		Description: book.Description,
		Currency:    book.Currency,
		Role:        models.RoleOwner,
		CreatedAt:   book.CreatedAt,
	})
}

func (h *BookHandler) GetBook(c echo.Context) error {
	userID := c.Get("user_id").(string)
	bookID := c.Param("id")

	var member models.BookMember
	if err := h.db.Preload("Book").Preload("Book.Members.User").Where("book_id = ? AND user_id = ?", bookID, userID).First(&member).Error; err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "장부에 접근할 권한이 없습니다."})
	}

	return c.JSON(http.StatusOK, member.Book)
}

type UpdateBookRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (h *BookHandler) UpdateBook(c echo.Context) error {
	userID := c.Get("user_id").(string)
	bookID := c.Param("id")

	var member models.BookMember
	if err := h.db.Where("book_id = ? AND user_id = ?", bookID, userID).First(&member).Error; err != nil || member.Role == models.RoleViewer {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "장부 수정 권한이 없습니다."})
	}

	var req UpdateBookRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	var book models.Book
	if err := h.db.First(&book, "id = ?", bookID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "장부를 찾을 수 없습니다."})
	}

	if req.Name != "" {
		book.Name = req.Name
	}
	book.Description = req.Description

	if err := h.db.Save(&book).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "장부 수정 실패"})
	}

	return c.JSON(http.StatusOK, book)
}


type CreateInvitationRequest struct {
	Role models.BookMemberRole `json:"role"`
}

func (h *BookHandler) CreateInvitation(c echo.Context) error {
	userID := c.Get("user_id").(string)
	bookID := c.Param("id")

	// Check permission (Owner or Editor)
	var member models.BookMember
	if err := h.db.Where("book_id = ? AND user_id = ?", bookID, userID).First(&member).Error; err != nil || member.Role == models.RoleViewer {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "초대 권한이 없습니다."})
	}

	var req CreateInvitationRequest
	_ = c.Bind(&req)
	if req.Role == "" {
		req.Role = models.RoleEditor
	}

	tokenBytes := make([]byte, 16)
	_, _ = rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	invitation := models.Invitation{
		BookID:      bookID,
		Token:       token,
		Role:        req.Role,
		CreatedByID: userID,
		ExpiresAt:   time.Now().Add(7 * 24 * time.Hour), // 7일간 유효
	}

	if err := h.db.Create(&invitation).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "초대 링크 생성 실패"})
	}

	return c.JSON(http.StatusCreated, invitation)
}

func (h *BookHandler) AcceptInvitation(c echo.Context) error {
	userID := c.Get("user_id").(string)
	token := c.Param("token")

	var invitation models.Invitation
	if err := h.db.Preload("Book").Where("token = ? AND is_accepted = ? AND expires_at > ?", token, false, time.Now()).First(&invitation).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "유효하지 않거나 만료된 초대 링크입니다."})
	}

	// Check if already a member
	var existingMember models.BookMember
	if err := h.db.Where("book_id = ? AND user_id = ?", invitation.BookID, userID).First(&existingMember).Error; err == nil {
		return c.JSON(http.StatusOK, map[string]string{"message": "이미 해당 장부의 멤버입니다.", "book_id": invitation.BookID})
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		member := models.BookMember{
			BookID: invitation.BookID,
			UserID: userID,
			Role:   invitation.Role,
		}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}

		invitation.IsAccepted = true
		invitation.AcceptedBy = userID
		return tx.Save(&invitation).Error
	})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "초대 수락 처리 실패"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message":   "장부에 성공적으로 합류했습니다.",
		"book_id":   invitation.BookID,
		"book_name": invitation.Book.Name,
	})
}
