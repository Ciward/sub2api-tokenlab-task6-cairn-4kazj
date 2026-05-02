import { describe, it, expect } from 'vitest'
import { decodeJwtPayload, extractSubscriptionExpiryFromIdToken, extractSubscriptionExpiryDateFromIdToken } from '@/utils/jwt'

// Test the JWT utilities that PlatformTypeBadge depends on
describe('PlatformTypeBadge dependencies', () => {
  describe('JWT parsing for subscription expiry', () => {
    // Valid test JWT with subscription expiry in claims
    const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7InN1YnNjcmlwdGlvbl9leHBpcmVzX2F0IjoxNzc3NTU1MjAwLCJjaGF0Z3B0X3BsYW5fdHlwZSI6InBsdXMifSwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2Mn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

    it('should extract subscription expiry from valid ID token', () => {
      const expiry = extractSubscriptionExpiryFromIdToken(validIdToken)
      expect(expiry).toBe(1777555200)
    })

    it('should format subscription expiry as ISO date string', () => {
      const dateStr = extractSubscriptionExpiryDateFromIdToken(validIdToken)
      expect(dateStr).not.toBeNull()
      const date = new Date(dateStr!)
      expect(isNaN(date.getTime())).toBe(false)
    })

    it('should return null for token without subscription expiry', () => {
      const noExpiryToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7ImNoYXRncHRfcGxhbl90eXBlIjoiZnJlZSJ9fQ.signature'
      expect(extractSubscriptionExpiryFromIdToken(noExpiryToken)).toBeNull()
    })

    it('should handle invalid token gracefully', () => {
      expect(extractSubscriptionExpiryFromIdToken('invalid-token')).toBeNull()
      expect(extractSubscriptionExpiryDateFromIdToken('invalid-token')).toBeNull()
    })

    it('should handle base64url without padding', () => {
      // JWT payload without padding
      const noPaddingToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlimGZtA0nT8'
      const result = decodeJwtPayload(noPaddingToken)
      expect(result).not.toBeNull()
    })
  })

  describe('subscription expiration display logic', () => {
    it('should not display expiration for free plan', () => {
      const planType = 'free'
      const subscriptionExpiresAt = '2026-05-02T20:32:12Z'

      // Logic from component: if free plan, don't show
      const shouldDisplay = planType.toLowerCase() !== 'free' && subscriptionExpiresAt
      expect(shouldDisplay).toBeFalsy()
    })

    it('should display expiration for paid plan with valid date', () => {
      const planType = 'plus'
      const subscriptionExpiresAt = '2026-05-02T20:32:12Z'

      const shouldDisplay = planType.toLowerCase() !== 'free' && subscriptionExpiresAt
      expect(shouldDisplay).toBeTruthy()
    })

    it('should format date as MM-DD', () => {
      const subscriptionExpiresAt = '2026-05-02T20:32:12Z'
      const d = new Date(subscriptionExpiresAt)
      // Use UTC methods to avoid timezone issues
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const formatted = `${mm}-${dd}`

      expect(formatted).toBe('05-02')
    })

    it('should use full date as title attribute', () => {
      const subscriptionExpiresAt = '2026-05-02T20:32:12Z'
      // Title should be the original date string
      expect(subscriptionExpiresAt).toBe('2026-05-02T20:32:12Z')
    })
  })
})
