// Advanced spam detection mechanisms

import { sha256Hash } from './crypto';

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  confidence: number; // 0-1, higher = more confident it's spam
  flags: string[];
}

/**
 * Check honeypot field
 * The honeypot field should be empty - if it's filled, it's a bot
 */
export function checkHoneypot(honeypotValue: string | undefined): SpamCheckResult {
  if (honeypotValue && honeypotValue.trim() !== '') {
    return {
      isSpam: true,
      reason: 'Honeypot field was filled',
      confidence: 1.0,
      flags: ['honeypot-filled'],
    };
  }
  
  return {
    isSpam: false,
    confidence: 0,
    flags: [],
  };
}

/**
 * Analyze timing patterns to detect bot behavior
 * Bots often submit forms much faster than humans
 */
export function checkSubmissionTiming(clientTimestamp?: number): SpamCheckResult {
  if (!clientTimestamp) {
    return { isSpam: false, confidence: 0, flags: [] };
  }
  
  const now = Date.now();
  const timeDiff = now - clientTimestamp;
  
  // Form submitted in less than 2 seconds (too fast for human)
  if (timeDiff < 2000) {
    return {
      isSpam: true,
      reason: 'Form submitted too quickly (possible bot)',
      confidence: 0.9,
      flags: ['submission-too-fast'],
    };
  }
  
  // Form submitted after more than 1 hour (suspicious, possible script)
  if (timeDiff > 3600000) {
    return {
      isSpam: true,
      reason: 'Form submitted after suspicious delay',
      confidence: 0.6,
      flags: ['submission-delayed'],
    };
  }
  
  return {
    isSpam: false,
    confidence: 0,
    flags: [],
  };
}

/**
 * Check User-Agent for suspicious patterns
 */
export function checkUserAgent(userAgent: string): SpamCheckResult {
  const flags: string[] = [];
  let confidence = 0;
  
  // No user agent (suspicious)
  if (!userAgent || userAgent.trim() === '') {
    return {
      isSpam: true,
      reason: 'Missing User-Agent header',
      confidence: 0.8,
      flags: ['no-user-agent'],
    };
  }
  
  // Known bot patterns
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java(?!script)/i, // Match "Java" but not "JavaScript"
    /go-http/i,
    /okhttp/i,
    /axios/i,
    /node-fetch/i,
  ];
  
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      flags.push('bot-user-agent');
      confidence = 0.9;
    }
  }
  
  // Extremely short user agent (suspicious)
  if (userAgent.length < 20) {
    flags.push('short-user-agent');
    confidence = Math.max(confidence, 0.7);
  }
  
  // Very old browsers (rare in 2026, might be spoofed)
  if (userAgent.includes('MSIE 6.0') || userAgent.includes('MSIE 7.0')) {
    flags.push('outdated-browser');
    confidence = Math.max(confidence, 0.6);
  }
  
  if (confidence > 0.5) {
    return {
      isSpam: true,
      reason: 'Suspicious User-Agent detected',
      confidence,
      flags,
    };
  }
  
  return {
    isSpam: false,
    confidence: 0,
    flags: [],
  };
}

/**
 * Check if IP is from known problematic sources
 * (VPNs, proxies, Tor, etc.)
 */
export async function checkIPReputation(ip: string): Promise<SpamCheckResult> {
  const flags: string[] = [];
  let confidence = 0;
  
  // Check for common VPN/proxy IP ranges (simplified)
  // In production, use a service like IPHub, IPQualityScore, or MaxMind
  
  // Local/private IPs (shouldn't happen in production but check anyway)
  if (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip === '::1' ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fd00:')
  ) {
    flags.push('private-ip');
    confidence = 0.5;
  }
  
  // For now, we'll skip external API calls to avoid latency
  // But in production, consider integrating with:
  // - IPHub: https://iphub.info/api
  // - IPQualityScore: https://www.ipqualityscore.com/
  // - StopForumSpam: https://www.stopforumspam.com/api
  
  if (confidence > 0.5) {
    return {
      isSpam: true,
      reason: 'Suspicious IP address detected',
      confidence,
      flags,
    };
  }
  
  return {
    isSpam: false,
    confidence: 0,
    flags: [],
  };
}

