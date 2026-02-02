// Aggressive rate limiting system optimized for Vercel deployment
// Uses Firestore for persistence across serverless function invocations

import { firestore } from './firebase';
import { collection, doc, getDoc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { sha256Hash } from './crypto';
import { RateLimitConfig } from '@/types/subscription';

// AGGRESSIVE rate limiting configuration
const RATE_LIMIT_CONFIG: RateLimitConfig = {
  perIP: {
    hourly: 3,    // Only 3 attempts per hour per IP
    daily: 10,    // Maximum 10 per day per IP
  },
  perEmail: {
    hourly: 2,    // Only 2 attempts per hour per email
    daily: 5,     // Maximum 5 per day per email
  },
  global: {
    hourly: 500,  // 500 total per hour across all users
    daily: 5000,  // 5000 total per day
  },
  blockDuration: 3600, // Block for 1 hour after limit exceeded
};

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until can retry
  reason?: string;
  remaining?: number;
}

interface RateLimitData {
  count: number;
  windowStart: number; // timestamp in ms
  lastAttempt: number;
  blockedUntil: number | null;
  totalAttempts: number;
}

/**
 * Check and enforce rate limits for IP address
 */
export async function checkIPRateLimit(ip: string): Promise<RateLimitResult> {
  const ipHash = await sha256Hash(ip);
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  const rateLimitRef = doc(firestore, 'rateLimits', 'byIP', 'limits', ipHash);
  const rateLimitDoc = await getDoc(rateLimitRef);
  
  let data: RateLimitData = {
    count: 0,
    windowStart: now,
    lastAttempt: now,
    blockedUntil: null,
    totalAttempts: 0,
  };
  
  if (rateLimitDoc.exists()) {
    const existing = rateLimitDoc.data() as RateLimitData;
    
    // Check if currently blocked
    if (existing.blockedUntil && existing.blockedUntil > now) {
      const retryAfter = Math.ceil((existing.blockedUntil - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'IP temporarily blocked due to excessive requests',
      };
    }
    
    // Reset window if needed
    if (existing.windowStart < oneHourAgo) {
      data = {
        count: 1,
        windowStart: now,
        lastAttempt: now,
        blockedUntil: null,
        totalAttempts: existing.totalAttempts + 1,
      };
    } else {
      // Increment count in current window
      data = {
        ...existing,
        count: existing.count + 1,
        lastAttempt: now,
        totalAttempts: existing.totalAttempts + 1,
      };
      
      // Check hourly limit
      if (data.count > RATE_LIMIT_CONFIG.perIP.hourly) {
        data.blockedUntil = now + (RATE_LIMIT_CONFIG.blockDuration * 1000);
        await setDoc(rateLimitRef, data);
        
        return {
          allowed: false,
          retryAfter: RATE_LIMIT_CONFIG.blockDuration,
          reason: `Too many attempts from your IP. Limit: ${RATE_LIMIT_CONFIG.perIP.hourly} per hour`,
        };
      }
      
      // Check daily limit (look at total attempts in last 24 hours)
      // This is a simplified check - in production you'd query a time-series collection
      if (existing.windowStart > oneDayAgo && data.count > RATE_LIMIT_CONFIG.perIP.daily) {
        data.blockedUntil = now + (RATE_LIMIT_CONFIG.blockDuration * 3 * 1000); // 3 hour block
        await setDoc(rateLimitRef, data);
        
        return {
          allowed: false,
          retryAfter: RATE_LIMIT_CONFIG.blockDuration * 3,
          reason: `Daily limit exceeded. Limit: ${RATE_LIMIT_CONFIG.perIP.daily} per day`,
        };
      }
    }
  } else {
    // First request from this IP
    data.count = 1;
    data.totalAttempts = 1;
  }
  
  // Save updated rate limit data
  await setDoc(rateLimitRef, data);
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.perIP.hourly - data.count,
  };
}

/**
 * Check and enforce rate limits for email address
 */
