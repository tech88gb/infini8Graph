'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
    Card, CardHeader, CardTitle, CardBody,
    Button, Toggle, Checkbox, Chip, Badge,
    EmptyState, PageHeader, LoadingPage, Toast, Spinner,
    Tooltip, InfoIcon
} from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

/**
 * Authenticated fetch — mirrors the axios interceptor in api.ts.
 * Reads the JWT from localStorage and adds it as an Authorization header
 * so requests work even when third-party / cross-site cookies are blocked
 * (Safari ITP, Firefox strict mode, Chrome incognito, etc.).
 * @param url  Full URL to fetch
 * @param opts Standard RequestInit options
 */
async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((opts.headers as Record<string, string>) || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Auth-Token'] = token;
    }
    return fetch(url, { ...opts, headers, credentials: 'include' });
}

interface AutomationRule {
    id?: string;
    instagram_account_id?: string;
    media_id?: string | null;
    media_ids?: string[] | null;
    name: string;
    keywords: string[];
    comment_reply: string;
    dm_reply: string;
    send_dm: boolean;
    is_active: boolean;
}

interface MediaItem {
    id: string;
    media_url: string;
    caption: string;
    is_collaboration?: boolean;
}

interface AutomationRulesResponse {
    success: boolean;
    rules?: AutomationRule[];
}

interface AutomationMediaResponse {
    success: boolean;
    data?: {
        all?: Array<{
            id: string;
            thumbnail?: string;
            media_url?: string;
            caption?: string;
            is_collaboration?: boolean;
        }>;
    };
}

interface AutomationStatsResponse {
    success: boolean;
    stats?: {
        totalRepliesSent: number;
        messagingReplies: number;
        commentReplies: number;
        errors: number;
        activeRules: number;
        recentEvents: number;
    };
}

const AUTOMATION_RULES_QUERY_KEY = ['automation', 'rules'];
const AUTOMATION_MEDIA_QUERY_KEY = ['automation', 'media'];
const AUTOMATION_STATS_QUERY_KEY = ['automation', 'stats'];

async function fetchJson<T>(url: string, opts: RequestInit = {}): Promise<T> {
    const res = await authFetch(url, opts);
    if (!res.ok) {
        let message = 'Request failed';
        try {
            const errorBody = await res.json();
            message = errorBody?.error || message;
        } catch {
            // Keep the fallback message if the error response is not JSON.
        }
        throw new Error(message);
    }
    return res.json();
}

