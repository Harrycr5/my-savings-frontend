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

type ActiveSession = {
  tokens: TokenResponse
  identity: symbol
}

function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>("auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

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
  const [initialIdentity] = useState(() => Symbol())
  const sessionRef = useRef<ActiveSession | null>(
    session && { tokens: session, identity: initialIdentity },
  )
  const refreshPromise = useRef<{
    session: ActiveSession
    promise: Promise<TokenResponse>
  } | null>(null)

  const persistSession = useCallback((nextSession: TokenResponse | null) => {
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

  const setSession = useCallback((tokens: TokenResponse | null, identity = Symbol()) => {
    sessionRef.current = tokens && { tokens, identity }
    persistSession(tokens)
  }, [persistSession])

  const updateUser = useCallback((user: UserSession) => {
    const activeSession = sessionRef.current
    if (!activeSession) {
      throw new Error("No hay una sesión activa para actualizar.")
    }
    activeSession.tokens = { ...activeSession.tokens, user }
    persistSession(activeSession.tokens)
  }, [persistSession])

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
      return await apiRequest<T>(path, init, activeSession.tokens.access_token)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error
      }

      if (sessionRef.current?.identity !== activeSession.identity) throw error

      if (sessionRef.current === activeSession) {
        if (refreshPromise.current?.session !== activeSession) {
          const promise = refreshTokens(activeSession.tokens.refresh_token).then((tokens) => {
            if (sessionRef.current === activeSession) {
              setSession(tokens, activeSession.identity)
            }
            return tokens
          }).catch((refreshError: unknown) => {
            if (sessionRef.current === activeSession) setSession(null)
            throw refreshError
          }).finally(() => {
            if (refreshPromise.current?.session === activeSession) {
              refreshPromise.current = null
            }
          })
          refreshPromise.current = { session: activeSession, promise }
        }
        await refreshPromise.current.promise
      }

      const retrySession = sessionRef.current
      if (retrySession?.identity !== activeSession.identity) throw error

      try {
        return await apiRequest<T>(path, init, retrySession.tokens.access_token)
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 &&
          sessionRef.current === retrySession) {
          setSession(null)
        }
        throw retryError
      }
    }
  }, [setSession])

  const signOut = useCallback(async () => {
    const activeSession = sessionRef.current
    const pendingRefresh = refreshPromise.current?.session === activeSession
      ? refreshPromise.current.promise
      : undefined
    setSession(null)
    if (!activeSession) return

    const logout = (accessToken: string) =>
      apiRequest<ApiResponse<null>>("auth/logout", { method: "POST" }, accessToken)

    try {
      await logout(activeSession.tokens.access_token)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error

      const tokens = await (pendingRefresh ?? refreshTokens(activeSession.tokens.refresh_token))
      await logout(tokens.access_token)
    }
  }, [setSession])

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
