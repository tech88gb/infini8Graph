import Link from 'next/link';
import { BarChart3, TrendingUp, Shield, ArrowRight, MessageCircle } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden">
            
            {/* Navbar */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-white font-bold text-xl">∞</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white hidden sm:block">infini8Graph</span>
                    </div>
                    
                    <div className="flex items-center gap-6 sm:gap-8 text-sm font-medium text-gray-400">
                        <a href="#features" className="hover:text-white transition-colors duration-200 hidden md:block">Features</a>
                        <Link href="/privacy" className="hover:text-white transition-colors duration-200 hidden md:block">Privacy & Terms</Link>
                        <div className="hidden md:block w-px h-4 bg-white/10"></div>
                        <Link href="/login" className="hover:text-white transition-colors duration-200">Log in</Link>
                        <Link href="/login" className="px-5 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-gray-100 transition-all flex items-center gap-2">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="relative pt-40 pb-20 px-6 flex flex-col items-center text-center min-h-[90vh] justify-center">
                    {/* Background Gradients */}
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[400px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm font-medium mb-8 backdrop-blur-md">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-gray-300">Official Instagram API Integration</span>
                        </div>
                        
                        <h1 className="text-5xl sm:text-7xl font-bold mb-8 tracking-tight leading-[1.1] text-white">
                            The intelligence layer <br />
                            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                for modern creators.
                            </span>
                        </h1>
                        
                        <p className="text-lg sm:text-2xl text-gray-400 max-w-2xl font-light leading-relaxed mb-12">
                            Transform your Instagram presence with enterprise-grade analytics, deep audience insights, and automated community management.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4">
                            <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-base sm:text-lg hover:shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2">
                                Connect Instagram Account <ArrowRight size={20} />
                            </Link>
                            <a href="#features" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-semibold text-base sm:text-lg hover:bg-white/10 transition-all flex items-center justify-center">
                                View Features
                            </a>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-24 px-6 border-t border-white/5 bg-[#08080A]">
                    <div className="max-w-7xl mx-auto flex flex-col items-center">
                        <div className="text-center mb-16 sm:mb-20 max-w-3xl">
                            <h2 className="text-3xl sm:text-5xl font-bold mb-6 tracking-tight text-white">Everything you need.<br/><span className="text-gray-500">Nothing you don't.</span></h2>
                            <p className="text-lg sm:text-xl text-gray-400 font-light leading-relaxed">Purpose-built tools designed to give you clarity and save you hours of manual work every week.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                            {/* Feature 1 */}
                            <div className="p-8 rounded-3xl bg-[#0F0F12] border border-white/5 transition-colors hover:border-white/10 shadow-lg shadow-black/50">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6">
                                    <BarChart3 className="text-indigo-400" size={28} />
                                </div>
                                <h3 className="text-xl font-bold mb-4 text-white">Deep Analytics</h3>
                                <p className="text-gray-400 leading-relaxed font-light">Stop guessing. Get exact metrics on reach, impressions, and engagement rates for every post and reel.</p>
                            </div>

                            {/* Feature 2 */}
                            <div className="p-8 rounded-3xl bg-[#0F0F12] border border-white/5 transition-colors hover:border-white/10 shadow-lg shadow-black/50">
                                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                                    <TrendingUp className="text-purple-400" size={28} />
                                </div>
                                <h3 className="text-xl font-bold mb-4 text-white">Audience Intelligence</h3>
                                <p className="text-gray-400 leading-relaxed font-light">Know exactly who follows you. Vivid demographic breakdowns by top cities, countries, age, and gender.</p>
                            </div>

                            {/* Feature 3 */}
                            <div className="p-8 rounded-3xl bg-[#0F0F12] border border-white/5 transition-colors hover:border-white/10 shadow-lg shadow-black/50">
                                <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6">
                                    <MessageCircle className="text-pink-400" size={28} />
                                </div>
                                <h3 className="text-xl font-bold mb-4 text-white">Smart Auto-Reply</h3>
                                <p className="text-gray-400 leading-relaxed font-light">Setup rules to automatically respond to comments and trigger DMs instantly, keeping your audience engaged 24/7.</p>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* CTA Section */}
                <section className="py-32 px-6 relative border-t border-white/5 overflow-hidden flex flex-col items-center text-center">
                     <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none"></div>
                     <div className="max-w-3xl mx-auto relative z-10">
                         <h2 className="text-3xl sm:text-5xl font-bold mb-8 tracking-tight text-white">Ready to scale your impact?</h2>
                         <p className="text-lg sm:text-xl text-gray-400 mb-10 font-light leading-relaxed">Join the next generation of creators utilizing data-driven insights to dominate their niche.</p>
                         <Link href="/login" className="inline-flex justify-center px-8 py-4 rounded-full bg-white text-black font-semibold text-base sm:text-lg hover:bg-gray-100 transition-colors items-center gap-2 shadow-xl shadow-white/10">
                             Connect Your Account Now
                         </Link>
                     </div>
                </section>
            </main>

            {/* Premium Footer */}
            <footer className="pt-20 pb-10 px-6 border-t border-white/5 bg-[#050505]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <span className="text-white font-bold">∞</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white">infini8Graph</span>
                    </div>
                    
                    <div className="flex flex-wrap justify-center md:justify-end items-center gap-6 sm:gap-8 text-sm text-gray-400 font-medium">
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                        <a href="mailto:britojaison123@gmail.com" className="hover:text-white transition-colors">Contact Support</a>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
                    <p>&copy; {new Date().getFullYear()} infini8Graph Platform. All rights reserved.</p>
                    <p className="flex items-center gap-2 justify-center"><Shield size={14} className="text-gray-400"/> Secure platform. Not affiliated with Meta Platforms, Inc.</p>
                </div>
            </footer>
        </div>
    );
}

