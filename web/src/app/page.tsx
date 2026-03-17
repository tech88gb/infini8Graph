import Link from 'next/link';
import { BarChart3, TrendingUp, Shield, ArrowRight, MessageCircle, Activity, Users, Globe2 } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#000212] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden">
            {/* Minimalist Top Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#000212]/80 backdrop-blur-xl border-b border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                            <span className="text-black font-bold text-lg">∞</span>
                        </div>
                        <span className="text-xl font-semibold tracking-tight text-white hidden sm:block">infini8Graph</span>
                    </div>
                    
                    <div className="flex items-center gap-8 text-[15px] font-medium text-gray-400">
                        <a href="#features" className="hover:text-white transition-colors duration-200 hidden md:block">Features</a>
                        <Link href="/privacy" className="hover:text-white transition-colors duration-200 hidden md:block">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors duration-200 hidden md:block">Terms</Link>
                        <div className="hidden md:block w-px h-5 bg-white/10 m-1"></div>
                        <Link href="/login" className="hover:text-white transition-colors duration-200">Log in</Link>
                        <Link href="/login" className="px-5 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="relative pt-48 pb-32 px-6 flex flex-col items-center text-center min-h-screen justify-center">
                    {/* Linear-style center glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[600px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-medium mb-8 backdrop-blur-md">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="text-gray-300">Instagram Graph API Integration</span>
                        </div>
                        
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter leading-[1.05] text-white">
                            The intelligence layer <br className="hidden md:block" />
                            <span className="text-gray-400">for modern creators.</span>
                        </h1>
                        
                        <p className="text-lg md:text-xl text-gray-400 max-w-2xl font-normal leading-relaxed mb-10">
                            Transform your Instagram presence with precision analytics, demographic insights, and automated community management—built for scale.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4">
                            <Link href="/login" className="w-full sm:w-auto px-6 py-3 rounded-full bg-white text-black font-medium text-base hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                Connect Instagram <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>

                    {/* Dashboard Abstract Preview (Linear style borders) */}
                    <div className="relative w-full max-w-5xl mt-24">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#000212] via-transparent to-transparent z-20 h-full"></div>
                        <div className="relative rounded-2xl border border-white/[0.08] bg-[#0A0A0C] shadow-2xl p-2 mx-auto overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-10 border-b border-white/[0.04] bg-white/[0.02] flex items-center px-4 justify-between">
                                <div className="flex gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                                </div>
                                <div className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">infini8Graph Dashboard</div>
                            </div>
                            
                            <div className="mt-10 p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 opacity-90">
                                {/* Main Analytics Chart Area */}
                                <div className="col-span-1 md:col-span-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-6 relative overflow-hidden flex flex-col justify-between h-[280px]">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-gray-400 text-sm font-medium flex items-center gap-2"><Activity size={14} className="text-indigo-400" /> Account Reach</h3>
                                            <div className="text-3xl font-bold text-white mt-1">1,248,392</div>
                                            <div className="text-green-400 text-xs mt-1 font-medium">+14.2% vs last week</div>
                                        </div>
                                        <div className="px-3 py-1 rounded bg-white/[0.03] border border-white/[0.05] text-xs text-gray-400">Last 7 Days</div>
                                    </div>
                                    
                                    {/* Mock Bar Chart */}
                                    <div className="flex items-end justify-between gap-2 h-32 mt-4">
                                        {[40, 65, 45, 80, 55, 90, 75].map((height, i) => (
                                            <div key={i} className="w-full relative group" style={{ height: '100%' }}>
                                                <div 
                                                    className="absolute bottom-0 w-full rounded-t-sm bg-indigo-500/20 group-hover:bg-indigo-500/40 transition-colors" 
                                                    style={{ height: `${height}%` }}
                                                >
                                                    <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400 rounded-t-sm opacity-50"></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sidebar Stats */}
                                <div className="col-span-1 flex flex-col gap-4 md:gap-6">
                                    {/* Audience Demo */}
                                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6 h-[130px] flex flex-col justify-center">
                                        <h3 className="text-gray-400 text-sm font-medium flex items-center gap-2 mb-3"><Users size={14} className="text-purple-400" /> Top Audience</h3>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <div className="text-2xl font-bold text-white">25-34</div>
                                                <div className="text-xs text-gray-500 mt-1">Men (62%)</div>
                                            </div>
                                            <div className="w-12 h-12 rounded-full border-[4px] border-white/[0.04] border-t-purple-500 flex items-center justify-center -rotate-45"></div>
                                        </div>
                                    </div>

                                    {/* Top Location */}
                                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6 h-[130px] flex flex-col justify-center">
                                        <h3 className="text-gray-400 text-sm font-medium flex items-center gap-2 mb-3"><Globe2 size={14} className="text-pink-400" /> Top Location</h3>
                                        <div>
                                            <div className="text-xl font-bold text-white tracking-tight">New York</div>
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="text-xs text-gray-500">United States</div>
                                                <div className="text-xs font-medium text-white">18.4%</div>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/[0.05] rounded-full mt-2 overflow-hidden">
                                                <div className="w-[18.4%] h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"></div>
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
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight text-white">Engineered for clarity.</h2>
                            <p className="text-lg text-gray-400 font-normal leading-relaxed">Purpose-built tools designed to give you exact data and save you hours of manual work every week.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                            {/* Feature 1 */}
                            <div className="p-8 rounded-2xl bg-[#08080A] border border-white/[0.04] hover:border-white/[0.08] transition-colors relative overflow-hidden group">
                                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-6">
                                    <BarChart3 className="text-gray-300" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold mb-3 text-white">Deep Analytics</h3>
                                <p className="text-gray-400 leading-relaxed font-normal text-sm">Get exact metrics on reach, impressions, and engagement rates for every post and reel without the clutter.</p>
                            </div>

                            {/* Feature 2 */}
                            <div className="p-8 rounded-2xl bg-[#08080A] border border-white/[0.04] hover:border-white/[0.08] transition-colors relative overflow-hidden group">
                                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-6">
                                    <TrendingUp className="text-gray-300" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold mb-3 text-white">Audience Intelligence</h3>
                                <p className="text-gray-400 leading-relaxed font-normal text-sm">Know your followers inside out. Vivid demographic breakdowns by top cities, countries, age, and gender.</p>
                            </div>

                            {/* Feature 3 */}
                            <div className="p-8 rounded-2xl bg-[#08080A] border border-white/[0.04] hover:border-white/[0.08] transition-colors relative overflow-hidden group">
                                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-6">
                                    <MessageCircle className="text-gray-300" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold mb-3 text-white">Smart Auto-Reply</h3>
                                <p className="text-gray-400 leading-relaxed font-normal text-sm">Automatically respond to comments and trigger DMs instantly. Keep your community active around the clock.</p>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* CTA Section */}
                <section className="py-32 px-6 relative border-t border-white/[0.04] overflow-hidden flex flex-col items-center text-center">
                     <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/[0.05] to-transparent pointer-events-none"></div>
                     <div className="max-w-2xl mx-auto relative z-10">
                         <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-white">Ready to scale your impact?</h2>
                         <p className="text-lg text-gray-400 mb-10 font-normal leading-relaxed">Join the creators utilizing data-driven insights to dominate their niche today.</p>
                         <Link href="/login" className="inline-flex justify-center px-6 py-3 rounded-full bg-white text-black font-medium text-base hover:bg-gray-100 transition-colors items-center gap-2">
                             Get Started Now <ArrowRight size={18} />
                         </Link>
                     </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="pt-20 pb-12 px-6 border-t border-white/[0.04] bg-[#000212]">
                <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 md:gap-8 mb-20 text-[15px]">
                    {/* Brand col */}
                    <div className="col-span-1 sm:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                                <span className="text-black font-bold text-lg">∞</span>
                            </div>
                            <span className="font-semibold text-white tracking-tight text-xl">infini8Graph</span>
                        </div>
                        <p className="text-gray-400 max-w-sm leading-relaxed">
                            The definitive platform for Instagram growth, analytics, and community automation. Built for creators who mean business.
                        </p>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-white font-semibold mb-6">Product</h4>
                        <ul className="space-y-4">
                            <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                            <li><Link href="/login" className="text-gray-400 hover:text-white transition-colors">Log In</Link></li>
                        </ul>
                    </div>
                    
                    {/* Legal */}
                    <div>
                        <h4 className="text-white font-semibold mb-6">Legal</h4>
                        <ul className="space-y-4">
                            <li><Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms of Service</Link></li>
                            <li><a href="mailto:britojaison123@gmail.com" className="text-gray-400 hover:text-white transition-colors">Contact Support</a></li>
                        </ul>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto border-t border-white/[0.04] pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
                    <p>&copy; {new Date().getFullYear()} infini8Graph. All rights reserved.</p>
                    <p className="flex items-center gap-2 justify-center"><Shield size={14} className="text-gray-500"/> Not affiliated with Meta Platforms, Inc.</p>
                </div>
            </footer>
        </div>
    );
}
