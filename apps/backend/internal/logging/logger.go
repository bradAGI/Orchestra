package logging

import (
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
)

func New() zerolog.Logger {
	level := zerolog.InfoLevel
	if env := os.Getenv("LOG_LEVEL"); env != "" {
		if parsed, err := zerolog.ParseLevel(env); err == nil {
			level = parsed
		}
	}
	zerolog.SetGlobalLevel(level)

	consoleWriter := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}

	logPath := os.Getenv("ORCHESTRA_LOG_FILE")
	if logPath == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			logPath = filepath.Join(home, ".orchestra", "orchestrad.log")
		} else {
			logPath = "/tmp/orchestrad.log"
		}
	}

	if err := os.MkdirAll(filepath.Dir(logPath), 0700); err != nil {
		return zerolog.New(consoleWriter).With().Timestamp().Str("app", "orchestra-backend").Logger()
	}

	logFile, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return zerolog.New(consoleWriter).With().Timestamp().Str("app", "orchestra-backend").Logger()
	}

	multi := zerolog.MultiLevelWriter(consoleWriter, logFile)

	return zerolog.New(multi).
		With().
		Timestamp().
		Str("app", "orchestra-backend").
		Logger()
}
