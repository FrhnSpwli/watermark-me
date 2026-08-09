# WatermarkMe — MVP Build Specification

> **Tagline:** Protect your identity before sharing it.

WatermarkMe is a privacy-first web application that helps users securely store personal documents and generate purpose-specific watermarked copies before sharing them.

This repository should be implemented as an MVP using **React + TypeScript + Supabase**.

The primary goal is not to build every possible feature. The MVP should prove the core value of WatermarkMe:

> A user can securely upload a personal document, create a purpose-specific watermark, preview the result, download the watermarked copy, and keep the original document unchanged.

---

# 1. Instructions for the Coding Agent

Read this README completely before making changes.

When implementing the project:

- Build features incrementally.
- Do not over-engineer.
- Prefer simple, maintainable solutions.
- Use strict TypeScript.
- Keep UI components reusable.
- Keep business logic separated from presentation components.
- Never expose Supabase `service_role` keys in frontend code.
- All user-owned database records must be protected with Supabase Row Level Security.
- All uploaded documents must be stored in a **private** Supabase Storage bucket.
- The original uploaded document must never be modified or overwritten.
- Watermarked files should be generated as separate files.
- Use environment variables for Supabase credentials.
- Do not commit `.env` or `.env.local`.
- Prefer client-side watermark processing for the MVP.
- Avoid adding unnecessary dependencies.
- Run linting and build checks after significant changes.
- If tests are added, keep them focused on critical business logic.

Before implementing a major feature, inspect the existing codebase and reuse existing utilities/components where appropriate.

---

# 2. MVP Goal

The MVP is considered complete when a new user can:

1. Register an account.
2. Log in.
3. Upload a JPG, JPEG, PNG, or PDF document.
4. View their uploaded documents.
5. Open a document.
6. Choose a watermark purpose.
7. Enter the recipient or organization.
8. Customize basic watermark settings.
9. Preview the watermarked document.
10. Download the result.
11. Keep the original document untouched.
12. Access only their own documents.

A different authenticated user must not be able to view, query, update, delete, or download another user's documents.

---

# 3. MVP Scope

## Included

- Landing page
- Register
- Login
- Logout
- Protected dashboard
- My Documents page
- Document upload
- JPG/JPEG/PNG support
- PDF support
- Document preview
- Purpose-based watermark generation
- Custom watermark text
- Recipient/organization input
- Date in watermark
- Opacity adjustment
- Rotation adjustment
- Font size adjustment
- Basic position presets
- Watermark preview
- Download image as PNG
- Download PDF as PDF
- Private Supabase Storage
- Supabase Row Level Security
- Delete document
- Rename document
- Responsive UI

## Not Required for MVP

Do **not** implement these unless the MVP is already complete:

- Secure public share links
- Expiring links
- OCR
- AI document recognition
- Native mobile application
- Advanced audit logs
- QR code watermarking
- Logo watermarking
- Freeform drag-and-drop layer editor
- Collaboration
- Admin dashboard
- Analytics dashboard
- Billing/payment
- Social login
- Version history
- Multiple watermark layers

These are future features.

---

# 4. Recommended Tech Stack

## Frontend

- React
- TypeScript
- Vite
- React Router

## Styling

- Tailwind CSS
- shadcn/ui
- Lucide React

## Backend / Platform

- Supabase

Supabase will provide:

- PostgreSQL
- Authentication
- Storage
- Row Level Security

## Client Data Fetching

Recommended:

- TanStack Query

Simple Supabase calls are also acceptable if adding TanStack Query would unnecessarily slow down the MVP.

## Watermark Processing

### Images

Preferred starting option:

- HTML Canvas API

Fabric.js is optional and should only be added if the current requirements become difficult with native Canvas.

### PDFs

Recommended:

- `pdf-lib`

## Deployment

Recommended:

- Vercel

---

# 5. High-Level Architecture

```text
                         User
                           |
                           v
                    React Web App
                           |
             +-------------+-------------+
             |                           |
             v                           v
        Supabase                      Browser
   +--------+--------+                 |
   |        |        |                 |
  Auth   Database  Storage        Watermark Engine
                              Canvas API / pdf-lib
                                        |
                                        v
                                   Export File
```

For the MVP, watermark rendering should happen primarily in the browser.