export async function checkEmailRateLimit(email: string): Promise<RateLimitResult> {
  const emailHash = await sha256Hash(email.toLowerCase());
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  const rateLimitRef = doc(firestore, 'rateLimits', 'byEmail', 'limits', emailHash);
  const rateLimitDoc = await getDoc(rateLimitRef);
  
  let data: RateLimitData = {
    count: 0,
    windowStart: now,
    lastAttempt: now,
    blockedUntil: null,
    totalAttempts: 0,
  };
  
  if (rateLimitDoc.exists()) {
    const existing = rateLimitDoc.data() as RateLimitData;
    
    // Check if currently blocked
    if (existing.blockedUntil && existing.blockedUntil > now) {
      const retryAfter = Math.ceil((existing.blockedUntil - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'This email address has been used too many times recently',
      };
    }
    
    // Reset window if needed
    if (existing.windowStart < oneHourAgo) {
      data = {
        count: 1,
        windowStart: now,
        lastAttempt: now,
        blockedUntil: null,
        totalAttempts: existing.totalAttempts + 1,
      };
    } else {
      // Increment count in current window
      data = {
        ...existing,
        count: existing.count + 1,
        lastAttempt: now,
        totalAttempts: existing.totalAttempts + 1,
      };
      
      // Check hourly limit
      if (data.count > RATE_LIMIT_CONFIG.perEmail.hourly) {
        data.blockedUntil = now + (RATE_LIMIT_CONFIG.blockDuration * 2 * 1000); // 2 hour block
        await setDoc(rateLimitRef, data);
        
        return {
          allowed: false,
          retryAfter: RATE_LIMIT_CONFIG.blockDuration * 2,
          reason: `This email was submitted too many times. Limit: ${RATE_LIMIT_CONFIG.perEmail.hourly} per hour`,
        };
      }
    }
  } else {
    data.count = 1;
    data.totalAttempts = 1;
  }
  
  // Save updated rate limit data
  await setDoc(rateLimitRef, data);
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.perEmail.hourly - data.count,
  };
}

/**
 * Check and enforce global rate limits
 */
export async function checkGlobalRateLimit(): Promise<RateLimitResult> {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  const globalRef = doc(firestore, 'rateLimits', 'global', 'stats', 'hourly');
  const globalDoc = await getDoc(globalRef);
  
  let data: RateLimitData = {
    count: 0,
    windowStart: now,
    lastAttempt: now,
    blockedUntil: null,
    totalAttempts: 0,
  };
  
  if (globalDoc.exists()) {
    const existing = globalDoc.data() as RateLimitData;
    
    // Reset window if needed
    if (existing.windowStart < oneHourAgo) {
      data = {
        count: 1,
        windowStart: now,
        lastAttempt: now,
        blockedUntil: null,
        totalAttempts: existing.totalAttempts + 1,
      };
    } else {
      data = {
        ...existing,
        count: existing.count + 1,
        lastAttempt: now,
        totalAttempts: existing.totalAttempts + 1,
      };
      
      // Check global limit
      if (data.count > RATE_LIMIT_CONFIG.global.hourly) {
        return {
          allowed: false,
          retryAfter: 300, // Try again in 5 minutes
          reason: 'System experiencing high traffic. Please try again in a few minutes.',
        };
      }
    }
  } else {
    data.count = 1;
    data.totalAttempts = 1;
  }
  
  // Save updated global rate limit
  await setDoc(globalRef, data);
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.global.hourly - data.count,
  };
}

/**
 * Check all rate limits (IP, email, global)
 * Returns the most restrictive result
 */
export async function checkAllRateLimits(
  ip: string,
  email: string
): Promise<RateLimitResult> {
  // Run all checks in parallel
  const [ipResult, emailResult, globalResult] = await Promise.all([
    checkIPRateLimit(ip),
    checkEmailRateLimit(email),
    checkGlobalRateLimit(),
  ]);
  
  // Return first failure
  if (!ipResult.allowed) return ipResult;
  if (!emailResult.allowed) return emailResult;
  if (!globalResult.allowed) return globalResult;
  
  // All passed
  return {
    allowed: true,
    remaining: Math.min(
      ipResult.remaining || 0,
      emailResult.remaining || 0,
      globalResult.remaining || 0
    ),
  };
}

/**
 * Manually block an IP or email (for admin use)
 */
export async function manualBlock(
  type: 'ip' | 'email',
  identifier: string,
  durationHours: number
): Promise<void> {
  const hash = await sha256Hash(identifier);
  const now = Date.now();
  const blockedUntil = now + (durationHours * 60 * 60 * 1000);
  
  const collection_name = type === 'ip' ? 'byIP' : 'byEmail';
  const ref = doc(firestore, 'rateLimits', collection_name, 'limits', hash);
  
  await setDoc(ref, {
    count: 999,
    windowStart: now,
    lastAttempt: now,
    blockedUntil,
    totalAttempts: 999,
  });
}

/**
 * Get rate limit configuration (for display to users)
 */
export function getRateLimitConfig(): RateLimitConfig {
  return RATE_LIMIT_CONFIG;
}
