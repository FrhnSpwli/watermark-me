# WatermarkMe

**Privacy-first document watermarking**

**Protect your identity before sharing it.**

WatermarkMe helps you create purpose-specific copies of sensitive documents. Compose images and selected PDF pages, convert them into the format you need, apply a watermark, and download the result while keeping every stored original unchanged.

<!--
PRODUCT SCREENSHOT: DASHBOARD / PRODUCT OVERVIEW

Recommended capture:
- authenticated dashboard
- several documents visible
- clean desktop viewport
- avoid DevTools/browser clutter

Suggested future path:
docs/screenshots/dashboard.png

Insert later with:
![WatermarkMe dashboard](docs/screenshots/dashboard.png)
-->

## Built for safer sharing

### Privacy-first

Stored originals remain in private, owner-scoped Storage. Generated conversion and watermark outputs stay local to your browser.

### Originals stay untouched

Composer, conversion, and watermarking produce separate output. They never overwrite the source document you uploaded.

### Compose before sharing

Combine images and selected PDF pages, leave out unnecessary content, and control the final order before creating a copy.

### One continuous workflow

Move from **Compose → Convert → Watermark → Download** without downloading and re-uploading an intermediate converted file.

## Why WatermarkMe?

Identity and supporting documents are often shared for one specific purpose: a job application, bank verification, property rental, university admission, insurance, or another administrative request.

A generic copy does not explain why it was shared or who should use it. WatermarkMe helps make the intended use of a shared copy explicit by placing purpose, recipient, and date information on a separately generated file while preserving the original.

## How it works

1. **Upload a document** — keep one or more source files in a private logical document.
2. **Compose what you need** — select images or PDF pages and put them in the right order.
3. **Choose an output format** — generate PDF, PNG, or JPEG output in the browser.
4. **Add a purpose-specific watermark** — choose the purpose and recipient, then adjust its appearance.
5. **Download the generated copy** — save one file or a controlled ZIP for multiple outputs.

Composer and conversion are optional. A document with one persisted image or PDF source can open directly in the Watermark Editor.

```text
Private original (private Supabase Storage)
                    |
                    v
             Composer (optional)
                    |
                    v
          Convert in browser memory
              /             \
             v               v
         Download         Watermark
                              |
                              v
                           Download
```

Generated files leave browser memory only when you explicitly download them; they are not uploaded back to Supabase.

## Key features

### Secure document management

- Email/password authentication with confirmed-email access and protected routes
- Private source storage and owner-scoped document metadata
- Logical documents containing one or many source files
- Separate or combined multi-file uploads
- Add, remove, and reorder persisted sources
- Rename and delete documents with explicit confirmation
- Backward compatibility for legacy single-source documents and Storage paths

### Document Composer

- Multiple images and independently selectable PDF pages
- Lazy PDF thumbnails and an active content preview
- Select or deselect individual items
- One ordered selection across images and pages from multiple sources
- Drag reordering plus keyboard-accessible **Move earlier** and **Move later** controls
- Mixed image and PDF-page composition for PDF output
- Session-local composition that does not rewrite persisted source order

### Conversion

- PDF, PNG, and JPEG output derived from the current selection
- Combined PDF or ordered multi-image output
- Individual multi-output downloads and one **Download all as ZIP** action
- Progress reporting, cancellation, retry, and stale-result protection
- Same-format PNG/JPEG pass-through where re-encoding is unnecessary
- Deterministic filenames and collision-safe ZIP contents

### Watermarking

- Six purpose presets: Job Application, Bank Verification, Property Rental, University Admission, Insurance, and Other
- Recipient or organization, editable watermark text, and an automatically included session date
- Opacity, rotation, relative size, and nine fixed positions
- Image and multi-page PDF preview and generation
- Shared-settings batch watermarking for generated image sets
- One ZIP download for a completed watermarked image batch

### Privacy safeguards

- Immutable-original workflow
- Browser-local generated and intermediate output
- Private Supabase Storage with temporary authorized source access
- PostgreSQL Row Level Security for owner isolation
- No frontend service-role credential
- No generated conversion or watermark upload

## Document Composer

Real documents are not always one file. An identity card may have a front and back, a supporting packet may contain several images, and a PDF may include pages that should not be shared.

The Composer turns each image and each PDF page into a selectable item. You can prepare examples such as:

- the front and back of an identity card;
- several supporting-document images;
- only selected pages from a PDF; or
- an image followed by selected PDF pages in one ordered document.

The order exists only for the current Composer session. Reordering or deselecting Composer items does not modify `document_files.sort_order`, the stored source files, or their metadata.