The backend should not be required just to add a watermark.

---

# 6. Core User Flow

```text
Landing Page
      |
      v
Register / Login
      |
      v
Dashboard
      |
      v
Upload Document
      |
      v
My Documents
      |
      v
Open Document
      |
      v
Choose Purpose
      |
      v
Enter Recipient
      |
      v
Customize Watermark
      |
      v
Preview
      |
      v
Download
```

---

# 7. Suggested Routes

```text
/
 /login
 /register
 /dashboard
 /documents/:documentId
 /documents/:documentId/watermark
```

Optional:

```text
/profile
/settings
```

Do not add unnecessary routes for the MVP.

---

# 8. Suggested Project Structure

The final structure may evolve, but use a maintainable organization similar to:

```text
src/
|
+-- components/
|   +-- ui/
|   +-- layout/
|   +-- documents/
|   +-- watermark/
|
+-- pages/
|   +-- LandingPage.tsx
|   +-- LoginPage.tsx
|   +-- RegisterPage.tsx
|   +-- DashboardPage.tsx
|   +-- DocumentDetailPage.tsx
|   +-- WatermarkEditorPage.tsx
|
+-- hooks/
|
+-- lib/
|   +-- supabase.ts
|   +-- watermark/
|       +-- imageWatermark.ts
|       +-- pdfWatermark.ts
|
+-- services/
|   +-- auth.ts
|   +-- documents.ts
|
+-- types/
|
+-- utils/
|
+-- App.tsx
+-- main.tsx
```

Do not treat this structure as mandatory if the existing codebase already has a clean architecture.

---

# 9. Environment Configuration

Create:

```text
.env.local
```

Required variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Add an example file:

```text
.env.example
```

Example:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

in client-side code.

Make sure these are ignored by Git:

```text
.env
.env.local
.env.*.local
```

---

# 10. Supabase Setup

A hosted Supabase project should be used.

Local PostgreSQL, Laragon, XAMPP, and pgAdmin are **not required** for the MVP.

The React frontend communicates with Supabase using `@supabase/supabase-js`.

---

# 11. Authentication

For the MVP, authentication should use:

- Email
- Password

Required flows:

- Register
- Login
- Logout
- Persist authenticated session
- Protect private routes

Optional if easy:

- Email confirmation state
- Forgot password

Do not prioritize Google OAuth yet.

---

# 12. Database Design

Keep the MVP database intentionally small.

## 12.1 profiles

```text
profiles

id              uuid primary key
full_name       text
created_at      timestamptz
updated_at      timestamptz
```

Relationship:

```text
profiles.id -> auth.users.id
```

Recommended SQL concept:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 12.2 documents

```text
documents

id              uuid primary key
user_id         uuid
name            text
document_type   text
mime_type       text
file_size       bigint
storage_path    text
created_at      timestamptz
updated_at      timestamptz
```

Suggested SQL:

```sql
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  document_type text,
  mime_type text not null,
  file_size bigint not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add indexes where useful:

```sql
create index documents_user_id_idx
on public.documents(user_id);
```

---

# 13. Row Level Security

RLS is mandatory.

Enable RLS:

```sql
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
```

The conceptual rule is:

```text
authenticated user
        |
        v
user_id = auth.uid()
```

Users must only be allowed to operate on their own records.

Example policies for `documents`:

```sql
create policy "Users can view their documents"
on public.documents
for select
using (auth.uid() = user_id);

create policy "Users can insert their documents"
on public.documents
for insert
with check (auth.uid() = user_id);

create policy "Users can update their documents"
on public.documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their documents"
on public.documents
for delete
using (auth.uid() = user_id);
```

Equivalent ownership policies should exist for `profiles`.

The coding agent should verify policies against the current Supabase documentation and project behavior before assuming security is complete.

---

# 14. Supabase Storage

Create a **private** bucket:

```text
documents
```

Do not make sensitive documents publicly accessible.

Recommended file path:

```text
USER_ID/DOCUMENT_ID/original.ext
```

Example:

```text
84ad38b0-xxxx/
    72fb91a2-xxxx/
        original-ktp.jpg
```

The database stores only metadata and the storage path.

The binary file itself belongs in Supabase Storage.

---

# 15. Storage Security

Storage policies must ensure users can only access paths beginning with their own user ID.

Conceptually:

```text
documents/
    auth.uid()/
