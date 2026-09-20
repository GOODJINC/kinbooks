package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/kinbooks/kinbooks/internal/models"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type JWTClaims struct {
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	jwt.RegisteredClaims
}

// HashPassword hashes a raw password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash compares password with hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateToken creates a signed JWT token valid for 30 days
func GenerateToken(userID, email, displayName, secret string) (string, error) {
	claims := &JWTClaims{
		UserID:      userID,
		Email:       email,
		DisplayName: displayName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// HashAPIKey computes SHA-256 hash of a raw API key
func HashAPIKey(rawKey string) string {
	hash := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(hash[:])
}

// CreateAPIKey generates a new kin_live_... API key
func CreateAPIKey(userID, name string) (rawKey string, apiKey models.APIKey, err error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", models.APIKey{}, err
	}
	secretHex := hex.EncodeToString(bytes)
	rawKey = "kin_live_" + secretHex
	prefix := rawKey[:16] + "..."

	apiKey = models.APIKey{
		UserID:    userID,
		Name:      name,
		KeyPrefix: prefix,
		KeyHash:   HashAPIKey(rawKey),
		IsActive:  true,
	}
	return rawKey, apiKey, nil
}

// AuthMiddleware validates either JWT or API Key
func AuthMiddleware(secret string, db *gorm.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			tokenString := ""

			// 1. Try X-API-Key header
			apiKeyHeader := c.Request().Header.Get("X-API-Key")
			if apiKeyHeader != "" {
				tokenString = apiKeyHeader
			}

			// 2. Try Authorization header (Bearer ...)
			if tokenString == "" {
				authHeader := c.Request().Header.Get("Authorization")
				if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
					tokenString = strings.TrimPrefix(authHeader, "Bearer ")
				}
			}

			// 3. Try Cookie if header not present
			if tokenString == "" {
				cookie, err := c.Cookie("kinbooks_token")
				if err == nil && cookie.Value != "" {
					tokenString = cookie.Value
				}
			}

			if tokenString == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "인증 토큰 또는 API Key가 필요합니다."})
			}

			// If token starts with "kin_live_", validate as API Key
			if strings.HasPrefix(tokenString, "kin_live_") {
				keyHash := HashAPIKey(tokenString)
				var apiKey models.APIKey
				if err := db.Preload("User").Where("key_hash = ? AND is_active = ?", keyHash, true).First(&apiKey).Error; err != nil {
					return c.JSON(http.StatusUnauthorized, map[string]string{"error": "유효하지 않거나 비활성화된 API Key입니다."})
				}

				now := time.Now()
				apiKey.LastUsedAt = &now
				db.Model(&apiKey).Update("last_used_at", now)

				c.Set("user_id", apiKey.UserID)
				c.Set("email", apiKey.User.Email)
				c.Set("display_name", apiKey.User.DisplayName)
				c.Set("auth_type", "api_key")
				return next(c)
			}

			// Otherwise, validate as JWT Token
			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("unexpected signing method")
				}
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "유효하지 않거나 만료된 토큰입니다."})
			}

			c.Set("user_id", claims.UserID)
			c.Set("email", claims.Email)
			c.Set("display_name", claims.DisplayName)
			c.Set("auth_type", "jwt")

			return next(c)
		}
	}
}
