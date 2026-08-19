# WatermarkMe Roadmap

## v0.1 — Privacy-First Watermarking MVP

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Project Foundation | ✅ Complete |
| 2 | Authentication | ✅ Complete |
| 3 | Database & Security | ✅ Complete |
| 4 | Document Upload | ✅ Complete |
| 5 | Document Management | ✅ Complete |
| 6 | Image Watermarking | ✅ Complete |
| 7 | PDF Watermarking | ✅ Complete |
| 8 | Purpose-Based Experience | ✅ Complete |
| 9 | UI Polish | ✅ Complete |
| 10 | MVP Validation | 🟡 Repository validation complete; final manual browser acceptance remains |

### v0.1 acceptance remaining

Manual acceptance should confirm the final browser workflow, representative responsive layouts, and the complete two-account metadata/Storage operation matrix before formally tagging v0.1 as acceptance-complete.

---

## v0.2 — Document Composer & Converter

**Active specification:** [`V0.2_DOCUMENT_COMPOSER.md`](V0.2_DOCUMENT_COMPOSER.md)

v0.2 expands WatermarkMe from a one-file-per-document workflow into a logical document model that can contain multiple source files and can be composed, reordered, selectively converted, and passed directly into watermarking without persisting intermediate generated files.

| Phase | Scope | Status |
| --- | --- | --- |
| 11 | Multi-file Architecture & Safe Migration | ✅ Phase 11 repository implementation complete; live Supabase validation remains manual |
| 12 | Multi-file Upload & Management | 🟡 Repository implementation complete; manual browser/Supabase acceptance remains |
| 13 | Document Composer: Selection, Preview & Reordering | Not Started |
| 14 | Conversion Engine | Not Started |
| 15 | Conversion Output UX | Not Started |
| 16 | Composer/Converter → Watermark Integration | Not Started |
| 17 | QA, Security & Performance | Not Started |

### Phase 11 — Multi-file Architecture & Safe Migration

Introduce the logical-document/source-file model without moving or breaking existing v0.1 originals. Add reproducible migration, RLS, safe backfill, service/type updates, and compatibility handling. No converter UI.

### Phase 12 — Multi-file Upload & Management

Allow multiple source files to belong to one logical document, while retaining the ability to upload files as separate documents. Support source ordering and source removal/addition with immutable originals. Repository implementation is complete; live browser and two-account acceptance remains outstanding.

### Phase 13 — Document Composer

Provide source/page selection, preview, and reordering. Images act as single composer items; PDFs expose selectable pages. Keep composition state local unless persistence is explicitly required.

### Phase 14 — Conversion Engine

Implement browser-side conversion for the v0.2 JPG/JPEG/PNG/PDF matrix, including image conversion, images-to-PDF, selected/reordered PDF pages, PDF pages to images, and mixed image/PDF-page composition to PDF where practical.

### Phase 15 — Conversion Output UX

Add clear output-format selection, conversion readiness, generated filenames, single-file downloads, and multi-output packaging (for example ZIP) when appropriate.

### Phase 16 — Converter → Watermark Integration

Allow generated in-memory conversion output to continue directly into WatermarkMe's existing watermark workflow without download-and-reupload and without persisting intermediate output by default.

### Phase 17 — QA, Security & Performance

Validate multi-source ownership, migration compatibility, conversion correctness, browser memory/resource cleanup, large-document behavior, responsive composer UX, lazy loading, and original preservation.

---

## Post-v0.2 candidates

Not committed to a phase yet:

- Version history / saved generated copies
- Secure and expiring share links
- Saved watermark/conversion presets
- OCR and document recognition
- Audit history
- Additional formats only after a clear product need

Do not implement these as part of v0.2 unless the roadmap is explicitly changed.
