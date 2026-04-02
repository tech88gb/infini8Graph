'use client';

import { useState, useEffect, Suspense } from 'react';
import { Instagram, BarChart3, TrendingUp, Zap, ArrowRight, Shield, AlertCircle, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

function LoginContent() {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();

    useEffect(() => {
        const urlError = searchParams.get('error');
        if (urlError) {
            setError(urlError);
        }
    }, [searchParams]);

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

    // Human-friendly error parsing
    const getFriendlyErrorMessage = (err: string) => {
        const lowerErr = err.toLowerCase();
        
        if (lowerErr.includes('no instagram business or creator account found')) {
            return {
                title: 'Account Link Mismatch',
                message: 'You selected a Facebook Page, but it doesn\'t have a linked Instagram Business account, or you didn\'t grant permission to see it.',
                steps: [
                    'Ensure you checked ALL the boxes in the Facebook login screen.',
                    'Verify your Instagram is a "Business" or "Creator" account (Personal accounts won\'t work).',
                    'Check that the specific Instagram account is linked to the specific Facebook Page in Settings.'
                ]
            };
        }
        
        if (lowerErr.includes('no facebook pages found')) {
            return {
                title: 'No Pages Selected',
                message: 'Your Facebook account has no Pages, or you didn\'t select any during login.',
                steps: [
                    'In the Facebook popup, make sure to check the box for your Facebook Page.',
                    'Ensure you have "Admin" or "Editor" access to the Page.',
                    'Ensure the Page is Published.'
                ]
            };
        }

        if (lowerErr.includes('permission') || lowerErr.includes('access_denied')) {
            return {
                title: 'Permission Required',
                message: 'Some required permissions were declined or timed out.',
                steps: [
                    'Click "Continue" and allow all requested permissions.',
                    'Do not uncheck any of the "Manage" boxes, as they are required for analytics.'
                ]
            };
        }

        if (lowerErr.includes('failed to fetch details for any instagram account')) {
            return {
                title: 'Data Fetching Error',
                message: 'Meta refused to give us details for the Instagram accounts you selected.',
                steps: [
                    'Ensure you selected both the Facebook Page AND the Instagram account in the login screens.',
                    'Don\'t uncheck the box for "Access basic info" or "Manage your pages".',
                    'Try logging out of Facebook in your browser and logging back in here.'
                ]
            };
        }

        return null;
    };

    const friendlyError = error ? getFriendlyErrorMessage(error) : null;

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
                        {friendlyError ? (
                            <div className="mb-6 p-5 rounded-2xl bg-red-500/5 border border-red-500/20 shadow-xl">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                                        <AlertCircle className="text-red-400" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white mb-1">{friendlyError.title}</h3>
                                        <p className="text-sm text-red-200/70 mb-4">{friendlyError.message}</p>
                                        
                                        <div className="space-y-3">
                                            <p className="text-[11px] uppercase tracking-wider text-white/40 font-bold">Recommended Steps:</p>
                                            {friendlyError.steps.map((step, i) => (
                                                <div key={i} className="flex gap-3 text-xs text-[#b4bcd0] leading-relaxed">
                                                    <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-[10px] text-white/50">{i + 1}</span>
                                                    <span>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : error && (
                            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-3 items-center">
                                <AlertCircle size={18} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="btn w-full py-4 text-lg font-semibold text-white mb-2"
                            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.98) 0%, rgba(139,92,246,0.95) 100%)', boxShadow: '0 16px 40px rgba(99,102,241,0.25)' }}
                        >
                            {isLoggingIn ? (
                                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }}></div>
                            ) : (
                                <>
                                    <Instagram size={24} />
                                    {friendlyError ? 'Try Login Again' : 'Continue with Instagram'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        {error && (
                            <button 
                                onClick={() => {
                                    setError(null);
                                    // Also clear from URL
                                    window.history.replaceState({}, document.title, window.location.pathname);
                                }}
                                className="w-full py-2 text-xs text-[#8f98b3] hover:text-white transition-colors mb-4"
                            >
                                Clear current error
                            </button>
                        )}

                        <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <p className="text-sm text-center text-[#b4bcd0]">
                                <strong className="text-white">Note:</strong> Connecting requires an <strong className="text-indigo-300">Instagram Business</strong> account linked to a Facebook Page.
                            </p>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-sm text-[#8f98b3]">
                        Infini8Graph respects your privacy and security. 
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
                <div className="spinner"></div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
