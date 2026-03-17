import Link from 'next/link';
import { Instagram, BarChart3, TrendingUp, Zap, Shield, ArrowRight } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[var(--background)] overflow-x-hidden">
            {/* Header / Navbar */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-1)' }}>
                            <span className="text-white font-bold text-xl">∞</span>
                        </div>
                        <span className="text-xl font-bold gradient-text">infini8Graph</span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--muted)]">
                        <a href="#features" className="hover:text-[var(--foreground)] transition-colors">Features</a>
                        <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms</Link>
                        <Link href="/login" className="btn px-4 py-2 text-sm bg-white text-black hover:bg-white/90">Sign In</Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main>
                <section className="relative pt-32 pb-20 px-6">
                    <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold mb-6 border border-[var(--primary)]/20 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                            <Zap size={14} />
                            <span>Powered by Instagram Graph API</span>
                        </div>
                        
                        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
                            Master Your <br />
                            <span className="gradient-text">Instagram Intelligence</span>
                        </h1>
                        
                        <p className="text-xl text-[var(--muted)] max-w-2xl mb-10 leading-relaxed">
                            Professional-grade analytics, growth tracking, and community automation designed for modern businesses and creators.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 mb-16">
                            <Link href="/login" className="btn btn-primary px-8 py-4 text-lg">
                                Get Started <ArrowRight className="ml-2 inline" size={20} />
                            </Link>
                            <a href="#features" className="btn btn-ghost px-8 py-4 text-lg border border-[var(--border)]">
                                Explore Features
                            </a>
                        </div>

                        {/* Visual Mockup - CSS Gradient Pattern */}
                        <div className="relative w-full max-w-5xl aspect-[16/9] rounded-2xl overflow-hidden border border-[var(--border)] shadow-2xl bg-[#0a0a0a]">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                            <div className="absolute inset-0 bg-gradient-to-tr from-[#E1306C]/10 via-transparent to-[#833AB4]/10"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center p-8 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/5 shadow-2xl">
                                    <BarChart3 size={80} className="mx-auto mb-6 text-[var(--primary)] opacity-80" />
                                    <h3 className="text-2xl font-bold mb-2">Beautiful Analytics</h3>
                                    <p className="text-[var(--muted)]">Visualize your growth and engagement.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Background Glows */}
                    <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#E1306C]/10 blur-[120px] rounded-full pointer-events-none"></div>
                    <div className="absolute bottom-0 -right-20 w-96 h-96 bg-[#833AB4]/10 blur-[120px] rounded-full pointer-events-none"></div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-24 px-6 border-t border-[var(--border)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none"></div>
                    <div className="relative max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Precision Tools for Growth</h2>
                            <p className="text-[var(--muted)] text-lg max-w-2xl mx-auto">Everything you need to optimize your digital presence and engage with your community effectively.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                {
                                    icon: TrendingUp,
                                    title: "Audience Demographics",
                                    desc: "Understand exactly who your followers are and where they are located with high-fidelity reporting."
                                },
                                {
                                    icon: BarChart3,
                                    title: "Deep Insights",
                                    desc: "Track reach, impressions, and engagement rates at the post and profile level in real-time."
                                },
                                {
                                    icon: Shield,
                                    title: "Secure & Compliant",
                                    desc: "We use official Meta APIs and enterprise-grade encryption to keep your data protected."
                                }
                            ].map((feature, i) => (
                                <div key={i} className="card hover:border-[var(--primary)]/50 transition-colors p-8 bg-[var(--background)] relative group overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] mb-6 border border-[var(--primary)]/20">
                                            <feature.icon size={28} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                        <p className="text-[var(--muted)] leading-relaxed">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-[var(--border)] text-center relative z-10 bg-[var(--background)]">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-6 opacity-80">
                        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--gradient-1)' }}>
                            <span className="text-white text-xs font-bold">∞</span>
                        </div>
                        <span className="font-semibold">infini8Graph</span>
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-6 text-sm text-[var(--muted)] mb-8">
                        <Link href="/login" className="hover:text-[var(--foreground)] transition-colors">Login</Link>
                        <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms of Service</Link>
                        <a href="mailto:britojaison123@gmail.com" className="hover:text-[var(--foreground)] transition-colors">Support</a>
                    </div>
                    
                    <p className="text-xs text-[var(--muted)]/60 max-w-md mx-auto">
                        &copy; {new Date().getFullYear()} infini8Graph. All rights reserved. <br />
                        This product uses the Instagram API but is not endorsed or certified by Instagram or Meta Platforms, Inc.
                    </p>
                </div>
            </footer>
        </div>
    );
}
