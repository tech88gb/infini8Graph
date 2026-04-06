'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Instagram, ArrowRight, ShieldCheck, Zap, Globe, RefreshCw } from 'lucide-react';
import Cookies from 'js-cookie';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

function getAuthToken(): string | null {
    return localStorage.getItem('auth_token') || Cookies.get('auth_token') || null;
}

function decodeJwt(token: string): Record<string, any> | null {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch (e) {
        return null;
    }
}

function ConnectMetaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const token = getAuthToken();
        if (!token) {
            router.push('/login');
            return;
        }

        const decoded = decodeJwt(token);
        if (decoded?.googleEmail) {
            setUserEmail(decoded.googleEmail);
        }

        // If already connected, skip to dashboard
        if (decoded?.metaConnected) {
            router.push('/dashboard');
        }
    }, [router]);

    const handleConnect = async () => {
        setLoading(true);
        try {
            const token = getAuthToken();
            const response = await fetch(`${API_URL}/api/auth/meta/connect`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            const data = await response.json();

            if (data.success && data.loginUrl) {
                window.location.href = data.loginUrl;
            } else {
                throw new Error(data.error || 'Failed to initiate connection');
            }
        } catch (error: any) {
            console.error('Connection error:', error);
            alert(error.message || 'Failed to connect. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-xl w-full"
            >
                {/* Header Section */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/50 mb-6 font-mono tracking-tighter uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Assets Discovery
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent italic">
                        Authorize Asset Sync.
                    </h1>
                    <p className="text-lg text-white/40 max-w-sm mx-auto">
                        Link your social business accounts to enable performance tracking and automated interactions.
                    </p>
                </div>

                {/* Connection Card */}
                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden group transition-all duration-500 hover:border-white/20">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 py-4">
                        {/* Current Identity */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="text-xs uppercase tracking-widest text-white/20 font-bold mb-3">Verified Persona</div>
                            <div className="flex items-center gap-3 justify-center md:justify-start">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                    <Globe size={18} className="text-white/40" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold text-white/80 text-sm">Google Account</div>
                                    <div className="text-[11px] text-white/30 truncate max-w-[150px]">{userEmail || 'Authenticated'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Transition Icon */}
                        <div className="relative group/arrow">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover/arrow:border-indigo-500/50 transition-colors">
                                <ArrowRight className="text-white/20 group-hover/arrow:text-indigo-400 transition-colors duration-300" size={18} />
                            </div>
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover/arrow:opacity-100 transition-opacity" />
                        </div>

                        {/* Target Asset */}
                        <div className="flex-1 text-center md:text-right">
                            <div className="text-xs uppercase tracking-widest text-white/20 font-bold mb-3 md:ml-auto">Automation Node</div>
                            <div className="flex items-center gap-3 justify-center md:justify-end">
                                <div className="text-right">
                                    <div className="font-semibold text-white/80 text-sm">Meta Assets</div>
                                    <div className="text-[11px] text-white/30">Instagram Business</div>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600/10 to-pink-600/10 flex items-center justify-center border border-purple-500/30">
                                    <Instagram size={18} className="text-purple-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 h-px bg-white/5 w-full" />

                    <div className="mt-10 space-y-4">
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="w-full h-14 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#eaeaea] transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group/btn shadow-[0_20px_50px_rgba(255,255,255,0.1)]"
                        >
                            {loading ? (
                                <RefreshCw className="animate-spin text-black" size={20} />
                            ) : (
                                <>
                                    <span>Sync with Meta</span>
                                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                        <p className="text-[9px] text-center text-white/10 uppercase tracking-[0.3em] font-bold">
                            Secured via Enterprise OAuth 2.0
                        </p>
                    </div>
                </div>

                {/* Features Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    {[
                        { icon: ShieldCheck, title: 'Safe Link', desc: 'Secure asset authorization.' },
                        { icon: Zap, title: 'Real-time', desc: 'Instant account syncing.' },
                        { icon: Globe, title: 'Privacy', desc: 'Encrypted meta handshake.' }
                    ].map((feature, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + (i * 0.05) }}
                            className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.03] transition-colors"
                        >
                            <feature.icon size={16} className="text-white/20 mb-2" />
                            <h3 className="text-xs font-bold mb-1 italic tracking-tight">{feature.title}</h3>
                            <p className="text-[10px] text-white/20 leading-relaxed font-medium">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Footer text */}
                <div className="mt-8 text-center">
                    <p className="text-[10px] text-white/10 uppercase tracking-widest leading-relaxed">
                        By continuing, you grant permissions to access business profile data and insights.<br />
                        We never store personal passwords or post without automation rules.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default function ConnectMetaPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6">
                <RefreshCw className="text-white/20 animate-spin" size={40} />
            </div>
        }>
            <ConnectMetaContent />
        </Suspense>
    );
}
