import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ApiResponse, Page, UserRead } from "@/lib/api-types"

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export function UsersSection({ request }: { request: ApiRequest }) {
  const [users, setUsers] = useState<UserRead[]>([])
  const [page, setPage] = useState<Page<UserRead> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [searchText, setSearchText] = useState("")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(pageNumber),
      page_size: "20",
    })
    if (search) params.set("search", search)

    const response = await request<ApiResponse<Page<UserRead>>>(
      `users?${params.toString()}`,
    )
    return response.data
  }, [pageNumber, request, search])

  useEffect(() => {
    let active = true
    void fetchUsers()
      .then((result) => {
        if (!active) return
        setUsers(result.items)
        setPage(result)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los usuarios.",
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchUsers])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSearch = searchText.trim()
    if (nextSearch === search && pageNumber === 1) return

    setIsLoading(true)
    setError(null)
    setPageNumber(1)
    setSearch(nextSearch)
  }

  return (
    <section className="space-y-6 px-4 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold">Usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Consulta las cuentas registradas en el sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos los usuarios</CardTitle>
          <CardDescription>
            {page ? `${page.total} usuarios registrados` : "Listado de usuarios"}
          </CardDescription>
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={handleSearch}
          >
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por nombre, usuario o correo"
              maxLength={100}
              aria-label="Buscar usuarios"
            />
            <Button type="submit" variant="outline">Buscar</Button>
          </form>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron usuarios.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name} {user.last_name}
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.is_active ? "Activo" : "Inactivo"}</TableCell>
                    <TableCell>{user.is_admin ? "Admin" : "Usuario"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {page && page.pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {page.page} de {page.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pageNumber <= 1 || isLoading}
                  onClick={() => {
                    setIsLoading(true)
                    setError(null)
                    setPageNumber((current) => current - 1)
                  }}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pageNumber >= page.pages || isLoading}
                  onClick={() => {
                    setIsLoading(true)
                    setError(null)
                    setPageNumber((current) => current + 1)
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
