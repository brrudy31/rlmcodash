# RLM&CO Dashboard

A full-stack real estate management dashboard built with Next.js, TypeScript, Tailwind CSS, and SQLite.

## Features

- **Vendor Email Manager** — Manage clients and vendor lists, send professionally formatted emails via Resend, track opens, and handle unsubscribes automatically.
- **Open House Tracker** — Log open houses, view sortable history, and analyze performance with interactive charts.

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- A free [Resend](https://resend.com) account for email delivery

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required: set a strong password for the login screen
DASHBOARD_PASSWORD=your-secure-password

# Required: long random string for session security
SESSION_SECRET=replace-with-a-long-random-string-like-this-one-here

# Required for email sending: get from https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Required for email sending: must be verified in Resend
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Your app's public URL (for unsubscribe links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your `DASHBOARD_PASSWORD`.

### 5. Build for Production

```bash
npm run build
npm run start
```

---

## Email Setup (Resend)

1. Create a free account at [resend.com](https://resend.com)
2. Add and verify your sending domain (or use the free sandbox)
3. Create an API key and add it to `.env.local`
4. Set `RESEND_FROM_EMAIL` to a verified address on your domain

### Email Open Tracking (Optional)

Open tracking uses Resend Webhooks:

1. In your Resend dashboard, go to **Webhooks** → **Add Endpoint**
2. Set the URL to: `https://yourdomain.com/api/email/webhook`
3. Select the `email.opened` event
4. Save — opens will now be recorded in the tracking dashboard

---

## Data Storage

All data is stored in a local SQLite database at `data/database.db`. The database is created automatically on first run. Back up this file to preserve your data.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Login page
│   ├── unsubscribe/          # Public unsubscribe page
│   ├── api/                  # All API routes
│   └── dashboard/            # Protected dashboard pages
├── components/
│   ├── Sidebar.tsx
│   └── Modal.tsx
└── lib/
    ├── db.ts                 # SQLite database
    └── auth.ts               # Session authentication
```
"# rlmcodash" 
