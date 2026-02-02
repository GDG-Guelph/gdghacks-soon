// Comprehensive email validation with multiple layers of checks

import { isDisposableEmail } from '@/utils/disposableEmails';

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}

/**
 * RFC 5322 compliant email regex
 * More permissive but catches most invalid formats
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate email format according to RFC 5321/5322
 */
function validateEmailFormat(email: string): EmailValidationResult {
  // Length check (RFC 5321)
  if (email.length > 254) {
    return {
      valid: false,
      reason: 'Email address is too long (max 254 characters)',
      severity: 'low',
    };
  }
  
  if (email.length < 3) {
    return {
      valid: false,
      reason: 'Email address is too short',
      severity: 'low',
    };
  }
  
  // Must contain @
  if (!email.includes('@')) {
    return {
      valid: false,
      reason: 'Email address must contain @',
      severity: 'low',
    };
  }
  
  const [local, ...domainParts] = email.split('@');
  const domain = domainParts.join('@'); // In case @ appears multiple times
  
  // Local part max 64 chars (RFC 5321)
  if (local.length > 64) {
    return {
      valid: false,
      reason: 'Local part of email is too long (max 64 characters)',
      severity: 'low',
    };
  }
  
  // Domain must exist and have at least one dot
  if (!domain || !domain.includes('.')) {
    return {
      valid: false,
      reason: 'Invalid email domain',
      severity: 'low',
    };
  }
  
  // Apply regex validation
  if (!EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      reason: 'Email address format is invalid',
      severity: 'low',
    };
  }
  
  return { valid: true };
}

/**
 * Check for suspicious patterns that might indicate spam or test data
 */
function checkSuspiciousPatterns(email: string): EmailValidationResult {
  const suspiciousPatterns = [
    {
      pattern: /^test@/i,
      reason: 'Test email addresses are not allowed',
    },
    {
      pattern: /^admin@/i,
      reason: 'Admin email addresses are suspicious',
    },
    {
      pattern: /^no-?reply@/i,
      reason: 'No-reply email addresses are not allowed',
    },
    {
      pattern: /^(.)\1{4,}@/,
      reason: 'Email contains suspicious repeated characters',
    },
    {
      pattern: /@example\.(com|org|net|edu)$/i,
      reason: 'Example domain emails are not allowed',
    },
    {
      pattern: /@localhost$/i,
      reason: 'Localhost emails are not allowed',
    },
    {
      pattern: /@127\.0\.0\.1$/,
      reason: 'IP-based email addresses are not allowed',
    },
    {
      pattern: /^webmaster@/i,
      reason: 'Webmaster email addresses are suspicious',
    },
    {
      pattern: /^postmaster@/i,
      reason: 'Postmaster email addresses are suspicious',
    },
    {
      pattern: /^abuse@/i,
      reason: 'Abuse email addresses are suspicious',
    },
    {
      pattern: /^spam@/i,
      reason: 'Spam email addresses are not allowed',
    },
  ];
  
  for (const { pattern, reason } of suspiciousPatterns) {
    if (pattern.test(email)) {
      return {
        valid: false,
        reason,
        severity: 'medium',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Check for malicious content (SQL injection, XSS attempts)
 */
function checkMaliciousContent(email: string): EmailValidationResult {
  const maliciousPatterns = [
    // SQL injection patterns
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDROP\b|\bDELETE\b|\bUPDATE\b)/i,
    /(--|\/\*|\*\/)/,
    /('|")/,
    
    // XSS patterns
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    
    // Other suspicious patterns
    /\.\./,  // Directory traversal
    /\x00/,  // Null byte
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(email)) {
      return {
        valid: false,
        reason: 'Email contains potentially malicious content',
        severity: 'high',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Check if email is from a disposable/temporary email provider
 */
function checkDisposableEmail(email: string): EmailValidationResult {
  if (isDisposableEmail(email)) {
    return {
      valid: false,
      reason: 'Temporary/disposable email addresses are not allowed',
      severity: 'medium',
    };
  }
  
  return { valid: true };
}

/**
 * Check for common typos in popular email domains
 */
function checkCommonTypos(email: string): EmailValidationResult {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return { valid: true };
  
  const commonTypos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmaiil.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmil.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yahho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outloo.com': 'outlook.com',
    'outlok.com': 'outlook.com',
  };
  
  if (commonTypos[domain]) {
    return {
      valid: false,
      reason: `Did you mean ${commonTypos[domain]}?`,
      severity: 'low',
    };
  }
  
  return { valid: true };
}

/**
 * Main email validation function that runs all checks
 */
export function validateEmail(email: string): EmailValidationResult {
  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();
  
  // Run all validation checks
  const checks = [
    validateEmailFormat(normalizedEmail),
    checkMaliciousContent(normalizedEmail),
    checkSuspiciousPatterns(normalizedEmail),
    checkDisposableEmail(normalizedEmail),
    checkCommonTypos(normalizedEmail),
  ];
  
  // Return first failure
  for (const result of checks) {
    if (!result.valid) {
      return result;
    }
  }
  
  // All checks passed
  return { valid: true };
}

/**
 * Quick email format check (for client-side validation)
 */
export function isValidEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Normalize email address for consistent storage
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
