import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'

export function NotFoundPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader
        description="The page you requested does not exist."
        eyebrow="404"
        title="Page not found"
      />
      <Link
        className="mt-8 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        to="/"
      >
        Return home
      </Link>
    </section>
  )
}
