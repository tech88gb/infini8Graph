'use client';

import { useState } from 'react';
import { Instagram, BarChart3, TrendingUp, Zap } from 'lucide-react';

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
        <div className="min-h-screen flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 50%, #f472b6 100%)'
            }}>
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="relative z-10 flex flex-col justify-center px-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <span className="text-3xl font-bold text-white">∞</span>
                        </div>
                        <span className="text-3xl font-bold text-white">infini8Graph</span>
                    </div>

                    <h1 className="text-5xl font-bold text-white leading-tight mb-6">
                        Unlock Your<br />
                        <span className="text-white/90">Instagram Potential</span>
                    </h1>

                    <p className="text-xl text-white/80 mb-12 max-w-md">
                        Professional analytics to grow your audience, boost engagement, and optimize your content strategy.
                    </p>

                    <div className="space-y-4">
                        {[
                            { icon: BarChart3, text: 'Comprehensive engagement metrics' },
                            { icon: TrendingUp, text: 'Growth trends & predictions' },
                            { icon: Zap, text: 'Best time to post analysis' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 text-white/90">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <item.icon size={20} />
                                </div>
                                <span className="font-medium">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl"></div>
            </div>

            {/* Right Panel - Login */}
            <div className="flex-1 flex items-center justify-center px-8 py-12" style={{ background: 'var(--background)' }}>
                <div className="w-full max-w-md">
                    <div className="text-center mb-10">
                        <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-1)' }}>
                                <span className="text-2xl font-bold text-white">∞</span>
                            </div>
                            <span className="text-2xl font-bold gradient-text">infini8Graph</span>
                        </div>

                        <h2 className="text-3xl font-bold mb-3">Welcome Back</h2>
                        <p className="text-[var(--muted)]">Connect your Instagram Business account to get started</p>
                    </div>

                    <div className="card">
                        {error && (
                            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="btn w-full py-4 text-lg font-semibold text-white"
                            style={{ background: 'linear-gradient(135deg, #E1306C 0%, #833AB4 50%, #5851DB 100%)' }}
                        >
                            {isLoggingIn ? (
                                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }}></div>
                            ) : (
                                <>
                                    <Instagram size={24} />
                                    Continue with Instagram
                                </>
                            )}
                        </button>

                        <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                            <p className="text-sm text-center text-[var(--muted)]">
                                <strong className="text-[var(--foreground)]">Note:</strong> You need an Instagram Business or Creator account connected to a Facebook Page.
                            </p>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-sm text-[var(--muted)]">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    );
}
