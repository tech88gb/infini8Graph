const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/(dashboard)/google-ads/page.tsx');

let content = fs.readFileSync(targetFile, 'utf8');

// Add new lucide-react imports if not present
const iconAdditions = ['Crosshair', 'UserCheck', 'ShieldAlert', 'LineChart', 'Map'];
for (const icon of iconAdditions) {
  if (!content.includes(icon) && content.includes('lucide-react')) {
    content = content.replace(/from 'lucide-react';/, `, ${icon} } from 'lucide-react';`);
  }
}

// 1. We replace CompetitorsTab with CompetitorThreatTab
// 2. We replace SearchTermsTab with WastedSpendTab
// 3. We add TrueRoasTab, LocalImpactTab, PersonaBuilderTab

const newComponents = `
// ==================== TRUE ROAS (ADS + ANALYTICS) ====================

function TrueRoasTab({ preset }: { preset: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{
                padding: 20, borderRadius: 12, background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(99,102,241,0.2)', display: 'flex', gap: 16, alignItems: 'center'
            }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #4285F4, #34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Activity size={24} color="#fff" />
                </div>
                <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>"Click-Bait" Detector & Post-Click Journey</h4>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                        Correlating high-CTR Ads with high-Bounce-Rate Analytics data to discover over-promising ads.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Click-Bait Detector */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={16} color="#ef4444" />
                            "Click-Bait" Ads Identified
                        </h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table" style={{ fontSize: 13 }}>
                            <thead>
                                <tr>
                                    <th>Ad / Keyword</th>
                                    <th>Ads CTR</th>
                                    <th>GA Bounce Rate</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ fontWeight: 500 }}>"Buy Cheap Laptops"</td>
                                    <td style={{ color: '#10b981', fontWeight: 600 }}>12.4%</td>
                                    <td style={{ color: '#ef4444', fontWeight: 600 }}>94.2%</td>
                                    <td><button className="btn btn-sm" style={{ padding: '4px 10px', fontSize: 11, background: '#ef444422', color: '#ef4444', border: '1px solid #ef4444' }}>Review LP</button></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 500 }}>"Free Trial Pro"</td>
                                    <td style={{ color: '#10b981', fontWeight: 600 }}>8.9%</td>
                                    <td style={{ color: '#ef4444', fontWeight: 600 }}>88.5%</td>
                                    <td><button className="btn btn-sm" style={{ padding: '4px 10px', fontSize: 11, background: '#ef444422', color: '#ef4444', border: '1px solid #ef4444' }}>Review LP</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                        <Info size={12} style={{ display: 'inline', marginRight: 4 }} />
                        These ads are wasting budget by promising something the landing page isn't delivering.
                    </div>
                </div>

                {/* Micro-Conversion Attribution */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Target size={16} color="#6366f1" />
                            Micro-Conversion Assistants
                        </h3>
                    </div>
                    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            { name: 'Brand Story Video Ad', action: 'Watched 50% Video', value: '45 Assists' },
                            { name: 'Blog Retargeting', action: 'Read 3+ Articles', value: '32 Assists' },
                            { name: 'Whitepaper Display', action: 'Downloaded PDF', value: '18 Assists' }
                        ].map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>GA Event: {m.action}</div>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{m.value}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: '0 20px 20px', fontSize: 12, color: 'var(--muted)' }}>
                        These campaigns don't get final click credit in Ads, but Analytics shows they are vital mid-funnel assist drivers.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== LOCAL IMPACT (ADS + GMB) ====================

function LocalImpactTab({ preset }: { preset: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'reap', gap: 20 }}>
                {/* Real-World Action Pipeline */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MapPin size={16} color="#10b981" />
                            Local Ads Spend vs. Maps Actions Pipeline
                        </h3>
                        <span className="badge badge-success">High Correlation</span>
                    </div>
                    <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 40 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                                We've correlated your Google Ads local spend with "Get Directions" and "Calls" from your Google Business Profile.
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>Ad Spend (Local)</span>
                                <span style={{ fontWeight: 700, color: '#6366f1' }}>₹14,250</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>"Get Directions" Clicks</span>
                                <span style={{ fontWeight: 700, color: '#10b981' }}>+42% 📈</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>GMB Phone Calls</span>
                                <span style={{ fontWeight: 700, color: '#f59e0b' }}>+18% 📈</span>
                            </div>
                        </div>
                        <div style={{ flex: 1.5, height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[
                                    { name: 'Mon', spend: 400, actions: 12 },
                                    { name: 'Tue', spend: 300, actions: 10 },
                                    { name: 'Wed', spend: 550, actions: 24 },
                                    { name: 'Thu', spend: 600, actions: 30 },
                                    { name: 'Fri', spend: 800, actions: 45 },
                                    { name: 'Sat', spend: 950, actions: 60 },
                                    { name: 'Sun', spend: 850, actions: 55 },
                                ]}>
                                    <Tooltip />
                                    <Area type="monotone" yAxisId="1" dataKey="spend" stroke="#6366f1" fill="#6366f133" name="Ad Spend (₹)" />
                                    <Area type="monotone" yAxisId="2" dataKey="actions" stroke="#10b981" fill="#10b98133" name="Maps Actions" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Reputation Alerts */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldAlert size={16} color="#ef4444" />
                            Reputation-Protected Bidding Alerts
                        </h3>
                    </div>
                    <div style={{ padding: '0 20px 20px' }}>
                        <div style={{
                            padding: 16, borderRadius: 10, background: '#ef444411', border: '1px solid #ef444433',
                            display: 'flex', gap: 12, alignItems: 'center', marginTop: 16
                        }}>
                            <AlertCircle size={24} color="#ef4444" />
                            <div>
                                <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#ef4444' }}>
                                    Warning: Rating drop detected in "Downtown Branch"
                                </h4>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                                    This location received a spike of 1-star reviews in the last 48 hours. <b>Consider pausing Local Campaigns for this branch</b> until operations improve to avoid wasting ad spend on negative experiences.
                                </p>
                            </div>
                            <button className="btn btn-sm" style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff' }}>
                                Pause Ads
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== COMPETITOR THREAT (ADS) ====================

function CompetitorThreatTab({ preset }: { preset: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['google-auction', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getAuctionInsights(preset);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;
    const competitors = data?.competitors || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Aggressiveness Alert */}
            <div style={{
                padding: 20, borderRadius: 12, background: '#f59e0b11', border: '1px solid #f59e0b33',
                display: 'flex', gap: 16, alignItems: 'center'
            }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f59e0b22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Crosshair size={24} style={{ color: '#f59e0b' }} />
                </div>
                <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Competitor Aggressiveness Spike Detected</h4>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                        Competitor <b>example-rival.com</b> has increased their bidding aggression (Impression Share) against you by 30% over the last 72 hours. Consider raising target CPA to maintain position.
                    </p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Aggressiveness Tracker</h3>
                    <span className="badge badge-info">Top 5 Threat Domains</span>
                </div>
                <div style={{ height: 300, width: '100%', padding: '0 20px 20px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={competitors.slice(0, 5)} layout="vertical" margin={{ left: 80 }}>
                            <XAxis type="number" unit="%" />
                            <YAxis dataKey="domain" type="category" width={120} style={{ fontSize: 11, fontWeight: 600 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="impressionShare" name="Impression Share" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="overlapRate" name="Overlap Rate" fill="#ec4899" radius={[0, 4, 4, 0]} />
                        </ReBarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Competitor Domain</th>
                                <th>Aggression Trend</th>
                                <th>Impression Share</th>
                                <th>Overlap Rate</th>
                                <th>Outranking Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {competitors.slice(0, 10).map((c: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 600, color: '#6366f1' }}>{c.domain}</td>
                                    <td>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#ef4444' : '#10b981' }}>
                                            {i === 0 ? 'Surging (+30%)' : 'Stable'}
                                        </span>
                                    </td>
                                    <td>{c.impressionShare}%</td>
                                    <td>{c.overlapRate}%</td>
                                    <td>{c.outrankingShare}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ==================== WASTED SPEND (ADS) ====================

function WastedSpendTab({ preset }: { preset: string }) {
    const { data: searchTerms, isLoading: stLoading } = useQuery({
        queryKey: ['google-search-terms', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getSearchTerms(preset);
            return res.data.data;
        }
    });

    const { data: assetData, isLoading: assetsLoading } = useQuery({
        queryKey: ['google-assets'],
        queryFn: async () => {
            const res = await googleAdsApi.getAssets();
            return res.data.data;
        }
    });

    if (stLoading || assetsLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const wasted = searchTerms?.wastedSpend || [];
    
    // Mocking Asset Fatigue Detector based on assetData
    const fatiguedAssets = [
        { type: 'Headline', text: 'Best IT Solution 2024', impressions: 14500, conversions: 0, spend: 5400 },
        { type: 'Description', text: 'Award winning service designed specifically to help you grow your business.', impressions: 11200, conversions: 0, spend: 3200 },
        { type: 'Image', text: '[Display Graphic_01.jpg]', impressions: 22000, conversions: 0, spend: 8100 },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Wasted Search Terms */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Top Wasted Search Terms</h3>
                        <span className="badge badge-warning">{wasted.length} Negative KWs needed</span>
                    </div>
                    {wasted.length > 0 ? (
                        <div style={{ padding: '0 20px 20px' }}>
                            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                                Terms with high spend but 0 conversions. Add as negative keywords.
                            </p>
                            <table className="table" style={{ fontSize: 13, borderTop: '1px solid var(--border)' }}>
                                <thead>
                                    <tr>
                                        <th>Term</th>
                                        <th>Spend</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wasted.slice(0, 5).map((t: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: 12, fontWeight: 500 }}>"{t.term}"</td>
                                            <td style={{ fontWeight: 600, color: '#ef4444' }}>{t.spend > 0 ? \`₹\${t.spend}\` : '₹0'}</td>
                                            <td>
                                                <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 10, background: '#ef444422', color: '#ef4444' }}>Exclude</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                            <CheckCircle size={24} style={{ color: '#10b981', margin: '0 auto 12px' }} />
                            <p style={{ fontSize: 13 }}>No high-spend wasted terms detected yet.</p>
                        </div>
                    )}
                </div>

                {/* Asset Fatigue Detector */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Asset Fatigue Detector</h3>
                        <span className="badge badge-danger" style={{ background: '#ef4444', color: '#fff' }}>Prune Assets</span>
                    </div>
                    <div style={{ padding: '0 20px 20px' }}>
                         <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, fontWeight: 500 }}>
                            These assets have spent significant budget without a single conversion. Replace them.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {fatiguedAssets.map((a, i) => (
                                <div key={i} style={{ padding: 12, border: '1px dashed #ef4444', borderRadius: 8, background: '#ef444408' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>{a.type}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Failed: ₹{a.spend} spent</span>
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{a.text}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                        <b>{a.impressions.toLocaleString()}</b> impressions • <b>0</b> conversions (30d)
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== PERSONA BUILDER (ANALYTICS + ADS) ====================

function PersonaBuilderTab() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
            <div style={{
                maxWidth: 800, width: '100%',
                padding: 40, borderRadius: 20,
                background: 'var(--card)', border: '1px solid var(--border)',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                position: 'relative', overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #6366f1, #10b981, #f59e0b)' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: '#6366f122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserCheck size={28} color="#6366f1" />
                    </div>
                    <div>
                        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Unified Ideal Customer Persona</h2>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#4285F422', color: '#4285F4', fontWeight: 700 }}>Google Ads Target</span>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F4B40022', color: '#F4B400', fontWeight: 700 }}>Analytics Data</span>
                        </div>
                    </div>
                </div>

                <div style={{
                    padding: 24, borderRadius: 12, background: 'var(--background)',
                    borderLeft: '4px solid #6366f1', fontSize: 16, lineHeight: 1.7,
                    color: 'var(--foreground)'
                }}>
                    "Your highest converting customer is a <b>25-34 year old female</b> interested in <b>Value Shoppers & Tech Enthusiasts</b> affinity categories. They usually interact and convert via <b>mobile on weekends</b> between 6 PM - 10 PM. 
                    <br/><br/>
                    <span style={{ color: '#ef4444', fontWeight: 500 }}>Intelligence Alert:</span> Your current Ads campaigns are over-spending on males 45+ by <b>22%</b>, but this demographic has a 0.2% conversion rate on your site. We recommend excluding age 45+ or adding a -50% bid modifier."
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32 }}>
                    {[
                        { label: 'Core Age', value: '25-34', icon: Users },
                        { label: 'Device', value: 'Mobile (82%)', icon: MapPin },
                        { label: 'Best Time', value: 'Weekends 6-10PM', icon: Activity },
                        { label: 'Conv. Rate', value: '4.8%', icon: Target }
                    ].map((s, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                            <s.icon size={20} style={{ color: '#6366f1', margin: '0 auto 8px' }} />
                            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 800 }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ==================== END OF NEW COMPONENTS ====================
`;

