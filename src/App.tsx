import { lazy, Suspense, useState, type FormEvent } from "react"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom"
import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form"
import { ThemeToggle } from "@/components/theme-toggle"
import ForgotPasswordPage from "@/pages/forgot-password-page"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/lib/auth"
import { useAuth } from "@/lib/use-auth"
import type { UserCreate } from "@/lib/api-types"
import { ThemeProvider } from "next-themes"

const DashboardPage = lazy(() => import("@/pages/dashboard-page"))

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado."
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

function LoginPage() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const form = new FormData(event.currentTarget)

    try {
      await signIn(
        String(form.get("username") ?? "").trim(),
        String(form.get("password") ?? ""),
      )
      navigate("/dashboard", { replace: true })
    } catch (loginError) {
      setError(getErrorMessage(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (user) return <Navigate to="/dashboard" replace />

  return (
    <AuthLayout>
      <LoginForm
        onSubmit={handleSubmit}
        error={error}
        isSubmitting={isSubmitting}
      />
    </AuthLayout>
  )
}

function SignupPage() {
  const { signUp, user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password !== String(form.get("confirm-password") ?? "")) {
      setError("Las contraseñas no coinciden.")
      setIsSubmitting(false)
      return
    }

    const newUser: UserCreate = {
      name: String(form.get("name") ?? "").trim(),
      last_name: String(form.get("last_name") ?? "").trim(),
      username: String(form.get("username") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password,
    }

    try {
      await signUp(newUser)
      navigate("/dashboard", { replace: true })
    } catch (signupError) {
      setError(getErrorMessage(signupError))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (user) return <Navigate to="/dashboard" replace />

  return (
    <AuthLayout>
      <SignupForm
        onSubmit={handleSubmit}
        error={error}
        isSubmitting={isSubmitting}
      />
    </AuthLayout>
  )
}

function ProtectedDashboard() {
  const { user } = useAuth()
  return user ? (
    <Suspense
      fallback={
        <main className="p-6 text-sm text-muted-foreground">
          Cargando el panel...
        </main>
      }
    >
      <DashboardPage />
    </Suspense>
  ) : (
    <Navigate to="/login" replace />
  )
}

function App() {
  return (
    <TooltipProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="my-savings-theme"
        disableTransitionOnChange
      >
        <BrowserRouter>
          <AuthProvider>
            <Toaster />
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/forgot-password"
                element={
                  <AuthLayout>
                    <ForgotPasswordPage />
                  </AuthLayout>
                }
              />
              <Route path="/dashboard/*" element={<ProtectedDashboard />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  )
}

export default App
