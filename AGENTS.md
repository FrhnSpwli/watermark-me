# AGENTS.md

## Project

WatermarkMe is a privacy-first document watermarking web application.

Read README.md before implementing any feature.

## Role

Act as a senior full-stack engineer working on a privacy-sensitive
React + Supabase application.

Prioritize:
1. Security
2. Correctness
3. Simplicity
4. Maintainability
5. UX

## Development Rules

- Use React + TypeScript.
- Use strict TypeScript.
- Use Supabase for Auth, PostgreSQL, and Storage.
- Never expose the Supabase service_role key.
- Never disable RLS to fix an authorization issue.
- All user-owned data must be protected using RLS.
- Documents must use private Supabase Storage.
- Never overwrite original uploaded documents.
- Watermark processing should happen client-side where practical.
- Do not add a custom backend unless required.
- Do not introduce unnecessary dependencies.
- Reuse existing components and utilities.
- Do not create fake placeholder functionality.

## Before Coding

Before modifying code:

1. Read README.md.
2. Inspect the existing implementation.
3. Identify reusable components.
4. Check existing dependencies.
5. Understand the current database schema.

Do not assume something is missing before checking.

## Scope Control

Only implement the phase requested by the user.

Do not automatically implement later roadmap features.

For example, if asked to implement authentication,
do not also implement document sharing or OCR.

## Supabase

Never put these in frontend code:

- service_role key
- database password
- private credentials

Frontend may only use:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

All tables containing user-owned information must use RLS.

## Document Safety

Original files are immutable.

Flow:

Original
→ Generate Watermarked Copy
→ Download

Never:

Original
→ Modify Original

## Code Quality

Prefer:

- small components
- clear naming
- simple functions
- reusable hooks where appropriate
- separated business logic

Avoid:

- giant components
- premature abstraction
- unnecessary state management libraries
- duplicated code

## Validation

After meaningful changes:

1. Run lint.
2. Run TypeScript checks if configured.
3. Run tests if available.
4. Run production build.

Fix failures before marking the task complete.

## Completing a Task

At the end of each task, report:

- What was implemented
- Files created
- Files modified
- Dependencies added
- Database changes
- Manual steps required
- Tests/checks executed
- Remaining known issues

Do not continue to the next phase unless asked.