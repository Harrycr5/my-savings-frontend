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
  Debt,
  DebtCreate,
  DebtPayment,
  DebtPay,
  Page,
  Till,
} from "@/lib/api-types"
import { hasAllPermissions, hasPermission, permissions } from "@/lib/permissions"

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

const frequencyLabels: Record<Debt["frequency"], string> = {
  once: "Una vez",
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
}

function formatAmount(amount: string, currency: string) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${amount} ${currency}`

  return `${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function DebtsSection({
  request,
  userPermissions,
  isSuperAdmin,
}: {
  request: ApiRequest
  userPermissions: readonly string[]
  isSuperAdmin: boolean
}) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [page, setPage] = useState<Page<Debt> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null)
  const [historyDebtId, setHistoryDebtId] = useState<string | null>(null)
  const [tills, setTills] = useState<Till[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [isLoadingPaymentData, setIsLoadingPaymentData] = useState(false)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  const canCreate = hasPermission(
    userPermissions,
    permissions.debtsCreate,
    isSuperAdmin,
  )
  const canUpdate = hasPermission(
    userPermissions,
    permissions.debtsUpdate,
    isSuperAdmin,
  )
  const canReadPayments = hasPermission(
    userPermissions,
    permissions.debtPaymentsRead,
    isSuperAdmin,
  )
  const canPay = hasAllPermissions(userPermissions, [
    permissions.debtPaymentsCreate,
    permissions.tillsRead,
    permissions.conceptsRead,
  ], isSuperAdmin)

  const fetchDebts = useCallback(async () => {
    const response = await request<ApiResponse<Page<Debt>>>(
      `debts?page=${pageNumber}&page_size=20`,
    )
    return response.data
  }, [pageNumber, request])

  const refreshDebts = useCallback(async () => {
    const result = await fetchDebts()
    setDebts(result.items)
    setPage(result)
  }, [fetchDebts])

  useEffect(() => {
    let active = true
    void fetchDebts()
      .then((result) => {
        if (!active) return
        setDebts(result.items)
        setPage(result)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar las deudas.",
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchDebts])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const description = String(form.get("description") ?? "").trim()
    const payload: DebtCreate = {
      name: String(form.get("name") ?? "").trim(),
      description: description || null,
      amount: Number(form.get("amount")),
      currency: String(form.get("currency") ?? "PEN").toUpperCase(),
      frequency: String(form.get("frequency") ?? "monthly") as Debt["frequency"],
      interval: Number(form.get("interval") ?? 1),
      first_due_date: String(form.get("first_due_date") ?? ""),
    }

    setIsCreating(true)
    setError(null)
    try {
      await request<ApiResponse<Debt>>("debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la deuda.",
      )
      setIsCreating(false)
      return
    }

    formElement.reset()
    setShowCreateForm(false)
    toast.success("Deuda creada.")
    try {
      await refreshDebts()
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? `Deuda creada, pero no se pudo actualizar la lista: ${refreshError.message}`
          : "Deuda creada, pero no se pudo actualizar la lista.",
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function toggleDebt(debt: Debt) {
    setError(null)
    try {
      const response = await request<ApiResponse<Debt>>(
        `debts/${encodeURIComponent(debt.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !debt.is_active }),
        },
      )
      setDebts((current) =>
        current.map((item) => item.id === debt.id ? response.data : item),
      )
      toast.success(response.data.is_active ? "Deuda reactivada." : "Deuda cerrada.")
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la deuda.",
      )
    }
  }

  async function openPaymentForm(debt: Debt) {
    if (payingDebtId === debt.id) {
      setPayingDebtId(null)
      return
    }
    setPayingDebtId(debt.id)
    setHistoryDebtId(null)
    setError(null)
    setIsLoadingPaymentData(true)
    try {
      const response = await request<ApiResponse<Page<Till>>>(
        "tills?page=1&page_size=100",
      )
      setTills(response.data.items)
      setConcepts([])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las cajas.",
      )
    } finally {
      setIsLoadingPaymentData(false)
    }
  }

  async function handleTillChange(tillId: string) {
    setConcepts([])
    if (!tillId) return
    setIsLoadingPaymentData(true)
    setError(null)
    try {
      const response = await request<ApiResponse<Page<Concept>>>(
        `tills/${encodeURIComponent(tillId)}/concepts?page=1&page_size=100`,
      )
      setConcepts(response.data.items)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los conceptos.",
      )
    } finally {
      setIsLoadingPaymentData(false)
    }
  }

  async function handlePay(event: FormEvent<HTMLFormElement>, debt: Debt) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload: DebtPay = {
      till_id: String(form.get("till_id") ?? ""),
      concept_id: String(form.get("concept_id") ?? ""),
      due_date: String(form.get("due_date") ?? ""),
      paid_on: String(form.get("paid_on") ?? ""),
    }

    setIsSubmittingPayment(true)
    setError(null)
    try {
      await request<ApiResponse<DebtPayment>>(
        `debts/${encodeURIComponent(debt.id)}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
    } catch (payError) {
      setError(
        payError instanceof Error ? payError.message : "No se pudo registrar el pago.",
      )
      setIsSubmittingPayment(false)
      return
    }

    setPayingDebtId(null)
    toast.success("Pago registrado.")
    try {
      await refreshDebts()
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? `Pago registrado, pero no se pudo actualizar la lista: ${refreshError.message}`
          : "Pago registrado, pero no se pudo actualizar la lista.",
      )
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  async function togglePaymentHistory(debt: Debt) {
    if (historyDebtId === debt.id) {
      setHistoryDebtId(null)
      return
    }
    setHistoryDebtId(debt.id)
    setPayingDebtId(null)
    setError(null)
    try {
      const response = await request<ApiResponse<Page<DebtPayment>>>(
        `debts/${encodeURIComponent(debt.id)}/payments?page=1&page_size=100`,
      )
      setPayments(response.data.items)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el historial de pagos.",
      )
    }
  }

  return (
    <section className="space-y-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Deudas</h2>
          <p className="text-sm text-muted-foreground">
            Organiza tus compromisos, vencimientos y pagos.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateForm((open) => !open)}>
            {showCreateForm ? "Cancelar" : "Registrar deuda"}
          </Button>
        )}
      </div>

      {showCreateForm && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva deuda</CardTitle>
            <CardDescription>
              Define el monto y la frecuencia de vencimiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="debt-name">Nombre</Label>
                <Input id="debt-name" name="name" maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-description">Descripción</Label>
                <Input id="debt-description" name="description" maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-amount">Monto por cuota</Label>
                <Input
                  id="debt-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-currency">Moneda</Label>
                <Input
                  id="debt-currency"
                  name="currency"
                  defaultValue="PEN"
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-frequency">Frecuencia</Label>
                <select
                  id="debt-frequency"
                  name="frequency"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="monthly"
                >
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-interval">Cada cuántas frecuencias</Label>
                <Input
                  id="debt-interval"
                  name="interval"
                  type="number"
                  min="1"
                  max="120"
                  defaultValue="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-first-due-date">Primer vencimiento</Label>
                <Input
                  id="debt-first-due-date"
                  name="first_due_date"
                  type="date"
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Guardando..." : "Guardar deuda"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Mis deudas</CardTitle>
          <CardDescription>
            {page ? `${page.total} deudas registradas` : "Listado de deudas"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando deudas...</p>
          ) : debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has registrado deudas.
            </p>
          ) : (
            <div className="space-y-4">
              {debts.map((debt) => (
                <Card key={debt.id}>
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{debt.name}</CardTitle>
                      <CardDescription>
                        {debt.description || "Sin descripción"} ·{" "}
                        {frequencyLabels[debt.frequency]}
                        {debt.interval > 1 ? ` cada ${debt.interval}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canUpdate && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleDebt(debt)}
                        >
                          {debt.is_active ? "Cerrar deuda" : "Reactivar"}
                        </Button>
                      )}
                      {canPay && debt.is_active && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openPaymentForm(debt)}
                        >
                          {payingDebtId === debt.id ? "Cancelar pago" : "Registrar pago"}
                        </Button>
                      )}
                      {canReadPayments && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void togglePaymentHistory(debt)}
                        >
                          {historyDebtId === debt.id ? "Ocultar pagos" : "Historial"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Monto por cuota</dt>
                        <dd className="font-medium">
                          {formatAmount(debt.amount, debt.currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Primer vencimiento</dt>
                        <dd>{debt.first_due_date}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Próximo vencimiento</dt>
                        <dd>{debt.next_due_date ?? "Sin vencimientos pendientes"}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      Estado: {debt.is_active ? "Activa" : "Cerrada"}
                    </p>

                    {payingDebtId === debt.id && canPay && (
                      <form
                        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
                        onSubmit={(event) => void handlePay(event, debt)}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`payment-till-${debt.id}`}>Caja</Label>
                          <select
                            id={`payment-till-${debt.id}`}
                            name="till_id"
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            required
                            defaultValue=""
                            onChange={(event) =>
                              void handleTillChange(event.target.value)
                            }
                          >
                            <option value="" disabled>Selecciona una caja</option>
                            {tills.map((till) => (
                              <option key={till.id} value={till.id}>
                                {till.name} · {till.currency}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`payment-concept-${debt.id}`}>Concepto</Label>
                          <select
                            id={`payment-concept-${debt.id}`}
                            name="concept_id"
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            required
                            defaultValue=""
                            disabled={concepts.length === 0}
                          >
                            <option value="" disabled>Selecciona un concepto</option>
                            {concepts
                              .filter((concept) => concept.direction === "expense")
                              .map((concept) => (
                                <option key={concept.id} value={concept.id}>
                                  {concept.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`payment-due-date-${debt.id}`}>
                            Cuota que se paga
                          </Label>
                          <Input
                            id={`payment-due-date-${debt.id}`}
                            name="due_date"
                            type="date"
                            defaultValue={debt.next_due_date ?? debt.first_due_date}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`payment-paid-on-${debt.id}`}>
                            Fecha de pago
                          </Label>
                          <Input
                            id={`payment-paid-on-${debt.id}`}
                            name="paid_on"
                            type="date"
                            defaultValue={today()}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Button
                            type="submit"
                            disabled={
                              isSubmittingPayment ||
                              isLoadingPaymentData ||
                              concepts.filter((concept) =>
                                concept.direction === "expense",
                              ).length === 0
                            }
                          >
                            {isSubmittingPayment
                              ? "Registrando..."
                              : isLoadingPaymentData
                                ? "Cargando..."
                                : "Confirmar pago"}
                          </Button>
                        </div>
                      </form>
                    )}

                    {historyDebtId === debt.id && canReadPayments && (
                      <div className="rounded-lg border p-4">
                        <h3 className="mb-3 text-sm font-medium">Pagos registrados</h3>
                        {payments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No hay pagos registrados en esta página.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Vencimiento</TableHead>
                                <TableHead>Fecha de pago</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payments
                                .filter((payment) => payment.debt_id === debt.id)
                                .map((payment) => (
                                  <TableRow key={payment.id}>
                                    <TableCell>{payment.due_date}</TableCell>
                                    <TableCell>{payment.paid_on}</TableCell>
                                    <TableCell className="text-right">
                                      {formatAmount(payment.amount, payment.currency)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {page && page.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page.page} de {page.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageNumber <= 1 || isLoading}
              onClick={() => {
                setIsLoading(true)
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