```

A user must not be able to:

- list another user's files
- download another user's files
- update another user's files
- delete another user's files

Do not rely only on frontend filtering.

Security must be enforced by Supabase policies.

---

# 16. Upload Requirements

Supported MVP formats:

```text
image/jpeg
image/png
application/pdf
```

Accepted extensions:

```text
.jpg
.jpeg
.png
.pdf
```

Recommended maximum size:

```text
10 MB
```

Upload flow:

```text
Select File
    |
    v
Validate Type
    |
    v
Validate Size
    |
    v
Create Document ID
    |
    v
Upload Original to Supabase Storage
    |
    v
Insert Document Metadata
    |
    v
Display in My Documents
```

If metadata insertion fails after upload, attempt cleanup of the uploaded file.

If upload fails, do not insert database metadata.

Provide understandable error messages.

---

# 17. My Documents Page

The dashboard should display the authenticated user's documents.

Each document card/list item should show at least:

- Document name
- File type
- Created date
- File size if appropriate

Actions:

- Open
- Add Watermark
- Rename
- Delete

Optional:

- Thumbnail preview for images
- Generic icon for PDFs

An empty state should guide the user to upload their first document.

---

# 18. Document Deletion

Deleting a document should remove:

1. Storage object
2. Database metadata

Do not leave orphaned sensitive files if avoidable.

Ask for confirmation before deleting.

Example message:

```text
Delete this document?

This will permanently delete the original file from your account.
```

---

# 19. Watermark Editor

This is the main product feature.

Suggested layout:

```text
+--------------------------------------------------------------+
| Back        Watermark Document                    Download   |
+--------------------------------+-----------------------------+
|                                |                             |
|                                | Purpose                     |
|        DOCUMENT PREVIEW        | [Job Application       v]   |
|                                |                             |
|     ONLY FOR PT EXAMPLE        | Recipient                   |
|         09 AUG 2026            | [PT Example             ]   |
|                                |                             |
|                                | Watermark Text              |
|                                | [ONLY FOR PT EXAMPLE    ]   |
|                                |                             |
|                                | Opacity                     |
|                                | --------O----------         |
|                                |                             |
|                                | Rotation                    |
|                                | --------O----------         |
|                                |                             |
|                                | Font Size                   |
|                                | --------O----------         |
|                                |                             |
|                                | Position                    |
|                                | [Center                 v]  |
|                                |                             |
+--------------------------------+-----------------------------+
```

Mobile layout should stack preview and controls vertically.

---

# 20. Purpose-Based Watermarks

WatermarkMe should provide basic predefined purposes.

MVP options:

```text
Job Application
Bank Verification
Property Rental
University Admission
Insurance
Other
```

A user selects a purpose and enters a recipient.

Example:

```text
Purpose:
Job Application

Recipient:
PT Example Indonesia
```

Generated default watermark:

```text
ONLY FOR
PT EXAMPLE INDONESIA
09 AUG 2026
```

The generated text must remain editable.

For `Other`, allow fully custom text.

---

# 21. Watermark Configuration

MVP controls:

- Watermark text
- Recipient
- Date
- Opacity
- Rotation
- Font size
- Position

Recommended position presets:

```text
Top Left       Top Center       Top Right
Center Left    Center           Center Right
Bottom Left    Bottom Center    Bottom Right
```

Suggested defaults:

```text
Opacity: 0.35
Rotation: -22 degrees
Position: Center
```

Do not implement advanced Photoshop-style editing for the MVP.

---

# 22. Image Watermarking

For JPG/JPEG/PNG documents, prefer browser-based processing using the HTML Canvas API.

Conceptual flow:

```text
Load Image
    |
    v
Draw Original onto Canvas
    |
    v
Draw Watermark Overlay
    |
    v
Preview Canvas
    |
    v
Export PNG
```

Important requirements:

- Maintain original aspect ratio.
- Avoid unnecessary quality degradation.
- Handle image orientation correctly where practical.
- Never overwrite the original uploaded file.
- Preview should closely match downloaded output.

---

# 23. PDF Watermarking

Use `pdf-lib` or an equivalent lightweight browser-compatible library.

Conceptual flow:

```text
Load PDF
   |
   v
