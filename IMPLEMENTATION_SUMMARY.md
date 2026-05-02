# Implementation Summary: OpenAI OAuth Metadata Sync

## Overview
This implementation adds the ability to synchronize OpenAI OAuth account metadata without refreshing the OAuth token, and display subscription expiration dates in the admin account list.

## Backend Changes

### 1. New API Endpoint
**`POST /api/v1/admin/openai/accounts/:id/sync-metadata`**

A new受管理员鉴权保护的 endpoint that:
- Validates the account exists and is an OpenAI OAuth account
- Uses the existing `access_token` to fetch account metadata from ChatGPT backend API
- Does NOT perform OAuth refresh grant (no token rotation)
- Preserves all existing token fields (`access_token`, `refresh_token`, `id_token`, `client_id`, `expires_at`)
- Updates only the following fields if available:
  - `email`
  - `chatgpt_account_id`
  - `chatgpt_user_id`
  - `organization_id`
  - `plan_type`
  - `subscription_expires_at`

### 2. Service Layer Changes
**`backend/internal/service/openai_oauth_service.go`**
- Added `SyncAccountMetadata()` method that:
  - Validates account type and platform
  - Extracts organization ID from access_token JWT if available
  - Fetches account info via `fetchChatGPTAccountInfo()` (readonly operation)
  - Attempts to extract subscription expiry from id_token claims as fallback
- Added `BuildSyncAccountCredentials()` method that:
  - Only includes fields that should be updated
  - Excludes all token fields to prevent accidental overwrites

### 3. Handler Layer Changes
**`backend/internal/handler/admin/openai_oauth_handler.go`**
- Added `SyncAccountMetadata()` handler that:
  - Validates account ID and platform match
  - Checks for OAuth account type
  - Verifies access_token exists
  - Calls the service and updates only specific credentials
  - Returns the updated account data in the same format as other account endpoints

### 4. Route Registration
**`backend/internal/server/routes/admin.go`**
- Added route registration for the new endpoint under the OpenAI OAuth routes group

## Frontend Changes

### 1. JWT Utility Functions
**`frontend/src/utils/jwt.ts`**
- `decodeJwtPayload()`: Decodes JWT payload without validation
- `extractOpenAIAuthClaims()`: Extracts OpenAI specific claims from ID token
- `extractSubscriptionExpiryFromIdToken()`: Extracts subscription expiration timestamp
- `extractSubscriptionExpiryDateFromIdToken()`: Returns formatted ISO date string
- Handles base64url encoding, missing padding, and invalid inputs gracefully

### 2. PlatformTypeBadge Component
**`frontend/src/components/common/PlatformTypeBadge.vue`**
- Added `credentials` prop to access id_token
- Added `effectiveSubscriptionExpiresAt` computed property that:
  - First uses `subscription_expires_at` from credentials if available
  - Falls back to extracting from `id_token` in credentials
- Updated date formatting to use UTC methods for consistency
- Display rules:
  - Only shows if plan_type is NOT `free`
  - Shows `MM-DD` format (e.g., `05-02`)
  - Sets full ISO date as `title` attribute for hover viewing

### 3. AccountsView Integration
**`frontend/src/views/admin/AccountsView.vue`**
- Updated `PlatformTypeBadge` usage to pass the full `credentials` object

## Test Coverage

### Backend Tests
**`backend/internal/service/openai_oauth_service_sync_test.go`**
- Tests for successful metadata sync
- Tests for invalid platform error
- Tests for invalid account type error
- Tests for missing access token error
- Tests for sync credentials building (ensures token fields are NOT included)
- Tests for JWT parsing integration

### Frontend Tests
**`frontend/src/utils/__tests__/jwt.spec.ts`**
- Tests for JWT payload decoding
- Tests for OpenAI claims extraction
- Tests for subscription expiry extraction
- Tests for edge cases (invalid tokens, missing claims, etc.)

**`frontend/src/components/common/__tests__/PlatformTypeBadge.spec.ts`**
- Tests for subscription expiration display logic
- Tests for free plan exclusion
- Tests for date formatting (MM-DD)
- Tests for UTC date handling
- Tests for title attribute setting

## Behavior Guarantees

### No Token Refresh
- The sync endpoint does NOT call `RefreshAccountToken()` or any refresh grant
- Only uses existing `access_token` for readonly API calls
- Never modifies: `access_token`, `refresh_token`, `id_token`, `client_id`, `expires_at`

### Readonly Operation
- Only calls `GET /backend-api/accounts/check/v4-2023-04-27` (readonly)
- Does NOT call the privacy setting endpoint (no write operations)
- No changes to account privacy settings or training data sharing preferences

### Error Handling
- Invalid account ID → 404 error
- Non-OpenAI platform → 400 error
- Non-OAuth account type → 400 error
- Missing access_token → 400 error
- All errors return appropriate JSON error responses

## Usage Example

```bash
curl -X POST "https://your-api.com/api/v1/admin/openai/accounts/123/sync-metadata" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Response format matches existing account endpoints:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "platform": "openai",
    "type": "oauth",
    "credentials": {
      "access_token": "...",
      "refresh_token": "...",
      "id_token": "...",
      "email": "user@example.com",
      "plan_type": "plus",
      "subscription_expires_at": "2026-05-02T20:32:12Z"
    },
    "...": "other account fields"
  }
}
```
