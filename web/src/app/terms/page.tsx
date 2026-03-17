import Link from 'next/link';

export const metadata = {
    title: 'Terms of Service - infini8Graph',
    description: 'Terms of Service for infini8Graph Instagram Analytics Platform',
};

export default function TermsPage() {
    return (
        <div className="min-h-screen py-16 px-4" style={{ background: 'var(--background)' }}>
            <div className="max-w-4xl mx-auto">
                <Link href="/login" className="inline-flex items-center gap-2 text-[var(--primary)] hover:underline mb-8">
                    ← Back to Login
                </Link>

                <h1 className="text-4xl font-bold mb-2 gradient-text">Terms of Service</h1>
                <p className="text-[var(--muted)] mb-12">Last updated: March 17, 2026</p>

                <div className="prose prose-invert max-w-none space-y-8">
                    <p className="text-lg text-[var(--foreground)]">
                        Welcome to infini8Graph. By using our website and services, you agree to comply with and be bound by the following terms and conditions.
                    </p>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                        <p className="text-[var(--muted)]">
                            By accessing or using infini8Graph, you confirm that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree, please do not use our Service.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
                        <p className="text-[var(--muted)]">
                            infini8Graph provides an analytics and community management tool for Instagram Business and Creator accounts. We utilize the official Instagram Graph API to display metrics and provide automation features like auto-replies.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">3. User Responsibilities</h2>
                        <p className="text-[var(--muted)] mb-2">As a user, you agree to:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1">
                            <li>Maintain the security of your account and credentials.</li>
                            <li>Use the service only for lawful purposes.</li>
                            <li>Comply with Meta's and Instagram's own Terms of Service.</li>
                            <li>Not use the platform for spamming, harassment, or unauthorized data scraping.</li>
                        </ul>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">4. Account and Data</h2>
                        <p className="text-[var(--muted)] mb-4">
                            You acknowledge that infini8Graph is a third-party tool and is not affiliated with, endorsed by, or sponsored by Meta Platforms or Instagram.
                        </p>
                        <p className="text-[var(--muted)]">
                            We reserve the right to suspend or terminate accounts that violate these terms or the terms of our third-party provider (Meta).
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">5. Intellectual Property</h2>
                        <p className="text-[var(--muted)]">
                            All content, features, and functionality of the Service (excluding your own Instagram data) are the exclusive property of infini8Graph and are protected by international copyright and trademark laws.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">6. Limitation of Liability</h2>
                        <p className="text-[var(--muted)] text-sm">
                            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." WE DISCLAIM ALL WARRANTIES OF ANY KIND. IN NO EVENT SHALL INFINI8GRAPH BE LIABLE FOR ANY DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO ACCOUNT SUSPENSION BY INSTAGRAM OR LOSS OF DATA.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">7. Contact Information</h2>
                        <p className="text-[var(--muted)]">
                            For questions about these Terms, please contact us at:
                        </p>
                        <p className="text-[var(--primary)] font-medium mt-2">Email: britojaison123@gmail.com</p>
                    </section>

                    <div className="text-center pt-8 border-t border-[var(--border)]">
                        <Link href="/" className="btn btn-primary">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
