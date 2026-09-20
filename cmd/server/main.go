package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/kinbooks/kinbooks/internal/api"
	"github.com/kinbooks/kinbooks/internal/auth"
	"github.com/kinbooks/kinbooks/internal/config"
	"github.com/kinbooks/kinbooks/internal/core"
	"github.com/kinbooks/kinbooks/internal/db"
	"github.com/kinbooks/kinbooks/internal/mcp"
	"github.com/kinbooks/kinbooks/internal/models"
	"gorm.io/gorm"
)

func main() {
	cfg := config.LoadConfig()

	// Initialize DB
	database, err := db.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("[KinBooks] 데이터베이스 초기화 실패: %v", err)
	}

	// 1. Check if running in MCP stdio mode (CLI for Antigravity / Claude Desktop)
	if len(os.Args) > 1 && os.Args[1] == "mcp" {
		runMCPStdio(database)
		return
	}

	// 2. Otherwise run normal HTTP API server
	log.Println("==================================================")
	log.Println("     KinBooks - 초경량 가족 가계부 서버 시작     ")
	log.Println("==================================================")

	router := api.SetupRouter(database, cfg.JWTSecret, cfg.DataDir)

	addr := ":" + cfg.Port
	log.Printf("[KinBooks] HTTP 서버가 http://localhost%s 에서 대기 중입니다.\n", addr)
	if err := router.Start(addr); err != nil {
		log.Fatalf("[KinBooks] 서버 종료 오류: %v", err)
	}
}

// runMCPStdio reads JSON-RPC 2.0 requests from stdin and writes responses to stdout
func runMCPStdio(database *gorm.DB) {
	mcpCmd := flag.NewFlagSet("mcp", flag.ExitOnError)
	apiKeyFlag := mcpCmd.String("key", "", "API Key for authentication")
	_ = mcpCmd.Parse(os.Args[2:])

	var userID string
	if *apiKeyFlag != "" {
		keyHash := auth.HashAPIKey(*apiKeyFlag)
		var key models.APIKey
		if err := database.Where("key_hash = ? AND is_active = ?", keyHash, true).First(&key).Error; err == nil {
			userID = key.UserID
		}
	}

	// If no key provided, default to first active user in database
	if userID == "" {
		var firstUser models.User
		if err := database.Where("is_active = ?", true).First(&firstUser).Error; err == nil {
			userID = firstUser.ID
		} else {
			fmt.Fprintf(os.Stderr, "[KinBooks MCP] 등록된 사용자가 없습니다. 먼저 웹에서 회원가입하세요.\n")
			os.Exit(1)
		}
	}

	accounting := core.NewAccountingService(database)
	mcpServer := mcp.NewServer(database, accounting)

	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var req mcp.Request
		if err := json.Unmarshal(line, &req); err != nil {
			continue
		}

		res := mcpServer.HandleRPC(userID, &req)
		if res != nil {
			resBytes, _ := json.Marshal(res)
			fmt.Println(string(resBytes))
		}
	}
}
