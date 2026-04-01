# ∞ infini8Graph

**A State-of-the-Art Multi-Channel Advertising & Analytics Command Center**

Infini8Graph is a high-performance, production-grade intelligence platform designed to bridge the gap between Meta Ads (Instagram/Facebook) and Google Ads. It provides unified cross-platform insights, advanced content analytics, and automated response systems for modern digital marketers.

---

## 🚀 The Stack
Built with the latest cutting-edge technologies for maximum performance and stability:

### Frontend
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Runtime**: [React 19](https://react.dev/)
- **State Management**: [TanStack Query v5](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Vanilla CSS
- **Visuals**: [Recharts](https://recharts.org/) & [Lucide Icons](https://lucide.dev/)

### Backend
- **Core**: Node.js & Express.js
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Security**: JWT Authentication (HttpOnly) & AES-256 Token Encryption
- **Infrastructure**: Automated Cache TTL Management (Instagram Graph API)

---

## 📊 Feature Ecosystem

| Ecosystem | Feature | Description |
| :--- | :--- | :--- |
| **Meta Analytics** | **Content Intel** | Deep-dive post analysis with quality scores and virality matching. |
| | **Growth & Engagement** | Longitudinal trend analysis and post-by-post efficiency metrics. |
| | **Best Time & Hashtags** | Algorithmic timing optimization and semantic hashtag tracking. |
| **Google Ads Intel** | **True ROAS** | Advanced attribution modeling for accurate return on spend. |
| | **Wasted Spend** | Identification of negative keywords and inefficient search terms. |
| | **Competitor Threat** | Auction insight analysis for share-of-voice tracking. |
| **Intelligence** | **Persona Builder** | AI-driven audience profiling based on ad performance data. |
| | **Local Impact** | Geographic performance mapping for physical store conversion. |
| **Automation** | **Auto-Reply** | Instagram Webhook-driven automated comment and DM response system. |
| **Experience** | **Unified Dashboard** | Cross-platform KPI comparison (Meta vs. Google) in a single view. |

---

## 📂 Project Structure

```text
infini8Graph/
├── infini8Graph-server/     # Node.js/Express Backend API
│   ├── src/
│   │   ├── controllers/      # Route logic for Ads, Auth, & Instagram
│   │   ├── services/         # Business logic & 3rd party API integrations
│   │   ├── middleware/       # Auth & Security layers
│   │   └── utils/            # Encryption & JWT helpers
│   └── scripts/             # Cache clearing and automation debugging
│
└── web/                     # Next.js 16 Frontend
    ├── src/
    │   ├── app/              # App Router (Dashboard, Google Ads, unified)
    │   ├── components/       # Premium UI components & Intel-Tabs
    │   └── lib/              # API clients and Auth context providers
    └── public/               # Asset management
```

---

## 🛠️ Infrastructure Setup

### 1. Prerequisites
- **Node.js 18+**
- **Supabase Instance** (Database + Authentication)
- **Meta Developer App** (Graph API + Webhooks)
- **Google Cloud Console** (Google Ads API + Developer Token)

### 2. Backend Initialization
```bash
cd infini8Graph-server
npm install
# Configure .env based on .env.example
npm run dev
```

### 3. Frontend Initialization
```bash
cd web
npm install
# Configure .env.local for NEXT_PUBLIC_API_URL
npm run dev
```

---

## 🛡️ Security Architecture
- **Stateless Authentication**: JWT tokens stored in secure, HttpOnly cookies.
- **Data Privacy**: All sensitive OAuth tokens (Meta & Google) are stored with AES-256 encryption using the system `ENCRYPTION_KEY`.
- **API Resilience**: Built-in rate limiting and Helmet.js headers for XSS protection.

---

## 📄 License
MIT © 2024 Infini8 Intelligence Group.
