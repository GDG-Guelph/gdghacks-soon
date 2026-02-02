// Subscribe API endpoint with comprehensive security

import { NextRequest, NextResponse } from 'next/server';
import { validateEmail, normalizeEmail } from '@/lib/emailValidator';
import { checkAllRateLimits } from '@/lib/rateLimiter';
import { detectSpam, logSpamAttempt } from '@/lib/spamDetection';
import { subscribeEmail, logSubscriptionMetrics } from '@/lib/emailSubscription';
import { sha256Hash } from '@/lib/crypto';
import { ERROR_CODES, type SubscribeRequest, type SubscribeResponse } from '@/types/subscription';

/**
 * Get client IP address from request
 * Handles various proxy headers that Vercel uses
 */
function getClientIP(request: NextRequest): string {
  // Try various headers in order of preference
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const vercelIP = request.headers.get('x-vercel-forwarded-for');
  if (vercelIP) {
    return vercelIP;
  }
  
  // Fallback (shouldn't happen in production)
  return 'unknown';
}

/**
 * Get country from Vercel geolocation headers
 */
function getCountry(request: NextRequest): string | null {
  return request.headers.get('x-vercel-ip-country') || null;
}

/**
 * POST /api/subscribe
 * Subscribe an email address to the mailing list
 */
export async function POST(request: NextRequest): Promise<NextResponse<SubscribeResponse>> {
  try {
    // Parse request body
    const body: SubscribeRequest = await request.json();
    const { email: rawEmail, honeypot, source = 'homepage', timestamp } = body;
    
    // Get client information
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const country = getCountry(request);
    const referrer = request.headers.get('referer') || null;
    const locale = request.headers.get('accept-language')?.split(',')[0] || 'en';
    
    // === SECURITY CHECK 1: Honeypot ===
    if (honeypot && honeypot.trim() !== '') {
      // Silently log and return fake success (don't let bot know it failed)
      const ipHash = await sha256Hash(ip);
      await logSpamAttempt(
        {
          isSpam: true,
          reason: 'Honeypot filled',
          confidence: 1.0,
          flags: ['honeypot-filled'],
        },
        rawEmail || 'unknown',
        ip,
        userAgent
      );
      
      // Return fake success to not alert the bot
      return NextResponse.json({
        success: true,
        message: 'Thanks for subscribing! We\'ll keep you updated.',
      });
    }
    
    // === VALIDATION: Email Format ===
    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Email address is required',
          error: {
            code: ERROR_CODES.INVALID_EMAIL,
            message: 'Email address is required',
          },
        },
        { status: 400 }
      );
    }
    
    const email = normalizeEmail(rawEmail);
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: emailValidation.reason || 'Invalid email address',
          error: {
            code: ERROR_CODES.INVALID_EMAIL,
            message: emailValidation.reason || 'Invalid email address',
          },
        },
        { status: 400 }
      );
    }
    
    // === SECURITY CHECK 2: Rate Limiting ===
    const rateLimitResult = await checkAllRateLimits(ip, email);
    if (!rateLimitResult.allowed) {
      // Log rate limit hit
      const metricsRef = await import('firebase/firestore').then(m => m.doc);
      const { firestore } = await import('@/lib/firebase');
      const today = new Date().toISOString().split('T')[0];
      const metricsDocRef = metricsRef(firestore, 'subscriptionMetrics', today);
      
      try {
        const { getDoc, updateDoc, increment, Timestamp } = await import('firebase/firestore');
        const metricsDoc = await getDoc(metricsDocRef);
        if (metricsDoc.exists()) {
          await updateDoc(metricsDocRef, {
            rateLimitedAttempts: increment(1),
            updatedAt: Timestamp.now(),
          });
        }
      } catch (error) {
        console.error('Error logging rate limit metric:', error);
      }
      
      return NextResponse.json(
        {
          success: false,
          message: rateLimitResult.reason || 'Too many requests. Please try again later.',
          error: {
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            message: rateLimitResult.reason || 'Too many requests',
            retryAfter: rateLimitResult.retryAfter,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
            'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
          },
        }
      );
    }
    
    // === SECURITY CHECK 3: Spam Detection ===
    const spamResult = await detectSpam({
      email,
      honeypot,
      timestamp,
      userAgent,
      ip,
    });
    
    if (spamResult.isSpam) {
      // Log spam attempt
      await logSpamAttempt(spamResult, email, ip, userAgent);
      
      // Log spam metric
      const metricsRef = await import('firebase/firestore').then(m => m.doc);
      const { firestore } = await import('@/lib/firebase');
      const today = new Date().toISOString().split('T')[0];
      const metricsDocRef = metricsRef(firestore, 'subscriptionMetrics', today);
      
      try {
        const { getDoc, updateDoc, increment, Timestamp } = await import('firebase/firestore');
        const metricsDoc = await getDoc(metricsDocRef);
        if (metricsDoc.exists()) {
          await updateDoc(metricsDocRef, {
            spamAttempts: increment(1),
            updatedAt: Timestamp.now(),
          });
        }
      } catch (error) {
        console.error('Error logging spam metric:', error);
      }
      
      // Return generic error (don't reveal spam detection)
      return NextResponse.json(
        {
          success: false,
          message: 'Unable to process your request. Please try again later.',
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Unable to process your request',
          },
        },
        { status: 400 }
      );
    }
    
    // === SUBSCRIPTION: Add to database ===
    const ipHash = await sha256Hash(ip);
    const result = await subscribeEmail(
      email,
      {
        ipHash,
        userAgent,
        country,
        referrer,
        locale,
      },
      source
    );
    
    // Log metrics
    if (!result.alreadySubscribed) {
      await logSubscriptionMetrics('subscription', ipHash);
    }
    
    // === SUCCESS RESPONSE ===
    if (result.alreadySubscribed) {
      return NextResponse.json({
        success: true,
        message: 'You\'re already subscribed! We\'ll keep you updated.',
        data: {
          status: 'subscribed',
          subscribedAt: result.subscription.subscribedAt?.toDate().toISOString() || new Date().toISOString(),
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Thanks for subscribing! We\'ll keep you updated.',
      data: {
        status: 'subscribed',
        subscribedAt: result.subscription.subscribedAt?.toDate().toISOString() || new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Subscribe API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred. Please try again later.',
        error: {
          code: ERROR_CODES.SERVER_ERROR,
          message: 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

// Block all other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
