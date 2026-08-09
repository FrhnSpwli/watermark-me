# WatermarkMe Development Roadmap

## Phase 1 — Foundation
Status: Complete

- [x] Initialize React + Vite
- [x] TypeScript
- [x] Tailwind
- [x] React Router
- [x] Supabase client
- [x] Environment configuration

## Phase 2 — Authentication
Status: Complete (Manually Validated)

- [x] Register
- [x] Login
- [x] Logout
- [x] Session persistence
- [x] Protected routes

## Phase 3 — Supabase
Status: Complete (Applied and Cross-Account Isolation Validated)

- [x] profiles table
- [x] documents table
- [x] RLS
- [x] private storage
- [x] storage policies

## Phase 4 — Document Upload
Status: Complete (Upload and Cross-Account Isolation Manually Validated)

- [x] Upload UI
- [x] File format and size validation
- [x] Private Storage upload
- [x] Document metadata insert
- [x] Upload rollback and error handling

## Phase 5 — Document Management
Status: Complete

- [x] Document list/grid
- [x] Document detail
- [x] Rename
- [x] Delete
- [x] Private original access
- [x] PDF representation

## Phase 6 — Image Watermarking
Status: Implementation Complete (Live Visual Review Pending)

- [x] Canvas watermark helper
- [x] Watermark text
- [x] Purpose and recipient configuration
- [x] Opacity
- [x] Rotation
- [x] Watermark size
- [x] Position
- [x] Live image preview
- [x] Natural-resolution PNG export

### Phase 6.1 — Watermark Visual Refinement
Status: Implementation Complete (Live Visual Review Pending)

- [x] Purpose text hierarchy
- [x] Responsive recipient wrapping
- [x] Refined typography and line spacing
- [x] Indigo fill and subtle outline
- [x] Custom multiline fallback
- [x] Focused renderer regression checks

### Phase 6.2 — Watermark Position Preset Refinement
Status: Implementation Complete (Live Visual Review Pending)

- [x] Typed 3 × 3 position model
- [x] Accessible visual position selector
- [x] Responsive safe margins
- [x] Rotation-aware edge placement
- [x] Long-recipient edge regression checks
- [x] Independent position and rotation controls

## Phase 7 — PDF Watermarking
Status: Implementation Complete (Live Browser Validation Pending)

- [x] Load private PDF in the browser
- [x] Apply watermark to all pages
- [x] Per-page size, orientation, safe-margin, and rotated-bound layout
- [x] Reuse shared watermark configuration and controls
- [x] Lightweight PDF configuration preview
- [x] Export a new local PDF
- [x] User-friendly PDF error handling
- [x] Focused multi-page and renderer regression checks
- [ ] Live browser validation with a private Supabase PDF

## Phase 8 — Purpose-Based Experience
Status: Implementation Complete (Live Browser UX Validation Pending)

- [x] Canonical typed purpose configuration
- [x] Purpose meaning and recipient examples
- [x] Required recipient validation for predefined purposes
- [x] Optional recipient and custom multiline text for Other
- [x] Predictable generated/manual text state
- [x] Reset to generated text
- [x] Stable editor-session date
- [x] Shared image/PDF semantic configuration
- [x] Download readiness feedback and validation
- [x] Focused purpose workflow regression checks
- [ ] Live browser UX validation for image and PDF workflows

## Phase 9 — UI Polish
Status: Implementation Complete (Live Visual and Accessibility Review Pending)

- [x] Product-wide visual consistency audit
- [x] Navigation and mobile header refinement
- [x] Landing and authentication refinement
- [x] Dashboard, document card, upload, and detail hierarchy
- [x] Image/PDF watermark editor polish
- [x] Responsive layout static review and targeted fixes
- [x] Shared loading and inline feedback treatment
- [x] Practical keyboard, focus, form-error, and reduced-motion pass
- [x] Authenticated route lazy loading
- [ ] Live browser review at target breakpoints
- [ ] Manual assistive-technology review

## Phase 10 — MVP Validation
Status: Repository Validation Complete (Manual Browser Acceptance Pending)

- [x] Audit authentication, routes, document lifecycle, and error-state code paths
- [x] Validate upload format, MIME/extension, empty-file, and 10 MB rules
- [x] Run purpose, image watermark, and PDF watermark regression checks
- [x] Confirm watermark generation has no Storage or database mutation path
- [x] Review RLS, private bucket, ownership policies, and frontend credential usage
- [x] Run lint, strict TypeScript, production build, and dependency security audit
- [ ] Validate the complete MVP flow in a live browser
- [ ] Repeat complete-flow validation with a second account
- [ ] Reconfirm the full cross-account metadata and Storage operation matrix
- [ ] Complete live responsive and assistive-technology review
