'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BarChart3, TrendingUp, Shield, ArrowRight, MessageCircle, Activity, Users, LayoutDashboard, Settings, Bell, CheckCircle2, MapPin, Heart, Plus, Sparkles, Briefcase, Building2, Eye } from 'lucide-react';

export default function LandingPage() {
    const [hoveredTab, setHoveredTab] = useState('analytics');

    return (
        <div className="min-h-screen bg-[#000212] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden flex flex-col">
            {/* Minimalist Top Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#000212]/80 backdrop-blur-xl border-b border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* More subtle, premium logo treatment */}
                        <div className="w-8 h-8 rounded-[10px] bg-gradient-to-b from-gray-100 to-gray-300 flex items-center justify-center shadow-[0_2px_10px_rgba(255,255,255,0.1)]">
                            <span className="text-black font-bold text-lg leading-none">∞</span>
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-white hidden sm:block">infini8Graph</span>
                    </div>
                    
                    <div className="flex items-center gap-8 text-[14px] font-medium text-[#ffffffa8]">
                        <a href="#features" className="hover:text-white transition-colors duration-200 hidden md:block">Features</a>
                        <Link href="/privacy" className="hover:text-white transition-colors duration-200 hidden md:block">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors duration-200 hidden md:block">Terms</Link>
                        
                        <div className="flex items-center gap-4">
                            <Link href="/login" className="hover:text-white transition-colors duration-200">Log in</Link>
                            <Link href="/login" className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative pt-48 pb-32 px-6 flex flex-col items-center text-center justify-center">
                    {/* Linear-style center glow */}
                    <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-full max-w-4xl h-[600px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
                        <Link href="/login" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-colors text-xs font-medium mb-10 backdrop-blur-md group">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="text-[#ffffffa8] group-hover:text-white transition-colors">Instagram Graph API Integration</span>
                            <ArrowRight size={12} className="text-[#ffffffa8] group-hover:text-white transition-colors ml-1" />
                        </Link>
                        
                        <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold mb-6 tracking-tighter leading-[1.05] text-white">
                            The intelligence layer <br className="hidden md:block" />
                            <span className="text-[#b4bcd0]">for cross-channel growth.</span>
                        </h1>
                        
                        <p className="text-lg md:text-xl text-[#b4bcd0] max-w-2xl font-normal leading-relaxed mb-10">
                            Transform your Instagram presence and Google Ads performance with precision analytics, cross-platform tracking, and automated community management—built for scale.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-3 mb-10 max-w-3xl">
                            {['Built for creators', 'Made for agencies', 'Ready for brand teams'].map((item) => (
                                <div
                                    key={item}
                                    className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-sm text-[#d7dced] backdrop-blur-md"
                                >
                                    {item}
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4">
                            <Link href="/login" className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white text-black font-medium text-[15px] hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                                Connect Instagram Account <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>

                    {/* Dashboard Abstract Preview (Linear style borders) */}
                    <div className="relative w-full max-w-5xl mt-24">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#000212] via-transparent to-transparent z-20 h-full pointer-events-none"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                        
                        <div className="relative rounded-xl border border-white/[0.08] bg-[#0A0A0C]/90 backdrop-blur-2xl shadow-2xl mx-auto overflow-hidden flex flex-col h-[500px]">
                            {/* Browser/Window Header */}
                            <div className="h-10 border-b border-white/[0.04] bg-white/[0.01] flex items-center px-4 justify-between shrink-0">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#333336]"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#333336]"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#333336]"></div>
                                </div>
                                <div className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">infini8Graph Dashboard</div>
                                <div className="w-12"></div> {/* Spacer for balance */}
                            </div>
                            
                            {/* App Content wrapper */}
                            <div className="flex flex-1 overflow-hidden opacity-90">
                                {/* Sidebar */}
                                <div className="w-16 md:w-56 border-r border-white/[0.04] bg-white/[0.01] flex flex-col p-3 shrink-0 relative z-20">
                                    <div className="flex items-center gap-3 px-2 py-2 mb-6">
                                        <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                                            <span className="text-white font-bold text-xs">∞</span>
                                        </div>
                                        <span className="font-semibold text-sm text-white hidden md:block">infini8Graph</span>
                                    </div>
                                    
                                    <div className="space-y-1 flex-1 relative group" onMouseLeave={() => setHoveredTab('analytics')}>
                                        <div 
                                            className={`flex items-center gap-3 px-2 py-2 rounded-md transition-all cursor-pointer ${hoveredTab === 'analytics' ? 'bg-white/[0.05] text-white' : 'text-[#ffffffa8] hover:text-white hover:bg-white/[0.02]'}`}
                                            onMouseEnter={() => setHoveredTab('analytics')}
                                        >
                                            <LayoutDashboard size={16} />
                                            <span className="text-sm font-medium hidden md:block">Analytics</span>
                                        </div>
                                        <div 
                                            className={`flex items-center gap-3 px-2 py-2 rounded-md transition-all cursor-pointer ${hoveredTab === 'audience' ? 'bg-white/[0.05] text-white' : 'text-[#ffffffa8] hover:text-white hover:bg-white/[0.02]'}`}
                                            onMouseEnter={() => setHoveredTab('audience')}
                                        >
                                            <Users size={16} />
                                            <span className="text-sm font-medium hidden md:block">Audience</span>
                                        </div>
                                        <div 
                                            className={`flex items-center gap-3 px-2 py-2 rounded-md transition-all cursor-pointer ${hoveredTab === 'automations' ? 'bg-white/[0.05] text-white' : 'text-[#ffffffa8] hover:text-white hover:bg-white/[0.02]'}`}
                                            onMouseEnter={() => setHoveredTab('automations')}
                                        >
                                            <MessageCircle size={16} />
                                            <span className="text-sm font-medium hidden md:block">Automations</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-auto">
                                        <div className="flex items-center gap-3 px-2 py-2 rounded-md text-[#ffffffa8] hover:bg-white/[0.02] cursor-pointer">
                                            <Settings size={16} />
                                            <span className="text-sm font-medium hidden md:block">Settings</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content Canvas */}
                                <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-hidden relative">
                                    <div className="flex justify-between items-center shrink-0 relative z-10">
                                        <h2 className="text-xl font-semibold text-white tracking-tight">
                                            {hoveredTab === 'analytics' && 'Overview'}
                                            {hoveredTab === 'audience' && 'Audience Intelligence'}
                                            {hoveredTab === 'automations' && 'Active Triggers'}
                                        </h2>
                                        <div className="px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.05] text-xs text-gray-400 font-medium">Last 30 Days</div>
                                    </div>

                                    {/* Data Grid Wrapper (with absolute positioning for crossfade) */}
                                    <div className="relative flex-1 min-h-0 w-full">
                                        
                                        {/* State 1: Analytics (Default) */}
                                        <div className={`absolute inset-0 grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-500 ease-out ${hoveredTab === 'analytics' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                                            {/* Main Chart Area */}
                                            <div className="lg:col-span-2 rounded-xl border border-white/[0.05] bg-[#000212]/50 p-6 relative overflow-hidden flex flex-col">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div>
                                                        <h3 className="text-[#ffffffa8] text-sm font-medium flex items-center gap-2"><Activity size={14} className="text-indigo-400" /> Total Reach</h3>
                                                        <div className="text-4xl font-bold text-white mt-1 tracking-tight">2.4M</div>
                                                        <div className="text-green-400 text-xs mt-2 font-medium bg-green-400/10 inline-block px-2 py-0.5 rounded pl-1"><span className="text-green-400 mr-1">↑</span>18.2% vs previous</div>
                                                    </div>
                                                </div>
                                                
                                                {/* Beautiful SVG Line Chart Mock */}
                                                <div className="flex-1 relative mt-4 w-full h-[180px]">
                                                    <svg viewBox="0 0 400 100" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                                                        <defs>
                                                            <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                                                                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                                                            </linearGradient>
                                                        </defs>
                                                        <path d="M0,80 C40,70 80,90 120,50 C160,10 200,60 240,40 C280,20 320,50 360,20 L400,30 L400,100 L0,100 Z" fill="url(#glow)" />
                                                        <path d="M0,80 C40,70 80,90 120,50 C160,10 200,60 240,40 C280,20 320,50 360,20 L400,30" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        {/* Data point dot */}
                                                        <circle cx="360" cy="20" r="4" fill="#000212" stroke="#6366f1" strokeWidth="2" />
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Right Column Smaller Widgets */}
                                            <div className="lg:col-span-1 flex flex-col gap-6 h-full">
                                                {/* Automation Activity */}
                                                <div className="flex-1 rounded-xl border border-white/[0.05] bg-[#000212]/50 p-5 flex flex-col h-full overflow-hidden">
                                                    <h3 className="text-[#ffffffa8] text-sm font-medium flex items-center gap-2 mb-4"><Bell size={14} className="text-pink-400" /> Recent Activity</h3>
                                                    
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex gap-3 text-sm">
                                                            <div className="mt-0.5"><CheckCircle2 size={14} className="text-green-400" /></div>
                                                            <div>
                                                                <p className="text-white text-xs">Replied to "price?"</p>
                                                                <p className="text-[#ffffffa8] text-[10px] mt-0.5">2 mins ago on Reel #891</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-3 text-sm">
                                                            <div className="mt-0.5"><CheckCircle2 size={14} className="text-green-400" /></div>
                                                            <div>
                                                                <p className="text-white text-xs">Sent DM to @creator23</p>
                                                                <p className="text-[#ffffffa8] text-[10px] mt-0.5">15 mins ago</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-3 text-sm opacity-50">
                                                            <div className="mt-0.5"><CheckCircle2 size={14} className="text-gray-500" /></div>
                                                            <div>
                                                                <p className="text-white text-xs">Replied to "link please"</p>
                                                                <p className="text-[#ffffffa8] text-[10px] mt-0.5">1 hour ago on Post</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* State 2: Audience (Hovered) */}
                                        <div className={`absolute inset-0 grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-500 ease-out ${hoveredTab === 'audience' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                                             {/* Map/Location Mock */}
                                             <div className="rounded-xl border border-white/[0.05] bg-[#000212]/50 p-6 flex flex-col justify-between">
                                                <h3 className="text-[#ffffffa8] text-sm font-medium flex items-center gap-2 mb-6"><MapPin size={14} className="text-pink-400" /> Top Geography</h3>
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1"><span className="text-white">New York, US</span><span className="text-gray-400">18.4%</span></div>
                                                        <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className="w-[18.4%] h-full bg-pink-500 rounded-full"></div></div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1"><span className="text-white">London, UK</span><span className="text-gray-400">12.2%</span></div>
                                                        <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className="w-[12.2%] h-full bg-purple-500 rounded-full"></div></div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1"><span className="text-white">Los Angeles, US</span><span className="text-gray-400">9.8%</span></div>
                                                        <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className="w-[9.8%] h-full bg-indigo-500 rounded-full"></div></div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1"><span className="text-white">Toronto, CA</span><span className="text-gray-400">7.1%</span></div>
                                                        <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className="w-[7.1%] h-full bg-blue-500 rounded-full"></div></div>
                                                    </div>
                                                </div>
                                             </div>
                                             
                                             {/* Demo breakdown mock */}
                                             <div className="rounded-xl border border-white/[0.05] bg-[#000212]/50 p-6 flex flex-col justify-between">
                                                <h3 className="text-[#ffffffa8] text-sm font-medium flex items-center gap-2"><Users size={14} className="text-blue-400" /> Age & Gender</h3>
                                                <div className="flex items-center justify-center flex-1 my-4">
                                                    <div className="relative w-32 h-32">
                                                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                                            {/* Background ring */}
                                                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="15" />
                                                            {/* Data arcs (simulated via stroke-dasharray) */}
                                                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#3b82f6" strokeWidth="15" strokeDasharray="160 251.2" strokeDashoffset="0" />
                                                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#8b5cf6" strokeWidth="15" strokeDasharray="70 251.2" strokeDashoffset="-160" />
                                                        </svg>
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                            <span className="text-xl font-bold text-white">25-34</span>
                                                            <span className="text-[10px] text-gray-500">Primary</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-center gap-4 text-xs">
                                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-gray-400">Men (64%)</span></div>
                                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span className="text-gray-400">Women (36%)</span></div>
                                                </div>
                                             </div>
                                        </div>

                                        {/* State 3: Automations (Hovered) */}
                                        <div className={`absolute inset-0 flex flex-col gap-3 transition-all duration-500 ease-out ${hoveredTab === 'automations' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex space-x-2">
                                                    <div className="px-3 py-1 bg-white/[0.05] rounded text-xs font-medium text-white border border-white/[0.05]">Active (3)</div>
                                                    <div className="px-3 py-1 rounded text-xs font-medium text-gray-500 hover:text-gray-300 cursor-pointer">Drafts (1)</div>
                                                </div>
                                                <div className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs flex items-center gap-1 border border-indigo-500/30 cursor-pointer"><Plus size={12}/> New Trigger</div>
                                            </div>
                                            
                                            {/* Automation Rules rows */}
                                            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-white/[0.03] to-transparent border border-white/[0.05]">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><MessageCircle size={14} className="text-blue-400"/></div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white flex items-center gap-2">"Link in bio" rule <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span></div>
                                                        <div className="text-xs text-gray-500">If user comments "link", reply and send DM.</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-white">1,402</div>
                                                    <div className="text-[10px] text-gray-500">Fired this week</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-white/[0.03] to-transparent border border-white/[0.05]">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center"><Heart size={14} className="text-pink-400"/></div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white flex items-center gap-2">Story Mentions <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span></div>
                                                        <div className="text-xs text-gray-500">If user tags in story, send thank you DM.</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-white">845</div>
                                                    <div className="text-[10px] text-gray-500">Fired this week</div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-white/[0.03] to-transparent border border-white/[0.05]">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center"><MessageCircle size={14} className="text-purple-400"/></div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white flex items-center gap-2">Pricing Inquiry <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span></div>
                                                        <div className="text-xs text-gray-500">If user comments "price", reply with info.</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-white">321</div>
                                                    <div className="text-[10px] text-gray-500">Fired this week</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Sub-grid */}
                <section id="features" className="py-32 px-6 border-t border-white/[0.04] bg-[#000212]">
                    <div className="max-w-6xl mx-auto flex flex-col items-center">
                        <div className="text-center mb-20 max-w-3xl">
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tighter text-white">Engineered for clarity.</h2>
                            <p className="text-lg text-[#b4bcd0] font-normal leading-relaxed">Purpose-built tools designed to give you exact data and save you hours of manual work every week.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                            {/* Feature 1 */}
                            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6 shadow-sm">
                                    <BarChart3 className="text-gray-300" size={20} />
                                </div>
                                <h3 className="text-[17px] font-semibold mb-3 text-white tracking-tight">Deep Analytics</h3>
                                <p className="text-[#b4bcd0] leading-relaxed font-normal text-[15px]">See reach, impressions, saves, shares, and growth in one dashboard for every post and campaign.</p>
                            </div>

                            {/* Feature 2 */}
                            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6 shadow-sm">
                                    <TrendingUp className="text-gray-300" size={20} />
                                </div>
                                <h3 className="text-[17px] font-semibold mb-3 text-white tracking-tight">Audience Intelligence</h3>
                                <p className="text-[#b4bcd0] leading-relaxed font-normal text-[15px]">Know exactly where your audience lives, which age groups respond best, and how your follower mix shifts.</p>
                            </div>

                            {/* Feature 3 */}
                            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6 shadow-sm">
                                    <MessageCircle className="text-gray-300" size={20} />
                                </div>
                                <h3 className="text-[17px] font-semibold mb-3 text-white tracking-tight">Smart Auto-Reply</h3>
                                <p className="text-[#b4bcd0] leading-relaxed font-normal text-[15px]">Automatically reply to common comment triggers, send DMs instantly, and stay responsive at all times.</p>
                            </div>

                            {/* Feature 4 */}
                            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6 shadow-sm">
                                    <Activity className="text-gray-300" size={20} />
                                </div>
                                <h3 className="text-[17px] font-semibold mb-3 text-white tracking-tight">Google Ads Insights</h3>
                                <p className="text-[#b4bcd0] leading-relaxed font-normal text-[15px]">Track campaign ROAS, assess keyword quality scores, audit budget waste, and compare cross-channel spend.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-32 px-6 border-t border-white/[0.04] bg-[#000212]">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-20 max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tighter text-white">How it works.</h2>
                            <p className="text-lg text-[#b4bcd0] font-normal leading-relaxed">A simple flow designed for teams that want better visibility and faster engagement without adding operational overhead.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    number: '01',
                                    title: 'Connect account',
                                    description: 'Link your Instagram Business or creator account through the Instagram Graph API and start syncing performance data securely.',
                                    icon: Sparkles,
                                },
                                {
                                    number: '02',
                                    title: 'See performance',
                                    description: 'Monitor post-level analytics, audience trends, and growth signals in a single workspace built for day-to-day decisions.',
                                    icon: Eye,
                                },
                                {
                                    number: '03',
                                    title: 'Automate engagement',
                                    description: 'Set up reply and DM workflows for recurring interactions so your community gets instant responses at scale.',
                                    icon: MessageCircle,
                                },
                            ].map(({ number, title, description, icon: Icon }) => (
                                <div key={title} className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.04] relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                            <Icon className="text-gray-200" size={20} />
                                        </div>
                                        <span className="text-xs tracking-[0.24em] text-[#7f89a6]">{number}</span>
                                    </div>
                                    <h3 className="text-xl font-semibold mb-3 text-white tracking-tight">{title}</h3>
                                    <p className="text-[#b4bcd0] leading-relaxed text-[15px]">{description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-32 px-6 border-t border-white/[0.04] bg-[#000212]">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-20 max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tighter text-white">Built for the teams behind growth.</h2>
                            <p className="text-lg text-[#b4bcd0] font-normal leading-relaxed">Different operators use Instagram differently. The product should make sense for each of them immediately.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {[
                                {
                                    title: 'For creators',
                                    description: 'Track what content actually moves reach, engagement, and follower growth so you can repeat what works.',
                                    icon: Sparkles,
                                },
                                {
                                    title: 'For agencies',
                                    description: 'Manage multiple client accounts with clearer reporting, faster audience insight, and reusable engagement workflows.',
                                    icon: Briefcase,
                                },
                                {
                                    title: 'For brand teams',
                                    description: 'Give marketers a reliable view of campaign performance, community activity, and audience quality in one place.',
                                    icon: Building2,
                                },
                            ].map(({ title, description, icon: Icon }) => (
                                <div key={title} className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/[0.05]">
                                    <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6">
                                        <Icon className="text-gray-200" size={20} />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-3 text-white tracking-tight">{title}</h3>
                                    <p className="text-[#b4bcd0] leading-relaxed text-[15px]">{description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-32 px-6 relative border-t border-white/[0.04] overflow-hidden flex flex-col items-center text-center">
                     <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/[0.05] to-transparent pointer-events-none"></div>
                     <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[300px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                     <div className="max-w-2xl mx-auto relative z-10">
                         <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tighter text-white">Ready for clearer analytics, faster engagement, and smarter growth?</h2>
                         <p className="text-lg text-[#b4bcd0] mb-10 font-normal leading-relaxed">Connect your Instagram account to turn raw performance data into decisions, automation, and consistent execution.</p>
                         <Link href="/login" className="inline-flex justify-center px-6 py-3.5 rounded-full bg-white text-black font-semibold text-[15px] hover:bg-gray-100 transition-colors items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                             Get Started Now <ArrowRight size={16} />
                         </Link>
                     </div>
                </section>
            </main>

            {/* Premium Footer - Linear Style */}
            <footer className="pt-24 pb-12 px-6 border-t border-white/[0.04] bg-[#000212]">
                <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-12 md:gap-8 mb-20">
                    {/* Brand col */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-3 pr-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-b from-gray-100 to-gray-300 flex items-center justify-center">
                                <span className="text-black font-bold text-lg leading-none">∞</span>
                            </div>
                            <span className="font-semibold text-white tracking-tight text-xl">infini8Graph</span>
                        </div>
                        <p className="text-[#ffffffa8] max-w-sm leading-relaxed text-[15px]">
                            The definitive platform for Instagram growth, analytics, and community automation. Built for creators who mean business.
                        </p>
                    </div>

                    {/* Resources */}
                    <div className="col-span-1">
                        <h4 className="text-white font-medium mb-6 text-[15px] tracking-tight">Product</h4>
                        <ul className="space-y-4 text-[15px]">
                            <li><a href="#features" className="text-[#ffffffa8] hover:text-white transition-colors">Features</a></li>
                            <li><Link href="/login" className="text-[#ffffffa8] hover:text-white transition-colors">Log In</Link></li>
                        </ul>
                    </div>
                    
                    {/* Legal */}
                    <div className="col-span-1">
                        <h4 className="text-white font-medium mb-6 text-[15px] tracking-tight">Legal</h4>
                        <ul className="space-y-4 text-[15px]">
                            <li><Link href="/privacy" className="text-[#ffffffa8] hover:text-white transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="text-[#ffffffa8] hover:text-white transition-colors">Terms of Service</Link></li>
                            <li><a href="mailto:britojaison123@gmail.com" className="text-[#ffffffa8] hover:text-white transition-colors">Contact Support</a></li>
                        </ul>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto border-t border-white/[0.04] pt-8 flex flex-col sm:flex-row justify-between items-center gap-6 text-[14px] text-[#ffffffa8]">
                    <p>&copy; {new Date().getFullYear()} infini8Graph. All rights reserved.</p>
                    <div className="flex items-center gap-2 justify-center bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 rounded-full">
                        <Shield size={14} className="text-[#ffffffa8]"/> 
                        <span>Not affiliated with Meta Platforms, Inc.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
