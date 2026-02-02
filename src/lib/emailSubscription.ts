// Core email subscription logic

import { firestore } from './firebase';
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { sha256Hash, generateUUID, maskEmail } from './crypto';
import { Subscription, SubscriptionStatus } from '@/types/subscription';

/**
 * Subscribe an email address
 */
export async function subscribeEmail(
  email: string,
  metadata: {
    ipHash: string;
    userAgent: string;
    country?: string | null;
    referrer?: string | null;
    locale: string;
  },
  source: string = 'homepage'
): Promise<{ success: boolean; alreadySubscribed: boolean; subscription: Partial<Subscription> }> {
  const emailHash = await sha256Hash(email.toLowerCase());
  const subscriptionRef = doc(firestore, 'subscriptions', emailHash);
  
  // Check if already exists
  const existingDoc = await getDoc(subscriptionRef);
  
  if (existingDoc.exists()) {
    const existingData = existingDoc.data() as Subscription;
    
    // If already subscribed, return early
    if (existingData.status === 'subscribed') {
      return {
        success: true,
        alreadySubscribed: true,
        subscription: {
          email: maskEmail(email),
          status: 'subscribed',
          subscribedAt: existingData.subscribedAt,
        },
      };
    }
    
    // If previously unsubscribed, re-subscribe
    if (existingData.status === 'unsubscribed') {
      const now = Timestamp.now();
      await updateDoc(subscriptionRef, {
        status: 'subscribed',
        lastSubscribedAt: now,
        unsubscribedAt: null,
        subscriptionCount: existingData.subscriptionCount + 1,
        updatedAt: now,
        // Update metadata with latest info
        metadata: {
          ipHash: metadata.ipHash,
          userAgent: metadata.userAgent,
          country: metadata.country ?? null,
          referrer: metadata.referrer ?? null,
          locale: metadata.locale,
        },
      });
      
      return {
        success: true,
        alreadySubscribed: false,
        subscription: {
          email: maskEmail(email),
          status: 'subscribed',
          subscribedAt: now,
        },
      };
    }
  }
  
  // Create new subscription
  const now = Timestamp.now();
  const unsubscribeToken = generateUUID();
  
  const newSubscription: Subscription = {
    email,
    emailHash,
    status: 'subscribed',
    subscribedAt: now,
    lastSubscribedAt: now,
    unsubscribedAt: null,
    unsubscribeToken,
    source,
    subscriptionCount: 1,
    metadata: {
      ipHash: metadata.ipHash,
      userAgent: metadata.userAgent,
      country: metadata.country ?? null,
      referrer: metadata.referrer ?? null,
      locale: metadata.locale,
    },
    notes: null,
    flaggedAsSpam: false,
    createdAt: now,
    updatedAt: now,
  };
  
  await setDoc(subscriptionRef, newSubscription);
  
  return {
    success: true,
    alreadySubscribed: false,
    subscription: {
      email: maskEmail(email),
      status: 'subscribed',
      subscribedAt: now,
    },
  };
}

/**
 * Unsubscribe an email using token
 */
export async function unsubscribeEmail(
  token: string
): Promise<{ success: boolean; email: string; notFound: boolean; alreadyUnsubscribed: boolean }> {
  // Query Firestore for subscription with this token
  // Note: This requires a Firestore index on unsubscribeToken field
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  
  const subscriptionsRef = collection(firestore, 'subscriptions');
  const q = query(subscriptionsRef, where('unsubscribeToken', '==', token));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return {
      success: false,
      email: '',
      notFound: true,
      alreadyUnsubscribed: false,
    };
  }
  
  const subscriptionDoc = querySnapshot.docs[0];
  const subscription = subscriptionDoc.data() as Subscription;
  
  // Check if already unsubscribed
  if (subscription.status === 'unsubscribed') {
    return {
      success: true,
      email: maskEmail(subscription.email),
      notFound: false,
      alreadyUnsubscribed: true,
    };
  }
  
  // Update to unsubscribed status
  const now = Timestamp.now();
  await updateDoc(subscriptionDoc.ref, {
    status: 'unsubscribed',
    unsubscribedAt: now,
    updatedAt: now,
  });
  
  return {
    success: true,
    email: maskEmail(subscription.email),
    notFound: false,
    alreadyUnsubscribed: false,
  };
}

/**
 * Get subscription by email hash (for admin/internal use)
 */
export async function getSubscriptionByEmail(email: string): Promise<Subscription | null> {
  const emailHash = await sha256Hash(email.toLowerCase());
  const subscriptionRef = doc(firestore, 'subscriptions', emailHash);
  const subscriptionDoc = await getDoc(subscriptionRef);
  
  if (!subscriptionDoc.exists()) {
    return null;
  }
  
  return subscriptionDoc.data() as Subscription;
}

/**
 * Check if email is already subscribed
 */
export async function isEmailSubscribed(email: string): Promise<boolean> {
  const subscription = await getSubscriptionByEmail(email);
  return subscription !== null && subscription.status === 'subscribed';
}

/**
 * Log subscription metrics (for analytics)
 */
export async function logSubscriptionMetrics(
  type: 'subscription' | 'unsubscription',
  ipHash: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const metricsRef = doc(firestore, 'subscriptionMetrics', today);
  
  try {
    const metricsDoc = await getDoc(metricsRef);
    
    if (metricsDoc.exists()) {
      const data = metricsDoc.data();
      const updates: any = {
        updatedAt: Timestamp.now(),
      };
      
      if (type === 'subscription') {
        updates.newSubscriptions = (data.newSubscriptions || 0) + 1;
        updates.netGrowth = (data.netGrowth || 0) + 1;
      } else {
        updates.unsubscriptions = (data.unsubscriptions || 0) + 1;
        updates.netGrowth = (data.netGrowth || 0) - 1;
      }
      
      await updateDoc(metricsRef, updates);
    } else {
      // Create new metrics document
      await setDoc(metricsRef, {
        date: today,
        newSubscriptions: type === 'subscription' ? 1 : 0,
        unsubscriptions: type === 'unsubscription' ? 1 : 0,
        netGrowth: type === 'subscription' ? 1 : -1,
        rateLimitedAttempts: 0,
        spamAttempts: 0,
        uniqueIPs: 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error('Error logging subscription metrics:', error);
    // Don't throw - metrics logging shouldn't break the main flow
  }
}
