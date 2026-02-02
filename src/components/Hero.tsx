'use client';

import React, { useState, useEffect } from 'react';

const Hero = () => {
    const [email, setEmail] = useState('');
    const [honeypot, setHoneypot] = useState(''); // Honeypot field for spam detection
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [formLoadTime, setFormLoadTime] = useState<number>(0);
    const [cooldownUntil, setCooldownUntil] = useState<number>(0);

    // Track when form was loaded (for timing analysis)
    useEffect(() => {
        setFormLoadTime(Date.now());
        
        // Check if there's an active cooldown
        const savedCooldown = sessionStorage.getItem('subscription_cooldown');
        if (savedCooldown) {
            const cooldown = parseInt(savedCooldown, 10);
            if (cooldown > Date.now()) {
                setCooldownUntil(cooldown);
            } else {
                sessionStorage.removeItem('subscription_cooldown');
            }
        }
    }, []);

    // Update cooldown timer
    useEffect(() => {
        if (cooldownUntil <= Date.now()) return;
        
        const timer = setInterval(() => {
            if (Date.now() >= cooldownUntil) {
                setCooldownUntil(0);
                sessionStorage.removeItem('subscription_cooldown');
            }
        }, 1000);
        
        return () => clearInterval(timer);
    }, [cooldownUntil]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        // Check cooldown
        if (cooldownUntil > Date.now()) {
            const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
            setStatus('error');
            setMessage(`Please wait ${remainingSeconds} seconds before trying again`);
            return;
        }
        
        // Basic client-side email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setStatus('error');
            setMessage('Please enter a valid email address');
            return;
        }
        
        setStatus('loading');
        setMessage('');
        
        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    honeypot, // Include honeypot (should be empty)
                    source: 'homepage',
                    timestamp: formLoadTime,
                }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                setStatus('success');
                setMessage(data.message || 'Thanks for subscribing! We\'ll keep you updated.');
                setEmail('');
                
                // Set 60-second cooldown
                const cooldown = Date.now() + 60000;
                setCooldownUntil(cooldown);
                sessionStorage.setItem('subscription_cooldown', cooldown.toString());
                
                // Reset success message after 10 seconds
                setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                }, 10000);
            } else {
                setStatus('error');
                setMessage(data.message || 'Something went wrong. Please try again.');
                
                // Reset error message after 5 seconds
                setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                }, 5000);
            }
        } catch (error) {
            console.error('Subscription error:', error);
            setStatus('error');
            setMessage('Unable to connect. Please try again later.');
            
            // Reset error message after 5 seconds
            setTimeout(() => {
                setStatus('idle');
                setMessage('');
            }, 5000);
        }
    };

    const isLoading = status === 'loading';
    const isCooldown = cooldownUntil > Date.now();
    const isDisabled = isLoading || isCooldown;

    return (
        <section className="relative z-10 flex flex-col items-start justify-center min-h-screen px-8 md:px-16 text-left pointer-events-none">
            <div className="max-w-4xl mt-10">
                
                {/* Coming Soon Badge */}
                <div className="inline-block mb-6 pointer-events-auto">
                    <div className="px-4 py-2 text-sm font-bold text-[#1a73e8] bg-blue-50 rounded-full border border-blue-200">
                        Coming Soon
                    </div>
                </div>

                {/* Main Heading */}
                <div className="space-y-2 pointer-events-auto mb-8">
                    <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter leading-tight pb-2 drop-shadow-sm">
                        <span className="text-[#1a73e8]">
                            GDGHacks 2026
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-800 max-w-2xl font-medium leading-relaxed">
                        Guelph's In-Person Hackathon. <span className="text-slate-600 font-normal">Build, learn, and connect with 500+ innovators.</span>
                    </p>
                </div>

                {/* Mailing List Form */}
                <div className="pointer-events-auto max-w-xl">
                    <p className="text-base md:text-lg text-slate-700 mb-6 font-medium">
                        Be the first to know when applications open.
                    </p>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Honeypot field - hidden from users, only bots fill it */}
                        <input
                            type="text"
                            name="website"
                            value={honeypot}
                            onChange={(e) => setHoneypot(e.target.value)}
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                left: '-9999px',
                                width: '1px',
                                height: '1px',
                                opacity: 0,
                            }}
                        />
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email address"
                                className="flex-1 px-6 py-3.5 text-base rounded-full border-2 border-slate-300 focus:border-[#1a73e8] focus:outline-none transition-colors duration-300 bg-white/95 backdrop-blur-sm placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                required
                                disabled={isDisabled}
                            />
                            <button
                                type="submit"
                                disabled={isDisabled}
                                className="px-8 py-3.5 text-base font-bold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-300 shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900 relative"
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Subscribing...
                                    </span>
                                ) : isCooldown ? (
                                    `Wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s`
                                ) : (
                                    'Notify Me'
                                )}
                            </button>
                        </div>

                        {status !== 'idle' && status !== 'loading' && (
                            <div className={`text-sm font-medium pl-2 ${status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {status === 'success' && (
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span>{message}</span>
                                    </div>
                                )}
                                {status === 'error' && (
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <span>{message}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>

                    <p className="text-xs text-slate-500 mt-4 pl-2">
                        We'll send you updates about GDGHacks 2026. No spam, unsubscribe anytime.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default Hero;
