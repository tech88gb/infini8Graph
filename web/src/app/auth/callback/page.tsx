'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { CheckCircle, AlertCircle } from 'lucide-react';

/** Decode JWT payload without verification (client-side display only) */
function decodeJwt(token: string): Record<string, any> | null {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = useState('Completing sign-in...');

    useEffect(() => {
        // Read DIRECTLY from window.location.search first — before AuthProvider's
        // checkAuth() can call window.history.replaceState() and wipe the params.
        const rawParams = new URLSearchParams(window.location.search);
        const token = rawParams.get('token') || searchParams.get('token');
        const error = rawParams.get('error') || searchParams.get('error');

        if (error) {
            setStatus('error');
            setMessage(decodeURIComponent(error));
            setTimeout(() => router.push('/login?error=' + encodeURIComponent(error)), 3000);
            return;
        }

        if (!token) {
            setStatus('error');
            setMessage('No authentication token received.');
            setTimeout(() => router.push('/login'), 3000);
            return;
        }

        // Save token to cookie + localStorage (dual storage for cross-env compat)
        const isSecure = window.location.protocol === 'https:';
        Cookies.set('auth_token', token, {
            expires: 7,
            secure: isSecure,
            sameSite: 'Lax',
            path: '/',
        });
        localStorage.setItem('auth_token', token);

        // Decode JWT to check if Meta is connected
        const decoded = decodeJwt(token);
        const metaConnected = decoded?.metaConnected === true;

        setStatus('success');

        if (!metaConnected) {
            setMessage('Identity verified. Preparing your workspace.');
            setTimeout(() => router.push('/connect-meta'), 1500);
        } else {
            setMessage('Session restored. Taking you to your dashboard.');
            setTimeout(() => router.push('/dashboard'), 1200);
        }
    }, [searchParams, router]);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center gap-8"
            style={{ 
                background: 'radial-gradient(circle at top, rgba(92,92,226,0.1), transparent 40%), #03040b',
            }}
        >
            {/* Minimalist Progress Loader */}
            <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Outer Ring */}
                <div 
                    className="absolute inset-0 rounded-full border-2 border-white/[0.05]"
                    style={{ borderTopColor: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#6366f1' }}
                />
                
                {/* Glow */}
                <div 
                    className="absolute inset-0 rounded-full blur-xl opacity-20"
                    style={{ background: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#6366f1' }}
                />

                {/* Status Icon */}
                <div className="relative z-10 transition-all duration-500 scale-110">
                    {status === 'processing' && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                    )}
                    {status === 'success' && (
                        <CheckCircle size={32} className="text-emerald-500 animate-in zoom-in-50 duration-300" />
                    )}
                    {status === 'error' && (
                        <AlertCircle size={32} className="text-red-500 animate-in zoom-in-50 duration-300" />
                    )}
                </div>
            </div>

            <div className="text-center max-w-sm px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2
                    className="text-2xl font-bold mb-3 tracking-tight"
                    style={{ color: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : 'white' }}
                >
                    {status === 'processing' ? 'Syncing...' : status === 'success' ? 'Authorized' : 'Connection Error'}
                </h2>
                <div className="flex flex-col gap-2">
                    <p style={{ color: '#94a3b8', fontSize: 15, fontWeight: 500 }}>{message}</p>
                    {status === 'success' && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" />
                        </div>
                    )}
                </div>
            </div>

            {status === 'error' && (
                <button
                    onClick={() => router.push('/login')}
                    className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
                >
                    Back to Login
                </button>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070b' }}>
                <div className="spinner" />
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
