'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { User, Shield, Bell, Palette, LogOut, RefreshCw } from 'lucide-react';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

function getAuthToken(): string | null {
    return localStorage.getItem('auth_token') || Cookies.get('auth_token') || null;
}

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const [isReconnecting, setIsReconnecting] = useState(false);

    const handleReconnectMeta = async () => {
        setIsReconnecting(true);
        try {
            const token = getAuthToken();
            const resp = await fetch(`${API_URL}/api/auth/meta/reconnect`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            const data = await resp.json();
            if (data.success && data.loginUrl) {
                window.location.href = data.loginUrl;
            } else {
                throw new Error(data.error || 'Failed to initiate reconnect');
            }
        } catch (err: any) {
            console.error('Reconnect error:', err);
            alert(err.message || 'Something went wrong. Please try again.');
            setIsReconnecting(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-[var(--muted)]">Manage your account and preferences</p>
            </div>

            {/* Account Section */}
            <div className="card">
                <div className="flex items-center gap-4 mb-6">
                    <User size={24} className="text-[var(--primary)]" />
                    <h3 className="text-lg font-semibold">Account Identity</h3>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--card-hover)]">
                        <div>
                            <div className="font-medium text-white">Google Identity</div>
                            <div className="text-sm text-[var(--muted)]">{user?.googleEmail}</div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Primary
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--card-hover)] transition-all duration-300 hover:bg-white/[0.05]">
                        <div>
                            <div className="font-medium text-white">Instagram Connection</div>
                            <div className="text-sm text-[var(--muted)]">@{user?.username || 'Not connected'}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleReconnectMeta}
                                disabled={isReconnecting}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={14} className={isReconnecting ? 'animate-spin' : ''} />
                                {isReconnecting ? 'Redirecting...' : 'Add or Remove Account'}
                            </button>
                            <span className="badge badge-success">Connected</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Security Section */}
            <div className="card">
                <div className="flex items-center gap-4 mb-6">
                    <Shield size={24} className="text-[var(--secondary)]" />
                    <h3 className="text-lg font-semibold">Security</h3>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--card-hover)]">
                        <div>
                            <div className="font-medium">Token Encryption</div>
                            <div className="text-sm text-[var(--muted)]">Your Instagram tokens are AES encrypted</div>
                        </div>
                        <span className="badge badge-success">Enabled</span>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--card-hover)]">
                        <div>
                            <div className="font-medium">Secure Cookies</div>
                            <div className="text-sm text-[var(--muted)]">HttpOnly cookies prevent XSS attacks</div>
                        </div>
                        <span className="badge badge-success">Enabled</span>
                    </div>
                </div>
            </div>

            {/* Data Section */}
            <div className="card">
                <div className="flex items-center gap-4 mb-6">
                    <Palette size={24} className="text-[var(--accent)]" />
                    <h3 className="text-lg font-semibold">Data & Privacy</h3>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--card-hover)]">
                        <div>
                            <div className="font-medium">Analytics Caching</div>
                            <div className="text-sm text-[var(--muted)]">Data refreshes automatically every 5 minutes</div>
                        </div>
                        <span className="badge badge-success">Active</span>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--card-hover)]">
                        <div className="font-medium mb-2">Data We Access</div>
                        <div className="text-sm text-[var(--muted)] space-y-1">
                            <p>• Basic profile information</p>
                            <p>• Post and reel insights</p>
                            <p>• Engagement metrics</p>
                            <p>• Follower demographics (if available)</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-[var(--danger)]" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                <div className="flex items-center gap-4 mb-6">
                    <LogOut size={24} className="text-[var(--danger)]" />
                    <h3 className="text-lg font-semibold text-[var(--danger)]">Danger Zone</h3>
                </div>

                <p className="text-sm text-[var(--muted)] mb-4">
                    Logging out will disconnect your Instagram account. You can reconnect anytime.
                </p>

                <button
                    onClick={logout}
                    className="btn px-6 py-3 bg-[var(--danger)] text-white hover:opacity-90"
                >
                    <LogOut size={18} />
                    Disconnect & Logout
                </button>
            </div>
        </div>
    );
}