<!--
PRODUCT SCREENSHOT: DOCUMENT COMPOSER

Recommended capture:
- document with multiple sources
- ideally image + multi-page PDF
- several selected items
- visible preview
- visible selected order
- demonstrate reordered content

Suggested future path:
docs/screenshots/document-composer.png

Insert later with:
![WatermarkMe Document Composer](docs/screenshots/document-composer.png)
-->

## Convert to the format you need

Conversion follows the exact current Composer selection and order.

| Selection | PDF | PNG | JPEG |
| --- | --- | --- | --- |
| Single image | ✅ | ✅ | ✅ |
| Multiple images | ✅ Combined PDF | ✅ Multiple files | ✅ Multiple files |
| Selected PDF pages | ✅ | ✅ Multiple files | ✅ Multiple files |
| Images + PDF pages | ✅ | — | — |

For PNG or JPEG multi-output, each artifact has its own download action and **Download all as ZIP** creates one archive through a single user action. PNG → PNG and JPEG → JPEG items pass through unchanged when possible, so a mixed image batch only re-encodes mismatched formats. Transparent PNG content converted to JPEG is composited onto a white background with a visible lossy/alpha warning.

Mixed image and PDF-page selections intentionally remain PDF-only. Selected PDF pages are copied natively into PDF output, while PDF → PNG/JPEG uses browser-side PDF.js rasterization.

<!--
PRODUCT SCREENSHOT: CONVERSION RESULT

Recommended capture:
- two selected images converted to PNG or JPEG
- result shows multiple generated files
- individual Download buttons visible
- Download All / ZIP visible
- Continue to Watermark visible

Suggested future path:
docs/screenshots/conversion-result.png

Insert later with:
![WatermarkMe conversion result](docs/screenshots/conversion-result.png)
-->

## Purpose-specific watermarking

Choose one of the built-in purposes, identify the recipient or organization, and refine the generated text. The current session date is included automatically. Appearance controls cover opacity, rotation, relative size, and nine positions, with a preview before generation.

Converted output can continue directly into the Watermark Editor through an authenticated, session-owned in-memory handoff—no intermediate download or re-upload is needed.

- **Multiple generated images:** one shared watermark configuration is applied to every artifact in order, and the completed files download together as one ZIP.
- **Generated PDF:** the PDF remains a PDF and uses the native PDF watermark path rather than being converted into page images.
- **Persisted single source:** images and PDFs can still enter watermarking directly without Composer.

<!--
PRODUCT SCREENSHOT: WATERMARK EDITOR

Recommended capture:
- visible document preview
- purpose selector
- recipient
- watermark controls
- visible watermark on preview
- if possible use a multi-image generated result so Previous/Next or
  batch state is visible

Suggested future path:
docs/screenshots/watermark-editor.png

Insert later with:
![WatermarkMe Watermark Editor](docs/screenshots/watermark-editor.png)
-->

## Privacy by design

WatermarkMe separates persisted private originals from temporary generated output:

| Data | Location | Lifecycle |
| --- | --- | --- |
| Original source files | Private Supabase Storage | Persist until the owner removes the source or document |
| Document/source metadata | Supabase PostgreSQL with RLS | Persist for the authenticated owner |
| Generated conversion output | Browser memory | Session-local; cleared when invalidated or the session is lost |
| Generated watermark output | Browser memory | Available for explicit local download; not uploaded |

Confirmed architectural invariants:

- Composer, conversion, and watermarking never overwrite an original.
- Generated output is not uploaded to Supabase Database or Storage.
- The `documents` bucket is private.
- Database and Storage policies enforce authenticated-owner isolation.
- The frontend uses only the Supabase project URL and anon key—never a `service_role` key.
- Stored originals are loaded through temporary authorized access when browser processing needs them.
- Converter → Watermark handoff keeps generated `Blob` artifacts in JavaScript memory and passes only an opaque identifier through navigation state.
- Refresh or an authenticated-user change intentionally expires the temporary handoff instead of falling back to a stored original.

Generated conversion and watermark outputs stay local to your browser. Stored originals may be uploaded to private Supabase Storage, so WatermarkMe does not claim that uploaded source files never leave the device.

## Supported files

| Type | Input | Generated output |
| --- | --- | --- |
| JPEG | ✅ | ✅ |
| PNG | ✅ | ✅ |
| PDF | ✅ | ✅ |
| ZIP | — | Multi-file download only |

Each uploaded source must be non-empty and no larger than **10 MiB**. ZIP is a download package, not an upload or Composer source format.

## Architecture

### Frontend

