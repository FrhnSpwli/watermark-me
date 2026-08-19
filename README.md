<div align="center">
  <img src="src/public/assets/logo.png" alt="WatermarkMe logo" width="112" />
  <h1>WatermarkMe</h1>
  <p><strong>Protect your identity before sharing it.</strong></p>
  <p>
    A privacy-first web application for preparing, composing, converting, and
    watermarking sensitive documents before sharing them.
  </p>
</div>

## About

WatermarkMe helps users prepare safer copies of identity and supporting documents before sending them to a company, bank, university, landlord, insurer, or another recipient.

The v0.1 workflow lets users upload a private original, choose why it is being shared, customize a watermark, and download a separate watermarked copy. Original stored documents are never overwritten. Image and PDF watermarking run locally in the browser, and generated copies are downloaded directly without being uploaded back to Supabase.

The next planned milestone, **v0.2 — Document Composer & Converter**, expands a document from a single physical file into a logical document that can contain multiple private source files. This enables use cases such as a front/back identity card, page selection from PDFs, source/page reordering, and local conversion between supported image/PDF formats.

Phase 11 introduces a backward-compatible `document_files` relation that backfills each legacy v0.1 document into exactly one source record while keeping storage paths, metadata, and ownership semantics intact.

## v0.1 capabilities

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

## Planned v0.2 capabilities

The active v0.2 plan is documented in [`V0.2_DOCUMENT_COMPOSER.md`](V0.2_DOCUMENT_COMPOSER.md).

Planned scope includes:

- Logical documents containing one or more source files
- Multiple-image documents such as KTP front/back
- Safe migration/backfill for existing v0.1 documents
- Source-file ordering and management
- PDF page selection and reordering
- Document Composer preview
- JPG/JPEG/PNG/PDF conversion workflows
- Multiple images to PDF
- Selected/reordered PDF pages to PDF
- PDF pages to PNG/JPG
- Mixed image + selected PDF pages to PDF where practical
- Direct converter-to-watermark handoff using in-memory generated data

Formats outside JPG/JPEG/PNG/PDF are intentionally out of scope for v0.2 unless the roadmap is explicitly changed.

## Core privacy model

WatermarkMe treats uploaded documents as sensitive personal data.

- Supabase Storage remains private.
- Database and Storage access are restricted to the authenticated owner.
- The frontend uses only the Supabase project URL and anon key.
- A Supabase `service_role` key must never be exposed to the browser.
- Original uploads are immutable and are never overwritten.
- Existing v0.1 Storage objects must not be moved merely to adopt the v0.2 data model.
- Signed URLs provide short-lived access to private originals.
- Watermarking runs in the browser.
- v0.2 composition/conversion should also run locally where practical.
- Generated and intermediate files are not uploaded to Supabase by default.

The existing reproducible database and Storage security setup is defined in [`supabase/migrations/20260809000100_phase_3_secure_data_layer.sql`](supabase/migrations/20260809000100_phase_3_secure_data_layer.sql). v0.2 database changes must be introduced through new migrations rather than editing applied migrations.

## Current and target document model

### v0.1

```text
Document
└── one original Storage object
```

### v0.2 target

```text
Logical Document
├── Source File 1
├── Source File 2
└── Source File N
```

Example:

```text
KTP
├── KTP Front.jpg
└── KTP Back.jpg
```

Existing v0.1 originals remain valid and are backfilled into the new source-file relation during the Phase 11 migration. They should not be physically moved.

## How v0.1 works

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

Supported purposes are Job Application, Bank Verification, Property Rental, University Admission, Insurance, and Other.

## v0.2 target workflow

```text
Upload one or more private source files
          ↓
Select / reorder files or PDF pages
          ↓
Choose output format
          ↓
Compose / convert locally
          ↓
Download
       or
Continue directly to watermark
          ↓
Download final protected copy
```

Intermediate converted output should stay in browser memory unless a later feature explicitly introduces saved generated versions.

## Technology

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase Auth, PostgreSQL, and Storage
- HTML Canvas API for image watermarking
- `pdf-lib` for browser-based PDF watermarking/manipulation

Additional v0.2 dependencies should be introduced only when needed. Heavy PDF preview/rendering code should be lazy-loaded when practical.

## Run locally

Requirements:

- Node.js 20 or newer
- npm
- A hosted Supabase project

Clone and install:

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

Do not place a service-role key or database password in frontend environment variables.

Apply required Supabase migrations by following [`supabase/README.md`](supabase/README.md), then start the application:

```bash
npm run dev
```

The default Vite development URL is `http://localhost:5173` unless another port is selected because it is already in use.

## Supabase Auth configuration

For local development:

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
| `npm run test:phase11` | Check Phase 11 legacy-source compatibility |
| `npm run test:purpose` | Check the purpose-based workflow |
| `npm run test:watermark` | Check image watermark layout and rendering |
| `npm run test:pdf-watermark` | Check PDF watermark generation |

## Project structure

```text
src/
├── components/       Reusable UI and feature components
├── context/          Authentication context
├── hooks/            Reusable React hooks
├── lib/              Supabase and document/watermark utilities
├── pages/            Route-level screens
├── services/         Authentication and document operations
├── types/            Shared TypeScript domain types
└── utils/            Formatting helpers

scripts/              Focused regression checks
supabase/migrations/  Reproducible schema, RLS, and Storage policies
```

## Project status

v0.1 implementation through Phase 9 and repository-level Phase 10 validation are complete. Final live browser acceptance remains documented in [`ROADMAP.md`](ROADMAP.md).

The next development phase is:

```text
Phase 11 — Multi-file Architecture & Safe Migration
```

Do not begin converter UI implementation before the Phase 11 logical-document/source-file architecture and migration are complete.

## Project documentation

- [`README.md`](README.md) — current project overview
- [`ROADMAP.md`](ROADMAP.md) — active phase and status
- [`V0.1_MVP_BUILD_SPEC.md`](V0.1_MVP_BUILD_SPEC.md) — historical v0.1 product/engineering specification
- [`V0.2_DOCUMENT_COMPOSER.md`](V0.2_DOCUMENT_COMPOSER.md) — active v0.2 architecture and implementation plan
- [`AGENTS.md`](AGENTS.md) — rules for coding agents working on the repository
- [`supabase/README.md`](supabase/README.md) — database and Storage setup

---

Maintained by [FrhnSpwli](https://github.com/FrhnSpwli).
