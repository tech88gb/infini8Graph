import Link from 'next/link';
import { BarChart3, TrendingUp, Zap, Shield, ArrowRight, MessageCircle } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#050511] text-white selection:bg-purple-500/30 overflow-x-hidden font-sans">
            {/* Minimalist Modern Navbar */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#050511]/70 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1px]">
                            <div className="w-full h-full bg-[#050511] rounded-xl flex items-center justify-center">
                                <span className="bg-gradient-to-br from-indigo-400 to-pink-400 bg-clip-text text-transparent font-bold text-xl">∞</span>
                            </div>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">infini8Graph</span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <a href="#features" className="hover:text-white transition-colors duration-200">Platform</a>
                        <Link href="/privacy" className="hover:text-white transition-colors duration-200">Safety</Link>
                        <div className="h-4 w-[1px] bg-white/10"></div>
                        <Link href="/login" className="hover:text-white transition-colors duration-200">Log in</Link>
                        <Link href="/login" className="px-5 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-gray-100 transition-all flex items-center gap-2 transform hover:scale-105">
                            Start Free <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section - True SaaS Aesthetic */}
                <section className="relative pt-40 pb-32 px-6 flex flex-col items-center justify-center text-center min-h-[90vh]">
                    {/* Background Gradients */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-purple-600/20 blur-[150px] rounded-full pointer-events-none"></div>
                    <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-5xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium mb-8 backdrop-blur-md">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-gray-300">Official Instagram API Integration</span>
                        </div>
                        
                        <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter leading-[1.1]">
                            The intelligence layer <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                                for modern creators.
                            </span>
                        </h1>
                        
                        <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
                            Transform your Instagram presence with enterprise-grade analytics, deep audience insights, and automated community management.
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-5">
                            <Link href="/login" className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-lg hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center gap-2 transform hover:-translate-y-1">
                                Connect Instagram Account
                            </Link>
                            <a href="#features" className="px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all flex items-center justify-center">
                                View Platform Features
                            </a>
                        </div>
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="relative w-full max-w-6xl mt-24">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050511] via-transparent to-transparent z-20 h-full"></div>
                        <div className="relative rounded-2xl border border-white/10 bg-[#0A0A1F] shadow-2xl p-2 mx-auto overflow-hidden transform perspective-1000 rotateX-12 scale-105">
                            <div className="absolute top-0 left-0 right-0 h-10 bg-[#15152A] border-b border-white/5 flex items-center px-4 gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            </div>
                            
                            {/* Abstract Dashboard UI */}
                            <div className="mt-10 p-8 grid grid-cols-3 gap-6 opacity-80">
                                <div className="col-span-2 h-64 rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-6 relative overflow-hidden">
                                     <div className="h-6 w-32 bg-white/10 rounded mb-8"></div>
                                     {/* Fake Chart Lines */}
                                     <svg className="absolute bottom-0 left-0 w-full h-32" preserveAspectRatio="none" viewBox="0 0 100 100">
                                        <path d="M0 100 Q 10 50, 20 80 T 40 40 T 60 70 T 80 20 T 100 0 L 100 100 Z" fill="url(#grad)" opacity="0.3" />
                                        <path d="M0 100 Q 10 50, 20 80 T 40 40 T 60 70 T 80 20 T 100 0" fill="none" stroke="#8b5cf6" strokeWidth="2" />
                                        <defs>
                                            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" />
                                                <stop offset="100%" stopColor="transparent" />
                                            </linearGradient>
                                        </defs>
                                     </svg>
                                </div>
                                <div className="col-span-1 space-y-6">
                                    <div className="h-28 rounded-xl border border-white/5 bg-gradient-to-br from-indigo-500/10 to-transparent p-6">
                                        <div className="h-4 w-24 bg-indigo-400/30 rounded mb-4"></div>
                                        <div className="h-8 w-32 bg-indigo-400/50 rounded"></div>
                                    </div>
                                    <div className="h-28 rounded-xl border border-white/5 bg-gradient-to-br from-pink-500/10 to-transparent p-6">
                                         <div className="h-4 w-24 bg-pink-400/30 rounded mb-4"></div>
                                        <div className="h-8 w-32 bg-pink-400/50 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Benthos */}
                <section id="features" className="py-32 px-6 relative border-t border-white/5 bg-[#03030A]">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-20">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Everything you need.<br/><span className="text-gray-500">Nothing you don't.</span></h2>
                            <p className="text-xl text-gray-400 max-w-2xl font-light">Purpose-built tools designed to give you clarity and save you hours of manual work every week.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Feature 1 */}
                            <div className="group p-8 rounded-3xl bg-[#0A0A1F] border border-white/5 hover:border-indigo-500/50 transition-all duration-300">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <BarChart3 className="text-indigo-400" size={28} />
                                </div>
                                <h3 className="text-2xl font-semibold mb-4">Deep Analytics</h3>
                                <p className="text-gray-400 leading-relaxed font-light">Stop guessing. Get exact metrics on reach, impressions, and engagement rates for every post and reel.</p>
                            </div>

                            {/* Feature 2 */}
                            <div className="group p-8 rounded-3xl bg-[#0A0A1F] border border-white/5 hover:border-purple-500/50 transition-all duration-300">
                                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <TrendingUp className="text-purple-400" size={28} />
                                </div>
                                <h3 className="text-2xl font-semibold mb-4">Audience Intelligence</h3>
                                <p className="text-gray-400 leading-relaxed font-light">Know exactly who follows you. Vivid demographic breakdowns by top cities, countries, age, and gender.</p>
                            </div>

                            {/* Feature 3 */}
                            <div className="group p-8 rounded-3xl bg-[#0A0A1F] border border-white/5 hover:border-pink-500/50 transition-all duration-300 md:col-span-2 lg:col-span-1">
                                <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <MessageCircle className="text-pink-400" size={28} />
                                </div>
                                <h3 className="text-2xl font-semibold mb-4">Smart Auto-Reply</h3>
                                <p className="text-gray-400 leading-relaxed font-light">Setup rules to automatically respond to comments and trigger DMs instantly, keeping your audience engaged 24/7.</p>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* CTA Section */}
                <section className="py-32 px-6 relative border-t border-white/5 overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-[#050511]"></div>
                     <div className="max-w-4xl mx-auto text-center relative z-10">
                         <h2 className="text-5xl font-bold mb-8 tracking-tight">Ready to scale your impact?</h2>
                         <p className="text-xl text-gray-400 mb-10 font-light max-w-2xl mx-auto">Join the next generation of creators utilizing data-driven insights to dominate their niche.</p>
                         <Link href="/login" className="inline-flex px-10 py-5 rounded-full bg-white text-black font-bold text-lg hover:scale-105 transition-transform">
                             Connect Your Account Now
                         </Link>
                     </div>
                </section>
            </main>

            {/* Premium Footer */}
            <footer className="pt-20 pb-10 px-6 border-t border-white/10 bg-[#020205]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2">
                        <span className="bg-gradient-to-br from-indigo-400 to-pink-400 bg-clip-text text-transparent font-black text-2xl">∞</span>
                        <span className="font-bold text-xl tracking-tight">infini8Graph</span>
                    </div>
                    
                    <div className="flex items-center gap-8 text-sm text-gray-400 font-medium">
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                        <a href="mailto:britojaison123@gmail.com" className="hover:text-white transition-colors">Contact Support</a>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-gray-600">
                    <p>&copy; {new Date().getFullYear()} infini8Graph Platform. All rights reserved.</p>
                    <p className="mt-2 md:mt-0 flex items-center gap-2"><Shield size={12}/> Secure platform. Not affiliated with Meta Platforms, Inc.</p>
                </div>
            </footer>
        </div>
    );
}
