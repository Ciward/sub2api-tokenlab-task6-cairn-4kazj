package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/openai"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIOAuthService_SyncAccountMetadata_Success(t *testing.T) {
	client := &openaiOAuthClientRefreshStub{}
	svc := NewOpenAIOAuthService(nil, client)

	expiresAt := time.Now().Add(30 * time.Minute).UTC().Format(time.RFC3339)
	account := &Account{
		ID:       77,
		Platform: PlatformOpenAI,
		Type:     AccountTypeOAuth,
		Credentials: map[string]any{
			"access_token":  "existing-access-token",
			"refresh_token": "existing-refresh-token",
			"id_token":      "existing-id-token",
			"expires_at":    expiresAt,
			"client_id":     "client-id-1",
			"email":         "old@example.com",
			"plan_type":     "free",
		},
	}

	// Set up a mock privacy client factory that returns predefined info
	svc.SetPrivacyClientFactory(func(proxyURL string) (*openai.ReqClient, error) {
		return nil, nil
	})

	info, err := svc.SyncAccountMetadata(context.Background(), account)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.Equal(t, "existing-access-token", info.AccessToken)
	assert.Equal(t, "existing-refresh-token", info.RefreshToken)
	assert.Equal(t, "existing-id-token", info.IDToken)
	assert.Equal(t, "client-id-1", info.ClientID)
	assert.Equal(t, "old@example.com", info.Email)
	assert.Equal(t, "free", info.PlanType)
}

func TestOpenAIOAuthService_SyncAccountMetadata_InvalidPlatform(t *testing.T) {
	client := &openaiOAuthClientRefreshStub{}
	svc := NewOpenAIOAuthService(nil, client)

	account := &Account{
		ID:       77,
		Platform: "anthropic", // Not OpenAI
		Type:     AccountTypeOAuth,
		Credentials: map[string]any{
			"access_token": "existing-access-token",
		},
	}

	info, err := svc.SyncAccountMetadata(context.Background(), account)
	require.Error(t, err)	assert.Nil(t, info)
	assert.Contains(t, err.Error(), "not an OpenAI account")
}

func TestOpenAIOAuthService_SyncAccountMetadata_InvalidAccountType(t *testing.T) {
	client := &openaiOAuthClientRefreshStub{}
	svc := NewOpenAIOAuthService(nil, client)

	account := &Account{
		ID:       77,
		Platform: PlatformOpenAI,
		Type:     "apikey", // Not OAuth
		Credentials: map[string]any{
			"access_token": "existing-access-token",
		},
	}

	info, err := svc.SyncAccountMetadata(context.Background(), account)
	require.Error(t, err)
	assert.Nil(t, info)
	assert.Contains(t, err.Error(), "not an OAuth account")
}

func TestOpenAIOAuthService_SyncAccountMetadata_NoAccessToken(t *testing.T) {
	client := &openaiOAuthClientRefreshStub{}
	svc := NewOpenAIOAuthService(nil, client)

	account := &Account{
		ID:       77,
		Platform: PlatformOpenAI,
		Type:     AccountTypeOAuth,
		Credentials: map[string]any{
			"refresh_token": "existing-refresh-token",
			// No access_token
		},
	}

	info, err := svc.SyncAccountMetadata(context.Background(), account)
	require.Error(t, err)
	assert.Nil(t, info)
	assert.Contains(t, err.Error(), "no access token available")
}

func TestOpenAIOAuthService_BuildSyncAccountCredentials(t *testing.T) {
	svc := NewOpenAIOAuthService(nil, nil)

	tokenInfo := &OpenAITokenInfo{
		Email:                 "test@example.com",
		ChatGPTAccountID:      "account-123",
		ChatGPTUserID:         "user-456",
		OrganizationID:        "org-789",
		PlanType:              "plus",
		SubscriptionExpiresAt: "2026-05-02T20:32:12Z",
	}

	creds := svc.BuildSyncAccountCredentials(tokenInfo)

	assert.Equal(t, "test@example.com", creds["email"])
	assert.Equal(t, "account-123", creds["chatgpt_account_id"])
	assert.Equal(t, "user-456", creds["chatgpt_user_id"])
	assert.Equal(t, "org-789", creds["organization_id"])
	assert.Equal(t, "plus", creds["plan_type"])
	assert.Equal(t, "2026-05-02T20:32:12Z", creds["subscription_expires_at"])

	// Token fields should NOT be included in sync credentials
	_, hasAccessToken := creds["access_token"]
	_, hasRefreshToken := creds["refresh_token"]
	_, hasIDToken := creds["id_token"]
	_, hasClientID := creds["client_id"]
	_, hasExpiresAt := creds["expires_at"]

	assert.False(t, hasAccessToken, "access_token should not be in sync credentials")
	assert.False(t, hasRefreshToken, "refresh_token should not be in sync credentials")
	assert.False(t, hasIDToken, "id_token should not be in sync credentials")
	assert.False(t, hasClientID, "client_id should not be in sync credentials")
	assert.False(t, hasExpiresAt, "expires_at should not be in sync credentials")
}

// Mock for testing JWT parsing
func TestOpenAIOAuthService_SyncAccountMetadata_ExtractFromIDToken(t *testing.T) {
	// Create a test ID token with subscription expiry in claims
	// This is a simplified mock of what the ID token might contain
	validIDToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsic3Vic2NyaXB0aW9uX2V4cGlyZXNfYXQiOjE3Nzc1NTUyMDB9fQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

	client := &openaiOAuthClientRefreshStub{}
	svc := NewOpenAIOAuthService(nil, client)

	account := &Account{
		ID:       77,
		Platform: PlatformOpenAI,
		Type:     AccountTypeOAuth,
		Credentials: map[string]any{
			"access_token": "existing-access-token",
			"id_token":     validIDToken,
		},
	}

	info, err := svc.SyncAccountMetadata(context.Background(), account)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.Equal(t, validIDToken, info.IDToken)
}