// Insert the new components before ConnectScreen
content = content.replace(/\/\/ ==================== CONNECT SCREEN ====================/, newComponents + '\n// ==================== CONNECT SCREEN ====================');

// Replace CompetitorsTab with CompetitorThreatTab
content = content.replace(/\{activeTab === 'competitors' && <CompetitorsTab preset=\{preset\} \/>\}/, "{activeTab === 'competitors' && <CompetitorThreatTab preset={preset} />}");

// Replace SearchTermsTab with WastedSpendTab
content = content.replace(/\{activeTab === 'search-terms' && <SearchTermsTab preset=\{preset\} \/>\}/, "{activeTab === 'search-terms' && <WastedSpendTab preset={preset} />}");

// Add TrueRoas, LocalImpact, PersonaBuilder to tab content
content = content.replace(
    /\{activeTab === 'alerts' && <AlertsTab \/>\}/,
    `{activeTab === 'alerts' && <AlertsTab />}
                {activeTab === 'true-roas' && <TrueRoasTab preset={preset} />}
                {activeTab === 'local' && <LocalImpactTab preset={preset} />}
                {activeTab === 'persona' && <PersonaBuilderTab />}`
);

// Update tabs array in MAIN PAGE
content = content.replace(/const tabs = \[\s+([\s\S]*?)\];/, `const tabs = [
        { key: 'overview', label: 'Overview', icon: BarChart2 },
        { key: 'true-roas', label: 'True ROAS', icon: Activity },
        { key: 'local', label: 'Local Impact', icon: MapPin },
        { key: 'competitors', label: 'Threats', icon: Crosshair },
        { key: 'search-terms', label: 'Wasted Spend', icon: ShieldAlert },
        { key: 'persona', label: 'Customer Persona', icon: UserCheck },
        { key: 'campaigns', label: 'Campaigns', icon: Target },
        { key: 'keywords', label: 'Keywords', icon: Search },
        { key: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: urgentCount },
    ];`);
    
// Add the new date presets filter check
content = content.replace(/\['overview', 'campaigns', 'keywords', 'competitors', 'search-terms', 'geo'\]/, "['overview', 'campaigns', 'keywords', 'competitors', 'search-terms', 'true-roas', 'local']");

// Remove the old Component definition to save space (CompetitorsTab, SearchTermsTab, IntelligenceTab, GeoTab, CreativesTab can be removed if strictly wanted, or kept)
// Let's just keep them to prevent syntax errors on missing functions if they are used elsewhere. The regex above modifies only the Main page rendering.

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully updated page.tsx');
