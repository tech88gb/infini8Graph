import Link from 'next/link';
import { BarChart3, TrendingUp, Shield, ArrowRight, MessageCircle } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#000212] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden">
            {/* Minimalist Top Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#000212]/80 backdrop-blur-xl border-b border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                            <span className="text-black font-bold text-lg">∞</span>
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-white hidden sm:block">infini8Graph</span>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
                        <a href="#features" className="hover:text-white transition-colors duration-200 hidden md:block">Features</a>
                        <Link href="/privacy" className="hover:text-white transition-colors duration-200 hidden md:block">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors duration-200 hidden md:block">Terms</Link>
                        <div className="hidden md:block w-px h-4 bg-white/10 m-2"></div>
                        <Link href="/login" className="hover:text-white transition-colors duration-200">Log in</Link>
                        <Link href="/login" className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
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
                            <Link href="/login" className="w-full sm:w-auto px-6 py-3 rounded-full bg-white text-black font-medium text-base hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/10">
                                Connect Instagram <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>

                    {/* Dashboard Abstract Preview (Linear style borders) */}
                    <div className="relative w-full max-w-5xl mt-24">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#000212] via-transparent to-transparent z-20 h-full"></div>
                        <div className="relative rounded-2xl border border-white/[0.08] bg-[#0A0A0C] shadow-2xl p-2 mx-auto overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-10 border-b border-white/[0.04] bg-white/[0.01] flex items-center px-4 gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                            </div>
                            
                            <div className="mt-10 p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60">
                                <div className="col-span-1 md:col-span-2 h-40 md:h-64 rounded-xl border border-white/[0.05] bg-white/[0.01] p-6 relative overflow-hidden flex flex-col justify-between">
                                     <div className="h-4 w-24 bg-white/10 rounded"></div>
                                     <div className="h-20 w-full bg-gradient-to-r from-indigo-500/20 to-purple-500/0 rounded-lg"></div>
                                </div>
                                <div className="col-span-1 space-y-6">
                                    <div className="h-28 rounded-xl border border-white/[0.05] bg-white/[0.01] p-6 flex flex-col justify-center">
                                        <div className="h-3 w-16 bg-white/10 rounded mb-4"></div>
                                        <div className="h-6 w-24 bg-white/20 rounded"></div>
                                    </div>
                                    <div className="h-28 rounded-xl border border-white/[0.05] bg-white/[0.01] p-6 flex flex-col justify-center">
                                         <div className="h-3 w-16 bg-white/10 rounded mb-4"></div>
                                        <div className="h-6 w-24 bg-white/20 rounded"></div>
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
            <footer className="pt-16 pb-8 px-6 border-t border-white/[0.04] bg-[#000212]">
                <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-4 mb-16 text-sm">
                    {/* Brand col */}
                    <div className="col-span-1 sm:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
                                <span className="text-black font-bold text-xs">∞</span>
                            </div>
                            <span className="font-semibold text-white tracking-tight">infini8Graph</span>
                        </div>
                        <p className="text-gray-500 max-w-xs leading-relaxed">
                            The definitive platform for Instagram growth, analytics, and community automation.
                        </p>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-white font-medium mb-4">Product</h4>
                        <ul className="space-y-3">
                            <li><a href="#features" className="text-gray-500 hover:text-white transition-colors">Features</a></li>
                            <li><Link href="/login" className="text-gray-500 hover:text-white transition-colors">Log In</Link></li>
                        </ul>
                    </div>
                    
                    {/* Legal */}
                    <div>
                        <h4 className="text-white font-medium mb-4">Legal</h4>
                        <ul className="space-y-3">
                            <li><Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="text-gray-500 hover:text-white transition-colors">Terms of Service</Link></li>
                            <li><a href="mailto:britojaison123@gmail.com" className="text-gray-500 hover:text-white transition-colors">Contact Support</a></li>
                        </ul>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto border-t border-white/[0.04] pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
                    <p>&copy; {new Date().getFullYear()} infini8Graph. All rights reserved.</p>
                    <p className="flex items-center gap-1.5 justify-center"><Shield size={12} className="text-gray-500"/> Not affiliated with Meta Platforms, Inc.</p>
                </div>
            </footer>
        </div>
    );
}
