'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import {
    Card, CardHeader, CardTitle, CardBody,
    Button, Toggle, Checkbox, Chip, Badge,
    EmptyState, PageHeader, LoadingPage, Toast, Spinner,
    Tooltip, InfoIcon
} from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

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

export default function AutomationPage() {
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
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
    const [stats, setStats] = useState<any>({
        totalRepliesSent: 0,
        messagingReplies: 0,
        commentReplies: 0,
        errors: 0,
        activeRules: 0,
        recentEvents: 0
    });
    const [loadingStats, setLoadingStats] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [rulesRes, mediaRes] = await Promise.all([
                fetch(`${API_BASE}/api/automation/rules`, { credentials: 'include' }),
                fetch(`${API_BASE}/api/instagram/posts?limit=100&includeCollabs=true`, { credentials: 'include' })
            ]);
            if (rulesRes.ok) {
                const data = await rulesRes.json();
                const allRules: AutomationRule[] = data.rules || [];
                console.log('📋 Fetched rules from API:', allRules.length, allRules);
                setRules(allRules);
                const def = allRules.find(r => !r.media_id && (!r.media_ids || r.media_ids.length === 0));
                if (def) { setDefaultRule(def); if (def.keywords?.length > 0) setShowKeywords(true); }
                
                // Log specific rules
                const specific = allRules.filter(r => r.media_id || (r.media_ids && r.media_ids.length > 0));
                console.log('🎯 Specific rules (overrides):', specific.length, specific);
            }
            if (mediaRes.ok) {
                const data = await mediaRes.json();
                console.log('📸 Fetched posts:', data.data?.total, 'posts (', data.data?.owned_count, 'owned,', data.data?.collab_count, 'collabs)');
                setMedia((data.data?.all || []).map((p: any) => ({ 
                    id: p.id, 
                    media_url: p.thumbnail || p.media_url, 
                    caption: p.caption || '',
                    is_collaboration: p.is_collaboration || false
                })));
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    const fetchStats = useCallback(async (showLoading = false) => {
        if (showLoading) setLoadingStats(true);
        try {
            const res = await fetch(`${API_BASE}/api/automation/stats`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            if (showLoading) setLoadingStats(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        fetchStats(true);
        const timer = setInterval(() => fetchStats(false), 5000);
        return () => clearInterval(timer);
    }, [fetchStats]);

    const specificRules = useMemo(() => {
        const filtered = rules.filter(r => r.media_id || (r.media_ids && r.media_ids.length > 0));
        console.log('🎯 Computing specificRules:', filtered.length, 'from', rules.length, 'total rules');
        return filtered;
    }, [rules]);
    
    const notify = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3000); };

    const toggleDefault = async (checked: boolean) => {
        // Optimistic update
        setDefaultRule({ ...defaultRule, is_active: checked });
        
        if (defaultRule.id) {
            try {
                const res = await fetch(`${API_BASE}/api/automation/rules/${defaultRule.id}`, { 
                    method: 'PATCH', 
                    headers: { 'Content-Type': 'application/json' }, 
                    credentials: 'include', 
                    body: JSON.stringify({ is_active: checked }) 
                });
                if (!res.ok) {
                    notify('error', 'Failed to update');
                    fetchData(); // Rollback
                }
            } catch { 
                notify('error', 'Network error'); 
                fetchData(); // Rollback
            }
        }
    };

    const saveDefault = async () => {
        if (!defaultRule.comment_reply.trim()) { notify('error', 'Please enter a reply message'); return; }
        setSaving(true);
        try {
            const method = defaultRule.id ? 'PATCH' : 'POST';
            const url = defaultRule.id ? `${API_BASE}/api/automation/rules/${defaultRule.id}` : `${API_BASE}/api/automation/rules`;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...defaultRule, name: 'Default Automation', keywords: defaultRule.keywords || [], media_id: null, media_ids: [] }) });
            if (res.ok) { const data = await res.json(); setDefaultRule(data.rule); notify('success', 'Saved successfully!'); fetchData(); }
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
            const res = await fetch(`${API_BASE}/api/automation/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(newRule) });
            const data = await res.json();
            console.log('📥 Create response:', data);
            if (res.ok) { 
                notify('success', 'Override created!'); 
                setShowCreateOverride(false); 
                setNewRule({ name: '', keywords: [], comment_reply: '', dm_reply: '', send_dm: true, is_active: true, media_id: null, media_ids: [] }); 
                
                // Force immediate refresh
                setLoading(true);
                const rulesRes = await fetch(`${API_BASE}/api/automation/rules`, { credentials: 'include' });
                if (rulesRes.ok) {
                    const rulesData = await rulesRes.json();
                    console.log('🔄 Refreshed rules:', rulesData.rules?.length, rulesData.rules);
                    setRules(rulesData.rules || []);
                }
                setLoading(false);
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
        try { await fetch(`${API_BASE}/api/automation/rules/${id}`, { method: 'DELETE', credentials: 'include' }); fetchData(); } catch { }
    };

    const toggleRule = async (rule: AutomationRule) => {
        try {
            // Optimistic update
            setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
            
            const res = await fetch(`${API_BASE}/api/automation/rules/${rule.id}`, { 
                method: 'PATCH', 
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include', 
                body: JSON.stringify({ is_active: !rule.is_active }) 
            });
            if (!res.ok) {
                notify('error', 'Failed to update rule');
                fetchData(); // Rollback
            }
        } catch { 
            notify('error', 'Network error'); 
            fetchData(); // Rollback
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

    if (loading) return <LoadingPage text="Loading automation..." />;

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
                        {/* Default Auto-Reply */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: defaultRule.is_active ? 'var(--success)' : 'var(--color-gray-300)', boxShadow: defaultRule.is_active ? '0 0 8px var(--success)' : 'none' }} />
                                    <div className="flex items-center gap-1">
                                        <CardTitle subtitle="Applies to all your posts">General Response Rule</CardTitle>
                                        <Tooltip content="This message will be used for all your posts unless you create a custom rule for a specific post below.">
                                            <InfoIcon />
                                        </Tooltip>
                                    </div>
                                </div>
                                <Toggle checked={defaultRule.is_active} onChange={toggleDefault} />
                            </CardHeader>
                            <CardBody>
                                <div className="mb-5">
                                    <button onClick={() => setShowKeywords(!showKeywords)} className="flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', fontWeight: 500 }}>
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: showKeywords ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Keywords to Watch For
                                        <Tooltip content="Only reply when comments contain these specific words. Leave empty to reply to every comment.">
                                            <InfoIcon />
                                        </Tooltip>
                                        {defaultRule.keywords.length > 0 && <Badge variant="primary" pill>{defaultRule.keywords.length}</Badge>}
                                    </button>
                                    {showKeywords && (
                                        <div style={{ marginTop: 'var(--space-4)', paddingLeft: 'var(--space-6)' }}>
                                            <p className="text-sm text-muted mb-3">Only reply when comments contain these words. Leave empty to reply to all.</p>
                                            <div className="flex gap-3">
                                                <input type="text" value={defaultKwInput} onChange={e => setDefaultKwInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(defaultKwInput, setDefaultKwInput, defaultRule, setDefaultRule))} placeholder="price, info, link..." className="input" style={{ flex: 1 }} />
                                                <Button variant="secondary" onClick={() => addKeyword(defaultKwInput, setDefaultKwInput, defaultRule, setDefaultRule)}>Add</Button>
                                            </div>
                                            {defaultRule.keywords.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {defaultRule.keywords.map(k => <Chip key={k} onRemove={() => setDefaultRule({ ...defaultRule, keywords: defaultRule.keywords.filter(x => x !== k) })}>{k}</Chip>)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="mb-5">
                                    <label className="form-label flex items-center gap-1">
                                        Public Comment Message
                                        <Tooltip content="This is the public message that will be posted as a reply to the user's comment.">
                                            <InfoIcon />
                                        </Tooltip>
                                    </label>
                                    <textarea value={defaultRule.comment_reply} onChange={e => setDefaultRule({ ...defaultRule, comment_reply: e.target.value })} placeholder="Thank you for your comment. Please check your messages for more information." className="input" style={{ minHeight: 100 }} />
                                </div>
                                <div className="mb-6">
                                    <div className="flex items-center gap-1 mb-2">
                                        <Checkbox checked={defaultRule.send_dm} onChange={(checked) => setDefaultRule({ ...defaultRule, send_dm: checked })} label="Send Private DM Too" />
                                        <Tooltip content="Enable this to automatically send a direct message (DM) as well. Perfect for sharing links or sensitive info.">
                                            <InfoIcon />
                                        </Tooltip>
                                    </div>
                                    {defaultRule.send_dm && (
                                        <div style={{ marginTop: 'var(--space-4)', paddingLeft: 'var(--space-8)' }}>
                                            <textarea value={defaultRule.dm_reply} onChange={e => setDefaultRule({ ...defaultRule, dm_reply: e.target.value })} placeholder="Hey! Thanks for reaching out. Here's more info..." className="input" style={{ minHeight: 90 }} />
                                        </div>
                                    )}
                                </div>
                                <Button variant="primary" block size="lg" onClick={saveDefault} isLoading={saving}>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    Save default reply
                                </Button>
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
                                <div style={{ padding: 'var(--space-6)', background: 'var(--card-raised)', borderRadius: 'var(--radius-lg)', margin: 'var(--space-4)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid inset rgba(255,255,255,0.05)' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-light)', paddingBottom: 'var(--space-4)' }}>Create Custom Post Rule</h3>
                                    
                                    <div className="mb-6">
                                        <label className="form-label flex items-center gap-1">
                                            Rule Label
                                            <Tooltip content="A name to help you identify this custom rule in your list.">
                                                <InfoIcon />
                                            </Tooltip>
                                        </label>
                                        <input type="text" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="e.g. Giveaway Post Rule" className="input" style={{ fontSize: '15px' }} />
                                    </div>
                                    
                                    <div className="mb-6">
                                        <label className="form-label flex items-center justify-between">
                                            <span className="flex items-center gap-1">
                                                Target Posts
                                                <Tooltip content="Choose the specific posts you want this custom rule to apply to.">
                                                    <InfoIcon />
                                                </Tooltip>
                                                {(newRule.media_ids?.length || 0) > 0 && <span className="text-primary ml-2">({newRule.media_ids?.length} selected)</span>}
                                            </span>
                                            <span className="text-xs text-muted font-normal">Select one or more posts</span>
                                        </label>
                                        <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', padding: 'var(--space-2) 0 var(--space-4) 0', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
                                            {media.length === 0 ? <p className="text-muted p-4">No posts available.</p> : media.map(m => {
                                                const selected = newRule.media_ids?.includes(m.id);
                                                return (
                                                    <div key={m.id} onClick={() => togglePost(m.id)} style={{ 
                                                        flex: '0 0 auto', width: 140, cursor: 'pointer', 
                                                        background: selected ? 'var(--color-primary-900)' : 'var(--card-hover)',
                                                        border: selected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                                                        borderRadius: 'var(--radius-lg)', overflow: 'hidden', padding: 'var(--space-2)',
                                                        transition: 'all 0.2s ease', position: 'relative',
                                                        transform: selected ? 'scale(1.02)' : 'scale(1)'
                                                    }}>
                                                        <div style={{ aspectRatio: '1', borderRadius: 'calc(var(--radius-lg) - var(--space-2))', overflow: 'hidden', position: 'relative' }}>
                                                            <img src={m.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                            {selected && <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="14" height="14" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>}
                                                        </div>
                                                        <p style={{ marginTop: 'var(--space-2)', fontSize: '11px', color: selected ? 'var(--primary-light)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, padding: '0 2px' }}>
                                                            {m.caption || 'No caption'}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="form-label flex items-center justify-between">
                                            <span>Trigger Keywords</span>
                                            <span className="text-xs text-muted font-normal">Optional</span>
                                        </label>
                                        <div className="flex gap-3">
                                            <input type="text" value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(kwInput, setKwInput, newRule, setNewRule))} placeholder="e.g. price, link, info..." className="input" style={{ flex: 1 }} />
                                            <Button variant="secondary" onClick={() => addKeyword(kwInput, setKwInput, newRule, setNewRule)}>Add</Button>
                                        </div>
                                        {newRule.keywords.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {newRule.keywords.map(k => <Chip key={k} onRemove={() => setNewRule({ ...newRule, keywords: newRule.keywords.filter(x => x !== k) })}>{k}</Chip>)}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }} className="mb-6">
                                        <div>
                                            <label className="form-label flex items-center gap-1">
                                                Public Message
                                                <Tooltip content="The message posted publicly on the comment.">
                                                    <InfoIcon />
                                                </Tooltip>
                                            </label>
                                            <textarea value={newRule.comment_reply} onChange={e => setNewRule({ ...newRule, comment_reply: e.target.value })} placeholder="Thanks! Check your DMs. 📩" className="input" style={{ minHeight: 80 }} />
                                        </div>
                                        <div>
                                            <label className="form-label flex items-center justify-between">
                                                <span>Private DM</span>
                                                <Checkbox checked={newRule.send_dm} onChange={(checked) => setNewRule({ ...newRule, send_dm: checked })} label="" />
                                            </label>
                                            <textarea value={newRule.dm_reply} onChange={e => setNewRule({ ...newRule, dm_reply: e.target.value })} placeholder="Here is the info..." className="input" style={{ minHeight: 80, opacity: newRule.send_dm ? 1 : 0.4 }} disabled={!newRule.send_dm} />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="primary" onClick={createOverride} isLoading={saving} style={{ flex: 1 }}>Save Custom Rule</Button>
                                        <Button variant="ghost" onClick={() => setShowCreateOverride(false)}>Cancel</Button>
                                    </div>
                                </div>
                            )}

                            <div>
                                {specificRules.length === 0 ? (
                                    <EmptyState icon={<svg width="24" height="24" fill="none" stroke="var(--muted)" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} title="No overrides yet" description="Create custom replies for specific posts" />
                                ) : specificRules.map(rule => {
                                    const expanded = expandedOverride === rule.id;
                                    const thumbs = rule.media_ids?.map(id => media.find(x => x.id === id)?.media_url).filter(Boolean).slice(0, 3) || [];
                                    return (
                                        <div key={rule.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                            <div onClick={() => setExpandedOverride(expanded ? null : rule.id || null)} className="flex items-center gap-4 cursor-pointer" style={{ padding: 'var(--space-4) var(--space-6)' }}>
                                                <div className="flex" style={{ marginLeft: -4 }}>
                                                    {thumbs.map((url, i) => <img key={i} src={url} style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '1px solid white', marginLeft: i > 0 ? -12 : 0 }} alt="" />)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-semibold">{rule.name}</span>
                                                        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                                                            <Toggle checked={rule.is_active} onChange={() => toggleRule(rule)} />
                                                            <span style={{ fontSize: '10px', fontWeight: 600, color: rule.is_active ? 'var(--success)' : 'var(--muted)', textTransform: 'uppercase' }}>
                                                                {rule.is_active ? 'Active' : 'Off'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-muted">{rule.keywords?.length ? `Keywords: ${rule.keywords.join(', ')}` : 'All comments'}</p>
                                                </div>
                                                <svg width="16" height="16" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                            {expanded && (
                                                <div style={{ padding: 'var(--space-4) var(--space-6)', background: 'var(--card-hover)', borderTop: '1px solid var(--border-light)' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }} className="mb-4">
                                                        <div><span className="text-xs text-muted font-semibold uppercase">Reply</span><p className="mt-1">{rule.comment_reply}</p></div>
                                                        {rule.send_dm && <div><span className="text-xs text-muted font-semibold uppercase">DM</span><p className="mt-1">{rule.dm_reply}</p></div>}
                                                    </div>
                                                    <Button variant="danger" size="sm" onClick={() => deleteRule(rule.id!)}>Delete Rule</Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
                                        <div style={{ flex: 1, padding: '10px', background: 'var(--card-hover)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 600 }}>@user_example</p>
                                            <p className="mt-1">
                                                {defaultRule.keywords.length > 0 ? <>How much is the <span style={{ background: 'var(--primary-light)', padding: '0 2px' }}>{defaultRule.keywords[0]}</span>?</> : 'Clean shot!'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Your Reply</span>
                                    <div className="flex items-start gap-3 mt-2">
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--primary)' }} />
                                        <div style={{ flex: 1, padding: '10px', background: 'var(--primary-light)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)' }}>@your_account</p>
                                            <p className="mt-1">{defaultRule.comment_reply || '...'}</p>
                                        </div>
                                    </div>
                                </div>
                                {defaultRule.send_dm && (
                                    <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--card-hover)', border: '1px solid var(--primary-light)' }}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)' }}>Private DM</span>
                                        </div>
                                        <p>{defaultRule.dm_reply || '...'}</p>
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
