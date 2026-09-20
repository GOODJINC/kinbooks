package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type ReceiptHandler struct {
	dataDir string
}

func NewReceiptHandler(dataDir string) *ReceiptHandler {
	uploadDir := filepath.Join(dataDir, "uploads")
	_ = os.MkdirAll(uploadDir, 0755)
	return &ReceiptHandler{dataDir: dataDir}
}

// UploadReceipt receives an image file (multipart/form-data) and saves it to data/uploads
func (h *ReceiptHandler) UploadReceipt(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "업로드할 파일이 없습니다."})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "파일을 열 수 없습니다."})
	}
	defer src.Close()

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".webp"
	}

	uploadDir := filepath.Join(h.dataDir, "uploads")
	_ = os.MkdirAll(uploadDir, 0755)

	newFileName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dstPath := filepath.Join(uploadDir, newFileName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "파일 저장 실패"})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "파일 복사 실패"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"url": fmt.Sprintf("/uploads/%s", newFileName),
	})
}