Iterate Pages
   |
   v
Draw Watermark
   |
   v
Generate New PDF
   |
   v
Download
```

For the MVP:

- Apply the watermark to every page.
- Preserve the original PDF.
- Maintain readable document quality.
- Keep watermark position consistent.

If rendering a visual PDF preview becomes complex, prioritize correct PDF export and provide a practical preview solution without over-engineering.

---

# 24. Privacy-First Principle

The product is positioned as privacy-first.

Implementation decisions should reflect that.

Core principle:

```text
Original Document
       |
       +--------------------------+
       |                          |
       v                          v
   Stored Original          Watermark Processor
                                  |
                                  v
                          Generated Copy
```

The original file must never be overwritten.

Where reasonable, watermark processing should happen locally in the browser.

Do not upload temporary watermark previews unless required.

---

# 25. Export

Required:

```text
Image input -> PNG output
PDF input   -> PDF output
```

Suggested filenames:

```text
KTP_JOB_PT_EXAMPLE_20260809.png

Passport_BANK_BCA_20260809.pdf
```

Sanitize user-provided values before using them in filenames.

---

# 26. UI / UX Direction

WatermarkMe should feel:

- Clean
- Modern
- Trustworthy
- Privacy-focused
- Minimal
- Professional

Avoid:

- Excessive gradients
- Too many animations
- Dashboard clutter
- Overly colorful interfaces
- Complex interactions without user value

Recommended style:

```text
White / neutral background
Purple or indigo as primary accent
Rounded cards
Subtle borders
Clear typography
Comfortable spacing
```

Do not treat this visual guidance as a reason to hardcode inaccessible colors.

Maintain good contrast and accessibility.

---

# 27. Landing Page

Keep the MVP landing page simple.

Suggested sections:

## Hero

```text
Protect your identity before sharing it.

Add purpose-specific watermarks to sensitive documents
before sending them anywhere.

[Get Started]
```

## How It Works

```text
1. Upload document
2. Choose purpose
3. Add watermark
4. Download safely
```

## Privacy Message

Highlight:

- Original documents are never modified.
- Documents are private to the account.
- Watermarked copies are generated on demand.

Do not make unsupported security or encryption claims.

---

# 28. Dashboard Empty State

Example:

```text
Your documents

No documents yet.

Upload your first document to create a protected
watermarked copy.

[Upload Document]
```

---

# 29. Loading and Error States

Every important async action must have:

- loading state
- success state
- failure state

Examples:

```text
Uploading document...
Generating watermark...
Deleting document...
```

Avoid silent errors.

Use toast notifications where appropriate.

---

# 30. Security Requirements

These are mandatory.

## Never expose secrets

Frontend may use:

```text
Supabase URL
Supabase anon key
```

Frontend must never contain:

```text
service_role key
database password
private server credentials
```

## RLS

All user-owned database tables require RLS.

## Private storage

Documents must not use a public bucket.

## Ownership

Never trust a `user_id` coming from arbitrary UI state.

Use the authenticated Supabase user.

## File validation

Validate:

- MIME type
- extension where appropriate
- file size

Do not rely only on the HTML `accept` attribute.

## Dangerous rendering

Do not inject user text using unsafe HTML.

---

# 31. Accessibility

The MVP should include basic accessibility:

- Buttons have meaningful labels.
- Inputs use labels.
- Keyboard navigation works.
- Dialogs can be closed via keyboard.
- Focus states are visible.
- Sufficient contrast.
- Icon-only buttons have accessible names.

---

# 32. Responsive Design

The app should work on:

- Desktop
- Tablet
- Mobile

Primary development may target desktop first.

The watermark editor on mobile should use:

```text
Preview
   |
   v
