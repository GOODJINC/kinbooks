package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/kinbooks/kinbooks/internal/ai"
	"github.com/kinbooks/kinbooks/internal/auth"
	"github.com/kinbooks/kinbooks/internal/core"
	"github.com/kinbooks/kinbooks/internal/mcp"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gorm.io/gorm"
)

type Server struct {
	echo *echo.Echo
	db   *gorm.DB
}

func SetupRouter(database *gorm.DB, jwtSecret string, dataDir string) *echo.Echo {
	e := echo.New()

	// Global Middlewares
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-API-Key"},
		AllowCredentials: true,
	}))

	// Services & Handlers
	accountingService := core.NewAccountingService(database)
	parserService := ai.NewParserService(database)
	mcpServer := mcp.NewServer(database, accountingService)

	authHandler := NewAuthHandler(database, jwtSecret)
	bookHandler := NewBookHandler(database)
	accountHandler := NewAccountHandler(database, accountingService)
	categoryHandler := NewCategoryHandler(database)
	txHandler := NewTransactionHandler(database, accountingService)
	apiKeyHandler := NewAPIKeyHandler(database)
	aiHandler := NewAIHandler(database, parserService)
	mcpHandler := NewMCPHandler(mcpServer)
	receiptHandler := NewReceiptHandler(dataDir)
	adminHandler := NewAdminHandler(database)
	systemHandler := NewSystemHandler(database)
	exportImportHandler := NewExportImportHandler(database, accountingService)

	// Static uploads directory serving
	e.Static("/uploads", filepath.Join(dataDir, "uploads"))

	// API v1
	v1 := e.Group("/api/v1")

	// Public Health Check
	v1.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "ok",
			"service": "KinBooks Core",
			"version": "1.0.0",
		})
	})

	// Public System Configuration (App Name, Enabled Modules)
	v1.GET("/system/config", systemHandler.GetPublicConfig)

	// Public Auth Routes
	authGroup := v1.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)

	// Protected Routes (Supports JWT Cookie/Header or Bearer/X-API-Key)
	protected := v1.Group("")
	protected.Use(auth.AuthMiddleware(jwtSecret, database))

	// User Profile Info & Update
	protected.GET("/auth/me", authHandler.Me)
	protected.PUT("/auth/profile", authHandler.UpdateProfile)

	// API Keys Management
	protected.GET("/apikeys", apiKeyHandler.GetAPIKeys)
	protected.POST("/apikeys", apiKeyHandler.CreateAPIKey)
	protected.DELETE("/apikeys/:id", apiKeyHandler.RevokeAPIKey)

	// Books (장부)
	protected.GET("/books", bookHandler.GetBooks)
	protected.POST("/books", bookHandler.CreateBook)
	protected.GET("/books/:id", bookHandler.GetBook)
	protected.PUT("/books/:id", bookHandler.UpdateBook)
	protected.POST("/books/:id/invitations", bookHandler.CreateInvitation)
	protected.POST("/invitations/:token/accept", bookHandler.AcceptInvitation)

	// Book Data Export & Import (Backup & Restore)
	protected.GET("/books/:bookId/export", exportImportHandler.ExportBookData)
	protected.POST("/books/:bookId/import", exportImportHandler.ImportBookData)

	// Accounts (계좌 & 카드)
	protected.GET("/books/:bookId/accounts", accountHandler.GetAccounts)
	protected.POST("/books/:bookId/accounts", accountHandler.CreateAccount)
	protected.PUT("/accounts/:id", accountHandler.UpdateAccount)
	protected.GET("/cards/:id/billing", accountHandler.GetCardBillingInfo)

	// Categories (카테고리)
	protected.GET("/books/:bookId/categories", categoryHandler.GetCategories)
	protected.POST("/books/:bookId/categories", categoryHandler.CreateCategory)
	protected.PUT("/categories/:id", categoryHandler.UpdateCategory)
	protected.DELETE("/categories/:id", categoryHandler.DeleteCategory)

	// Transactions (거래 내역)
	protected.GET("/books/:bookId/transactions", txHandler.GetTransactions)
	protected.POST("/books/:bookId/transactions", txHandler.CreateTransaction)
	protected.PUT("/transactions/:id", txHandler.UpdateTransaction)
	protected.DELETE("/transactions/:id", txHandler.DeleteTransaction)
	protected.GET("/books/:bookId/summary", txHandler.GetMonthlySummary)
	protected.GET("/books/:bookId/stats/categories", txHandler.GetCategoryStats)

	// Receipts Upload
	protected.POST("/receipts/upload", receiptHandler.UploadReceipt)

	// Admin Console (Settings, Users, SMTP Mail)
	adminGroup := protected.Group("/admin")
	adminGroup.GET("/settings", adminHandler.GetSettings)
	adminGroup.PUT("/settings", adminHandler.UpdateSettings)
	adminGroup.GET("/users", adminHandler.GetUsers)
	adminGroup.PUT("/users/:id", adminHandler.UpdateUser)
	adminGroup.POST("/mail/test", adminHandler.TestMail)

	// AI & Natural Language
	protected.GET("/ai/settings", aiHandler.GetSettings)
	protected.POST("/ai/settings", aiHandler.UpdateSettings)
	protected.POST("/ai/parse", aiHandler.ParseText)

	// MCP (Model Context Protocol JSON-RPC Endpoint)
	protected.POST("/mcp", mcpHandler.HandleMCP)

	// Static Web Frontend Serving (SPA Fallback)
	distDir := "./web/dist"
	if _, err := os.Stat(distDir); err == nil {
		e.Static("/assets", filepath.Join(distDir, "assets"))
		e.File("/icon.svg", filepath.Join(distDir, "icon.svg"))
		e.File("/manifest.json", filepath.Join(distDir, "manifest.json"))
		e.File("/sw.js", filepath.Join(distDir, "sw.js"))
		e.File("/favicon.ico", filepath.Join(distDir, "icon.svg"))

		// Fallback for all other routes to index.html (SPA routing)
		e.GET("/*", func(c echo.Context) error {
			path := c.Request().URL.Path
			if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/uploads") {
				return echo.ErrNotFound
			}
			cleanPath := filepath.Clean(path)
			targetFile := filepath.Join(distDir, cleanPath)
			if fi, err := os.Stat(targetFile); err == nil && !fi.IsDir() {
				return c.File(targetFile)
			}
			return c.File(filepath.Join(distDir, "index.html"))
		})
	}

	return e
}