export default function AutomationPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [defaultRule, setDefaultRule] = useState<AutomationRule>({
        name: 'Default Automation', keywords: [], comment_reply: '', dm_reply: '',
        send_dm: false, is_active: false, media_id: null, media_ids: []
    });
    const [showKeywords, setShowKeywords] = useState(false);
    const [showCreateOverride, setShowCreateOverride] = useState(false);
    const [expandedOverride, setExpandedOverride] = useState<string | null>(null);
    const [newRule, setNewRule] = useState<AutomationRule>({
        name: '', keywords: [], comment_reply: '', dm_reply: '',
        send_dm: true, is_active: true, media_id: null, media_ids: []
    });
    const [kwInput, setKwInput] = useState('');
    const [defaultKwInput, setDefaultKwInput] = useState('');
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [editKwInput, setEditKwInput] = useState('');

    const rulesQuery = useQuery({
        queryKey: AUTOMATION_RULES_QUERY_KEY,
        enabled: !!user,
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: false,
        queryFn: async () => {
            const data = await fetchJson<AutomationRulesResponse>(`${API_BASE}/api/automation/rules`);
            return data.rules || [];
        }
    });

    const mediaQuery = useQuery({
        queryKey: AUTOMATION_MEDIA_QUERY_KEY,
        enabled: !!user,
        staleTime: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
        queryFn: async () => {
            const data = await fetchJson<AutomationMediaResponse>(`${API_BASE}/api/instagram/posts?limit=100&includeCollabs=true`);
            return (data.data?.all || []).map((p) => ({
                id: p.id,
                media_url: p.thumbnail || p.media_url || '',
                caption: p.caption || '',
                is_collaboration: p.is_collaboration || false
            }));
        }
    });

    const statsQuery = useQuery({
        queryKey: AUTOMATION_STATS_QUERY_KEY,
        enabled: !!user,
        staleTime: 1000 * 10,
        refetchInterval: 15000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        queryFn: async () => {
            const data = await fetchJson<AutomationStatsResponse>(`${API_BASE}/api/automation/stats`);
            return data.stats || {
                totalRepliesSent: 0,
                messagingReplies: 0,
                commentReplies: 0,
                errors: 0,
                activeRules: 0,
                recentEvents: 0
            };
        }
    });

    useEffect(() => {
        if (!rulesQuery.data) return;

        const allRules = rulesQuery.data;
        console.log('📋 Fetched rules from API:', allRules.length, allRules);
        setRules(allRules);

        const def = allRules.find(r => !r.media_id && (!r.media_ids || r.media_ids.length === 0));
        if (def) {
            setDefaultRule(def);
            if (def.keywords?.length > 0) setShowKeywords(true);
        }

        const specific = allRules.filter(r => r.media_id || (r.media_ids && r.media_ids.length > 0));
        console.log('🎯 Specific rules (overrides):', specific.length, specific);
    }, [rulesQuery.data]);

    useEffect(() => {
        if (!mediaQuery.data) return;

        console.log('📸 Fetched posts:', mediaQuery.data.length, 'posts');
        setMedia(mediaQuery.data);
    }, [mediaQuery.data]);

    const specificRules = useMemo(() => {
        const filtered = rules.filter(r => r.media_id || (r.media_ids && r.media_ids.length > 0));
        console.log('🎯 Computing specificRules:', filtered.length, 'from', rules.length, 'total rules');
        return filtered;
    }, [rules]);
    
    const notify = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3000); };

    const refreshRules = async () => {
        await queryClient.invalidateQueries({ queryKey: AUTOMATION_RULES_QUERY_KEY });
        await queryClient.invalidateQueries({ queryKey: AUTOMATION_STATS_QUERY_KEY });
    };

    const toggleDefault = async (checked: boolean) => {
        // Optimistic update
        setDefaultRule({ ...defaultRule, is_active: checked });
        
        if (defaultRule.id) {
            try {
                const res = await authFetch(`${API_BASE}/api/automation/rules/${defaultRule.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ is_active: checked })
                });
                if (!res.ok) {
                    notify('error', 'Failed to update');
                    await rulesQuery.refetch(); // Rollback
                }
            } catch { 
                notify('error', 'Network error'); 
                await rulesQuery.refetch(); // Rollback
            }
        }
    };

    const saveDefault = async () => {
        if (!defaultRule.comment_reply.trim()) { notify('error', 'Please enter a reply message'); return; }
        setSaving(true);
        try {
            const method = defaultRule.id ? 'PATCH' : 'POST';
            const url = defaultRule.id ? `${API_BASE}/api/automation/rules/${defaultRule.id}` : `${API_BASE}/api/automation/rules`;
            const res = await authFetch(url, { method, body: JSON.stringify({ ...defaultRule, name: 'Default Automation', keywords: defaultRule.keywords || [], media_id: null, media_ids: [] }) });
            if (res.ok) { const data = await res.json(); setDefaultRule(data.rule); notify('success', 'Saved successfully!'); await refreshRules(); }
            else { const err = await res.json(); notify('error', err.error || 'Save failed'); }
        } catch { notify('error', 'Network error'); } finally { setSaving(false); }
    };

    const createOverride = async () => {
        if (!newRule.name.trim()) return notify('error', 'Enter a name');
        if (!newRule.media_ids?.length) return notify('error', 'Select at least one post');
        if (!newRule.comment_reply.trim()) return notify('error', 'Enter a reply');
        setSaving(true);
        try {
            console.log('🔧 Creating override:', newRule);
            const res = await authFetch(`${API_BASE}/api/automation/rules`, { method: 'POST', body: JSON.stringify(newRule) });
            const data = await res.json();
            console.log('📥 Create response:', data);
            if (res.ok) { 
                notify('success', 'Override created!'); 
                setShowCreateOverride(false); 
                setNewRule({ name: '', keywords: [], comment_reply: '', dm_reply: '', send_dm: true, is_active: true, media_id: null, media_ids: [] }); 
                await refreshRules();
            }
            else {
                console.error('❌ Create failed:', data);
                notify('error', data.error || 'Failed to create');
            }
        } catch (err) { 
            console.error('❌ Network error:', err);
            notify('error', 'Network error'); 
        } finally { setSaving(false); }
    };

    const deleteRule = async (id: string) => {
        if (!confirm('Delete this override?')) return;
        try {
            await authFetch(`${API_BASE}/api/automation/rules/${id}`, { method: 'DELETE' });
            await refreshRules();
        } catch { }
    };

    const updateRule = async () => {
        if (!editingRule) return;
        if (!editingRule.name.trim()) return notify('error', 'Enter a name');
        if (!editingRule.media_ids?.length) return notify('error', 'Select at least one post');
        if (!editingRule.comment_reply.trim()) return notify('error', 'Enter a reply');
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/automation/rules/${editingRule.id}`, {
                method: 'PATCH',
                body: JSON.stringify(editingRule)
            });
            const data = await res.json();
            if (res.ok) {
                notify('success', 'Rule updated!');
                setEditingRule(null);
                await refreshRules();
            } else {
                notify('error', data.error || 'Update failed');
            }
        } catch { notify('error', 'Network error'); } finally { setSaving(false); }
    };

    const editTogglePost = (id: string) => {
        if (!editingRule) return;
        const curr = editingRule.media_ids || [];
        setEditingRule({ ...editingRule, media_ids: curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id] });
    };

    const toggleRule = async (rule: AutomationRule) => {
        try {
            // Optimistic update
            setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
            
            const res = await authFetch(`${API_BASE}/api/automation/rules/${rule.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !rule.is_active })
            });
            if (!res.ok) {
                notify('error', 'Failed to update rule');
                await rulesQuery.refetch(); // Rollback
            } else {
                await queryClient.invalidateQueries({ queryKey: AUTOMATION_STATS_QUERY_KEY });
            }
        } catch { 
            notify('error', 'Network error'); 
            await rulesQuery.refetch(); // Rollback
        }
    };

    const togglePost = (id: string) => {
        const curr = newRule.media_ids || [];
        setNewRule({ ...newRule, media_ids: curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id] });
    };

    const addKeyword = (input: string, setInput: (v: string) => void, rule: AutomationRule, setRule: (r: AutomationRule) => void) => {
        if (!input.trim()) return;
        const newKws = input.split(/[,\s]+/).map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
        setRule({ ...rule, keywords: [...new Set([...rule.keywords, ...newKws])] });
        setInput('');
    };

    const stats = statsQuery.data || {
        totalRepliesSent: 0,
        messagingReplies: 0,
        commentReplies: 0,
        errors: 0,
        activeRules: 0,
        recentEvents: 0
    };

    if ((rulesQuery.isLoading && !rules.length) || (mediaQuery.isLoading && !media.length)) {
        return <LoadingPage text="Loading automation..." />;
    }

    const statsRow = [
        {
            label: 'Total Replies',
            value: stats.totalRepliesSent,
            color: 'var(--primary)',
            icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        },
        {
            label: 'Comments',
            value: stats.commentReplies,
            color: '#38bdf8',
            icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        },
        {
            label: 'DMs Sent',
            value: stats.messagingReplies,
            color: '#22c55e',
            icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        },
        {
            label: 'Active Rules',
            value: stats.activeRules,
            color: '#fbbf24',
            icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
        },
        {
            label: 'Errors',
            value: stats.errors,
            color: '#ef4444',
            icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        }
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
            {toast && <Toast type={toast.type} message={toast.message} />}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
                <PageHeader
                    title="Auto-Reply"
                    subtitle="Automatically respond to Instagram comments & DMs"
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />

                {/* Automation Stats Bar */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-4)',
                    marginBottom: 'var(--space-8)'
                }}>
                    {statsRow.map((stat, i) => (
                        <Card key={i} style={{ border: 'none', background: 'var(--card-raised)', boxShadow: '0 16px 32px rgba(0,0,0,0.18)' }}>
                            <CardBody style={{ padding: 'var(--space-5)' }}>
                                <div className="flex items-center justify-between">
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '12px',
                                        background: `${stat.color}15`, color: stat.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20
                                    }}>
                                        {stat.icon}
                                    </div>
                                    <div style={{ color: 'var(--success)', fontSize: 10, fontWeight: 700, background: 'var(--success-light)', padding: '2px 6px', borderRadius: 4, visibility: i === 0 ? 'visible' : 'hidden' }}>
                                        LIVE
                                    </div>
                                </div>
                                <div style={{ marginTop: 'var(--space-4)' }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{stat.value}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>

                <div className="layout-split">
                    <div className="layout-split-main flex flex-col gap-6">
                        {/* General Response Rule - CLEANER LAYOUT */}
                        <Card style={{ border: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--card-raised) 0%, rgba(16, 17, 26, 0.8) 100%)' }}>
                            <CardHeader style={{ borderBottom: '1px solid var(--border-light)', padding: 'var(--space-6)' }}>
                                <div className="flex items-center gap-4">
                                    <div style={{ width: 44, height: 44, borderRadius: '12px', background: defaultRule.is_active ? 'var(--success-light)' : 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                                        <svg width="22" height="22" fill="none" stroke={defaultRule.is_active ? 'var(--success)' : 'var(--muted)'} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <CardTitle subtitle="Applies to all incoming comments across your profile">General Response Rule</CardTitle>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: defaultRule.is_active ? 'var(--success)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {defaultRule.is_active ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                    <Toggle checked={defaultRule.is_active} onChange={toggleDefault} />
                                </div>
                            </CardHeader>
                            <CardBody style={{ padding: 'var(--space-8)' }}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-6">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="form-label mb-0 flex items-center gap-2">
                                                    Keywords to Watch For
                                                    <Tooltip content="Leave blank to reply to every comment. If set, we only reply if these words appear.">
                                                        <InfoIcon />
                                                    </Tooltip>
                                                </label>
                                                <span className="text-xs text-muted">{defaultRule.keywords.length} active</span>
                                            </div>
                                            <div className="flex gap-2 p-1.5 background-alt border border-light rounded-xl focus-within:border-primary transition-all">
                                                <input type="text" value={defaultKwInput} onChange={e => setDefaultKwInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(defaultKwInput, setDefaultKwInput, defaultRule, setDefaultRule))} placeholder="e.g. price, info, link..." className="bg-transparent border-none outline-none px-3 py-1.5 flex-1 transition-all text-sm" />
                                                <Button size="sm" variant="secondary" onClick={() => addKeyword(defaultKwInput, setDefaultKwInput, defaultRule, setDefaultRule)}>Add</Button>
                                            </div>
                                            {defaultRule.keywords.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-4">
                                                    {defaultRule.keywords.map(k => <Chip key={k} onRemove={() => setDefaultRule({ ...defaultRule, keywords: defaultRule.keywords.filter(x => x !== k) })}>{k}</Chip>)}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Checkbox checked={defaultRule.send_dm} onChange={(checked) => setDefaultRule({ ...defaultRule, send_dm: checked })} label="Send Private Message (DM)" />
                                            <Tooltip content="Perfect for sending pricing info or links that aren't public.">
                                                <InfoIcon />
                                            </Tooltip>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-6">
                                        <div>
                                            <label className="form-label flex items-center gap-2 mb-3">
                                                Public Response
                                                <Tooltip content="This message appears as a public reply to the comment.">
                                                    <InfoIcon />
                                                </Tooltip>
                                            </label>
                                            <textarea value={defaultRule.comment_reply} onChange={e => setDefaultRule({ ...defaultRule, comment_reply: e.target.value })} placeholder="Write your public reply here..." className="input w-full" style={{ minHeight: 110, fontSize: '14px', borderRadius: '16px' }} />
                                            <div className="text-right mt-2"><span className="text-xs text-muted">{defaultRule.comment_reply.length} / 1000 characters</span></div>
                                        </div>

                                        {defaultRule.send_dm && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="form-label flex items-center gap-2 mb-3">
                                                    Private DM Message
                                                    <Tooltip content="This message is sent privately to the user.">
                                                        <InfoIcon />
                                                    </Tooltip>
                                                </label>
                                                <textarea value={defaultRule.dm_reply} onChange={e => setDefaultRule({ ...defaultRule, dm_reply: e.target.value })} placeholder="Write your private message here..." className="input w-full" style={{ minHeight: 90, fontSize: '14px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.03)' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-10 pt-6 border-top border-light flex justify-end">
                                    <Button variant="primary" size="lg" onClick={saveDefault} isLoading={saving} style={{ paddingLeft: 'min(var(--space-12), 48px)', paddingRight: 'min(var(--space-12), 48px)' }}>
                                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        Update Automation
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Post Overrides */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-1">
                                    <CardTitle subtitle="Custom rules for individual posts">Custom Post Settings</CardTitle>
                                    <Tooltip content="Create special responses for specific posts (e.g., for a giveaway or a product sale).">
                                        <InfoIcon />
                                    </Tooltip>
                                </div>
                                <Button variant={showCreateOverride ? 'ghost' : 'secondary'} size="sm" onClick={() => setShowCreateOverride(!showCreateOverride)}>
                                    {showCreateOverride ? (<><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Cancel</>) : (<><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Add override</>)}
                                </Button>
                            </CardHeader>
                            
                            {showCreateOverride && (
                                <div style={{ padding: 'var(--space-8)', background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border)', borderRadius: '20px', margin: 'var(--space-6)', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }}>
                                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--foreground)', marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div style={{ width: 8, height: 24, background: 'var(--primary)', borderRadius: 4 }} />
                                        Create Custom Rule
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="flex flex-col gap-8">
                                            <div>
                                                <label className="form-label flex items-center gap-2 mb-3">
                                                    Rule Label
                                                    <Tooltip content="A name to help you identify this custom rule in your list.">
                                                        <InfoIcon />
                                                    </Tooltip>
                                                </label>
                                                <input type="text" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="e.g. Giveaway Post Rule" className="input text-base" />
                                            </div>
                                            
                                            <div>
                                                <label className="form-label flex items-center justify-between mb-3">
                                                    <span className="flex items-center gap-1">
                                                        Target Posts
                                                        <Tooltip content="Choose one or more posts you want this rule to apply to.">
                                                            <InfoIcon />
                                                        </Tooltip>
                                                        {(newRule.media_ids?.length || 0) > 0 && <span className="text-primary ml-2 font-bold">({newRule.media_ids?.length})</span>}
                                                    </span>
                                                    <span className="text-xs text-muted font-normal uppercase tracking-wider">Select Thumbnails</span>
                                                </label>
                                                <div style={{ display: 'flex', gap: 'var(--space-3)', overflowX: 'auto', padding: 'var(--space-2) 0 var(--space-4) 0', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }} className="custom-scroll">
                                                    {media.length === 0 ? <p className="text-muted p-4 italic">No posts available.</p> : media.map(m => {
                                                        const selected = newRule.media_ids?.includes(m.id);
                                                        return (
                                                            <div key={m.id} onClick={() => togglePost(m.id)} style={{ 
                                                                flex: '0 0 auto', width: 120, cursor: 'pointer', 
                                                                background: selected ? 'rgba(99, 102, 241, 0.15)' : 'var(--card-raised)',
                                                                border: selected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                                                                borderRadius: '16px', overflow: 'hidden', padding: '6px',
                                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
                                                                transform: selected ? 'scale(1.05)' : 'scale(1)'
                                                            }}>
                                                                <div style={{ aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                                                                    <img src={m.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                                    {selected && <div style={{ position: 'absolute', inset: 0, background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}><svg width="18" height="18" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div></div>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="form-label flex items-center gap-2 mb-3">
                                                    Rule Keywords
                                                    <Tooltip content="Only reply to comments containing these. Keep blank to catch all.">
                                                        <InfoIcon />
                                                    </Tooltip>
                                                </label>
                                                <div className="flex gap-2 p-1.5 background-alt border border-light rounded-xl focus-within:border-primary">
                                                    <input type="text" value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(kwInput, setKwInput, newRule, setNewRule))} placeholder="e.g. discount, 2024..." className="bg-transparent border-none outline-none px-3 py-1.5 flex-1 text-sm" />
                                                    <Button size="sm" variant="secondary" onClick={() => addKeyword(kwInput, setKwInput, newRule, setNewRule)}>Add</Button>
                                                </div>
                                                {newRule.keywords.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-4">
                                                        {newRule.keywords.map(k => <Chip key={k} onRemove={() => setNewRule({ ...newRule, keywords: newRule.keywords.filter(x => x !== k) })}>{k}</Chip>)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-8">
                                            <div>
                                                <label className="form-label flex items-center gap-2 mb-3">
                                                    Public Message
                                                    <Tooltip content="The message posted publicly as a response.">
                                                        <InfoIcon />
                                                    </Tooltip>
                                                </label>
                                                <textarea value={newRule.comment_reply} onChange={e => setNewRule({ ...newRule, comment_reply: e.target.value })} placeholder="Thanks for reaching out! DM-ing you the details. 🔥" className="input" style={{ minHeight: 110, borderRadius: '16px' }} />
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="form-label flex items-center gap-2 mb-0">
                                                        Direct Message
                                                        <Tooltip content="Message sent privately to the user.">
                                                            <InfoIcon />
                                                        </Tooltip>
                                                    </label>
                                                    <Checkbox checked={newRule.send_dm} onChange={(checked) => setNewRule({ ...newRule, send_dm: checked })} label="" />
                                                </div>
                                                <textarea value={newRule.dm_reply} onChange={e => setNewRule({ ...newRule, dm_reply: e.target.value })} placeholder="Here is the link you requested: ..." className="input" style={{ minHeight: 110, borderRadius: '16px', opacity: newRule.send_dm ? 1 : 0.4, background: 'rgba(99, 102, 241, 0.03)' }} disabled={!newRule.send_dm} />
                                            </div>

                                            <div className="flex gap-4 mt-4 pt-4">
                                                <Button variant="primary" style={{ flex: 1, padding: '16px' }} onClick={createOverride} isLoading={saving}>Create Rule</Button>
                                                <Button variant="ghost" onClick={() => setShowCreateOverride(false)}>Cancel</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                                {specificRules.length === 0 ? (
                                    <div className="p-12 mb-4 bg-transparent border border-dashed border-light rounded-2xl">
                                        <EmptyState 
                                            icon={<div style={{ padding: 16, background: 'var(--border-light)', borderRadius: '16px' }}><svg width="32" height="32" fill="none" stroke="var(--muted)" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16h16M4 12h16M4 8h16M4 20h16" /></svg></div>} 
                                            title="No custom rules active" 
                                            description="Custom rules let you automate specific responses for different posts." 
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 pb-4">
                                        {specificRules.map(rule => {
                                            const expanded = expandedOverride === rule.id;
                                            const thumbs = rule.media_ids?.map(id => media.find(x => x.id === id)?.media_url).filter(Boolean).slice(0, 4) || [];
                                            return (
                                                <div key={rule.id} className={`transition-all duration-300 ${expanded ? 'bg-background-alt' : 'hover:bg-background-alt/50'}`} style={{ borderRadius: '16px', border: expanded ? '1px solid var(--border)' : '1px solid transparent', overflow: 'hidden' }}>
                                                    <div onClick={() => setExpandedOverride(expanded ? null : rule.id || null)} className="flex items-center gap-6 cursor-pointer p-5">
                                                        <div className="flex" style={{ marginLeft: -6 }}>
                                                            {thumbs.map((url, i) => (
                                                                <div key={i} style={{ width: 44, height: 44, borderRadius: '10px', overflow: 'hidden', border: '2px solid var(--background)', marginLeft: i > 0 ? -16 : 0, boxShadow: '0 4px 8px rgba(0,0,0,0.2)', zIndex: 4 - i }}>
                                                                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                                </div>
                                                            ))}
                                                            { (rule.media_ids?.length || 0) > 4 && (
                                                                <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'var(--card-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--background)', marginLeft: -16, zIndex: 0, fontSize: '10px', fontWeight: 800 }}>
                                                                    +{rule.media_ids!.length - 4}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-bold text-base tracking-tight">{rule.name}</span>
                                                                <Badge variant={rule.is_active ? 'success' : 'primary'} pill>{rule.is_active ? 'Live' : 'Paused'}</Badge>
                                                            </div>
                                                            <p className="text-xs text-muted font-medium uppercase tracking-widest mt-1">
                                                                {rule.keywords?.length ? `Keywords: ${rule.keywords.join(', ')}` : 'All comments targeting these posts'}
                                                            </p>
                                                        </div>
                                                        <div onClick={(e) => { e.stopPropagation(); toggleRule(rule); }} style={{ padding: '4px' }}>
                                                            <Toggle checked={rule.is_active} onChange={() => {}} />
                                                        </div>
                                                        <div style={{ padding: '4px', opacity: 0.4 }}>
                                                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </div>
                                                    {expanded && (
                                                        <div style={{ padding: '0 24px 24px', animation: 'fadeIn 0.3s ease-out' }}>
                                                          {editingRule && editingRule.id === rule.id ? (
                                                            /* ─── INLINE EDIT FORM ─── */
                                                            <div style={{ background: 'var(--background-alt)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
                                                                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Edit Rule</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                    {/* Left column */}
                                                                    <div className="flex flex-col gap-5">
                                                                        <div>
                                                                            <label className="form-label mb-2">Rule Name</label>
                                                                            <input
                                                                                className="input"
                                                                                value={editingRule!.name}
                                                                                onChange={e => setEditingRule({ ...editingRule!, name: e.target.value })}
                                                                                placeholder="e.g. Giveaway Post"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="form-label mb-2">Posts this rule applies to</label>
                                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8, maxHeight: 220, overflowY: 'auto', padding: 4 }}>
                                                                                {media.map(m => {
                                                                                    const selected = editingRule!.media_ids?.includes(m.id);
                                                                                    return (
                                                                                        <div
                                                                                            key={m.id}
                                                                                            onClick={() => editTogglePost(m.id)}
                                                                                            style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: selected ? '2px solid var(--primary)' : '2px solid transparent', opacity: selected ? 1 : 0.5, transition: 'all 0.2s' }}
                                                                                        >
                                                                                            <img src={m.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                                                            {selected && (
                                                                                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                                    <svg width="16" height="16" fill="white" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <label className="form-label mb-2">Keywords</label>
                                                                            <div className="flex gap-2 p-1.5 background-alt border border-light rounded-xl focus-within:border-primary">
                                                                                <input
                                                                                    type="text"
                                                                                    value={editKwInput}
                                                                                    onChange={e => setEditKwInput(e.target.value)}
                                                                                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(editKwInput, setEditKwInput, editingRule!, setEditingRule as any))}
                                                                                    placeholder="e.g. discount, promo..."
                                                                                    className="bg-transparent border-none outline-none px-3 py-1.5 flex-1 text-sm"
                                                                                />
                                                                                <Button size="sm" variant="secondary" onClick={() => addKeyword(editKwInput, setEditKwInput, editingRule!, setEditingRule as any)}>Add</Button>
                                                                            </div>
                                                                            {editingRule!.keywords.length > 0 && (
                                                                                <div className="flex flex-wrap gap-2 mt-3">
                                                                                    {editingRule!.keywords.map(k => <Chip key={k} onRemove={() => setEditingRule({ ...editingRule!, keywords: editingRule!.keywords.filter(x => x !== k) })}>{k}</Chip>)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {/* Right column */}
                                                                    <div className="flex flex-col gap-5">
                                                                        <div>
                                                                            <label className="form-label mb-2">Public Reply</label>
                                                                            <textarea
                                                                                value={editingRule!.comment_reply}
                                                                                onChange={e => setEditingRule({ ...editingRule!, comment_reply: e.target.value })}
                                                                                className="input"
                                                                                style={{ minHeight: 90, borderRadius: '12px' }}
                                                                                placeholder="Hi, check your DMs!"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <label className="form-label mb-0">Direct Message</label>
                                                                                <Checkbox checked={editingRule!.send_dm} onChange={checked => setEditingRule({ ...editingRule!, send_dm: checked })} label="" />
                                                                            </div>
                                                                            <textarea
                                                                                value={editingRule!.dm_reply}
                                                                                onChange={e => setEditingRule({ ...editingRule!, dm_reply: e.target.value })}
                                                                                className="input"
                                                                                style={{ minHeight: 90, borderRadius: '12px', opacity: editingRule!.send_dm ? 1 : 0.4 }}
                                                                                disabled={!editingRule!.send_dm}
                                                                                placeholder="Here is your link: ..."
                                                                            />
                                                                        </div>
                                                                        <div className="flex gap-3 mt-2">
                                                                            <Button variant="primary" style={{ flex: 1 }} onClick={updateRule} isLoading={saving}>Save Changes</Button>
                                                                            <Button variant="ghost" onClick={() => { setEditingRule(null); setEditKwInput(''); }}>Cancel</Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                          ) : (
                                                            /* ─── READ VIEW ─── */
                                                            <>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-background/50 rounded-2xl border border-light" style={{ overflow: 'hidden' }}>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <span className="text-[10px] text-muted font-extrabold uppercase tracking-[0.1em]">Public Reply</span>
                                                                        <p className="mt-2 text-sm leading-relaxed text-foreground/90" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{rule.comment_reply}</p>
                                                                    </div>
                                                                    {rule.send_dm && (
                                                                        <div style={{ minWidth: 0 }}>
                                                                            <span className="text-[10px] text-primary font-extrabold uppercase tracking-[0.1em] flex items-center gap-1.5">
                                                                                <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293A1 1 0 016 6h8a1 1 0 01.707 1.707l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                                                                Direct Message
                                                                            </span>
                                                                            <p className="mt-2 text-sm leading-relaxed text-foreground/90" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{rule.dm_reply}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="mt-4 flex justify-end gap-2">
                                                                    <Button variant="secondary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setEditingRule({ ...rule }); setEditKwInput(''); }} style={{ borderRadius: '10px' }}>Edit Rule</Button>
                                                                    <Button variant="danger" size="sm" onClick={() => deleteRule(rule.id!)} style={{ borderRadius: '10px' }}>Remove Rule</Button>
                                                                </div>
                                                            </>
                                                          )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    <div className="layout-split-aside">
                        <Card>
                            <CardHeader>
                                <CardTitle subtitle="Preview your automation">Live Preview</CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="mb-4">
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>User Comment</span>
                                    <div className="flex items-start gap-3 mt-2">
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)' }} />
                                        <div style={{ flex: 1, padding: '12px', background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--foreground)' }}>@user_example</p>
                                            <p className="mt-1" style={{ color: 'var(--foreground)', fontSize: '13px', lineHeight: '1.4' }}>
                                                {defaultRule.keywords.length > 0 ? (
                                                    <>Looking for the <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-light)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{defaultRule.keywords[0]}</span>?</>
                                                ) : (
                                                    'This is a really cool post! Clean shot! 🔥'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Your Reply</span>
                                    <div className="flex items-start gap-3 mt-2" style={{ paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--border)' }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                                        </div>
                                        <div style={{ flex: 1, padding: '10px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px' }}>
                                            <div className="flex items-center justify-between mb-1">
                                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>@your_account</p>
                                                <span style={{ fontSize: '9px', color: 'var(--muted)' }}>Reply</span>
                                            </div>
                                            <p className="mt-1" style={{ color: 'var(--foreground)', fontSize: '13px', lineHeight: '1.4' }}>{defaultRule.comment_reply || 'Type a message to see preview...'}</p>
                                        </div>
                                    </div>
                                </div>
                                {defaultRule.send_dm && (
                                    <div className="mt-3">
                                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>DM Preview</span>
                                        <div style={{ marginTop: 'var(--space-2)', padding: '12px', borderRadius: '12px', background: 'var(--card-raised)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--primary)' }} />
                                                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px' }}>OFFICIAL DM</span>
                                            </div>
                                            <p style={{ color: 'var(--foreground)', fontSize: '13px', lineHeight: '1.4' }}>{defaultRule.dm_reply || 'Type a DM to see preview...'}</p>
                                        </div>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