Controls
```

instead of side-by-side layout.

---

# 33. Suggested Implementation Phases

The coding agent should implement the application incrementally.

---

## Phase 1 — Project Foundation

Tasks:

- Initialize React + TypeScript + Vite.
- Configure Tailwind.
- Configure shadcn/ui if used.
- Add React Router.
- Create basic layout.
- Add environment configuration.
- Add Supabase client.
- Add linting.

Expected result:

```text
Application starts successfully.
Basic routes render.
Supabase client can initialize.
```

---

## Phase 2 — Authentication

Tasks:

- Register page.
- Login page.
- Logout.
- Session persistence.
- Protected routes.
- Basic profile handling.

Expected result:

```text
User can create an account,
log in,
refresh the page,
remain authenticated,
and log out.
```

---

## Phase 3 — Database and Security

Tasks:

- Add profiles table.
- Add documents table.
- Enable RLS.
- Add ownership policies.
- Create private documents bucket.
- Configure storage policies.

Expected result:

```text
User A cannot access User B's records or files.
```

Security must be validated before continuing.

---

## Phase 4 — Document Upload

Tasks:

- Upload UI.
- Drag/drop optional.
- Validate format.
- Validate size.
- Upload to Storage.
- Insert metadata.
- Error handling.

Expected result:

```text
User can upload JPG, PNG, or PDF
and see it in My Documents.
```

---

## Phase 5 — Document Management

Tasks:

- Document list/grid.
- Document detail.
- Rename.
- Delete.
- Image preview.
- PDF representation.

Expected result:

```text
User can manage their own uploaded documents.
```

---

## Phase 6 — Image Watermarking

Tasks:

- Canvas watermark helper.
- Watermark text.
- Opacity.
- Rotation.
- Font size.
- Position.
- Preview.
- PNG export.

Expected result:

```text
User can watermark an image
and download the result.
```

---

## Phase 7 — PDF Watermarking

Tasks:

- Load PDF.
- Apply watermark to all pages.
- Export new PDF.
- Error handling.

Expected result:

```text
User can watermark a PDF
and download the watermarked PDF.
```

---

## Phase 8 — Purpose-Based Experience

Tasks:

- Purpose dropdown.
- Recipient input.
- Generated default watermark text.
- Editable text.
- Date generation.

Expected result:

```text
Purpose + recipient automatically creates
a useful watermark template.
```

---

## Phase 9 — UI Polish

Tasks:

- Responsive design.
- Empty states.
- Loading states.
- Error states.
- Toasts.
- Accessibility.
- Landing page refinement.

---

## Phase 10 — MVP Validation

Validate the full flow:

```text
Register
-> Login
-> Upload
-> View
-> Add Watermark
-> Preview
-> Download
-> Logout
```

Test with a second account.

Confirm that cross-account access fails.

---

# 34. Definition of Done

WatermarkMe MVP is complete when all of the following are true:

- [ ] React + TypeScript app builds successfully.
- [ ] Supabase connection works.
- [ ] User can register.
- [ ] User can log in.
- [ ] User can log out.
- [ ] Private routes are protected.
- [ ] User can upload JPG/JPEG.
- [ ] User can upload PNG.
- [ ] User can upload PDF.
- [ ] Invalid files are rejected.
- [ ] Large files are rejected.
- [ ] Uploaded files appear in My Documents.
- [ ] User can rename a document.
- [ ] User can delete a document.
- [ ] User can open a document.
- [ ] User can select a watermark purpose.
- [ ] User can enter a recipient.
- [ ] Default watermark text is generated.
- [ ] Watermark text can be edited.
- [ ] Opacity can be adjusted.
- [ ] Rotation can be adjusted.
- [ ] Font size can be adjusted.
- [ ] Position can be changed.
- [ ] Image watermark preview works.
- [ ] Watermarked image can be downloaded as PNG.
- [ ] PDF watermarking works.
- [ ] Watermarked PDF can be downloaded as PDF.
- [ ] Original files remain unchanged.
- [ ] Documents are stored in a private bucket.
- [ ] Database RLS is enabled.
- [ ] Storage ownership policies are enabled.
- [ ] User A cannot access User B's document metadata.
- [ ] User A cannot download User B's document file.
- [ ] UI works reasonably on mobile.
- [ ] No service role key exists in frontend code.
- [ ] `.env.local` is ignored by Git.
- [ ] Production build completes without errors.

---

# 35. Non-Goals

The coding agent should not spend MVP development time on:

```text
Microservices
Custom backend server
Docker orchestration
Redis
Message queues
GraphQL
Kubernetes
Complex caching
Custom authentication
AI services
OCR pipelines
Blockchain
Advanced encryption infrastructure
Native mobile apps
```

unless a concrete MVP blocker genuinely requires one.

---

# 36. Future Roadmap

After MVP is stable, possible WatermarkMe features include:

## Version History

Keep multiple purpose-specific copies of one original document.

```text
KTP Original

