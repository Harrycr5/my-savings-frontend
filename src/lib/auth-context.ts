import { createContext } from "react"
import type { UserCreate, UserSession } from "@/lib/api-types"

export interface AuthContextValue {
  user: UserSession | null
  updateUser: (user: UserSession) => void
  signIn: (username: string, password: string) => Promise<void>
  signUp: (user: UserCreate) => Promise<void>
  signOut: () => Promise<void>
  request: <T>(path: string, init?: RequestInit) => Promise<T>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
