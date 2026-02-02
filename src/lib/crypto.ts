// Cryptographic utilities for hashing and token generation

/**
 * Generate SHA-256 hash of input string
 * Used for email hashing, IP hashing, etc.
 */
export async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generate a secure random UUID v4
 * Used for unsubscribe tokens
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Mask email address for privacy
 * Example: john.doe@example.com -> j***@example.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  
  return `${local[0]}***@${domain}`;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate a short hash for logging (first 8 characters of SHA-256)
 */
export async function shortHash(input: string): Promise<string> {
  const fullHash = await sha256Hash(input);
  return fullHash.substring(0, 8);
}
