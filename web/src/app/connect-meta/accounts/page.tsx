'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowRight, CheckCircle2, Instagram, RefreshCw, ShieldCheck } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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

interface MetaSetupResult {
    returnedAccountIds?: string[];
    returnedCount?: number;
    accessReduced?: boolean;
    missingPreviouslyEnabledCount?: number;
}

function AccountAvatar({ account }: { account: ManagedAccount }) {
    return (
        <div
            style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: account.profile_picture_url ? 'transparent' : 'linear-gradient(135deg, #6366f1, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.1)'
            }}
        >
            {account.profile_picture_url ? (
                <img src={account.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <span style={{ color: 'white', fontWeight: 800 }}>{account.username?.[0]?.toUpperCase() || '?'}</span>
            )}
        </div>
    );
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
                borderColor: checked ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.16)',
                background: checked ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
                position: 'relative',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
                transition: 'all 0.2s ease',
                flexShrink: 0
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

function MetaAccountSelectionContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { syncSession } = useAuth();
    const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
    const [setupResult, setSetupResult] = useState<MetaSetupResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const accessReducedFromUrl = searchParams.get('accessReduced') === 'true';

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const storedSetup = typeof window !== 'undefined'
                    ? sessionStorage.getItem('meta_setup_result')
                    : null;
                const parsedSetup = storedSetup ? JSON.parse(storedSetup) as MetaSetupResult : null;
                if (mounted) setSetupResult(parsedSetup);

                const response = await authApi.getAccounts(true);
                if (!mounted) return;

                if (!response.data.success) {
                    throw new Error(response.data.error || 'Could not load connected accounts.');
                }

                setAccounts(response.data.accounts || []);
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Could not load connected accounts.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();

        return () => {
            mounted = false;
        };
    }, []);

    const returnedIdSet = useMemo(() => new Set(setupResult?.returnedAccountIds || []), [setupResult]);
    const hasReturnedScope = returnedIdSet.size > 0;
    const returnedAccounts = useMemo(
        () => hasReturnedScope ? accounts.filter((account) => returnedIdSet.has(account.id)) : accounts,
        [accounts, hasReturnedScope, returnedIdSet]
    );
    const otherAccounts = useMemo(
        () => hasReturnedScope ? accounts.filter((account) => !returnedIdSet.has(account.id)) : [],
        [accounts, hasReturnedScope, returnedIdSet]
    );
    const enabledCount = accounts.filter((account) => account.is_enabled).length;
    const showReducedWarning = accessReducedFromUrl || setupResult?.accessReduced;

    const handleToggleAccount = async (account: ManagedAccount) => {
        setUpdatingAccountId(account.id);
        setError(null);

        try {
            const nextEnabled = !account.is_enabled;
            const response = await authApi.updateAccountEnabled(account.id, nextEnabled);
            if (!response.data.success) {
                throw new Error(response.data.error || 'Failed to update account access.');
            }

            setAccounts((current) => current.map((item) => (
                item.id === account.id
                    ? { ...item, is_enabled: nextEnabled, is_active: nextEnabled ? item.is_active : false }
                    : item
            )));
            await syncSession();
            const refreshed = await authApi.getAccounts(true);
            if (refreshed.data.success) setAccounts(refreshed.data.accounts || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update account access.');
        } finally {
            setUpdatingAccountId(null);
        }
    };

    const continueToDashboard = async () => {
        await syncSession();
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('meta_setup_result');
        }
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-3xl">
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/50 mb-5 uppercase tracking-wider">
                        <Instagram size={14} className="text-pink-300" />
                        Meta connected
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-3">Choose accounts for this Google login</h1>
                    <p className="text-white/45 max-w-xl mx-auto leading-7">
                        Meta grants app permission to the selected business assets. These switches control which Instagram accounts this Google login uses inside infini8Graph.
                    </p>
                </div>

                {showReducedWarning && (
                    <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 flex gap-3">
                        <AlertTriangle size={20} className="text-amber-300 mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="font-semibold text-amber-100">Meta access appears reduced</div>
                            <p className="text-sm text-amber-100/70 mt-1 leading-6">
                                Meta returned fewer accounts than this Google login previously had enabled. Existing automations for missing accounts may stop if Meta removed app access to those assets.
                            </p>
                        </div>
                    </div>
                )}

                <div className="rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl overflow-hidden">
                    <div className="p-5 border-b border-white/8 flex items-start justify-between gap-4">
                        <div>
                            <div className="font-semibold">Accounts returned by Meta</div>
                            <div className="text-sm text-white/35 mt-1">
                                Keep enabled what this Google login should see in dashboards and automation.
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                            <CheckCircle2 size={13} />
                            {enabledCount} enabled
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 flex items-center justify-center gap-3 text-white/45">
                            <RefreshCw size={18} className="animate-spin" />
                            Loading accounts...
                        </div>
                    ) : error ? (
                        <div className="p-6 text-sm text-red-300">{error}</div>
                    ) : returnedAccounts.length === 0 ? (
                        <div className="p-8 text-center text-white/45">
                            No Instagram accounts were returned by this Meta connection.
                        </div>
                    ) : (
                        <div className="divide-y divide-white/8">
                            {returnedAccounts.map((account) => {
                                const busy = updatingAccountId === account.id;
                                return (
                                    <div key={account.id} className="p-5 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <AccountAvatar account={account} />
                                            <div className="min-w-0">
                                                <div className="font-semibold truncate">@{account.username}</div>
                                                <div className="text-sm text-white/42 truncate mt-1">
                                                    {account.name || 'Instagram Business'}{account.followers_count ? ` - ${account.followers_count.toLocaleString()} followers` : ''}
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {account.is_active && <span className="badge badge-success">Active</span>}
                                                    <span className={`badge ${account.is_enabled ? 'badge-success' : 'badge-primary'}`}>
                                                        {account.is_enabled ? 'Enabled' : 'Hidden'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {busy && <RefreshCw size={14} className="animate-spin text-white/35" />}
                                            <Toggle
                                                checked={account.is_enabled}
                                                disabled={busy}
                                                onChange={() => handleToggleAccount(account)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {otherAccounts.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm text-white/35 leading-6">
                        {otherAccounts.length} previously linked account{otherAccounts.length === 1 ? '' : 's'} did not come back from this Meta connection and remain managed from Settings.
                    </div>
                )}

                <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/8 p-4 flex gap-3">
                    <ShieldCheck size={18} className="text-indigo-300 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/45 leading-6">
                        For shared Facebook logins, keep all business assets checked in Meta. Use infini8Graph switches for per-Google-account visibility.
                    </p>
                </div>

                <div className="mt-7 flex justify-end">
                    <button
                        type="button"
                        onClick={continueToDashboard}
                        className="h-12 px-5 rounded-2xl bg-white text-black font-bold flex items-center gap-2 hover:bg-white/90 transition-colors"
                    >
                        Continue to dashboard
                        <ArrowRight size={17} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function MetaAccountSelectionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center p-6">
                <RefreshCw className="text-white/30 animate-spin" size={34} />
            </div>
        }>
            <MetaAccountSelectionContent />
        </Suspense>
    );
}
