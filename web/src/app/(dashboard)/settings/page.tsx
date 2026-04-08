'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { authApi, googleAdsApi, webhookApi } from '@/lib/api';
import { User, Shield, Palette, LogOut, RefreshCw, Instagram, Activity, CheckCircle2, AlertTriangle, Radio } from 'lucide-react';

interface ManagedAccount {
    id: string;
    instagram_user_id: string;
    username: string;
    name: string;
    profile_picture_url: string | null;
    followers_count: number;
    is_active: boolean;
    is_enabled: boolean;
}

interface SystemStatusCard {
    key: string;
    label: string;
    state: 'healthy' | 'warning' | 'inactive';
    summary: string;
    detail: string;
}

function Toggle({
    checked,
    disabled,
    onChange,
}: {
    checked: boolean;
    disabled?: boolean;
    onChange: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={checked}
            disabled={disabled}
            onClick={onChange}
            style={{
                width: 48,
                height: 28,
                borderRadius: 999,
                border: '1px solid',
                borderColor: checked ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.12)',
                background: checked ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
                position: 'relative',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
                transition: 'all 0.2s ease',
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: 3,
                    left: checked ? 23 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: checked ? '#22c55e' : '#94a3b8',
                    transition: 'all 0.2s ease',
                }}
            />
        </button>
    );
}

