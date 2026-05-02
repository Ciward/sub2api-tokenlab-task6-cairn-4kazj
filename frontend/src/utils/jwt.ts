/**
 * JWT utility functions for parsing and extracting claims from JWT tokens.
 * Primarily used for extracting subscription expiration from OpenAI ID tokens.
 */

/**
 * Decodes a JWT payload without validating expiration or signature.
 * Handles base64url encoding with optional padding.
 * @param token - The JWT token string
 * @returns The decoded claims object or null on failure
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode payload (second part)
    let payload = parts[1]
    // Add padding if necessary
    switch (payload.length % 4) {
      case 2:
        payload += '=='
        break
      case 3:
        payload += '='
        break
    }

    // Decode base64url
    const decoded = decodeURIComponent(
      atob(payload)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )

    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * OpenAI specific auth claims from JWT.
 */
export interface OpenAIAuthClaims {
  chatgpt_account_id?: string
  chatgpt_user_id?: string
  chatgpt_plan_type?: string
  user_id?: string
  poid?: string
  organizations?: Array<{
    id: string
    role: string
    title: string
    is_default: boolean
  }>
}

/**
 * ID Token claims structure for OpenAI.
 */
export interface OpenAIDTokenClaims {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  iat?: number
  email?: string
  email_verified?: boolean
  'https://api.openai.com/auth'?: OpenAIAuthClaims
}

/**
 * Extracts OpenAI auth claims from an ID token.
 * @param idToken - The OpenAI ID token
 * @returns The OpenAI auth claims or null if not found
 */
export function extractOpenAIAuthClaims(idToken: string): OpenAIAuthClaims | null {
  const claims = decodeJwtPayload(idToken) as OpenAIDTokenClaims | null
  if (!claims || !claims['https://api.openai.com/auth']) {
    return null
  }
  return claims['https://api.openai.com/auth']
}

/**
 * Extracts subscription expiration time from OpenAI ID token claims.
 * @param idToken - The OpenAI ID token
 * @returns The expiration timestamp in seconds (Unix time) or null if not found
 */
export function extractSubscriptionExpiryFromIdToken(idToken: string): number | null {
  const claims = decodeJwtPayload(idToken) as OpenAIDTokenClaims | null
  if (!claims) {
    return null
  }

  // Check if there's subscription expiry in the OpenAI auth claims
  const authClaims = claims['https://api.openai.com/auth']
  if (authClaims && 'subscription_expires_at' in authClaims) {
    const expiry = authClaims.subscription_expires_at as number | undefined
    if (typeof expiry === 'number' && expiry > 0) {
      return expiry
    }
  }

  // Fallback: use the standard exp claim (token expiry, not subscription)
  // This is not ideal but provides a fallback if needed
  if (typeof claims.exp === 'number' && claims.exp > 0) {
    return claims.exp
  }

  return null
}

/**
 * Extracts subscription expiration date string from OpenAI ID token.
 * @param idToken - The OpenAI ID token
 * @returns The expiration date string in ISO format or null if not found
 */
export function extractSubscriptionExpiryDateFromIdToken(idToken: string): string | null {
  const expiry = extractSubscriptionExpiryFromIdToken(idToken)
  if (!expiry) {
    return null
  }

  try {
    const date = new Date(expiry * 1000)
    if (isNaN(date.getTime())) {
      return null
    }
    return date.toISOString()
  } catch {
    return null
  }
}
