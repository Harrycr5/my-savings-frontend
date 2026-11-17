import { useEffect, useMemo, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { AppSidebar } from "@/components/app-sidebar"
import { AccountSettingsSection } from "@/components/account-settings-section"
import { AssetsSection } from "@/components/assets-section"
import { CashBoxesSection } from "@/components/cash-boxes-section"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DebtsSection } from "@/components/debts-section"
import { ProfilesSection } from "@/components/profiles-section"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { UsersSection } from "@/components/users-section"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/lib/use-auth"
import type {
  ApiResponse,
  Movement,
  Page,
  Till,
  TillSummary,
} from "@/lib/api-types"
import type { DailyMovement } from "@/components/chart-area-interactive"
import { hasAllPermissions, hasPermission, permissions } from "@/lib/permissions"

function formatAmount(amount: string, currency?: string) {
  const value = Number(amount)
  if (!Number.isFinite(value)) {
    return currency ? `${amount} ${currency}` : amount
  }

  const formattedAmount = new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return currency ? `${formattedAmount} ${currency}` : formattedAmount
}

function SummarySection({
  request,
  userName,
}: {
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  userName: string
}) {
  const [summaries, setSummaries] = useState<TillSummary[]>([])
  const [tills, setTills] = useState<Till[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMovements, setIsLoadingMovements] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movementError, setMovementError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadSummary() {
      try {
        const [summaryResponse, tillResponse] = await Promise.all([
          request<ApiResponse<TillSummary[]>>("tills/summary"),
          request<ApiResponse<Page<Till>>>("tills?page=1&page_size=100"),
        ])
        if (!active) return

        setSummaries(summaryResponse.data)
        setTills(tillResponse.data.items)
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el resumen.",
          )
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadSummary()
    return () => {
      active = false
    }
  }, [request])

  useEffect(() => {
    let active = true

    async function loadMovements() {
      try {
        const response = await request<ApiResponse<Page<Movement>>>(
          "tills/movements?page=1&page_size=100",
        )
        if (active) {
          setMovements(
            [...response.data.items].sort((a, b) =>
              b.occurred_on.localeCompare(a.occurred_on),
            ),
          )
        }
      } catch (loadError) {
        if (active) {
          setMovementError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los movimientos.",
          )
        }
      } finally {
        if (active) setIsLoadingMovements(false)
      }
    }

    void loadMovements()
    return () => {
      active = false
    }
  }, [request])

  const tillsById = useMemo(
    () => new Map(tills.map((till) => [till.id, till])),
    [tills],
  )

  const chartData = useMemo(() => {
    const byDateAndCurrency = new Map<string, DailyMovement>()
    for (const movement of movements) {
      const currency = tillsById.get(movement.till_id)?.currency
      if (!currency) continue

      const key = `${movement.occurred_on}:${currency}`
      const daily = byDateAndCurrency.get(key) ?? {
        date: movement.occurred_on,
        currency,
        income: 0,
        expense: 0,
      }
      const amount = Number(movement.amount)
      if (Number.isFinite(amount)) {
        daily[movement.direction] += amount
      }
      byDateAndCurrency.set(key, daily)
    }
    return [...byDateAndCurrency.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    )
  }, [movements, tillsById])

  return (
    <section className="flex flex-col gap-6 py-6">
      <div className="px-4 lg:px-6">
        <h2 className="text-2xl font-semibold">Hola, {userName}</h2>
        <p className="text-sm text-muted-foreground">
          Aquí tienes el resumen de tus finanzas.
        </p>
      </div>

      {error && (
        <p className="px-4 text-sm text-destructive lg:px-6" role="alert">
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="px-4 text-sm text-muted-foreground lg:px-6">
          Cargando tus cuentas...
        </p>
      ) : (
        <>
          <SectionCards summaries={summaries} />
          <section className="grid gap-6 px-4 lg:px-6">
            <ChartAreaInteractive data={chartData} />
            <Card>
              <CardHeader>
                <CardTitle>Movimientos recientes</CardTitle>
                <CardDescription>
                  {isLoadingMovements
                    ? "Cargando movimientos..."
                    : `Mostrando ${movements.length} movimientos`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {movementError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {movementError}
                  </p>
                ) : isLoadingMovements ? (
                  <p className="text-sm text-muted-foreground">
                    Cargando movimientos...
                  </p>
                ) : movements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay movimientos para mostrar.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Caja</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((movement) => {
                        const till = tillsById.get(movement.till_id)
                        return (
                          <TableRow key={movement.id}>
                            <TableCell>
                              {new Date(
                                `${movement.occurred_on}T00:00:00`,
                              ).toLocaleDateString("es-PE")}
                            </TableCell>
                            <TableCell>
                              {movement.description || "Sin descripción"}
                            </TableCell>
                            <TableCell>
                              {movement.direction === "income"
                                ? "Ingreso"
                                : "Gasto"}
                            </TableCell>
                            <TableCell title={movement.till_id}>
                              {till?.name ?? "Caja no encontrada"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatAmount(movement.amount, till?.currency)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const { user, request, signOut, updateUser } = useAuth()
  const { pathname } = useLocation()

  if (!user) return <Navigate to="/login" replace />

  const normalizedPath = pathname.replace(/\/+$/, "")
  const canViewSummary = hasAllPermissions(user.permissions, [
    permissions.tillsRead,
    permissions.movementsRead,
  ], user.is_admin)
  const availablePages = [
    ...(canViewSummary ? ["/dashboard"] : []),
    ...(hasPermission(user.permissions, permissions.tillsRead, user.is_admin)
      ? ["/dashboard/cajas"]
      : []),
    ...(hasPermission(user.permissions, permissions.assetsRead, user.is_admin)
      ? ["/dashboard/patrimonios"]
      : []),
    ...(hasPermission(user.permissions, permissions.debtsRead, user.is_admin)
      ? ["/dashboard/deudas"]
      : []),
    ...(hasPermission(user.permissions, permissions.usersRead, user.is_admin)
      ? ["/dashboard/usuarios"]
      : []),
    ...(hasPermission(user.permissions, permissions.profilesRead, user.is_admin)
      ? ["/dashboard/perfiles"]
      : []),
    "/dashboard/configuracion",
  ]
  const defaultPage = availablePages[0]
  const requestedPage =
    normalizedPath === "/dashboard" || availablePages.includes(normalizedPath)
      ? normalizedPath
      : null
  const activeUrl = requestedPage && availablePages.includes(requestedPage)
    ? requestedPage
    : defaultPage

  if (normalizedPath !== activeUrl && activeUrl) {
    return <Navigate to={activeUrl} replace />
  }
  if (!activeUrl && normalizedPath !== "/dashboard") {
    return <Navigate to="/dashboard" replace />
  }

  async function handleLogout() {
    try {
      await signOut()
    } catch (logoutError) {
      toast.error("Se cerró la sesión local, pero falló el cierre en el servidor.", {
        description:
          logoutError instanceof Error ? logoutError.message : undefined,
      })
    }
  }

  const titles: Record<string, string> = {
    "/dashboard": "Resumen",
    "/dashboard/cajas": "Cajas",
    "/dashboard/patrimonios": "Patrimonios",
    "/dashboard/deudas": "Deudas",
    "/dashboard/usuarios": "Usuarios",
    "/dashboard/perfiles": "Perfiles",
    "/dashboard/configuracion": "Configuración",
  }
  const title = activeUrl ? titles[activeUrl] : "Panel"

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        onLogout={() => void handleLogout()}
        activeUrl={activeUrl}
      />
      <SidebarInset>
        <SiteHeader title={title} />
        <main className="flex flex-1 flex-col">
          {activeUrl === "/dashboard/cajas" && (
            <CashBoxesSection
              request={request}
              userPermissions={user.permissions}
              isSuperAdmin={user.is_admin}
            />
          )}
          {activeUrl === "/dashboard/patrimonios" && (
            <AssetsSection
              request={request}
              userPermissions={user.permissions}
              isSuperAdmin={user.is_admin}
            />
          )}
          {activeUrl === "/dashboard/deudas" && (
            <DebtsSection
              request={request}
              userPermissions={user.permissions}
              isSuperAdmin={user.is_admin}
            />
          )}
          {activeUrl === "/dashboard/usuarios" && (
            <UsersSection request={request} />
          )}
          {activeUrl === "/dashboard/perfiles" && (
            <ProfilesSection
              request={request}
              userPermissions={user.permissions}
              isSuperAdmin={user.is_admin}
            />
          )}
          {activeUrl === "/dashboard/configuracion" && (
            <AccountSettingsSection
              user={user}
              request={request}
              updateUser={updateUser}
            />
          )}
          {activeUrl === "/dashboard" && canViewSummary && (
            <SummarySection request={request} userName={user.name} />
          )}
          {!activeUrl && (
            <p className="m-6 text-sm text-muted-foreground" role="status">
              Tu cuenta no tiene permisos para consultar secciones del panel.
            </p>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
