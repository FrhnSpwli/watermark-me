<div align="center">
  <img src="src/public/assets/logo.png" alt="WatermarkMe logo" width="112" />
  <h1>WatermarkMe</h1>
  <p><strong>Protect your identity before sharing it.</strong></p>
  <p>
    A privacy-first web application for creating purpose-specific watermarked
    copies of sensitive documents.
  </p>
</div>

## About

WatermarkMe helps users prepare safer copies of identity documents before
sending them to a company, bank, university, landlord, insurer, or another
recipient. Users upload a private original, explain why it is being shared,
customize a watermark, and download a separate watermarked copy.

The original stored document is never overwritten. Image and PDF watermarking
run locally in the browser, and generated copies are downloaded directly
without being uploaded back to Supabase.

## MVP features

- Email and password authentication with required email confirmation
- Persistent sessions and protected application routes
- Private JPG, JPEG, PNG, and PDF uploads up to 10 MB
- User-isolated document metadata through PostgreSQL Row Level Security
- User-isolated files in a private Supabase Storage bucket
- My Documents listing, document details, rename, delete, and private access
- Purpose-based watermark generation with an editable recipient and text
- Opacity, rotation, size, and nine fixed position controls
- Natural-resolution PNG export for images
- Multi-page PDF watermarking and PDF export
- Responsive, keyboard-accessible interface

## How it works

```text
Register and confirm email
          ↓
Upload a private document
          ↓
Choose a purpose and recipient
          ↓
Customize and preview the watermark
          ↓
Download a new PNG or PDF copy
```

Supported purposes are Job Application, Bank Verification, Property Rental,
University Admission, Insurance, and Other.

## Privacy and security model

WatermarkMe treats uploaded documents as sensitive personal data.

- The `documents` Storage bucket is private.
- Database and Storage access are restricted to the authenticated owner.
- The frontend uses only the Supabase project URL and anon key.
- A Supabase `service_role` key must never be exposed to the browser.
- Original uploads use immutable object paths and are never overwritten.
- Signed URLs provide short-lived access to private originals.
- Generated watermarked files stay in browser memory and are downloaded locally.

The reproducible database and Storage security setup is defined in
[`supabase/migrations/20260809000100_phase_3_secure_data_layer.sql`](supabase/migrations/20260809000100_phase_3_secure_data_layer.sql).

## Technology

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase Auth, PostgreSQL, and Storage
- HTML Canvas API for image watermarking
- `pdf-lib` for browser-based PDF watermarking

## Run locally

Requirements:

- Node.js 20 or newer
- npm
- A hosted Supabase project

Clone and install the project:

```bash
git clone https://github.com/FrhnSpwli/watermark-me.git
cd watermark-me
npm install
```

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not place a service-role key or database password in frontend environment
variables.

Apply the Supabase migration by following
[`supabase/README.md`](supabase/README.md), then start the application:

```bash
npm run dev
```

The default Vite development URL is `http://localhost:5173` unless another
port is selected because it is already in use.

## Supabase Auth configuration

For local development, configure the Supabase dashboard with:

- Email confirmation enabled
- Site URL: `http://localhost:5173`
- Redirect URL: `http://localhost:5173/auth/confirm`

Add the equivalent production origin and `/auth/confirm` URL before deploying.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run strict TypeScript checks |
| `npm run build` | Create a production build |
| `npm run test:documents` | Validate document format and size rules |
| `npm run test:purpose` | Check the purpose-based workflow |
| `npm run test:watermark` | Check image watermark layout and rendering |
| `npm run test:pdf-watermark` | Check PDF watermark generation |

## Project structure

```text
src/
├── components/       Reusable UI and feature components
├── context/          Authentication context
├── hooks/            Reusable React hooks
├── lib/              Supabase and watermark rendering utilities
├── pages/            Route-level screens
├── services/         Authentication and document operations
├── types/            Shared TypeScript domain types
└── utils/            Formatting helpers

scripts/              Focused regression checks
supabase/migrations/  Reproducible schema, RLS, and Storage policies
```

## Project status

The Phase 1–9 MVP implementation and repository-level Phase 10 validation are
complete. Final live browser acceptance, full two-account operation checks,
and manual accessibility review remain documented in [`ROADMAP.md`](ROADMAP.md).

Password-protected PDFs are intentionally unsupported, and PDF export uses a
lightweight representative preview instead of bundling a full PDF renderer.

## Project documentation

- [`MVP_BUILD_SPEC.md`](MVP_BUILD_SPEC.md) — complete product and engineering specification
- [`ROADMAP.md`](ROADMAP.md) — implementation phases and validation status
- [`AGENTS.md`](AGENTS.md) — rules for coding agents working on the project
- [`supabase/README.md`](supabase/README.md) — database and Storage setup

---

Maintained by [FrhnSpwli](https://github.com/FrhnSpwli).
