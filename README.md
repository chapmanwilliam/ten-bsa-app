# SJS/TEN BSA Assessment Tool

A clinical progressive web app for assessing Body Surface Area (BSA) involvement in Stevens-Johnson Syndrome (SJS) and Toxic Epidermal Necrolysis (TEN).

Built for a multicentre clinical study across sites in France and England.

## Overview

This tool enables clinicians to:

- **Draw on body maps** to mark affected skin regions using a 4-layer canvas system (background anatomy, region outlines, active drawing, composite)
- **Calculate TBSA and DBSA** (Total / Detached Body Surface Area) using the Lund & Browder method with age-adjusted percentages
- **Score SCORTEN** severity index automatically from 7 binary clinical criteria (age, malignancy, tachycardia, BUN, serum bicarbonate, glucose, BSA)
- **Capture clinical photographs** with EXIF metadata extraction
- **Write clinical notes** with automatic EN/FR translation via DeepL
- **Track patients** across multiple assessment timepoints with full audit trail

The app is bilingual (English/French), works offline as a PWA, and is designed for iPad use at the bedside.

## Demo

A standalone demo mode is available at `/demo` — it provides the full body-map drawing experience without requiring authentication or a database. Useful for training or evaluation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email/password + MFA) |
| Storage | Supabase Storage (clinical photos) |
| i18n | next-intl (EN/FR) |
| Translation | DeepL API (clinical notes) |
| PWA | Serwist (service worker, offline support) |
| Hosting | Vercel |

## Self-Hosting Guide

### Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) account (free tier works)
- A [DeepL API](https://www.deepl.com/pro-api) key (free tier works — needed for note translation)
- A [Vercel](https://vercel.com) account (optional — for production deployment)

### 1. Clone and install

```bash
git clone https://github.com/chapmanwilliam/ten-bsa.git
cd ten-bsa
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** and run the migration files in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_albumin_and_photos.sql
supabase/migrations/003_notes_translation.sql
supabase/migrations/004_photo_metadata.sql
supabase/migrations/004_scorten.sql
```

These create the tables (`clinicians`, `patients`, `assessments`, `assessment_photos`, `audit_log`), Row Level Security policies, audit triggers, and required functions.

3. Create a **Storage bucket** called `assessment-photos`:
   - Go to **Storage** in your Supabase dashboard
   - Click **New Bucket**
   - Name: `assessment-photos`
   - Public: **No** (RLS will control access)

4. Create your first admin user:
   - Go to **Authentication > Users > Add User**
   - Create a user with email and password
   - Then in **SQL Editor**, insert them into the clinicians table:

```sql
INSERT INTO clinicians (id, email, full_name, role, site)
VALUES (
  'the-auth-user-uuid',
  'admin@example.com',
  'Admin Name',
  'admin',
  'england'  -- or 'france'
);
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase project credentials (found in **Settings > API**) and DeepL API key.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with the admin user you created.

### 5. Deploy to Vercel (optional)

```bash
npx vercel --yes --prod
```

Set the same environment variables in your Vercel project settings.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Patient list (home)
│   ├── login/                # Authentication
│   ├── admin/                # Admin panel (manage clinicians)
│   ├── patients/[studyId]/
│   │   ├── page.tsx          # Patient detail + history
│   │   └── assess/page.tsx   # BSA assessment (body maps + drawing)
│   ├── demo/                 # Standalone demo mode
│   ├── forgot-password/      # Password reset flow
│   ├── reset-password/
│   └── mfa/                  # Multi-factor auth enrollment/verify
├── components/
│   ├── canvas/               # DrawingEngine, body map SVGs, region data
│   └── ui/                   # Shared UI components
├── lib/                      # Supabase clients, server actions, utilities
└── middleware.ts              # Auth guard

messages/
├── en.json                   # English strings
└── fr.json                   # French strings

supabase/migrations/          # Database schema (run in SQL Editor)

public/
├── manifest.json             # PWA manifest (main app)
├── manifest-demo.json        # PWA manifest (demo mode)
└── icons/                    # App icons
```

## Key Features

- **Lund & Browder body mapping**: 51 anatomical regions with age-adjusted BSA percentages for adults, children (5-15 yr), and infants (0-1 yr)
- **Dual drawing modes**: Mark both "involved" and "detached" skin areas with separate colour coding
- **SCORTEN auto-calculation**: 4 of 7 criteria (tachycardia, BUN, bicarbonate, glucose) auto-computed from lab values
- **Photo capture**: Camera integration with EXIF metadata, stored in Supabase Storage
- **Bilingual**: Full EN/FR interface with DeepL-powered clinical note translation
- **Audit trail**: Every data change is logged with clinician ID, timestamp, and before/after values
- **PWA**: Installable on iOS/Android home screens with offline support via service worker
- **Role-based access**: Clinician, Admin, and PI roles with RLS-enforced data boundaries
- **Separate PWA instances**: Demo and main app can be saved as independent home screen icons

## License

[MIT](LICENSE)