+-- Job Application — PT Example
+-- Bank Verification — BCA
+-- University Admission — University X
```

## Secure Sharing

Generate controlled links instead of manually sending files.

Potential features:

- expiration
- access limits
- revoke link

## Watermark Templates

Save frequently used watermark configurations.

## OCR

Recognize document types automatically.

## Sensitive Information Detection

Detect fields such as:

- identification numbers
- address
- date of birth

## Audit History

Track:

```text
Uploaded
Watermarked
Downloaded
Shared
Deleted
```

## Custom Watermark Layers

- Logo
- QR code
- Multiple text layers
- Repeated diagonal patterns

These features should not delay MVP delivery.

---

# 37. Product Principles

When deciding between implementations, prioritize in this order:

```text
1. Privacy
2. Security
3. Correctness
4. Simplicity
5. User experience
6. Maintainability
7. Visual polish
8. Extra features
```

---

# 38. Development Rules

The coding agent should follow these rules throughout the project.

## Rule 1 — Inspect Before Editing

Before making changes:

- inspect relevant existing files
- understand current structure
- avoid duplicating utilities

## Rule 2 — Small Logical Changes

Prefer:

```text
foundation
-> auth
-> upload
-> documents
-> watermark
```

instead of implementing the entire application in one uncontrolled change.

## Rule 3 — No Fake Functionality

Do not create buttons that appear functional but do nothing unless clearly marked as disabled or future functionality.

## Rule 4 — Preserve Originals

Never overwrite the source document.

## Rule 5 — Security Is Backend-Enforced

Frontend filtering is not authorization.

Supabase RLS and Storage policies are required.

## Rule 6 — Avoid Premature Abstraction

Do not create generalized systems before they are needed.

## Rule 7 — Keep Dependencies Small

Before installing a dependency, check whether the browser, React, Supabase, or an already-installed library can solve the problem cleanly.

---

# 39. Suggested First Coding Task

After reading this README, begin with **Phase 1 only**.

Do not attempt all phases at once.

The first task is:

```text
Initialize the WatermarkMe frontend foundation.

Requirements:
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase JS client
- clean project structure
- environment variable setup
- .env.example
- .gitignore configuration
- basic landing/login/register/dashboard route placeholders

Do not implement Supabase database tables or watermark processing yet.

After implementation:
1. run lint
2. run production build
3. report created files
4. report installed dependencies
5. report any manual setup still required
```

---

# 40. Manual Supabase Configuration Checklist

Some steps may require manual action in the Supabase dashboard.

Before authentication/data features are considered complete, confirm:

- [ ] Supabase project created.
- [ ] Project URL copied.
- [ ] Anon key copied.
- [ ] `.env.local` configured.
- [ ] Authentication email provider enabled.
- [ ] `profiles` table created.
- [ ] `documents` table created.
- [ ] RLS enabled.
- [ ] RLS policies created.
- [ ] Private `documents` storage bucket created.
- [ ] Storage policies created.

If these values are unavailable, the coding agent should implement everything possible locally and clearly report which manual Supabase steps remain.

---

# 41. Final MVP Experience

The final experience should feel approximately like this:

```text
User opens WatermarkMe
        |
        v
Creates account
        |
        v
Uploads KTP.pdf
        |
        v
Opens document
        |
        v
Selects:
Job Application
        |
        v
Enters:
PT Example Indonesia
        |
        v
WatermarkMe generates:

ONLY FOR
PT EXAMPLE INDONESIA
09 AUG 2026

        |
        v
User adjusts opacity / rotation
        |
        v
Preview updates
        |
        v
Download
        |
        v
KTP_JOB_PT_EXAMPLE_INDONESIA_20260809.pdf
```

The original:

```text
KTP.pdf
```

must remain untouched.

---

# 42. Product Summary

WatermarkMe is not primarily a file editor.

It is a **privacy workflow**.

The product should help users move from:

```text
"I need to send my ID."
```

to:

```text
"I can create a copy that clearly states
who this document is intended for."
```

with as little friction as possible.

For the MVP, success means doing this one workflow extremely well.
