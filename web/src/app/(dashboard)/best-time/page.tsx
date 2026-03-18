'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import { Clock, Zap, Calendar, HelpCircle, Info } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';

// ==================== TOOLTIP COMPONENT ====================

function InfoTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
            <HelpCircle
                size={14}
                style={{ color: 'var(--muted)', cursor: 'help', opacity: 0.7 }}
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            />
            {show && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1e293b',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    width: 200,
                    zIndex: 100,
                    marginBottom: 6,
                    lineHeight: 1.5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                    {text}
                </div>
            )}
        </div>
    );
}

// ==================== SECTION CARD ====================

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>
                    {subtitle && <p className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

// ==================== HOUR HEATMAP ====================

function HourlyHeatmap({ data }: { data: any[] }) {
    if (!data || data.length === 0) return null;

    // Find max engagement for color scaling
    const maxEngagement = Math.max(...data.map(d => d.avgEngagement || 0));

    // Split into two rows: AM and PM
    const amHours = data.filter(d => d.hour < 12);
    const pmHours = data.filter(d => d.hour >= 12);

    const getOpacity = (engagement: number) => {
        if (maxEngagement === 0) return 0.1;
        return 0.15 + (engagement / maxEngagement) * 0.85;
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'flex-end' }}>
                <div style={{ width: 40, fontSize: 11, color: 'var(--muted)' }}>AM</div>
                {amHours.map((hour) => (
                    <div key={hour.hour} style={{ flex: 1, textAlign: 'center' }}>
                        <div
                            style={{
                                height: 40,
                                borderRadius: 4,
                                background: `rgba(99, 102, 241, ${getOpacity(hour.avgEngagement)})`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 500,
                                color: hour.avgEngagement > maxEngagement * 0.5 ? 'white' : 'var(--foreground)'
                            }}
                            title={`${hour.hour}:00 - ${hour.avgEngagement} avg engagement`}
                        >
                            {hour.avgEngagement || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                            {hour.hour === 0 ? '12' : hour.hour}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                <div style={{ width: 40, fontSize: 11, color: 'var(--muted)' }}>PM</div>
                {pmHours.map((hour) => (
                    <div key={hour.hour} style={{ flex: 1, textAlign: 'center' }}>
                        <div
                            style={{
                                height: 40,
                                borderRadius: 4,
                                background: `rgba(99, 102, 241, ${getOpacity(hour.avgEngagement)})`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 500,
                                color: hour.avgEngagement > maxEngagement * 0.5 ? 'white' : 'var(--foreground)'
                            }}
                            title={`${hour.hour}:00 - ${hour.avgEngagement} avg engagement`}
                        >
                            {hour.avgEngagement || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                            {hour.hour === 12 ? '12' : hour.hour - 12}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <span className="text-muted" style={{ fontSize: 11 }}>Low engagement</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    {[0.15, 0.35, 0.55, 0.75, 1].map((opacity, i) => (
                        <div key={i} style={{ width: 20, height: 12, background: `rgba(99, 102, 241, ${opacity})`, borderRadius: 2 }} />
                    ))}
                </div>
                <span className="text-muted" style={{ fontSize: 11 }}>High engagement</span>
            </div>
        </div>
    );
}

// ==================== MAIN PAGE ====================

export default function BestTimePage() {
    const { data, isLoading } = useQuery({
        queryKey: ['best-time'],
        queryFn: async () => {
            const res = await instagramApi.getBestTime();
            return res.data.data;
        }
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Analyzing your posting patterns...</p>
                </div>
            </div>
        );
    }

    const hourlyAnalysis = data?.hourlyAnalysis || [];
    const dailyAnalysis = data?.dailyAnalysis || [];
    const recommendations = data?.recommendations || {};

    // Find peak and low hours
    const sortedHours = [...hourlyAnalysis].sort((a, b) => (b.avgEngagement || 0) - (a.avgEngagement || 0));
    const peakHours = sortedHours.slice(0, 3);
    const lowHours = sortedHours.slice(-3).reverse();

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 24 }}>
                <h1 className="page-title">Best Time to Post</h1>
                <p className="page-subtitle">Optimize your posting schedule for maximum engagement</p>
            </div>

            {/* Recommendations */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={24} style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 600, fontSize: 14 }}>Best Hours</h3>
                            <p className="text-muted" style={{ fontSize: 12 }}>Peak engagement times</p>
                        </div>
                        <InfoTooltip text="These hours consistently show the highest engagement based on your posting history." />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {recommendations.bestHours?.map((hour: number) => (
                            <span key={hour} style={{
                                padding: '8px 16px',
                                borderRadius: 20,
                                background: 'var(--primary)',
                                color: 'white',
                                fontWeight: 500,
                                fontSize: 13
                            }}>
                                {hour.toString().padStart(2, '0')}:00
                            </span>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(14, 165, 233, 0.05) 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Calendar size={24} style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 600, fontSize: 14 }}>Best Days</h3>
                            <p className="text-muted" style={{ fontSize: 12 }}>Top performing days</p>
                        </div>
                        <InfoTooltip text="Days of the week when your posts typically receive the most engagement." />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {recommendations.bestDays?.map((day: string) => (
                            <span key={day} style={{
                                padding: '8px 16px',
                                borderRadius: 20,
                                background: '#0ea5e9',
                                color: 'white',
                                fontWeight: 500,
                                fontSize: 13
                            }}>
                                {day}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={24} style={{ color: 'white' }} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 600, fontSize: 14 }}>Optimal Times</h3>
                            <p className="text-muted" style={{ fontSize: 12 }}>Recommended posting</p>
                        </div>
                        <InfoTooltip text="Specific times ranked by average engagement. Try to schedule your posts around these times." />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recommendations.optimalPostingTimes?.map((time: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 500 }}>{time.formatted}</span>
                                <span className="text-muted" style={{ fontSize: 12 }}>{time.engagement} avg eng</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hourly Heatmap */}
            <SectionCard
                title="Hourly Engagement Heatmap"
                subtitle="Visual breakdown of engagement by hour of day"
            >
                <HourlyHeatmap data={hourlyAnalysis} />
            </SectionCard>

            {/* Peak vs Low Hours Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <SectionCard title="Peak Hours" subtitle="Times with highest engagement">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {peakHours.map((hour, i) => (
                            <div key={hour.hour} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: 'var(--background)',
                                borderRadius: 8
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: '50%',
                                        background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: 'white'
                                    }}>
                                        {i + 1}
                                    </div>
                                    <span style={{ fontWeight: 500 }}>
                                        {hour.hour.toString().padStart(2, '0')}:00
                                    </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600, color: '#10b981' }}>{hour.avgEngagement}</div>
                                    <div className="text-muted" style={{ fontSize: 11 }}>{hour.postCount} posts</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Avoid These Hours" subtitle="Times with lowest engagement">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {lowHours.map((hour, i) => (
                            <div key={hour.hour} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: 'var(--background)',
                                borderRadius: 8
                            }}>
                                <span style={{ fontWeight: 500 }}>
                                    {hour.hour.toString().padStart(2, '0')}:00
                                </span>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600, color: '#ef4444' }}>{hour.avgEngagement}</div>
                                    <div className="text-muted" style={{ fontSize: 11 }}>{hour.postCount} posts</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            {/* Hourly Bar Chart */}
            <SectionCard title="Engagement by Hour" subtitle="Detailed view of hourly engagement patterns">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={hourlyAnalysis}>
                        <XAxis
                            dataKey="hour"
                            stroke="#9ca3af"
                            fontSize={11}
                            tickLine={false}
                            tickFormatter={(val) => `${val}:00`}
                        />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                            labelFormatter={(val) => `${val}:00`}
                        />
                        <Bar
                            dataKey="avgEngagement"
                            fill="#6366f1"
                            radius={[4, 4, 0, 0]}
                            name="Avg Engagement"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Daily Radar Chart */}
            <SectionCard title="Engagement by Day of Week" subtitle="Weekly engagement pattern visualization">
                <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={dailyAnalysis}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                        <Radar
                            name="Engagement"
                            dataKey="avgEngagement"
                            stroke="#6366f1"
                            fill="#6366f1"
                            fillOpacity={0.3}
                        />
                        <Tooltip contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    </RadarChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Analysis Info */}
            <div className="card" style={{ textAlign: 'center', padding: '16px 24px', background: 'var(--background)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Info size={16} style={{ color: 'var(--muted)' }} />
                    <p className="text-muted" style={{ margin: 0 }}>
                        Analysis based on <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{data?.postsAnalyzed || 0}</span> posts
                    </p>
                </div>
            </div>
        </div>
    );
}
