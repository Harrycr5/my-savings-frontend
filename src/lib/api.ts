const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, "")

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function getErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  if (body) {
    try {
      const payload: unknown = JSON.parse(body)
      if (isRecord(payload) && "detail" in payload) {
        const detail = payload.detail
        return typeof detail === "string" ? detail : JSON.stringify(detail)
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error
      }
    }
    return body
  }

  return response.statusText || "Error al comunicarse con el servidor."
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_URL no está configurada.")
  }

  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }

  const response = await fetch(
    `${apiBaseUrl}/${path.replace(/^\/+/, "")}`,
    { ...init, headers },
  )

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
