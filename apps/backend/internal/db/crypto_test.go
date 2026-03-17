package db

import (
	"os"
	"strings"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	t.Setenv("ORCHESTRA_TOKEN_KEY", "test-secret-key-for-crypto")

	original := "ghp_abc123_my_secret_token"
	encrypted, err := EncryptToken(original)
	if err != nil {
		t.Fatalf("EncryptToken failed: %v", err)
	}

	if !strings.HasPrefix(encrypted, encryptedPrefix) {
		t.Fatalf("encrypted token should have prefix %q, got %q", encryptedPrefix, encrypted)
	}

	if encrypted == original {
		t.Fatal("encrypted token should differ from plaintext")
	}

	decrypted, err := DecryptToken(encrypted)
	if err != nil {
		t.Fatalf("DecryptToken failed: %v", err)
	}

	if decrypted != original {
		t.Fatalf("decrypted token %q does not match original %q", decrypted, original)
	}
}

func TestEncryptDecryptEmptyString(t *testing.T) {
	t.Setenv("ORCHESTRA_TOKEN_KEY", "some-key")

	encrypted, err := EncryptToken("")
	if err != nil {
		t.Fatalf("EncryptToken on empty string failed: %v", err)
	}
	if encrypted != "" {
		t.Fatalf("expected empty string, got %q", encrypted)
	}

	decrypted, err := DecryptToken("")
	if err != nil {
		t.Fatalf("DecryptToken on empty string failed: %v", err)
	}
	if decrypted != "" {
		t.Fatalf("expected empty string, got %q", decrypted)
	}
}

func TestDecryptPlaintextPassthrough(t *testing.T) {
	// A token without the encrypted prefix should be returned as-is
	// regardless of whether the key is set.
	t.Setenv("ORCHESTRA_TOKEN_KEY", "some-key")

	plaintext := "ghp_plaintext_token_no_prefix"
	result, err := DecryptToken(plaintext)
	if err != nil {
		t.Fatalf("DecryptToken on plaintext failed: %v", err)
	}
	if result != plaintext {
		t.Fatalf("expected passthrough %q, got %q", plaintext, result)
	}
}

func TestDecryptWithWrongKey(t *testing.T) {
	t.Setenv("ORCHESTRA_TOKEN_KEY", "correct-key")

	encrypted, err := EncryptToken("secret-data")
	if err != nil {
		t.Fatalf("EncryptToken failed: %v", err)
	}

	// Switch to a different key
	t.Setenv("ORCHESTRA_TOKEN_KEY", "wrong-key")

	_, err = DecryptToken(encrypted)
	if err == nil {
		t.Fatal("DecryptToken with wrong key should fail, but got nil error")
	}
}

func TestEncryptWithoutKeyReturnsPlaintext(t *testing.T) {
	// Ensure the env var is unset
	os.Unsetenv("ORCHESTRA_TOKEN_KEY")
	t.Setenv("ORCHESTRA_TOKEN_KEY", "")

	token := "ghp_should_stay_plaintext"
	result, err := EncryptToken(token)
	if err != nil {
		t.Fatalf("EncryptToken without key failed: %v", err)
	}
	if result != token {
		t.Fatalf("expected plaintext %q unchanged, got %q", token, result)
	}
}

func TestDecryptEncryptedTokenWithoutKeyErrors(t *testing.T) {
	t.Setenv("ORCHESTRA_TOKEN_KEY", "temp-key")

	encrypted, err := EncryptToken("some-token")
	if err != nil {
		t.Fatalf("EncryptToken failed: %v", err)
	}

	// Remove the key
	t.Setenv("ORCHESTRA_TOKEN_KEY", "")

	_, err = DecryptToken(encrypted)
	if err == nil {
		t.Fatal("DecryptToken should fail when key is missing for encrypted token")
	}
	if !strings.Contains(err.Error(), "ORCHESTRA_TOKEN_KEY is not set") {
		t.Fatalf("unexpected error message: %v", err)
	}
}
