package config

import (
	"os"
)

type Config struct {
	Port      string
	DBPath    string
	JWTSecret string
	DataDir   string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = dataDir + "/kinbooks.db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "kinbooks-dev-super-secret-key-change-in-prod"
	}

	return &Config{
		Port:      port,
		DBPath:    dbPath,
		JWTSecret: jwtSecret,
		DataDir:   dataDir,
	}
}
