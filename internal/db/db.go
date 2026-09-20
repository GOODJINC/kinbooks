package db

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/glebarez/sqlite"
	"github.com/kinbooks/kinbooks/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB initializes SQLite with WAL mode and runs schema migrations
func InitDB(dbPath string) (*gorm.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	// Enable WAL mode & foreign keys via connection string parameters
	dsn := dbPath + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)&_pragma=synchronous(NORMAL)"
	
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}

	// Run auto migrations
	err = db.AutoMigrate(
		&models.User{},
		&models.Book{},
		&models.BookMember{},
		&models.Invitation{},
		&models.Account{},
		&models.Category{},
		&models.Transaction{},
		&models.Entry{},
		&models.APIKey{},
		&models.AISetting{},
		&models.SystemSetting{},
	)
	if err != nil {
		return nil, err
	}

	// Ensure at least one admin exists if users exist
	var adminCount int64
	db.Model(&models.User{}).Where("is_admin = ?", true).Count(&adminCount)
	if adminCount == 0 {
		var firstUser models.User
		if err := db.Order("created_at asc").First(&firstUser).Error; err == nil {
			db.Model(&firstUser).Update("is_admin", true)
			log.Printf("[KinBooks] 첫 번째 사용자(%s)를 시스템 관리자(Admin)로 자동 지정했습니다.", firstUser.Email)
		}
	}

	// Backfill empty usernames from email if any
	var emptyUsernameUsers []models.User
	db.Where("username = ? OR username IS NULL", "").Find(&emptyUsernameUsers)
	for _, u := range emptyUsernameUsers {
		uname := u.Email
		if parts := strings.Split(u.Email, "@"); len(parts) > 0 && parts[0] != "" {
			uname = parts[0]
		}
		db.Model(&u).Update("username", uname)
		log.Printf("[KinBooks] 기존 사용자(%s)의 기본 아이디를 '%s'로 설정했습니다.", u.Email, uname)
	}

	log.Printf("[KinBooks] Database connected and migrated successfully: %s", dbPath)
	return db, nil
}

// SeedDefaultCategories populates standard Korean household categories for a new book
func SeedDefaultCategories(db *gorm.DB, bookID string) error {
	defaultExpenseCategories := []struct {
		Name  string
		Icon  string
		Color string
	}{
		{"식비", "Utensils", "#ef4444"},
		{"카페/간식", "Coffee", "#f97316"},
		{"교통/차량", "Car", "#3b82f6"},
		{"주거/통신", "Home", "#8b5cf6"},
		{"쇼핑/생활", "ShoppingBag", "#ec4899"},
		{"취미/여가", "Gamepad2", "#06b6d4"},
		{"의료/건강", "HeartPulse", "#10b981"},
		{"금융/보험", "ShieldCheck", "#64748b"},
		{"경조/선물", "Gift", "#eab308"},
		{"기타 지출", "MoreHorizontal", "#94a3b8"},
	}

	for i, cat := range defaultExpenseCategories {
		category := models.Category{
			BookID: bookID,
			Name:   cat.Name,
			Type:   models.CategoryExpense,
			Icon:   cat.Icon,
			Color:  cat.Color,
			Order:  i + 1,
		}
		if err := db.Create(&category).Error; err != nil {
			return err
		}
	}

	defaultIncomeCategories := []struct {
		Name  string
		Icon  string
		Color string
	}{
		{"급여/월급", "Briefcase", "#3b82f6"},
		{"상여/보너스", "Coins", "#10b981"},
		{"용돈", "Wallet", "#8b5cf6"},
		{"금융소득", "TrendingUp", "#06b6d4"},
		{"기타 수입", "PlusCircle", "#94a3b8"},
	}

	for i, cat := range defaultIncomeCategories {
		category := models.Category{
			BookID: bookID,
			Name:   cat.Name,
			Type:   models.CategoryIncome,
			Icon:   cat.Icon,
			Color:  cat.Color,
			Order:  i + 1,
		}
		if err := db.Create(&category).Error; err != nil {
			return err
		}
	}

	return nil
}
