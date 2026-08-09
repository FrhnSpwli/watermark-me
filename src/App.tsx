import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { GuestRoute } from './components/auth/GuestRoute'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { RouteLoadingScreen } from './components/ui/RouteLoadingScreen'
import { AuthConfirmPage } from './pages/AuthConfirmPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'

const DashboardPage = lazy(async () => {
  const page = await import('./pages/DashboardPage')
  return { default: page.DashboardPage }
})

const DocumentDetailPage = lazy(async () => {
  const page = await import('./pages/DocumentDetailPage')
  return { default: page.DocumentDetailPage }
})

const WatermarkEditorPage = lazy(async () => {
  const page = await import('./pages/WatermarkEditorPage')
  return { default: page.WatermarkEditorPage }
})

function SuspendedRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      {children}
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'auth/confirm', element: <AuthConfirmPage /> },
      {
        element: <GuestRoute />,
        children: [{ path: 'login', element: <LoginPage /> }],
      },
      { path: 'register', element: <RegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'dashboard',
            element: (
              <SuspendedRoute>
                <DashboardPage />
              </SuspendedRoute>
            ),
          },
          {
            path: 'documents/:documentId',
            element: (
              <SuspendedRoute>
                <DocumentDetailPage />
              </SuspendedRoute>
            ),
          },
          {
            path: 'documents/:documentId/watermark',
            element: (
              <SuspendedRoute>
                <WatermarkEditorPage />
              </SuspendedRoute>
            ),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
