import { decodeJwtPayload, extractOpenAIAuthClaims, extractSubscriptionExpiryFromIdToken, extractSubscriptionExpiryDateFromIdToken } from '@/utils/jwt'

describe('jwt utils', () => {
  // Valid test JWT (simplified, not real signature)
  const validIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7ImNoYXRncHRfcGxhbl90eXBlIjoicGx1cyIsInN1YnNjcmlwdGlvbl9leHBpcmVzX2F0IjoxNzc3NTU1MjAwfSwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2Mn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

  describe('decodeJwtPayload', () => {
    it('should decode valid JWT payload', () => {
      const result = decodeJwtPayload(validIdToken)
      expect(result).not.toBeNull()
      expect(result?.sub).toBe('1234567890')
      expect(result?.email).toBe('test@example.com')
    })

    it('should return null for invalid JWT format', () => {
      expect(decodeJwtPayload('invalid')).toBeNull()
      expect(decodeJwtPayload('a.b')).toBeNull()
      expect(decodeJwtPayload('a.b.c.d')).toBeNull()
    })

    it('should handle base64url without padding', () => {
      // JWT payload without padding
      const noPaddingToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlimGZtA0nT8'
      const result = decodeJwtPayload(noPaddingToken)
      expect(result).not.toBeNull()
      expect(result?.sub).toBe('1234567890')
    })

    it('should handle edge cases gracefully', () => {
      // This is actually valid JSON {a: ''}, so it returns an object
      const validJsonToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiIn0.invalid'
      const result = decodeJwtPayload(validJsonToken)
      expect(result).not.toBeNull()
    })
  })

  describe('extractOpenAIAuthClaims', () => {
    it('should extract OpenAI auth claims from valid ID token', () => {
      const claims = extractOpenAIAuthClaims(validIdToken)
      expect(claims).not.toBeNull()
      expect(claims?.chatgpt_plan_type).toBe('plus')
      expect((claims as any)?.subscription_expires_at).toBe(1777555200)
    })

    it('should return null for token without OpenAI claims', () => {
      const simpleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlimGZtA0nT8'
      expect(extractOpenAIAuthClaims(simpleToken)).toBeNull()
    })

    it('should return null for invalid token', () => {
      expect(extractOpenAIAuthClaims('invalid')).toBeNull()
    })
  })

  describe('extractSubscriptionExpiryFromIdToken', () => {
    it('should extract subscription expiry from token claims', () => {
      const expiry = extractSubscriptionExpiryFromIdToken(validIdToken)
      expect(expiry).toBe(1777555200)
    })

    it('should return null for token without subscription expiry', () => {
      const noExpiryToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7ImNoYXRncHRfcGxhbl90eXBlIjoiZnJlZSJ9fQ.signature'
      expect(extractSubscriptionExpiryFromIdToken(noExpiryToken)).toBeNull()
    })

    it('should return null for invalid token', () => {
      expect(extractSubscriptionExpiryFromIdToken('invalid')).toBeNull()
    })
  })

  describe('extractSubscriptionExpiryDateFromIdToken', () => {
    it('should format subscription expiry as ISO date string', () => {
      const dateStr = extractSubscriptionExpiryDateFromIdToken(validIdToken)
      expect(dateStr).not.toBeNull()
      const date = new Date(dateStr!)
      expect(isNaN(date.getTime())).toBe(false)
      expect(date.getFullYear()).toBe(2026)
    })

    it('should return null for invalid expiry', () => {
      const invalidExpiryToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7InN1YnNjcmlwdGlvbl9leHBpcmVzX2F0IjoiaW52YWxpZCJ9fQ.signature'
      expect(extractSubscriptionExpiryDateFromIdToken(invalidExpiryToken)).toBeNull()
    })
  })
})
