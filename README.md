# infini8Graph

A production-grade Instagram Analytics Web Platform with a Next.js frontend and Node.js/Express backend, backed by Supabase PostgreSQL.

---

## Project Structurses

```
infini8Graphs/
├── infini8Graph-server/     # Backend API (Express.js)
│   ├── src/
│   │   ├── app.js           # Main server entry
│   │   ├── config/          # Database configuration
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Encryption, JWT utilities
│   ├── .env                 # Environment variables
│   └── package.json
│
└── web/                     # Frontend (Next.js)
    ├── src/
    │   ├── app/
    │   │   ├── login/       # Login page
    │   │   └── (dashboard)/ # Protected dashboard routes
    │   │       ├── dashboard/
    │   │       ├── growth/
    │   │       ├── engagement/
    │   │       ├── reels/
    │   │       ├── best-time/
    │   │       ├── hashtags/
    │   │       ├── ads/
    │   │       ├── export/
    │   │       └── settings/
    │   ├── components/      # React components
    │   └── lib/             # API client, auth context
    ├── .env.local           # Frontend environment
    └── package.json
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- Supabase account with the database schema applied
- Meta Developer App with Instagram Basic Display & Graph API configured

### 1. Backend Setup

```bash
cd infini8Graph-server
npm install
```

Configure `.env` with your credentials:

- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- `META_APP_ID` and `META_APP_SECRET`
- `META_REDIRECT_URI` (your Cloudflare tunnel URL + `/api/auth/callback`)
- `JWT_SECRET` and `ENCRYPTION_KEY`

Start the server:

```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd web
npm install
```

Configure `.env.local`:

```
NEXT_PUBLIC_API_URL=https://your-cloudflare-tunnel-url
```

Start the frontend:

```bash
npm run dev
```

### 3. Cloudflare Tunnel (Development)

Run a Cloudflare tunnel to get a public HTTPS URL:

```bash
cloudflared tunnel --url http://localhost:3001
```

Update `META_REDIRECT_URI` in Meta Developer Console and backend `.env` with the tunnel URL.

---

## Features

| Feature       | Description                                          |
|---------------|------------------------------------------------------|
| Dashboard     | Overview of followers, engagement rate, recent posts |
| Growth        | Trend analysis, week-over-week comparisons           |
| Engagement    | Detailed post-by-post metrics                        |
| Reels         | Video content performance vs regular posts           |
| Best Time     | Optimal posting schedule based on historical data    |
| Hashtags      | Top performing and most used hashtags                |
| Ads           | Facebook/Instagram Ads performance analytics         |
| Export        | Download analytics as JSON or CSV                    |

---

## Security

- JWT authentication with HttpOnly cookies
- AES-256 encrypted Instagram access tokens
- Rate limiting on API endpoints
- CORS protection
- Helmet.js security headers

---

## Database Schema

Apply the SQL schema to your Supabase project:

| Table            | Description                      |
|------------------|----------------------------------|
| `users`          | Instagram user accounts          |
| `auth_tokens`    | Encrypted access tokens          |
| `analytics_cache`| Cached analytics with TTL        |

---

## API Endpoints

### Auth

| Method | Endpoint               | Description          |
|--------|------------------------|----------------------|
| GET    | `/api/auth/login`      | Get OAuth URL        |
| GET    | `/api/auth/callback`   | OAuth callback       |
| GET    | `/api/auth/me`         | Get current user     |
| POST   | `/api/auth/logout`     | Logout               |

### Analytics

| Method | Endpoint                     | Description          |
|--------|------------------------------|----------------------|
| GET    | `/api/instagram/overview`    | Dashboard metrics    |
| GET    | `/api/instagram/growth`      | Growth analytics     |
| GET    | `/api/instagram/posts`       | Posts with engagement|
| GET    | `/api/instagram/reels`       | Reels analytics      |
| GET    | `/api/instagram/best-time`   | Best time to post    |
| GET    | `/api/instagram/hashtags`    | Hashtag analysis     |
| GET    | `/api/instagram/export`      | Export data          |

### Ads

| Method | Endpoint                                   | Description                  |
|--------|--------------------------------------------|------------------------------|
| GET    | `/api/ads/accounts`                        | Get ad accounts              |
| GET    | `/api/ads/accounts/:id/insights`           | Get account insights         |
| GET    | `/api/ads/accounts/:id/campaigns`          | Get campaigns                |
| GET    | `/api/ads/accounts/:id/adsets`             | Get ad sets                  |
| GET    | `/api/ads/accounts/:id/ads`                | Get individual ads           |
| GET    | `/api/ads/page-insights`                   | Get page insights            |

---

## Tech Stack

### Frontend

| Technology     | Purpose                    |
|----------------|----------------------------|
| Next.js 15     | React framework (App Router)|
| React Query    | Data fetching and caching  |
| Recharts       | Charts and visualizations  |
| Tailwind CSS   | Styling                    |
| Lucide Icons   | Icon library               |

### Backend

| Technology     | Purpose                    |
|----------------|----------------------------|
| Node.js        | Runtime environment        |
| Express        | Web framework              |
| JWT            | Authentication             |
| Supabase       | PostgreSQL database        |
| Axios          | HTTP client for APIs       |

---

## License

MIT
