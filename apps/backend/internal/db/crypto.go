package db

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
)

const encryptedPrefix = "enc:v1:"

// tokenKey returns the 32-byte AES key derived from ORCHESTRA_TOKEN_KEY.
// Returns nil if the env var is unset or empty (encryption disabled).
func tokenKey() []byte {
	raw := strings.TrimSpace(os.Getenv("ORCHESTRA_TOKEN_KEY"))
	if raw == "" {
		return nil
	}
	h := sha256.Sum256([]byte(raw))
	return h[:]
}

// EncryptToken encrypts a plaintext token using AES-256-GCM.
// If ORCHESTRA_TOKEN_KEY is not set, returns the plaintext unchanged.
func EncryptToken(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key := tokenKey()
	if key == nil {
		return plaintext, nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encryptedPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptToken decrypts a token previously encrypted with EncryptToken.
// If the token does not have the encrypted prefix, it is returned as-is
// (backward-compatible with plaintext tokens stored before encryption was enabled).
func DecryptToken(stored string) (string, error) {
	if stored == "" {
		return "", nil
	}
	if !strings.HasPrefix(stored, encryptedPrefix) {
		return stored, nil
	}

	key := tokenKey()
	if key == nil {
		return "", errors.New("encrypted token found but ORCHESTRA_TOKEN_KEY is not set")
	}

	data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(stored, encryptedPrefix))
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
