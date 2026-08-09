import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const steps = [
  ['01', 'Upload a document'],
  ['02', 'Choose its purpose'],
  ['03', 'Add a watermark'],
  ['04', 'Download the copy'],
] as const

export function LandingPage() {
  const { loading, user } = useAuth()

  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
              Privacy-first document watermarking
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Protect your identity before sharing it.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Create purpose-specific watermarked copies of sensitive documents
              while keeping the originals unchanged.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {loading ? (
                <span
                  className="inline-flex rounded-xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500"
                  role="status"
                >
                  Checking session…
                </span>
              ) : user ? (
                <Link
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  to="/dashboard"
                >
                  Go to My Documents
                </Link>
              ) : (
                <>
                  <Link
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    to="/register"
                  >
                    Get started
                  </Link>
                  <Link
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    to="/login"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-500">
              Watermarked copies are generated locally in your browser. Your
              stored original remains unchanged.
            </p>
          </div>

          <div
            aria-label="Example of a purpose-specific watermark on a document"
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-8"
            role="img"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-12 flex flex-col gap-1 text-xs font-medium text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-all">IDENTITY-DOCUMENT.PDF</span>
                <span>ORIGINAL UNCHANGED</span>
              </div>
              <div className="rotate-[-8deg] border-y-2 border-indigo-200 bg-indigo-50/80 py-4 text-center font-bold tracking-[0.18em] text-indigo-700">
                ONLY FOR INTENDED RECIPIENT
              </div>
              <div className="mt-12 grid grid-cols-2 gap-3" aria-hidden="true">
                <div className="h-3 rounded bg-slate-100" />
                <div className="h-3 rounded bg-slate-100" />
                <div className="h-3 rounded bg-slate-100" />
                <div className="h-3 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">A safer copy in four steps</h2>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([number, label]) => (
            <li className="rounded-2xl border border-slate-200 bg-white p-5" key={number}>
              <span className="text-sm font-bold text-indigo-600">{number}</span>
              <p className="mt-8 font-semibold text-slate-900">{label}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-indigo-950">Designed around your original</h2>
          <p className="mt-2 max-w-3xl leading-7 text-indigo-900/80">
            WatermarkMe is designed to generate separate watermarked copies on
            demand. Your original document is never modified by the watermarking flow.
          </p>
        </div>
      </section>
    </>
  )
}
