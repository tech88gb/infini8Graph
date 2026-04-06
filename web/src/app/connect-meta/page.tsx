'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { Instagram, Shield, AlertCircle, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

function getAuthToken(): string | null {
    return localStorage.getItem('auth_token') || Cookies.get('auth_token') || null;
}

function decodeJwt(token: string): Record<string, any> | null {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}

function ConnectMetaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [googleEmail, setGoogleEmail] = useState<string | null>(null);

    useEffect(() => {
        // --- Guard: redirect to login if no token ---
        const token = getAuthToken();
        if (!token) {
            router.replace('/login');
            return;
        }

        // Decode to get google email for display
        const decoded = decodeJwt(token);
        if (decoded?.googleEmail) setGoogleEmail(decoded.googleEmail);

        // If already meta connected, go to dashboard
        if (decoded?.metaConnected === true) {
            router.replace('/dashboard');
            return;
        }

        // Check for error from Meta OAuth redirect
        const urlError = searchParams.get('error');
        if (urlError) setError(decodeURIComponent(urlError));
    }, [router, searchParams]);

    const handleMetaConnect = async () => {
        setIsConnecting(true);
        setError(null);

        const token = getAuthToken();
        if (!token) {
            router.push('/login');
            return;
        }

        try {
            const resp = await fetch(`${API_URL}/api/auth/meta/connect`, {
                credentials: 'include',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true',
                },
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to initiate Meta connection');
            }

            const data = await resp.json();
            if (data.success && data.loginUrl) {
                window.location.href = data.loginUrl;
            } else {
                throw new Error('No login URL returned from server');
            }
        } catch (err: any) {
            console.error('Meta connect error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
            setIsConnecting(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 overflow-hidden relative"
            style={{
                background: 'radial-gradient(circle at 50% -20%, rgba(92,92,226,0.15), transparent 40%), radial-gradient(circle at 0% 100%, rgba(99,102,241,0.08), transparent 30%), #03040b',
            }}
        >
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />

            <div className="w-full max-w-lg relative animate-fade-in">
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-4 mb-12">
                    <div className="flex flex-col items-center gap-2 group">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', boxShadow: '0 0 20px rgba(16,185,129,0.1)' }}
                        >
                            <CheckCircle size={18} />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500/80">Identify</span>
                    </div>

                    <div className="w-16 h-[2px] mt-[-18px]" style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.3), rgba(99,102,241,0.3))' }} />

                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold animate-pulse-subtle"
                            style={{ background: 'rgba(99,102,241,0.15)', border: '2px solid #6366f1', color: 'white', boxShadow: '0 0 30px rgba(99,102,241,0.2)' }}
                        >
                            2
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Connect</span>
                    </div>

                    <div className="w-16 h-[2px] mt-[-18px]" style={{ background: 'rgba(255,255,255,0.05)' }} />

                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#4b5563' }}
                        >
                            3
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Launch</span>
                    </div>
                </div>

                {/* Main card */}
                <div
                    className="rounded-[24px] p-10 backdrop-blur-xl"
                    style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 40px 100px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
                    }}
                >
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div
                            className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center relative group"
                            style={{
                                background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                                boxShadow: '0 15px 35px rgba(220,39,67,0.25)',
                            }}
                        >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity rounded-3xl" />
                            <Instagram size={36} className="text-white" />
                        </div>
                        
                        <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">Connect Meta</h1>
                        <p className="text-[#94a3b8] text-[15px] leading-relaxed max-w-[320px] mx-auto">
                            To bring your Instagram analytics into <span className="text-white font-medium">infini8Graph</span>, we need a secure handshake with Meta.
                        </p>

                        {googleEmail && (
                            <div
                                className="mt-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[13px] font-medium"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8' }}
                            >
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Authenticated as <span className="text-[#d1d5db]">{googleEmail}</span>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            className="mb-8 p-5 rounded-2xl flex gap-4 items-start text-[14px] animate-shake"
                            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
                        >
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                                <AlertCircle size={20} className="text-red-500" />
                            </div>
                            <div className="flex-1 pt-1">
                                <p className="font-bold text-red-100 mb-1">Authorization required</p>
                                <p className="text-red-400/80 leading-relaxed">{error}</p>
                                <button
                                    onClick={() => setError(null)}
                                    className="mt-3 text-xs font-bold uppercase tracking-widest text-red-300 hover:text-white transition-colors"
                                >
                                    Try again
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Perks List */}
                    <div className="grid grid-cols-1 gap-4 mb-10">
                        {[
                            { label: 'Intelligence', sub: 'Deep audience & post metrics', icon: '💎' },
                            { label: 'Automation', sub: 'Comment & DM auto-flows', icon: '⚡' },
                            { label: 'Insights', sub: 'Historical growth patterns', icon: '📈' },
                        ].map((item, i) => (
                            <div 
                                key={i} 
                                className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 hover:bg-white/[0.03]"
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                            >
                                <div className="text-2xl">{item.icon}</div>
                                <div>
                                    <p className="text-[14px] font-bold text-white leading-none mb-1">{item.label}</p>
                                    <p className="text-[12px] text-gray-500">{item.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Connect button */}
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                        <button
                            id="meta-connect-btn"
                            onClick={handleMetaConnect}
                            disabled={isConnecting}
                            className="relative w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-lg text-white transition-all duration-300 overflow-hidden"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            }}
                        >
                            {isConnecting ? (
                                <RefreshCw size={22} className="animate-spin" />
                            ) : (
                                <ArrowRight size={22} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                            )}
                            <span className={isConnecting ? 'pl-2' : ''}>
                                {isConnecting ? 'Initializing handshake...' : 'Continue to Meta'}
                            </span>
                        </button>
                    </div>

                    {/* Security Footer */}
                    <div className="mt-8 pt-8 border-t border-white/[0.05] flex items-center justify-between text-[11px] uppercase tracking-widest font-bold text-gray-600">
                        <div className="flex items-center gap-2">
                            <Shield size={12} className="text-indigo-500" />
                            <span>Encrypted Connection</span>
                        </div>
                        <span className="text-gray-700">Powered by Facebook Graph API</span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-subtle {
                    0%, 100% { opacity: 1; box-shadow: 0 0 30px rgba(99,102,241,0.2); }
                    50% { opacity: 0.8; box-shadow: 0 0 50px rgba(99,102,241,0.4); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-pulse-subtle { animation: pulse-subtle 3s ease-in-out infinite; }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
        </div>
    );
}

export default function ConnectMetaPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#07070b' }}>
                <div className="spinner" />
            </div>
        }>
            <ConnectMetaContent />
        </Suspense>
    );
}
