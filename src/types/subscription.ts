// Type definitions for email subscription system

import { Timestamp } from 'firebase/firestore';

export type SubscriptionStatus = 'subscribed' | 'unsubscribed';

export interface Subscription {
  email: string;
  emailHash: string;
  status: SubscriptionStatus;
  
  // Timestamps
  subscribedAt: Timestamp;
  lastSubscribedAt: Timestamp;
  unsubscribedAt: Timestamp | null;
  
  // Unsubscribe token
  unsubscribeToken: string;
  
  // Tracking
  source: string;
  subscriptionCount: number;
  
  // Metadata for abuse detection
  metadata: {
    ipHash: string;
    userAgent: string;
    country: string | null;
    referrer: string | null;
    locale: string;
  };
  
  // Admin fields
  notes: string | null;
  flaggedAsSpam: boolean;
  
  // Firestore timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RateLimit {
  count: number;
  windowStart: Timestamp;
  lastAttempt: Timestamp;
  blockedUntil: Timestamp | null;
  totalAttempts: number;
}

export type AbuseType = 
  | 'rate-limit' 
  | 'spam-detected' 
  | 'invalid-email' 
  | 'honeypot-filled' 
  | 'disposable-email'
  | 'suspicious-pattern'
  | 'malicious-content';

export type AbuseSeverity = 'low' | 'medium' | 'high';

export interface AbuseLog {
  timestamp: Timestamp;
  type: AbuseType;
  severity: AbuseSeverity;
  
  details: {
    email: string | null;
    ipHash: string;
    userAgent: string;
    reason: string;
    additionalInfo: Record<string, any>;
  };
  
  resolved: boolean;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;
}

export interface SubscriptionMetrics {
  date: string; // YYYY-MM-DD
  newSubscriptions: number;
  unsubscriptions: number;
  netGrowth: number;
  rateLimitedAttempts: number;
  spamAttempts: number;
  uniqueIPs: number;
}

// API Request/Response types
export interface SubscribeRequest {
  email: string;
  honeypot?: string;
  source?: string;
  timestamp?: number; // Client timestamp for timing analysis
}

export interface SubscribeResponse {
  success: boolean;
  message: string;
  data?: {
    status: SubscriptionStatus;
    subscribedAt: string;
  };
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
  };
}

export interface UnsubscribeRequest {
  token: string;
}

export interface UnsubscribeResponse {
  success: boolean;
  message: string;
  data?: {
    email: string; // Masked
    unsubscribedAt: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Rate limit configuration
export interface RateLimitConfig {
  perIP: {
    hourly: number;
    daily: number;
  };
  perEmail: {
    hourly: number;
    daily: number;
  };
  global: {
    hourly: number;
    daily: number;
  };
  blockDuration: number; // seconds
}

// Error codes
export const ERROR_CODES = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_EMAIL: 'INVALID_EMAIL',
  DISPOSABLE_EMAIL: 'DISPOSABLE_EMAIL',
  INVALID_REQUEST: 'INVALID_REQUEST',
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ALREADY_UNSUBSCRIBED: 'ALREADY_UNSUBSCRIBED',
  SERVER_ERROR: 'SERVER_ERROR',
  SPAM_DETECTED: 'SPAM_DETECTED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
