import Link from 'next/link';

export const metadata = {
    title: 'Privacy Policy - infini8Graph',
    description: 'Privacy Policy for infini8Graph Cross-Channel Analytics Platform',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen py-16 px-4" style={{ background: 'var(--background)' }}>
            <div className="max-w-4xl mx-auto">
                <Link href="/login" className="inline-flex items-center gap-2 text-[var(--primary)] hover:underline mb-8">
                    ← Back to Login
                </Link>

                <h1 className="text-4xl font-bold mb-2 gradient-text">Privacy Policy</h1>
                <p className="text-[var(--muted)] mb-12">Last updated: March 27, 2026</p>

                <div className="prose prose-invert max-w-none space-y-8">
                    <p className="text-lg text-[var(--foreground)]">
                        infini8Graph ("we", "our", or "us") operates the infini8Graph website and analytics platform (the "Service").
                        This Privacy Policy explains how we collect, use, store, and protect your information when you use our Service.
                    </p>

                    <p className="text-[var(--foreground)]">
                        By accessing or using infini8Graph, you agree to the practices described in this Privacy Policy.
                    </p>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>

                        <h3 className="text-xl font-semibold mb-3 text-[var(--primary)]">1.1 Information Provided via OAuth Login (Meta & Google)</h3>
                        <p className="text-[var(--muted)] mb-4">
                            When you sign in using Instagram (Meta) or Google Ads (Google via OAuth), we collect and store information necessary to provide cross-channel analytics services:
                        </p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1 mb-4">
                            <li><strong>Meta Platform:</strong> User ID, username, and analytics metadata.</li>
                            <li><strong>Google Ads API:</strong> Google User ID, email, and advertising account metadata required for analytics access.</li>
                        </ul>
                        <p className="text-[var(--foreground)] font-medium">We do not collect or store your Instagram or Google account passwords.</p>

                        <h3 className="text-xl font-semibold mb-3 mt-6 text-[var(--primary)]">1.2 Access Tokens</h3>
                        <p className="text-[var(--muted)] mb-2">To access cross-channel analytics securely, we store:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1 mb-4">
                            <li>OAuth access tokens and refresh tokens</li>
                            <li>Token expiration timestamps</li>
                        </ul>
                        <p className="text-[var(--foreground)]">
                            All access and refresh tokens are <strong>encrypted at rest</strong> using industry-standard AES encryption and are never exposed to the client browser.
                        </p>

                        <h3 className="text-xl font-semibold mb-3 mt-6 text-[var(--primary)]">1.3 Analytics Data</h3>
                        <p className="text-[var(--muted)] mb-2">We temporarily process and cache analytics data such as:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1 mb-4">
                            <li><strong>Instagram:</strong> Reach, impressions, saves, and audience demographics.</li>
                            <li><strong>Google Ads:</strong> Campaign performance (ROAS, spend, CTR), keyword quality scores, and asset performance labels.</li>
                        </ul>
                        <p className="text-[var(--foreground)]">
                            Our use of Google data is strictly limited to the practices disclosed here and conforms to the <strong>Google API Services User Data Policy</strong>, including the Limited Use requirements. This data is used only to generate insights for your account and is <strong>not sold, shared, or used for third-party advertising</strong>.
                        </p>

                        <h3 className="text-xl font-semibold mb-3 mt-6 text-[var(--primary)]">1.4 Automatically Collected Information</h3>
                        <p className="text-[var(--muted)] mb-2">When you access the website, we may collect limited technical information such as:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1">
                            <li>Browser type and version</li>
                            <li>Device type</li>
                            <li>IP address (used only for security and rate limiting)</li>
                        </ul>
                        <p className="text-[var(--muted)] mt-2">This data is not used to identify you personally.</p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
                        <p className="text-[var(--muted)] mb-2">We use collected information to:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1">
                            <li>Authenticate your account</li>
                            <li>Retrieve analytics from the Instagram Graph API</li>
                            <li>Generate dashboards, charts, and reports</li>
                            <li>Cache analytics to reduce API usage and improve performance</li>
                            <li>Secure the platform against abuse</li>
                            <li>Comply with legal and platform requirements</li>
                        </ul>
                        <p className="text-[var(--foreground)] mt-4 font-medium">We do not use your data for advertising or profiling.</p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">3. How We Store and Protect Data</h2>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-2">
                            <li>User data is stored in <strong>Supabase PostgreSQL</strong></li>
                            <li>Access tokens are <strong>AES-encrypted</strong></li>
                            <li>Authentication is handled using JWT stored in secure, <strong>HttpOnly cookies</strong></li>
                            <li>All communication uses <strong>HTTPS</strong></li>
                            <li>Access to production databases is restricted and logged</li>
                        </ul>
                        <p className="text-[var(--muted)] mt-4">
                            We take reasonable technical and organizational measures to protect your data, but no system is 100% secure.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">4. Data Retention</h2>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-2">
                            <li>User account data is retained while your account remains active</li>
                            <li>Cached analytics data is stored temporarily and automatically refreshed or overwritten</li>
                            <li>Access tokens are refreshed or deleted based on expiration and account status</li>
                        </ul>
                        <p className="text-[var(--foreground)] mt-4">You may request deletion of your data at any time.</p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">5. Data Deletion & Account Removal</h2>
                        <p className="text-[var(--muted)] mb-2">You may request complete deletion of your data, including:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1 mb-4">
                            <li>User record</li>
                            <li>Encrypted access tokens</li>
                            <li>Cached analytics</li>
                        </ul>
                        <p className="text-[var(--muted)] mb-4">
                            To request deletion, use the in-app account deletion option or contact us at:
                        </p>
                        <p className="text-[var(--primary)] font-medium mb-4">Email: support@infini8graph.com</p>
                        <p className="text-[var(--warning)]">Data deletion is permanent and cannot be undone.</p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">6. Third-Party Services</h2>
                        <p className="text-[var(--muted)] mb-4">infini8Graph integrates with the following third-party services:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-2">
                            <li><strong>Meta Platforms / Instagram Graph API</strong> – for analytics data</li>
                            <li><strong>Supabase</strong> – database and secure data storage</li>
                            <li><strong>Cloudflare</strong> – secure tunneling and network protection</li>
                            <li><strong>Vercel</strong> – website hosting</li>
                        </ul>
                        <p className="text-[var(--muted)] mt-4">
                            These services process data only as required to operate the Service and are governed by their own privacy policies.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">7. Cookies</h2>
                        <p className="text-[var(--muted)] mb-2">We use cookies only for authentication and security purposes, such as:</p>
                        <ul className="list-disc list-inside text-[var(--muted)] space-y-1">
                            <li>Maintaining your login session</li>
                            <li>Protecting against unauthorized access</li>
                        </ul>
                        <p className="text-[var(--foreground)] mt-4">We do not use tracking or advertising cookies.</p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">8. Children's Privacy</h2>
                        <p className="text-[var(--muted)]">
                            infini8Graph is not intended for individuals under the age of 13. We do not knowingly collect personal data from children.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">9. International Data Transfers</h2>
                        <p className="text-[var(--muted)]">
                            Your data may be processed in servers located outside your country of residence. By using the Service, you consent to such transfers in accordance with applicable laws.
                        </p>
                    </section>

                    <section className="card">
                        <h2 className="text-2xl font-bold mb-4">10. Changes to This Privacy Policy</h2>
                        <p className="text-[var(--muted)] mb-4">
                            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date.
                        </p>
                        <p className="text-[var(--muted)]">
                            Continued use of the Service after changes constitutes acceptance of the updated policy.
                        </p>
                    </section>

                    <div className="text-center pt-8 border-t border-[var(--border)]">
                        <Link href="/login" className="btn btn-primary">
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