- React 19, TypeScript, and React Router
- Vite 8 and Tailwind CSS 4

### Platform

- Supabase Auth
- PostgreSQL with Row Level Security
- Private Supabase Storage

### Browser processing

- Canvas for image conversion and watermark rendering
- `pdf-lib` for PDF composition and watermark generation
- Lazy-loaded `pdfjs-dist` for PDF previews and page rasterization
- Lazy-loaded JSZip for controlled multi-file downloads

```text
React client
|
+-- Authentication
|      +-- Supabase Auth
|
+-- Persisted documents
|      +-- PostgreSQL + RLS
|      +-- Private Storage
|
+-- Browser processing
       +-- Composer
       +-- Conversion
       +-- Watermark
       +-- Explicit download
```

Generated artifacts flow through the browser-processing branch only; they do not flow back into persisted documents.

## Technical highlights

- **Multi-source logical documents:** a compatibility layer expands the original one-file model without moving legacy Storage objects.
- **Source-scoped PDF page identity:** Composer items keep page identity stable across multiple PDFs, selection changes, and arbitrary ordering.
- **Native mixed composition:** selected PDF pages are copied directly while images receive purpose-built PDF pages, preserving the requested mixed order.
- **Ordered multi-artifact output:** every image artifact remains traceable to its Composer item, with deterministic, collision-safe names.
- **In-memory workflow handoff:** conversion results become the authoritative Watermark Editor input without `localStorage`, IndexedDB, or Supabase persistence.
- **Owner-enforced data isolation:** RLS and private Storage policies protect both logical documents and source files beyond frontend filtering.
- **Cancellation and cleanup:** source reads, previews, conversion, and watermark generation observe cancellation; temporary URLs and PDF resources are released.
- **Regression-oriented release hardening:** focused scripts exercise legacy compatibility, conversion order, stale results, ZIP safety, handoff ownership, and watermark rendering.

## Getting started

### Requirements

- Node.js `^20.19.0` or `>=22.12.0` (the supported range for the installed Vite version)
- npm
- A hosted Supabase project

### Clone

```bash
git clone https://github.com/FrhnSpwli/watermark-me.git
cd watermark-me
```

### Install

```bash
npm install
```

### Environment

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Use the project URL and anon key from your Supabase project. Do not add a service-role key or database password to frontend environment variables.

### Database and Storage

Apply the SQL files in [`supabase/migrations`](supabase/migrations) in timestamp order through the Supabase SQL Editor. The repository is not currently linked to a Supabase CLI project. Follow [`supabase/README.md`](supabase/README.md) for the migration order, private bucket expectations, and post-migration checks.

For local authentication, enable email confirmation and configure:

- Site URL: `http://localhost:5173`
- Redirect URL: `http://localhost:5173/auth/confirm`

Add the equivalent production origin and `/auth/confirm` redirect before deployment.

### Development

```bash
npm run dev
```

Vite uses `http://localhost:5173` by default unless that port is unavailable.

### Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --audit-level=high
```

## Project status

**WatermarkMe v0.2 — Document Composer & Converter**

- ✅ Implemented
- ✅ Manual acceptance complete
- ✅ Release hardening complete

Release highlights include multi-source private documents, image/PDF composition, browser-local conversion, controlled multi-file output, purpose-specific watermarking, and direct in-memory conversion → watermark handoff.

See [`ROADMAP.md`](ROADMAP.md) for development chronology. The active v0.2 architecture and behavior are documented in [`V0.2_DOCUMENT_COMPOSER.md`](V0.2_DOCUMENT_COMPOSER.md).

## Documentation

| Document | Description |
| --- | --- |
| [`MVP_BUILD_SPEC.md`](MVP_BUILD_SPEC.md) | Original v0.1 MVP specification |
| [`V0.2_DOCUMENT_COMPOSER.md`](V0.2_DOCUMENT_COMPOSER.md) | v0.2 as-built Composer & Converter specification |
| [`ROADMAP.md`](ROADMAP.md) | Development roadmap and phase history |
| [`PHASE17_RELEASE_ACCEPTANCE.md`](PHASE17_RELEASE_ACCEPTANCE.md) | Release QA, security, privacy, and browser acceptance runbook |

## Release snapshot

At the v0.2 release checkpoint:

- **577 regression checks** passing
- Production build passing
- **0 high-severity npm audit vulnerabilities**

## Roadmap

WatermarkMe v0.2 is complete. Future work is intentionally not committed to a new release scope; see [`ROADMAP.md`](ROADMAP.md) for documented candidates and project history.

---

Maintained by [FrhnSpwli](https://github.com/FrhnSpwli).
