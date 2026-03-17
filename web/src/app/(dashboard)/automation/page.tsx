'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import {
    Card, CardHeader, CardTitle, CardBody,
    Button, Toggle, Checkbox, Chip, Badge,
    EmptyState, PageHeader, LoadingPage, Toast, Spinner
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
                fetch(`${API_BASE}/api/instagram/posts?limit=100`, { credentials: 'include' })
            ]);
            if (rulesRes.ok) {
                const data = await rulesRes.json();
                const allRules: AutomationRule[] = data.rules || [];
                setRules(allRules);
                const def = allRules.find(r => !r.media_id && (!r.media_ids || r.media_ids.length === 0));
                if (def) { setDefaultRule(def); if (def.keywords?.length > 0) setShowKeywords(true); }
            }
            if (mediaRes.ok) {
                const data = await mediaRes.json();
                setMedia((data.data?.all || []).map((p: any) => ({ id: p.id, media_url: p.thumbnail, caption: p.caption || '' })));
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

    const specificRules = rules.filter(r => r.media_id || (r.media_ids && r.media_ids.length > 0));
    const notify = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3000); };

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
            const res = await fetch(`${API_BASE}/api/automation/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(newRule) });
            if (res.ok) { notify('success', 'Override created!'); setShowCreateOverride(false); setNewRule({ name: '', keywords: [], comment_reply: '', dm_reply: '', send_dm: true, is_active: true, media_id: null, media_ids: [] }); fetchData(); }
            else notify('error', 'Failed to create');
        } catch { notify('error', 'Network error'); } finally { setSaving(false); }
    };

    const deleteRule = async (id: string) => {
        if (!confirm('Delete this override?')) return;
        try { await fetch(`${API_BASE}/api/automation/rules/${id}`, { method: 'DELETE', credentials: 'include' }); fetchData(); } catch { }
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
        { label: 'Total Replies', value: stats.totalRepliesSent, color: 'var(--primary)', icon: '⚡' },
        { label: 'Comments', value: stats.commentReplies, color: '#38bdf8', icon: '💬' },
        { label: 'DMs Sent', value: stats.messagingReplies, color: '#22c55e', icon: '📩' },
        { label: 'Active Rules', value: stats.activeRules, color: '#fbbf24', icon: '🎯' },
        { label: 'Errors', value: stats.errors, color: '#ef4444', icon: '⚠️' }
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

                {/* ── Automation Stats Bar ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-4)',
                    marginBottom: 'var(--space-8)'
                }}>
                    {statsRow.map((stat, i) => (
                        <Card key={i} style={{ border: 'none', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
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
                                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-gray-900)', lineHeight: 1 }}>{stat.value}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>



                {/* Two Column Layout */}
                <div className="layout-split">
                    {/* LEFT COLUMN */}
                    <div className="layout-split-main flex flex-col gap-6">

                        {/* Default Auto-Reply */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: defaultRule.is_active ? 'var(--success)' : 'var(--color-gray-300)', boxShadow: defaultRule.is_active ? '0 0 8px var(--success)' : 'none' }} />
                                    <CardTitle subtitle="Applies to all your posts">Default Auto-Reply</CardTitle>
                                </div>
                                <Toggle checked={defaultRule.is_active} onChange={(checked) => setDefaultRule({ ...defaultRule, is_active: checked })} />
                            </CardHeader>
                            <CardBody>
                                <div className="mb-5">
                                    <button onClick={() => setShowKeywords(!showKeywords)} className="flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', fontWeight: 500 }}>
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: showKeywords ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Trigger keywords
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
                                    <label className="form-label">Comment reply</label>
                                    <textarea value={defaultRule.comment_reply} onChange={e => setDefaultRule({ ...defaultRule, comment_reply: e.target.value })} placeholder="Thanks for your comment! Check your DMs 📩" className="input" style={{ minHeight: 100 }} />
                                </div>
                                <div className="mb-6">
                                    <Checkbox checked={defaultRule.send_dm} onChange={(checked) => setDefaultRule({ ...defaultRule, send_dm: checked })} label="Also send a private DM" />
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
                                <CardTitle subtitle="Custom replies for specific posts">Post Overrides</CardTitle>
                                <Button variant={showCreateOverride ? 'ghost' : 'secondary'} size="sm" onClick={() => setShowCreateOverride(!showCreateOverride)}>
                                    {showCreateOverride ? (<><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Cancel</>) : (<><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Add override</>)}
                                </Button>
                            </CardHeader>
                            {showCreateOverride && (
                                <div style={{ padding: 'var(--space-6)', background: 'var(--color-gray-50)', borderBottom: '1px solid var(--border-light)' }}>
                                    <div className="mb-5">
                                        <label className="form-label">Rule name</label>
                                        <input type="text" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="e.g. Summer Sale Post" className="input" />
                                    </div>
                                    <div className="mb-5">
                                        <label className="form-label">Select posts {(newRule.media_ids?.length || 0) > 0 && <span className="text-primary">({newRule.media_ids?.length} selected)</span>}</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 'var(--space-2)', maxHeight: 160, overflowY: 'auto', padding: 'var(--space-3)', background: 'white', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)' }}>
                                            {media.length === 0 ? <p className="text-muted text-center" style={{ gridColumn: '1/-1', padding: 'var(--space-6)' }}>No posts available</p> : media.map(m => {
                                                const selected = newRule.media_ids?.includes(m.id);
                                                return (
                                                    <div key={m.id} onClick={() => togglePost(m.id)} style={{ aspectRatio: '1', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', position: 'relative', border: selected ? '2px solid var(--primary)' : '2px solid transparent', transition: 'border 0.2s' }}>
                                                        <img src={m.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                                        {selected && <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 20, height: 20, borderRadius: 'var(--radius-full)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }} className="mb-5">
                                        <div><label className="form-label">Comment reply</label><textarea value={newRule.comment_reply} onChange={e => setNewRule({ ...newRule, comment_reply: e.target.value })} placeholder="Your reply..." className="input" style={{ minHeight: 80 }} /></div>
                                        <div><label className="form-label">Private DM</label><textarea value={newRule.dm_reply} onChange={e => setNewRule({ ...newRule, dm_reply: e.target.value })} placeholder="DM message..." className="input" style={{ minHeight: 80 }} /></div>
                                    </div>
                                    <Button variant="primary" block onClick={createOverride} isLoading={saving}>Create override</Button>
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
                                            <div onClick={() => setExpandedOverride(expanded ? null : rule.id || null)} className="flex items-center gap-4 cursor-pointer transition" style={{ padding: 'var(--space-4) var(--space-6)' }} onMouseOver={e => e.currentTarget.style.background = 'var(--card-hover)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                <div className="flex" style={{ marginLeft: -4 }}>
                                                    {thumbs.map((url, i) => <img key={i} src={url} style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '2px solid white', marginLeft: i > 0 ? -12 : 0 }} alt="" />)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold">{rule.name}</span>
                                                        <Badge variant={rule.is_active ? 'success' : 'info'}>{rule.is_active ? 'Active' : 'Off'}</Badge>
                                                    </div>
                                                    <p className="text-sm text-muted" style={{ marginTop: 2 }}>{rule.keywords?.length ? `Keywords: ${rule.keywords.join(', ')}` : 'All comments'}</p>
                                                </div>
                                                <svg width="16" height="16" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                            {expanded && (
                                                <div style={{ padding: 'var(--space-4) var(--space-6)', background: 'var(--color-gray-50)', borderTop: '1px solid var(--border-light)' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }} className="mb-4">
                                                        <div><span className="text-sm text-muted font-semibold" style={{ textTransform: 'uppercase', fontSize: 'var(--text-xs)' }}>Comment Reply</span><p style={{ marginTop: 'var(--space-2)' }}>{rule.comment_reply}</p></div>
                                                        {rule.send_dm && <div><span className="text-sm text-muted font-semibold" style={{ textTransform: 'uppercase', fontSize: 'var(--text-xs)' }}>Private DM</span><p style={{ marginTop: 'var(--space-2)' }}>{rule.dm_reply}</p></div>}
                                                    </div>
                                                    <Button variant="danger" size="sm" onClick={() => deleteRule(rule.id!)}>
                                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        Delete
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN - Live Preview */}
                    <div className="layout-split-aside">
                        <Card>
                            <CardHeader style={{ background: 'linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-primary-100) 100%)' }}>
                                <div className="flex items-center gap-2">
                                    <svg width="16" height="16" fill="none" stroke="var(--primary)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    <CardTitle subtitle="How your auto-reply will appear"><span style={{ color: 'var(--color-primary-700)' }}>Live Preview</span></CardTitle>
                                </div>
                            </CardHeader>
                            <CardBody>
                                <div className="mb-4">
                                    <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 600 }}>Incoming Comment</span>
                                    <div className="flex items-start gap-3 mt-3">
                                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', flexShrink: 0, background: 'linear-gradient(135deg, #f472b6 0%, #fb923c 100%)' }} />
                                        <div style={{ flex: 1, padding: 'var(--space-3) var(--space-4)', background: 'var(--color-gray-100)', borderRadius: '16px 16px 16px 4px' }}>
                                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-gray-600)' }}>@user_example</p>
                                            <p style={{ marginTop: 'var(--space-1)' }}>
                                                {defaultRule.keywords.length > 0 ? <>Hey, what&apos;s the <span style={{ background: 'var(--warning-light)', padding: '1px 4px', borderRadius: 4 }}>{defaultRule.keywords[0]}</span>?</> : 'Hey, interested in this!'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                    <svg width="14" height="14" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                </div>
                                <div className="mb-4">
                                    <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 600 }}>Your Reply</span>
                                    <div className="flex items-start gap-3 mt-3">
                                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', flexShrink: 0, background: 'linear-gradient(135deg, var(--primary) 0%, var(--color-primary-600) 100%)' }} />
                                        <div style={{ flex: 1, padding: 'var(--space-3) var(--space-4)', background: 'var(--color-primary-100)', borderRadius: '16px 16px 16px 4px', border: '1px solid var(--color-primary-200)' }}>
                                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--primary)' }}>@your_account</p>
                                            <p style={{ marginTop: 'var(--space-1)' }}>{defaultRule.comment_reply || <span className="text-muted" style={{ fontStyle: 'italic' }}>Enter a reply above...</span>}</p>
                                        </div>
                                    </div>
                                </div>
                                {defaultRule.send_dm && (
                                    <>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                            <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 600 }}>+ Private DM</span>
                                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                        </div>
                                        <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #faf5ff 0%, #fdf4ff 100%)', border: '1px solid var(--color-primary-200)' }}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg width="14" height="14" fill="none" stroke="#9333ea" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#9333ea' }}>Direct Message</span>
                                            </div>
                                            <p>{defaultRule.dm_reply || <span className="text-muted" style={{ fontStyle: 'italic' }}>Enter a DM message...</span>}</p>
                                        </div>
                                    </>
                                )}
                                <div className="flex items-center gap-2 mt-5" style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: defaultRule.is_active ? 'var(--success-light)' : 'var(--color-gray-100)' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: defaultRule.is_active ? 'var(--success)' : 'var(--muted)', boxShadow: defaultRule.is_active ? '0 0 6px var(--success)' : 'none' }} />
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: defaultRule.is_active ? 'var(--success-dark)' : 'var(--muted)' }}>
                                        {defaultRule.is_active ? 'Auto-reply is active' : 'Auto-reply is off'}
                                    </span>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
