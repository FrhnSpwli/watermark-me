import type { ReactNode } from 'react'
import { PageHeader } from '../ui/PageHeader'

interface AuthPageShellProps {
  title: string
  description: string
  children: ReactNode
}

export function AuthPageShell({ title, description, children }: AuthPageShellProps) {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16 lg:px-8">
      <div className="lg:sticky lg:top-10">
        <PageHeader description={description} eyebrow="Secure account" title={title} />
        <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-sm leading-6 text-indigo-950/75">
          Your password is handled by our authentication provider. WatermarkMe
          never stores it with your document data.
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </section>
  )
}
