'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function UnsubscribePage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;
    
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');

    const handleUnsubscribe = async () => {
        setStatus('loading');
        setMessage('');
        
        try {
            const response = await fetch('/api/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                setStatus('success');
                setMessage(data.message || 'You\'ve been successfully unsubscribed');
                setEmail(data.data?.email || '');
            } else {
                setStatus('error');
                setMessage(data.message || 'Invalid or expired unsubscribe link');
            }
        } catch (error) {
            console.error('Unsubscribe error:', error);
            setStatus('error');
            setMessage('Unable to process your request. Please try again later.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <div className="text-5xl font-bold text-[#1a73e8]">
                            GDGHacks
                        </div>
                    </div>
                    
                    {status === 'idle' && (
                        <>
                            <div className="text-center space-y-4">
                                <h1 className="text-2xl font-bold text-slate-900">
                                    Unsubscribe from GDGHacks 2026
                                </h1>
                                <p className="text-slate-600">
                                    We're sorry to see you go! Click the button below to unsubscribe from our mailing list.
                                </p>
                            </div>
                            
                            <button
                                onClick={handleUnsubscribe}
                                className="w-full px-6 py-3 text-base font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors duration-300"
                            >
                                Unsubscribe
                            </button>
                            
                            <p className="text-xs text-center text-slate-500">
                                You'll no longer receive updates about GDGHacks 2026
                            </p>
                        </>
                    )}
                    
                    {status === 'loading' && (
                        <div className="text-center space-y-4 py-8">
                            <div className="flex justify-center">
                                <svg className="animate-spin h-12 w-12 text-[#1a73e8]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                            <p className="text-slate-600 font-medium">
                                Processing your request...
                            </p>
                        </div>
                    )}
                    
                    {status === 'success' && (
                        <div className="text-center space-y-6 py-4">
                            <div className="flex justify-center">
                                <div className="rounded-full bg-green-100 p-3">
                                    <svg className="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-slate-900">
                                    Successfully Unsubscribed
                                </h2>
                                {email && (
                                    <p className="text-sm text-slate-600">
                                        {email}
                                    </p>
                                )}
                                <p className="text-slate-600">
                                    {message}
                                </p>
                            </div>
                            
                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full px-6 py-3 text-base font-semibold text-white bg-[#1a73e8] rounded-lg hover:bg-[#1557b0] transition-colors duration-300"
                                >
                                    Return to Homepage
                                </button>
                                
                                <p className="text-xs text-slate-500">
                                    Changed your mind? You can always subscribe again later.
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {status === 'error' && (
                        <div className="text-center space-y-6 py-4">
                            <div className="flex justify-center">
                                <div className="rounded-full bg-red-100 p-3">
                                    <svg className="w-12 h-12 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-slate-900">
                                    Unable to Unsubscribe
                                </h2>
                                <p className="text-slate-600">
                                    {message}
                                </p>
                            </div>
                            
                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => setStatus('idle')}
                                    className="w-full px-6 py-3 text-base font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors duration-300"
                                >
                                    Try Again
                                </button>
                                
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full px-6 py-3 text-base font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors duration-300"
                                >
                                    Return to Homepage
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <p className="text-center text-sm text-slate-500 mt-6">
                    © 2026 GDGHacks. All rights reserved.
                </p>
            </div>
        </div>
    );
}