/**
 * Analyze email patterns for bot behavior
 */
export function checkEmailPatterns(email: string): SpamCheckResult {
  const flags: string[] = [];
  let confidence = 0;
  
  const local = email.split('@')[0];
  
  // Extremely long local part (suspicious)
  if (local.length > 50) {
    flags.push('long-local-part');
    confidence = 0.5;
  }
  
  // All numbers (suspicious for real users)
  if (/^\d+$/.test(local)) {
    flags.push('numeric-only');
    confidence = Math.max(confidence, 0.6);
  }
  
  // Random-looking string (many consonants in a row, etc.)
  const consonantStreak = /[bcdfghjklmnpqrstvwxyz]{6,}/i;
  if (consonantStreak.test(local)) {
    flags.push('random-string');
    confidence = Math.max(confidence, 0.7);
  }
  
  // Many special characters
  const specialCharCount = (local.match(/[^a-zA-Z0-9]/g) || []).length;
  if (specialCharCount > 5) {
    flags.push('many-special-chars');
    confidence = Math.max(confidence, 0.6);
  }
  
  if (confidence > 0.5) {
    return {
      isSpam: true,
      reason: 'Email shows suspicious patterns',
      confidence,
      flags,
    };
  }
  
  return {
    isSpam: false,
    confidence: 0,
    flags: [],
  };
}

/**
 * Master spam detection function that combines all checks
 */
export async function detectSpam(data: {
  email: string;
  honeypot?: string;
  timestamp?: number;
  userAgent: string;
  ip: string;
}): Promise<SpamCheckResult> {
  // Run all spam checks
  const checks = await Promise.all([
    Promise.resolve(checkHoneypot(data.honeypot)),
    Promise.resolve(checkSubmissionTiming(data.timestamp)),
    Promise.resolve(checkUserAgent(data.userAgent)),
    checkIPReputation(data.ip),
    Promise.resolve(checkEmailPatterns(data.email)),
  ]);
  
  // Aggregate results
  const allFlags: string[] = [];
  let maxConfidence = 0;
  let spamReason = '';
  
  for (const result of checks) {
    allFlags.push(...result.flags);
    if (result.confidence > maxConfidence) {
      maxConfidence = result.confidence;
      spamReason = result.reason || '';
    }
    
    // If any check is definitive spam (confidence >= 0.9), return immediately
    if (result.isSpam && result.confidence >= 0.9) {
      return {
        isSpam: true,
        reason: result.reason,
        confidence: result.confidence,
        flags: allFlags,
      };
    }
  }
  
  // Calculate aggregate spam score
  const avgConfidence = checks.reduce((sum, c) => sum + c.confidence, 0) / checks.length;
  
  // If average confidence is high or multiple checks flagged, mark as spam
  if (avgConfidence > 0.5 || allFlags.length >= 3) {
    return {
      isSpam: true,
      reason: spamReason || 'Multiple spam indicators detected',
      confidence: maxConfidence,
      flags: allFlags,
    };
  }
  
  return {
    isSpam: false,
    confidence: maxConfidence,
    flags: allFlags,
  };
}

/**
 * Log spam attempt to Firestore for analysis
 */
export async function logSpamAttempt(
  spamResult: SpamCheckResult,
  email: string,
  ip: string,
  userAgent: string
): Promise<void> {
  // Import here to avoid circular dependencies
  const { firestore } = await import('./firebase');
  const { collection, addDoc, Timestamp } = await import('firebase/firestore');
  
  const emailHash = await sha256Hash(email);
  const ipHash = await sha256Hash(ip);
  
  await addDoc(collection(firestore, 'abuseLog'), {
    timestamp: Timestamp.now(),
    type: 'spam-detected',
    severity: spamResult.confidence > 0.8 ? 'high' : spamResult.confidence > 0.5 ? 'medium' : 'low',
    details: {
      email: emailHash,
      ipHash,
      userAgent,
      reason: spamResult.reason || 'Spam detected',
      additionalInfo: {
        confidence: spamResult.confidence,
        flags: spamResult.flags,
      },
    },
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
  });
}
