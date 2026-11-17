import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ApiError, apiRequest } from "@/lib/api"
import type {
  ApiResponse,
  TokenResponse,
  UserCreate,
  UserSession,
} from "@/lib/api-types"
import { AuthContext } from "@/lib/auth-context"

const SESSION_STORAGE_KEY = "my-savings-session"

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== "object" || value === null) return false
  const session = value as Partial<TokenResponse>
  return (
    typeof session.access_token === "string" &&
    typeof session.refresh_token === "string" &&
    typeof session.expires_in === "number" &&
    session.token_type === "bearer" &&
    typeof session.user === "object" &&
    session.user !== null
  )
}

function readStoredSession(): TokenResponse | null {
  const storedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!storedSession) return null

  try {
    const parsed: unknown = JSON.parse(storedSession)
    if (isTokenResponse(parsed)) return parsed
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<TokenResponse | null>(readStoredSession)
  const sessionRef = useRef<TokenResponse | null>(session)
  const refreshPromise = useRef<Promise<TokenResponse> | null>(null)

  const setSession = useCallback((nextSession: TokenResponse | null) => {
    sessionRef.current = nextSession
    setSessionState(nextSession)
    if (nextSession) {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(nextSession),
      )
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [])

  const updateUser = useCallback((user: UserSession) => {
    const activeSession = sessionRef.current
    if (!activeSession) {
      throw new Error("No hay una sesión activa para actualizar.")
    }
    setSession({ ...activeSession, user })
  }, [setSession])

  const signIn = useCallback(async (username: string, password: string) => {
    const body = new URLSearchParams({ username, password })
    const result = await apiRequest<TokenResponse>("auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
    setSession(result)
  }, [setSession])

  const signUp = useCallback(async (user: UserCreate) => {
    await apiRequest<ApiResponse<unknown>>("auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    })
    await signIn(user.username, user.password)
  }, [signIn])

  const request = useCallback(async <T,>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> => {
    const activeSession = sessionRef.current
    if (!activeSession) {
      throw new Error("Inicia sesión para continuar.")
    }

    try {
      return await apiRequest<T>(path, init, activeSession.access_token)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error
      }
    }

    const refresh = refreshPromise.current ?? apiRequest<TokenResponse>(
      "auth/refresh",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: activeSession.refresh_token,
        }),
      },
    )
    refreshPromise.current = refresh

    try {
      const refreshedSession = await refresh
      setSession(refreshedSession)
      return await apiRequest<T>(path, init, refreshedSession.access_token)
    } catch (error) {
      setSession(null)
      throw error
    } finally {
      if (refreshPromise.current === refresh) {
        refreshPromise.current = null
      }
    }
  }, [setSession])

  const signOut = useCallback(async () => {
    try {
      if (sessionRef.current) {
        await request<ApiResponse<null>>("auth/logout", { method: "POST" })
      }
    } finally {
      setSession(null)
    }
  }, [request, setSession])

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        updateUser,
        signIn,
        signUp,
        signOut,
        request,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
