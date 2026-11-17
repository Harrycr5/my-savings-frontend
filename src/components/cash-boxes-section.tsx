import { useCallback, useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  ApiResponse,
  Concept,
  Movement,
  Page,
  Till,
  TillBalance,
  TillCreate,
} from "@/lib/api-types"
import { hasAllPermissions, hasPermission, permissions } from "@/lib/permissions"

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

function formatAmount(amount: string, currency: string) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${amount} ${currency}`

  return `${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`
}

function localDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function CajaCard({
  till,
  request,
  userPermissions,
  isSuperAdmin,
}: {
  till: Till
  request: ApiRequest
  userPermissions: readonly string[]
  isSuperAdmin: boolean
}) {
  const [balance, setBalance] = useState<TillBalance | null>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [action, setAction] = useState<"movements" | "movement" | "concept" | null>(null)
  const [isLoadingAction, setIsLoadingAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canReadConcepts = hasPermission(
    userPermissions,
    permissions.conceptsRead,
    isSuperAdmin,
  )
  const canCreateConcept = hasPermission(
    userPermissions,
    permissions.conceptsCreate,
    isSuperAdmin,
  )
  const canReadMovements = hasPermission(
    userPermissions,
    permissions.movementsRead,
    isSuperAdmin,
  )
  const canCreateMovement = hasAllPermissions(userPermissions, [
    permissions.movementsCreate,
    permissions.conceptsRead,
  ], isSuperAdmin)

  const fetchBalance = useCallback(async () => {
    const response = await request<ApiResponse<TillBalance>>(
      `tills/${encodeURIComponent(till.id)}/balance`,
    )
    return response.data
  }, [request, till.id])

  const loadConcepts = useCallback(async () => {
    const response = await request<ApiResponse<Page<Concept>>>(
      `tills/${encodeURIComponent(till.id)}/concepts?page=1&page_size=100`,
    )
    setConcepts(response.data.items)
  }, [request, till.id])

  const loadMovements = useCallback(async () => {
    const response = await request<ApiResponse<Page<Movement>>>(
      `tills/${encodeURIComponent(till.id)}/movements?page=1&page_size=100`,
    )
    setMovements(
      [...response.data.items].sort((a, b) =>
        b.occurred_on.localeCompare(a.occurred_on),
      ),
    )
  }, [request, till.id])

  useEffect(() => {
    let active = true
    void fetchBalance()
      .then((nextBalance) => {
        if (active) setBalance(nextBalance)
      })
      .catch((error: unknown) => {
        if (active) {
          setBalanceError(
            error instanceof Error ? error.message : "No se pudo cargar el saldo.",
          )
        }
      })
      .finally(() => {
        if (active) setIsLoadingBalance(false)
      })
    return () => {
      active = false
    }
  }, [fetchBalance])

  async function handleAction(nextAction: "movements" | "movement" | "concept") {
    if (action === nextAction) {
      setAction(null)
      return
    }

    setAction(nextAction)
    setActionError(null)
    if (
      (nextAction === "movement" && canReadConcepts) ||
      (nextAction === "concept" && canReadConcepts)
    ) {
      setIsLoadingAction(true)
      try {
        await loadConcepts()
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los conceptos.",
        )
      } finally {
        setIsLoadingAction(false)
      }
    } else {
      setIsLoadingAction(true)
      try {
        await Promise.all([
          loadMovements(),
          ...(canReadConcepts ? [loadConcepts()] : []),
        ])
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los datos de esta caja.",
        )
      } finally {
        setIsLoadingAction(false)
      }
    }
  }

  async function handleCreateConcept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setActionError(null)
    setIsSubmitting(true)
    const form = new FormData(formElement)

    try {
      await request<ApiResponse<Concept>>(
        `tills/${encodeURIComponent(till.id)}/concepts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(form.get("name") ?? "").trim(),
            direction: String(form.get("direction") ?? "expense"),
          }),
        },
      )
      toast.success("Concepto creado.")
      formElement.reset()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No se pudo crear el concepto.",
      )
      setIsSubmitting(false)
      return
    }

    if (canReadConcepts) {
      try {
        await loadConcepts()
      } catch (error) {
        setActionError(
          error instanceof Error
            ? `Concepto creado, pero no se pudo actualizar la lista: ${error.message}`
            : "Concepto creado, pero no se pudo actualizar la lista.",
        )
      }
    }
    setIsSubmitting(false)
  }

  async function handleCreateMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError(null)
    setIsSubmitting(true)
    const form = new FormData(event.currentTarget)
    const description = String(form.get("description") ?? "").trim()

    try {
      await request<ApiResponse<Movement>>(
        `tills/${encodeURIComponent(till.id)}/movements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concept_id: String(form.get("concept_id") ?? ""),
            amount: Number(form.get("amount")),
            occurred_on: String(form.get("occurred_on") ?? ""),
            description: description || null,
          }),
        },
      )
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el movimiento.",
      )
      setIsSubmitting(false)
      return
    }

    toast.success("Movimiento registrado.")
    setIsSubmitting(false)
    setBalanceError(null)
    setIsLoadingBalance(true)
    setAction(canReadMovements ? "movements" : null)

    const [balanceResult, movementResult] = await Promise.allSettled([
      fetchBalance(),
      canReadMovements ? loadMovements() : Promise.resolve(),
    ])
    setIsLoadingBalance(false)
    if (balanceResult.status === "fulfilled") {
      setBalance(balanceResult.value)
    } else {
      setBalanceError(
        balanceResult.reason instanceof Error
          ? balanceResult.reason.message
          : "No se pudo cargar el saldo.",
      )
    }
    if (canReadMovements && movementResult.status === "rejected") {
      setActionError(
        movementResult.reason instanceof Error
          ? `Movimiento registrado, pero no se pudo actualizar la lista: ${movementResult.reason.message}`
          : "Movimiento registrado, pero no se pudo actualizar la lista.",
      )
    }
  }

  const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{till.name}</CardTitle>
        <CardDescription>
          {till.description || "Caja de ahorro"} · {till.currency}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {balanceError ? (
          <p className="text-sm text-destructive" role="alert">
            {balanceError}
          </p>
        ) : isLoadingBalance ? (
          <p className="text-sm text-muted-foreground">Cargando saldo...</p>
        ) : balance ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Saldo actual", balance.balance],
              ["Saldo inicial", balance.opening_balance],
              ["Ingresos", balance.total_income],
              ["Gastos", balance.total_expense],
            ].map(([label, amount]) => (
              <div key={label} className="space-y-1">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatAmount(amount, balance.currency)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {canReadMovements && (
            <Button
              type="button"
              variant={action === "movements" ? "default" : "outline"}
              onClick={() => void handleAction("movements")}
            >
              Ver movimientos
            </Button>
          )}
          {canCreateMovement && (
            <Button
              type="button"
              variant={action === "movement" ? "default" : "outline"}
              onClick={() => void handleAction("movement")}
            >
              Crear movimiento
            </Button>
          )}
          {canCreateConcept && (
            <Button
              type="button"
              variant={action === "concept" ? "default" : "outline"}
              onClick={() => void handleAction("concept")}
            >
              Crear concepto
            </Button>
          )}
        </div>

        {action && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-medium">
                {action === "movements"
                  ? "Movimientos de esta caja"
                  : action === "movement"
                    ? "Nuevo movimiento"
                    : "Nuevo concepto"}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAction(null)}
              >
                Cerrar
              </Button>
            </div>

            {actionError && (
              <p className="text-sm text-destructive" role="alert">
                {actionError}
              </p>
            )}
            {isLoadingAction ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : action === "concept" ? (
              <form className="grid gap-4 sm:grid-cols-3" onSubmit={handleCreateConcept}>
                <div className="space-y-2">
                  <Label htmlFor={`concept-name-${till.id}`}>Nombre</Label>
                  <Input
                    id={`concept-name-${till.id}`}
                    name="name"
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`concept-direction-${till.id}`}>Tipo</Label>
                  <select
                    id={`concept-direction-${till.id}`}
                    name="direction"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Guardando..." : "Guardar concepto"}
                  </Button>
                </div>
                {canReadConcepts && concepts.length > 0 && (
                  <p className="text-sm text-muted-foreground sm:col-span-3">
                    Conceptos existentes:{" "}
                    {concepts
                      .map(
                        (concept) =>
                          `${concept.name} (${concept.direction === "income" ? "ingreso" : "gasto"})`,
                      )
                      .join(", ")}
                  </p>
                )}
              </form>
            ) : action === "movement" ? (
              concepts.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Crea un concepto para esta caja antes de registrar un movimiento.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canCreateConcept}
                    onClick={() => void handleAction("concept")}
                  >
                    Crear concepto
                  </Button>
                </div>
              ) : (
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateMovement}>
                  <div className="space-y-2">
                    <Label htmlFor={`movement-concept-${till.id}`}>Concepto</Label>
                    <select
                      id={`movement-concept-${till.id}`}
                      name="concept_id"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>Selecciona un concepto</option>
                      {concepts.map((concept) => (
                        <option key={concept.id} value={concept.id}>
                          {concept.name} · {concept.direction === "income" ? "Ingreso" : "Gasto"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`movement-amount-${till.id}`}>Monto ({till.currency})</Label>
                    <Input
                      id={`movement-amount-${till.id}`}
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`movement-date-${till.id}`}>Fecha</Label>
                    <Input
                      id={`movement-date-${till.id}`}
                      name="occurred_on"
                      type="date"
                      defaultValue={localDate()}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`movement-description-${till.id}`}>Descripción</Label>
                    <Input
                      id={`movement-description-${till.id}`}
                      name="description"
                      maxLength={500}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Guardando..." : "Registrar movimiento"}
                    </Button>
                  </div>
                </form>
              )
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta caja todavía no tiene movimientos.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => {
                    const concept = conceptsById.get(movement.concept_id)
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {new Date(`${movement.occurred_on}T00:00:00`).toLocaleDateString("es-PE")}
                        </TableCell>
                        <TableCell>
                          {concept?.name ?? (movement.direction === "income" ? "Ingreso" : "Gasto")}
                        </TableCell>
                        <TableCell>{movement.description || "—"}</TableCell>
                        <TableCell className="text-right">
                          {formatAmount(movement.amount, till.currency)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CashBoxesSection({
  request,
  userPermissions,
  isSuperAdmin,
}: {
  request: ApiRequest
  userPermissions: readonly string[]
  isSuperAdmin: boolean
}) {
  const [tills, setTills] = useState<Till[]>([])
  const [page, setPage] = useState<Page<Till> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const canCreate = hasPermission(
    userPermissions,
    permissions.tillsCreate,
    isSuperAdmin,
  )

  const fetchTills = useCallback(async () => {
    const response = await request<ApiResponse<Page<Till>>>(
      `tills?page=${pageNumber}&page_size=20`,
    )
    return response.data
  }, [pageNumber, request])

  useEffect(() => {
    let active = true
    void fetchTills()
      .then((result) => {
        if (!active) return
        setTills(result.items)
        setPage(result)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar las cajas.",
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchTills])

  async function handleCreateTill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const description = String(form.get("description") ?? "").trim()
    const payload: TillCreate = {
      name: String(form.get("name") ?? "").trim(),
      description: description || null,
      currency: String(form.get("currency") ?? "PEN").toUpperCase(),
      opening_balance: Number(form.get("opening_balance") ?? 0),
    }

    try {
      await request<ApiResponse<Till>>("tills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setPageNumber(1)
      setShowCreateForm(false)
      setIsLoading(true)
      setError(null)
      toast.success("Caja creada.")
      if (pageNumber === 1) {
        try {
          const result = await fetchTills()
          setTills(result.items)
          setPage(result)
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? `Caja creada, pero no se pudo actualizar la lista: ${loadError.message}`
              : "Caja creada, pero no se pudo actualizar la lista.",
          )
        } finally {
          setIsLoading(false)
        }
      }
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "No se pudo crear la caja.",
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section className="space-y-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Cajas</h2>
          <p className="text-sm text-muted-foreground">
            Consulta saldos, movimientos y conceptos de cada caja.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateForm((open) => !open)}>
            {showCreateForm ? "Cancelar" : "Crear caja"}
          </Button>
        )}
      </div>

      {showCreateForm && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva caja</CardTitle>
            <CardDescription>
              Define el nombre, moneda y saldo inicial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateTill}>
              <div className="space-y-2">
                <Label htmlFor="till-name">Nombre</Label>
                <Input id="till-name" name="name" maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="till-description">Descripción</Label>
                <Input id="till-description" name="description" maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="till-currency">Moneda (código ISO)</Label>
                <Input
                  id="till-currency"
                  name="currency"
                  defaultValue="PEN"
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="till-opening-balance">Saldo inicial</Label>
                <Input
                  id="till-opening-balance"
                  name="opening_balance"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creando..." : "Guardar caja"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando cajas...</p>
      ) : tills.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Todavía no tienes cajas. Crea una para comenzar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tills.map((till) => (
            <CajaCard
              key={till.id}
              till={till}
              request={request}
              userPermissions={userPermissions}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}

      {page && page.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page.page} de {page.pages} · {page.total} cajas
          </p>
          <div className="flex gap-2">
            <Button
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
    </section>
  )
}
