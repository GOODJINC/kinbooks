package api

import (
	"net/http"

	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type CategoryHandler struct {
	db *gorm.DB
}

func NewCategoryHandler(database *gorm.DB) *CategoryHandler {
	return &CategoryHandler{db: database}
}

func (h *CategoryHandler) GetCategories(c echo.Context) error {
	bookID := c.Param("bookId")

	var categories []models.Category
	if err := h.db.Where("book_id = ?", bookID).Order("type ASC, `order` ASC").Find(&categories).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "카테고리 목록 조회 실패"})
	}

	return c.JSON(http.StatusOK, categories)
}

type CreateCategoryRequest struct {
	ParentID *string             `json:"parent_id,omitempty"`
	Name     string              `json:"name"`
	Type     models.CategoryType `json:"type"`
	Icon     string              `json:"icon"`
	Color    string              `json:"color"`
}

func (h *CategoryHandler) CreateCategory(c echo.Context) error {
	bookID := c.Param("bookId")

	var req CreateCategoryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	if req.Name == "" || req.Type == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "카테고리 이름과 유형은 필수입니다."})
	}

	if req.Color == "" {
		req.Color = "#10b981"
	}

	category := models.Category{
		BookID:   bookID,
		ParentID: req.ParentID,
		Name:     req.Name,
		Type:     req.Type,
		Icon:     req.Icon,
		Color:    req.Color,
	}

	if err := h.db.Create(&category).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "카테고리 생성 실패"})
	}

	return c.JSON(http.StatusCreated, category)
}

type UpdateCategoryRequest struct {
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
	Order *int   `json:"order"`
}

func (h *CategoryHandler) UpdateCategory(c echo.Context) error {
	id := c.Param("id")

	var category models.Category
	if err := h.db.First(&category, "id = ?", id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "카테고리를 찾을 수 없습니다."})
	}

	var req UpdateCategoryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "잘못된 요청 형식입니다."})
	}

	if req.Name != "" {
		category.Name = req.Name
	}
	if req.Icon != "" {
		category.Icon = req.Icon
	}
	if req.Color != "" {
		category.Color = req.Color
	}
	if req.Order != nil {
		category.Order = *req.Order
	}

	if err := h.db.Save(&category).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "카테고리 수정 실패"})
	}

	return c.JSON(http.StatusOK, category)
}

func (h *CategoryHandler) DeleteCategory(c echo.Context) error {
	id := c.Param("id")

	var count int64
	h.db.Model(&models.Entry{}).Where("category_id = ?", id).Count(&count)
	if count > 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "해당 카테고리를 사용하는 거래 내역이 있어 삭제할 수 없습니다."})
	}

	if err := h.db.Delete(&models.Category{}, "id = ?", id).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "카테고리 삭제 실패"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "카테고리가 삭제되었습니다."})
}

