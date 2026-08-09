interface PageHeaderProps {
  eyebrow?: string
  title: string
  description: string
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="max-w-2xl">
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="break-words text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
        {description}
      </p>
    </header>
  )
}