export default function SettingsPage() {
    const { user, logout, connectMeta, refreshAccounts, syncSession } = useAuth();
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
    const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
    const [systemStatuses, setSystemStatuses] = useState<SystemStatusCard[]>([]);
    const [statusLoading, setStatusLoading] = useState(true);

    const loadAccounts = async () => {
        setAccountsLoading(true);
        try {
            const response = await authApi.getAccounts(true);
            if (response.data.success) {
                setAccounts(response.data.accounts || []);
            }
        } catch (error) {
            console.error('Failed to load managed accounts:', error);
        } finally {
            setAccountsLoading(false);
        }
    };

    const loadSystemStatuses = async () => {
        setStatusLoading(true);
        try {
            const [accountsResponse, googleResponse, webhookResponse] = await Promise.allSettled([
                authApi.getAccounts(true),
                googleAdsApi.getStatus(),
                webhookApi.getStatus(),
            ]);

            const accountList =
                accountsResponse.status === 'fulfilled' && accountsResponse.value.data.success
                    ? accountsResponse.value.data.accounts || []
                    : [];

            const enabledAccounts = accountList.filter((account: ManagedAccount) => account.is_enabled);
            const activeAccount = accountList.find((account: ManagedAccount) => account.is_active);
            const googleConnected =
                googleResponse.status === 'fulfilled' && googleResponse.value.data.connected === true;
            const webhookActive =
                webhookResponse.status === 'fulfilled' && webhookResponse.value.data.status === 'active';

            setSystemStatuses([
                {
                    key: 'meta',
                    label: 'Meta token healthy',
                    state: user?.metaConnected && enabledAccounts.length > 0 ? 'healthy' : user?.metaConnected ? 'warning' : 'inactive',
                    summary: user?.metaConnected && enabledAccounts.length > 0 ? 'Healthy' : user?.metaConnected ? 'Attention needed' : 'Disconnected',
                    detail: user?.metaConnected && enabledAccounts.length > 0
                        ? `Ready for ${enabledAccounts.length} enabled Instagram account${enabledAccounts.length === 1 ? '' : 's'}${activeAccount ? ` with @${activeAccount.username} active` : ''}.`
                        : user?.metaConnected
                            ? 'Meta is connected, but no Instagram account is enabled for this login.'
                            : 'Reconnect Meta access to restore Instagram analytics and automation.',
                },
                {
                    key: 'google',
                    label: 'Google Ads connected',
                    state: googleConnected ? 'healthy' : 'inactive',
                    summary: googleConnected ? 'Connected' : 'Not connected',
                    detail: googleConnected
                        ? `Google Ads is connected${googleResponse.status === 'fulfilled' && googleResponse.value.data.account?.email ? ` as ${googleResponse.value.data.account.email}` : ''}.`
                        : 'Connect Google Ads if you want cross-platform reporting and campaign intelligence.',
                },
                {
                    key: 'webhook',
                    label: 'Webhook receiving',
                    state: webhookActive ? 'healthy' : 'warning',
                    summary: webhookActive ? 'Active' : 'Check required',
                    detail: webhookActive
                        ? 'The webhook endpoint is live and ready to receive Instagram comment and DM events.'
                        : 'The webhook status endpoint did not confirm a healthy listener.',
                },
            ]);
        } catch {
            setSystemStatuses([
                {
                    key: 'meta',
                    label: 'Meta token healthy',
                    state: 'warning',
                    summary: 'Unavailable',
                    detail: 'Status checks could not be completed right now.',
                },
            ]);
        } finally {
            setStatusLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
        loadSystemStatuses();
    }, []);

    const handleReconnectMeta = async () => {
        setIsReconnecting(true);
        try {
            await connectMeta();
        } catch (err: any) {
            console.error('Reconnect error:', err);
            alert(err.message || 'Something went wrong. Please try again.');
            setIsReconnecting(false);
        }
    };

    const handleToggleAccount = async (account: ManagedAccount) => {
        setUpdatingAccountId(account.id);
        try {
            const response = await authApi.updateAccountEnabled(account.id, !account.is_enabled);
            if (!response.data.success) {
                throw new Error(response.data.error || 'Failed to update account');
            }

            if (response.data.jwt) {
                await syncSession(response.data.jwt);
            }

            await refreshAccounts();
            await loadAccounts();
            await loadSystemStatuses();
        } catch (error: any) {
            console.error('Account toggle error:', error);
            alert(error.message || 'Failed to update this account.');
        } finally {
            setUpdatingAccountId(null);
        }
    };

    const statusTone = (state: SystemStatusCard['state']) => {
        if (state === 'healthy') {
            return {
                border: 'rgba(34,197,94,0.25)',
                background: 'rgba(34,197,94,0.08)',
                text: '#22c55e',
                icon: CheckCircle2,
            };
        }

        if (state === 'warning') {
            return {
                border: 'rgba(245,158,11,0.25)',
                background: 'rgba(245,158,11,0.08)',
                text: '#f59e0b',
                icon: AlertTriangle,
            };
        }

        return {
            border: 'rgba(148,163,184,0.2)',
            background: 'rgba(148,163,184,0.08)',
            text: '#94a3b8',
            icon: Radio,
        };
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-[var(--muted)]">Manage your account and preferences</p>
            </div>

            <div className="card">
                <div className="flex items-center gap-4 mb-6">
                    <Activity size={24} className="text-[var(--primary)]" />
                    <h3 className="text-lg font-semibold">System Status</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {statusLoading ? (
                        <div className="p-4 rounded-xl bg-[var(--card-hover)] text-sm text-[var(--muted)] md:col-span-3">
                            Checking system health...
                        </div>
                    ) : (
                        systemStatuses.map((status) => {
                            const tone = statusTone(status.state);
                            const Icon = tone.icon;

                            return (
                                <div
                                    key={status.key}
                                    style={{
                                        padding: 18,
                                        borderRadius: 18,
                                        border: `1px solid ${tone.border}`,
                                        background: tone.background,
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div>
                                            <div className="text-sm font-semibold text-white">{status.label}</div>
                                            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: tone.text }}>
                                                {status.summary}
                                            </div>
                                        </div>
                                        <Icon size={18} style={{ color: tone.text, flexShrink: 0 }} />
                                    </div>
                                    <p className="text-sm text-[var(--muted)] leading-6">{status.detail}</p>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

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
                            <div className="font-medium text-white">Meta Asset Sync</div>
                            <div className="text-sm text-[var(--muted)]">
                                Refresh permissions or discover newly authorized Instagram pages without changing this Google user&apos;s saved selection automatically.
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleReconnectMeta}
                                disabled={isReconnecting}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={14} className={isReconnecting ? 'animate-spin' : ''} />
                                {isReconnecting ? 'Redirecting...' : 'Refresh Meta Access'}
                            </button>
                            <span className="badge badge-success">Connected</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="flex items-center gap-4 mb-6">
                    <Instagram size={24} className="text-[var(--secondary)]" />
                    <h3 className="text-lg font-semibold">Instagram Access for This Google Login</h3>
                </div>

                <p className="text-sm text-[var(--muted)] mb-4">
                    These toggles are your app-side configuration. Turning an account off here only affects this Google login, even if another user reconnects the same Facebook identity elsewhere.
                </p>

                <div className="space-y-3">
                    {accountsLoading ? (
                        <div className="p-4 rounded-xl bg-[var(--card-hover)] text-sm text-[var(--muted)]">Loading connected accounts...</div>
                    ) : accounts.length === 0 ? (
                        <div className="p-4 rounded-xl bg-[var(--card-hover)] text-sm text-[var(--muted)]">
                            No Instagram accounts are linked yet. Use <strong>Refresh Meta Access</strong> to connect them.
                        </div>
                    ) : (
                        accounts.map((account) => {
                            const busy = updatingAccountId === account.id;
                            return (
                                <div key={account.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--card-hover)]">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: '50%',
                                                background: account.profile_picture_url ? 'transparent' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {account.profile_picture_url ? (
                                                <img
                                                    src={account.profile_picture_url}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <span style={{ color: 'white', fontWeight: 700 }}>
                                                    {account.username?.[0]?.toUpperCase() || '?'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-medium text-white truncate">@{account.username}</div>
                                            <div className="text-sm text-[var(--muted)] truncate">
                                                {account.name || 'Instagram Business'} {account.followers_count ? `• ${account.followers_count.toLocaleString()} followers` : ''}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                {account.is_active && <span className="badge badge-success">Active</span>}
                                                <span className={`badge ${account.is_enabled ? 'badge-success' : 'badge-primary'}`}>
                                                    {account.is_enabled ? 'Enabled' : 'Hidden'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {busy && <RefreshCw size={14} className="animate-spin text-[var(--muted)]" />}
                                        <Toggle
                                            checked={account.is_enabled}
                                            disabled={busy}
                                            onChange={() => handleToggleAccount(account)}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

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
