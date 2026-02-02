import { useEffect, useRef, useState } from 'react';
import {
    ref,
    push,
    onChildAdded,
    remove,
    query,
    orderByChild,
    startAt,
    onValue,
    set,
    onDisconnect,
    get
} from 'firebase/database';
import { database } from '@/lib/firebase';

// Google Colors
export const COLORS = [
    { r: 66, g: 133, b: 244 }, // Blue
    { r: 219, g: 68, b: 55 },  // Red
    { r: 244, g: 180, b: 0 },  // Yellow
    { r: 15, g: 157, b: 88 }   // Green
];

export type Color = typeof COLORS[0];

export type Ripple = {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    color: Color;
    life: number;
    isDrag: boolean;
};

export type ClickBurst = {
    x: number;
    y: number;
    life: number;
    color: Color;
};

interface UseCollaborativeRipplesProps {
    width: number;
    height: number;
}

export const useCollaborativeRipples = ({ width, height }: UseCollaborativeRipplesProps) => {
    const [groupId, setGroupId] = useState<number>(0);
    const [activeUsers, setActiveUsers] = useState<number>(0);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const userIdRef = useRef<string>('');
    const lastRippleTime = useRef<number>(0);
    const rippleCount = useRef<number>(0);
    const isInitialized = useRef<boolean>(false);
    const failedWrites = useRef<number>(0);

    const ripplesRef = useRef<Ripple[]>([]);
    const clickBurstsRef = useRef<ClickBurst[]>([]);
    const currentGroupIdRef = useRef<number>(0);

    // Constants
    const MAX_GROUP_SIZE = 15;
    const RATE_LIMIT_MS = 50; // Reduced from 30ms - allows 20 ripples/sec max
    const MAX_RIPPLES_PER_MINUTE = 120; // Reduced from 200 - more realistic rate
    const BURST_ALLOWANCE = 20; // Reduced from 50 - prevents overwhelming Firebase

    const dimensionsRef = useRef({ width, height });

    useEffect(() => {
        dimensionsRef.current = { width, height };
    }, [width, height]);

    useEffect(() => {
        // Generate unique user ID
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        userIdRef.current = userId;

        // Detect device type
        const isMobile = window.innerWidth < 768;
        const deviceType = isMobile ? 'mobile' : 'desktop';

        let unsubscribeRipples: (() => void) | null = null;
        let unsubscribePresence: (() => void) | null = null;

        const assignToGroup = async (): Promise<number> => {
            try {
                const groupsRef = ref(database, `groups/${deviceType}`);
                const snapshot = await get(groupsRef);

                if (!snapshot.exists()) {
                    await set(ref(database, `groups/${deviceType}/0`), {
                        count: 1,
                        lastActivity: Date.now()
                    });
                    return 0;
                }

                const groups = snapshot.val();

                for (const [groupNum, groupData] of Object.entries(groups)) {
                    const count = (groupData as any).count || 0;
                    if (count < MAX_GROUP_SIZE) {
                        await set(ref(database, `groups/${deviceType}/${groupNum}`), {
                            count: count + 1,
                            lastActivity: Date.now()
                        });
                        return parseInt(groupNum);
                    }
                }

                const newGroupId = Object.keys(groups).length;
                await set(ref(database, `groups/${deviceType}/${newGroupId}`), {
                    count: 1,
                    lastActivity: Date.now()
                });
                return newGroupId;
            } catch (error) {
                console.error('Group assignment error:', error);
                return 0;
            }
        };

        const initializeUser = async () => {
            try {
                const assignedGroup = await assignToGroup();
                currentGroupIdRef.current = assignedGroup;
                setGroupId(assignedGroup);

                const userPresenceRef = ref(database, `presence/${deviceType}/${assignedGroup}/${userId}`);

                await set(userPresenceRef, {
                    online: true,
                    joinedAt: Date.now(),
                    lastActivity: Date.now()
                });

                const disconnectRef = onDisconnect(userPresenceRef);
                await disconnectRef.remove();

                const now = Date.now();
                const ripplesPath = `ripples/${deviceType}/${assignedGroup}`;
                const ripplesRefDb = ref(database, ripplesPath);
                const realtimeQuery = query(ripplesRefDb, orderByChild('timestamp'), startAt(now));

                unsubscribeRipples = onChildAdded(realtimeQuery, (snapshot) => {
                    const data = snapshot.val();

                    if (!data || !data.timestamp || data.userId === userId) {
                        return;
                    }

                    if (typeof data.x !== 'number' || typeof data.y !== 'number' ||
                        typeof data.colorIndex !== 'number' || typeof data.isDrag !== 'boolean') {
                        return;
                    }

                    const timeDiff = Math.abs(Date.now() - data.timestamp);
                    if (timeDiff > 10000) {
                        return;
                    }

                    const { width, height } = dimensionsRef.current;

                    if (width === 0 || height === 0) {
                        return;
                    }

                    const currentAspect = width / height;
                    const rippleAspect = data.aspectRatio || 1;

                    let x = data.x * width;
                    let y = data.y * height;

                    if (Math.abs(currentAspect - rippleAspect) > 0.3) {
                        x = width * 0.5 + (data.x - 0.5) * Math.min(width, height);
                        y = height * 0.5 + (data.y - 0.5) * Math.min(width, height);
                    }

                    const color = COLORS[data.colorIndex];

                    ripplesRef.current.push({
                        x,
                        y,
                        radius: 0,
                        maxRadius: data.isDrag ? 220 : 180,
                        color: color,
                        life: 1.0,
                        isDrag: data.isDrag
                    });

                    if (!data.isDrag) {
                        clickBurstsRef.current.push({ x, y, life: 1.0, color });
                    }

                    if (snapshot.key) {
                        setTimeout(() => {
                            remove(ref(database, `${ripplesPath}/${snapshot.key}`)).catch(() => { });
                        }, 12000);
                    }
                });

                const presenceRef = ref(database, `presence/${deviceType}/${assignedGroup}`);
                unsubscribePresence = onValue(presenceRef, (snapshot) => {
                    const users = snapshot.val();
                    const count = users ? Object.keys(users).length : 0;
                    setActiveUsers(count);
                    setConnectionStatus('connected');
                    console.log(`✅ Connected to Group ${assignedGroup} | Active users: ${count}`);
                });

                isInitialized.current = true;
            } catch (error) {
                console.error('Initialization error:', error);
                setConnectionStatus('error');
                isInitialized.current = true;
            }
        };

        initializeUser();

        return () => {
            if (unsubscribeRipples) unsubscribeRipples();
            if (unsubscribePresence) unsubscribePresence();

            if (userIdRef.current) {
                remove(ref(database, `presence/${deviceType}/${currentGroupIdRef.current}/${userIdRef.current}`)).catch(() => { });
            }
        };
    }, []);

    const addRipple = (x: number, y: number, color: Color, isDrag: boolean = false) => {
        const now = Date.now();

        // Client-side courtesy check
        if (rippleCount.current >= BURST_ALLOWANCE) {
            if (now - lastRippleTime.current < RATE_LIMIT_MS) {
                return;
            }
        }

        rippleCount.current++;
        if (rippleCount.current > MAX_RIPPLES_PER_MINUTE) {
            console.warn('⚠️ Client rate limit reached');
            return;
        }

        setTimeout(() => {
            rippleCount.current = Math.max(0, rippleCount.current - 1);
        }, 60000);

        lastRippleTime.current = now;

        // ALWAYS add locally
        ripplesRef.current.push({
            x,
            y,
            radius: 0,
            maxRadius: isDrag ? 220 : 180,
            color: color,
            life: 1.0,
            isDrag: isDrag
        });

        // Broadcast to Firebase
        if (width > 0 && height > 0 && isInitialized.current) {
            const isMobile = window.innerWidth < 768;
            const deviceType = isMobile ? 'mobile' : 'desktop';

            const rippleData = {
                x: x / width,
                y: y / height,
                aspectRatio: width / height,
                colorIndex: COLORS.indexOf(color),
                isDrag: isDrag,
                timestamp: Date.now(),
                userId: userIdRef.current
            };

            push(ref(database, `ripples/${deviceType}/${currentGroupIdRef.current}`), rippleData)
                .then(() => {
                    failedWrites.current = 0;
                })
                .catch(err => {
                    failedWrites.current++;
                    
                    // Detailed error logging for debugging
                    if (failedWrites.current <= 3) {
                        console.group('🔥 Firebase Write Failed');
                        console.log('Error Code:', err.code);
                        console.log('Error Message:', err.message);
                        console.log('Failed Writes Count:', failedWrites.current);
                        console.log('Timestamp:', rippleData.timestamp, 'Current:', Date.now(), 'Diff:', Date.now() - rippleData.timestamp, 'ms');
                        console.groupEnd();
                    }
                    
                    if (err.code === 'PERMISSION_DENIED') {
                        console.warn('🛑 PERMISSION_DENIED: Timestamp validation failed in Firebase rules');
                        console.warn('💡 Tip: Check that Firebase rules allow timestamps within ±5 seconds of server time');
                    } else {
                        console.error('Firebase error:', err);
                    }

                    if (failedWrites.current === 10) {
                        console.warn('⚠️ Multiple write failures - ripples are visible locally but may not sync to other devices');
                        console.warn('💡 This usually means network latency or strict Firebase timestamp rules');
                    }
                });
        }
    };

    const addClickBurst = (x: number, y: number, color: Color) => {
        clickBurstsRef.current.push({ x, y, life: 1.0, color });
    };

    return {
        ripples: ripplesRef.current,
        clickBursts: clickBurstsRef.current,
        addRipple,
        addClickBurst,
        groupId,
        activeUsers,
        connectionStatus
    };
};
