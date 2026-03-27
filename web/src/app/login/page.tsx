'use client';

import { useState } from 'react';
import { Instagram, BarChart3, TrendingUp, Zap, ArrowRight, Shield } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export default function LoginPage() {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                credentials: 'include',
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const data = await response.json();
            if (data.success && data.loginUrl) {
                window.location.href = data.loginUrl;
            } else {
                setError('Failed to get login URL');
                setIsLoggingIn(false);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Connection error. Is the backend running?');
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#000212] text-white">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-white/[0.05]" style={{
                background: 'radial-gradient(circle at top, rgba(92,92,226,0.18), transparent 34%), linear-gradient(180deg, #0a0b12 0%, #07070b 100%)'
            }}>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]"></div>
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

                {/* Decorative Elements */}
                <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl"></div>
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-violet-400/10 blur-3xl"></div>
            </div>

            {/* Right Panel - Login */}
            <div className="flex-1 flex items-center justify-center px-8 py-12 relative" style={{ background: 'radial-gradient(circle at top, rgba(92,92,226,0.1), transparent 26%), linear-gradient(180deg, #0a0b12 0%, #07070b 100%)' }}>
                <div className="w-full max-w-md">
                    <div className="text-center mb-10">
                        <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg,#5b5ce2_0%,#7c5cff_100%)] shadow-[0_10px_24px_rgba(96,91,255,0.18)]">
                                <span className="text-2xl font-bold text-white">∞</span>
                            </div>
                            <span className="text-2xl font-bold text-white">infini8Graph</span>
                        </div>

                        <h2 className="text-3xl font-bold mb-3 text-white">Connect your account</h2>
                        <p className="text-[#b4bcd0]">Sign in with Instagram to access analytics, audience intelligence, and automation in one workspace.</p>
                    </div>

                    <div className="card p-8 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
                        {error && (
                            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="btn w-full py-4 text-lg font-semibold text-white"
                            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.98) 0%, rgba(139,92,246,0.95) 100%)', boxShadow: '0 16px 40px rgba(99,102,241,0.25)' }}
                        >
                            {isLoggingIn ? (
                                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }}></div>
                            ) : (
                                <>
                                    <Instagram size={24} />
                                    Continue with Instagram
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <p className="text-sm text-center text-[#b4bcd0]">
                                <strong className="text-white">Note:</strong> You need an Instagram Business or Creator account connected to a Facebook Page.
                            </p>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-sm text-[#8f98b3]">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    );
}
