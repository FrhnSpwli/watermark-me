import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoUrl from '../../public/assets/logo.png'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
    isActive
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
  ].join(' ')

export function AppLayout() {
  const navigate = useNavigate()
  const { initializationError, loading, signOut, user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)

  const metadataName = user?.user_metadata.full_name
  const displayName =
    typeof metadataName === 'string' && metadataName.trim()
      ? metadataName.trim()
      : (user?.email ?? 'WatermarkMe user')
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!isAccountOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountOpen(false)
        accountButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountOpen])

  const handleSignOut = async () => {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)
    setSignOutError(null)
    const error = await signOut()

    if (error) {
      setSignOutError(error)
      setIsSigningOut(false)
      return
    }

    setIsSigningOut(false)
    setIsAccountOpen(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <a
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
        href="#main-content"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <NavLink
            aria-label={user ? 'WatermarkMe My Documents' : 'WatermarkMe home'}
            className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
            to={user ? '/dashboard' : '/'}
          >
            <img
              alt=""
              aria-hidden="true"
              className="size-10 object-contain"
              src={logoUrl}
            />
            <span className="hidden sm:inline">WatermarkMe</span>
          </NavLink>

          <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1">
            {loading ? (
              <span className="px-3 py-2 text-sm text-slate-500" role="status">
                Checking session&hellip;
              </span>
            ) : user ? (
              <>
                <NavLink className={navLinkClass} to="/dashboard">
                  My Documents
                </NavLink>
                <div className="relative ml-1" ref={accountMenuRef}>
                  <button
                    aria-controls="account-menu"
                    aria-expanded={isAccountOpen}
                    aria-haspopup="true"
                    aria-label="Open account menu"
                    className="grid size-10 place-items-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    onClick={() => setIsAccountOpen((current) => !current)}
                    ref={accountButtonRef}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>

                  {isAccountOpen ? (
                    <div className="absolute right-0 top-12 z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" id="account-menu">
                      <div className="border-b border-slate-100 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Signed in as
                        </p>
                        <p className="mt-1 break-words text-sm font-bold text-slate-950">
                          {displayName}
                        </p>
                        {user.email && user.email !== displayName ? (
                          <p className="mt-1 break-all text-xs text-slate-500">
                            {user.email}
                          </p>
                        ) : null}
                      </div>
                      <div className="p-2">
                        <Link
                          className="flex w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                          onClick={() => setIsAccountOpen(false)}
                          to="/dashboard"
                        >
                          My Documents
                        </Link>
                        <button
                          className="mt-1 flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:text-red-300"
                          disabled={isSigningOut}
                          onClick={handleSignOut}
                          type="button"
                        >
                          {isSigningOut ? 'Logging out...' : 'Logout'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <NavLink className={navLinkClass} to="/login">
                  Login
                </NavLink>
                <NavLink
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  to="/register"
                >
                  Get Started
                </NavLink>
              </>
            )}
          </nav>
        </div>
        {signOutError ? (
          <div
            className="mx-auto w-full max-w-6xl px-4 pb-3 text-sm text-red-700 sm:px-6 lg:px-8"
            role="alert"
          >
            {signOutError}
          </div>
        ) : null}
        {initializationError ? (
          <div
            className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900"
            role="alert"
          >
            {initializationError}
          </div>
        ) : null}
      </header>

      <main className="flex-1 focus:outline-none" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.7fr_1fr]">
            <div className="max-w-sm">
              <Link
                className="inline-flex items-center gap-2 rounded-md font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400"
                to={user ? '/dashboard' : '/'}
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-10 object-contain"
                  src={logoUrl}
                />
                WatermarkMe
              </Link>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Create purpose-specific copies of sensitive documents before
                sharing them with another person or organization.
              </p>
            </div>

            <nav aria-label="Footer navigation">
              <h2 className="text-sm font-bold text-white">Explore</h2>
              <div className="mt-4 flex flex-col items-start gap-3 text-sm">
                <Link className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400" to="/">
                  Home
                </Link>
                {user ? (
                  <Link className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400" to="/dashboard">
                    My Documents
                  </Link>
                ) : (
                  <>
                    <Link className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400" to="/register">
                      Get Started
                    </Link>
                    <Link className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400" to="/login">
                      Log in
                    </Link>
                  </>
                )}
              </div>
            </nav>

            <div>
              <h2 className="text-sm font-bold text-white">Privacy by design</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li>Private account storage</li>
                <li>Local watermark processing</li>
                <li>Original files remain unchanged</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {currentYear} WatermarkMe</p>
            <p>Built with React, TypeScript, and Supabase.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
