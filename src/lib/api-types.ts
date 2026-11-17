export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface UserSession {
  id: string
  username: string
  name: string
  last_name: string
  doc_number: string | null
  avatar_url: string | null
  is_active: boolean
  is_admin: boolean
  profile: {
    id: string
    name: string
  }
  permissions: string[]
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: "bearer"
  user: UserSession
}

export interface UserCreate {
  email: string
  username: string
  name: string
  last_name: string
  password: string
}

export interface UserUpdate {
  name?: string | null
  last_name?: string | null
  doc_number?: string | null
  avatar_url?: string | null
}

export interface Till {
  id: string
  name: string
  description: string | null
  currency: string
  opening_balance: string
  created_at: string
  updated_at: string
}

export interface TillSummary {
  currency: string
  total_tills: number
  opening_balance: string
  total_income: string
  total_expense: string
  net_savings: string
  balance: string
}

export interface TillBalance {
  till_id: string
  currency: string
  opening_balance: string
  total_income: string
  total_expense: string
  balance: string
}

export interface TillCreate {
  name: string
  description: string | null
  currency: string
  opening_balance: number
}

export interface Concept {
  id: string
  created_at: string
  updated_at: string
  till_id: string
  name: string
  direction: "income" | "expense"
}

export interface UserRead {
  id: string
  email: string
  username: string
  name: string
  last_name: string
  doc_number: string | null
  avatar_url: string | null
  is_active: boolean
  is_admin: boolean
  profile_id: string
  created_at: string
  updated_at: string
}

export interface Movement {
  id: string
  created_at: string
  updated_at: string
  till_id: string
  concept_id: string
  direction: "income" | "expense"
  amount: string
  occurred_on: string
  description: string | null
}

export interface Asset {
  id: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  asset_type: "property" | "vehicle" | "other"
  other_type: string | null
  currency: string
  current_value: string
  market_value: string
}

export interface AssetSummary {
  currency: string
  total_assets: number
  current_value: string
  market_value: string
}

export interface AssetCreate {
  name: string
  description: string | null
  asset_type: Asset["asset_type"]
  other_type: string | null
  currency: string
  current_value: number
  market_value: number
}

export interface AssetUpdate {
  name?: string
  description?: string | null
  asset_type?: Asset["asset_type"]
  other_type?: string | null
  current_value?: number
  market_value?: number
}

export interface Debt {
  id: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  amount: string
  currency: string
  frequency: "once" | "daily" | "weekly" | "monthly" | "yearly"
  interval: number
  first_due_date: string
  next_due_date: string | null
  is_active: boolean
}

export interface DebtCreate {
  name: string
  description: string | null
  amount: number
  currency: string
  frequency: Debt["frequency"]
  interval: number
  first_due_date: string
}

export interface DebtPayment {
  id: string
  created_at: string
  updated_at: string
  debt_id: string
  movement_id: string
  due_date: string
  paid_on: string
  amount: string
  currency: string
}

export interface DebtPay {
  till_id: string
  concept_id: string
  due_date: string
  paid_on?: string
}

export interface Profile {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  code: string
  name: string
  description: string | null
}

export interface ProfileDetail extends Omit<Profile, "created_at" | "updated_at"> {
  permissions: Permission[]
}

export interface ProfileCreate {
  code: string
  name: string
  description: string | null
}

