// Unsubscribe API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeEmail, logSubscriptionMetrics } from '@/lib/emailSubscription';
import { sha256Hash } from '@/lib/crypto';
import { ERROR_CODES, type UnsubscribeRequest, type UnsubscribeResponse } from '@/types/subscription';

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
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
  
  return 'unknown';
}

/**
 * POST /api/unsubscribe
 * Unsubscribe an email using the unsubscribe token
 */
export async function POST(request: NextRequest): Promise<NextResponse<UnsubscribeResponse>> {
  try {
    // Parse request body
    const body: UnsubscribeRequest = await request.json();
    const { token } = body;
    
    // Validate token
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid unsubscribe token',
          error: {
            code: ERROR_CODES.INVALID_TOKEN,
            message: 'Unsubscribe token is required',
          },
        },
        { status: 400 }
      );
    }
    
    // Validate token format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid unsubscribe link',
          error: {
            code: ERROR_CODES.INVALID_TOKEN,
            message: 'Invalid token format',
          },
        },
        { status: 400 }
      );
    }
    
    // Unsubscribe
    const result = await unsubscribeEmail(token);
    
    if (result.notFound) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid or expired unsubscribe link',
          error: {
            code: ERROR_CODES.INVALID_TOKEN,
            message: 'Subscription not found',
          },
        },
        { status: 404 }
      );
    }
    
    // Log metrics if not already unsubscribed
    if (!result.alreadyUnsubscribed) {
      const ip = getClientIP(request);
      const ipHash = await sha256Hash(ip);
      await logSubscriptionMetrics('unsubscription', ipHash);
    }
    
    // Success response
    if (result.alreadyUnsubscribed) {
      return NextResponse.json({
        success: true,
        message: 'You were already unsubscribed',
        data: {
          email: result.email,
          unsubscribedAt: new Date().toISOString(),
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'You\'ve been successfully unsubscribed. Sorry to see you go!',
      data: {
        email: result.email,
        unsubscribedAt: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Unsubscribe API error:', error);
    
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
