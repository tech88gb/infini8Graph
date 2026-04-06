'use client';

import { useState, useEffect, Suspense } from 'react';
import { BarChart3, TrendingUp, Zap, Shield, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
            <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
            <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
            <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
        </svg>
    );
}

function LoginContent() {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();

    useEffect(() => {
        const urlError = searchParams.get('error');
        if (urlError) setError(decodeURIComponent(urlError));
    }, [searchParams]);

    const handleGoogleLogin = async () => {
        setIsLoggingIn(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                credentials: 'include',
                headers: { 'ngrok-skip-browser-warning': 'true' },
            });
            const data = await response.json();
            if (data.success && data.loginUrl) {
                window.location.href = data.loginUrl;
            } else {
                setError('Failed to initiate login. Please try again.');
                setIsLoggingIn(false);
            }
        } catch (err) {
            setError('Connection error. Is the backend running?');
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#000212] text-white">
            {/* Left Panel — Branding */}
            <div
                className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-white/[0.05]"
                style={{ background: 'radial-gradient(circle at top, rgba(92,92,226,0.18), transparent 34%), linear-gradient(180deg, #0a0b12 0%, #07070b 100%)' }}
            >
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
                <div className="relative z-10 flex flex-col justify-center px-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(135deg,#5b5ce2_0%,#7c5cff_100%)] flex items-center justify-center shadow-[0_14px_34px_rgba(96,91,255,0.22)]">
                            <span className="text-3xl font-bold text-white">∞</span>
                        </div>
                        <span className="text-3xl font-bold text-white">infini8Graph</span>
                    </div>

                    <h1 className="text-5xl font-bold text-white leading-tight mb-6">
                        The intelligence layer<br />
                        <span className="text-[#b4bcd0]">for cross-channel growth.</span>
                    </h1>

                    <p className="text-xl text-[#b4bcd0] mb-12 max-w-md leading-relaxed">
                        Professional analytics, audience visibility, and automation workflows designed for creators, agencies, and brand teams.
                    </p>

                    <div className="space-y-4">
                        {[
                            { icon: BarChart3, text: 'Clear post-level Instagram analytics without clutter' },
                            { icon: TrendingUp, text: 'Audience and growth signals you can actually act on' },
                            { icon: Zap, text: 'Cross-channel spend tracking and Google Ads Intelligence' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 text-[#d7dced]">
                                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                                    <item.icon size={20} />
                                </div>
                                <span className="font-medium">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 flex flex-wrap gap-3">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-sm text-[#d7dced] w-fit">
                            <Shield size={14} className="text-indigo-300" />
                            Official Instagram Graph API connection
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-sm text-[#d7dced] w-fit">
                            <Shield size={14} className="text-emerald-300" />
                            Official Google Ads API connection
                        </div>
                    </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-violet-400/10 blur-3xl" />
            </div>

            {/* Right Panel — Login */}
            <div
                className="flex-1 flex items-center justify-center px-8 py-12 relative"
                style={{ background: 'radial-gradient(circle at top, rgba(92,92,226,0.1), transparent 26%), linear-gradient(180deg, #0a0b12 0%, #07070b 100%)' }}
            >
                <div className="w-full max-w-md">
                    <div className="text-center mb-10">
                        <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg,#5b5ce2_0%,#7c5cff_100%)] shadow-[0_10px_24px_rgba(96,91,255,0.18)]">
                                <span className="text-2xl font-bold text-white">∞</span>
                            </div>
                            <span className="text-2xl font-bold text-white">infini8Graph</span>
                        </div>

                        <h2 className="text-3xl font-bold mb-3 text-white">Welcome back</h2>
                        <p className="text-[#b4bcd0]">
                            Sign in with your Google account to access your analytics dashboard.
                        </p>
                    </div>

                    <div className="card p-8 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
                        {/* Error display */}
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-3 items-start">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-red-200 mb-1">Login Failed</p>
                                    <p>{error}</p>
                                    <button
                                        onClick={() => {
                                            setError(null);
                                            window.history.replaceState({}, document.title, window.location.pathname);
                                        }}
                                        className="mt-2 text-xs text-red-300/70 hover:text-red-200 transition-colors underline underline-offset-2"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Google Sign-In Button */}
                        <button
                            id="google-login-btn"
                            onClick={handleGoogleLogin}
                            disabled={isLoggingIn}
                            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-semibold text-[15px] transition-all duration-200"
                            style={{
                                background: isLoggingIn ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: 'white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            }}
                            onMouseEnter={e => { if (!isLoggingIn) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isLoggingIn ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'; }}
                        >
                            {isLoggingIn ? (
                                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                            ) : (
                                <GoogleIcon />
                            )}
                            {isLoggingIn ? 'Redirecting to Google...' : 'Continue with Google'}
                        </button>

                        {/* Separator */}
                        <div className="my-6 flex items-center gap-3">
                            <div className="flex-1 h-px bg-white/[0.06]" />
                            <span className="text-xs text-[#8f98b3]">Secure sign-in</span>
                            <div className="flex-1 h-px bg-white/[0.06]" />
                        </div>

                        {/* Info box */}
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                            <p className="text-sm text-[#b4bcd0] flex items-start gap-2">
                                <span className="text-indigo-400 mt-0.5">①</span>
                                Sign in with your Google account
                            </p>
                            <p className="text-sm text-[#b4bcd0] flex items-start gap-2">
                                <span className="text-indigo-400 mt-0.5">②</span>
                                Connect your Instagram Business account <span className="text-[#8f98b3]">(one-time setup)</span>
                            </p>
                            <p className="text-sm text-[#b4bcd0] flex items-start gap-2">
                                <span className="text-indigo-400 mt-0.5">③</span>
                                Access your full analytics dashboard
                            </p>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-sm text-[#8f98b3]">
                        infini8Graph respects your privacy and security.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#000212] flex items-center justify-center">
                <div className="spinner" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
