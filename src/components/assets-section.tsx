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
  Asset,
  AssetCreate,
  AssetSummary,
  AssetUpdate,
  Page,
} from "@/lib/api-types"
import { hasPermission, permissions } from "@/lib/permissions"

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

function formatAmount(amount: string, currency: string) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${amount} ${currency}`

  return `${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`
}

function assetTypeLabel(asset: Asset) {
  if (asset.asset_type === "property") return "Inmueble"
  if (asset.asset_type === "vehicle") return "Vehículo"
  return asset.other_type || "Otro"
}

export function AssetsSection({
  request,
  userPermissions,
  isSuperAdmin,
}: {
  request: ApiRequest
  userPermissions: readonly string[]
  isSuperAdmin: boolean
}) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [summaries, setSummaries] = useState<AssetSummary[]>([])
  const [page, setPage] = useState<Page<Asset> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canCreate = hasPermission(
    userPermissions,
    permissions.assetsCreate,
    isSuperAdmin,
  )
  const canUpdate = hasPermission(
    userPermissions,
    permissions.assetsUpdate,
    isSuperAdmin,
  )
  const canDelete = hasPermission(
    userPermissions,
    permissions.assetsDelete,
    isSuperAdmin,
  )

  const fetchAssets = useCallback(async () => {
    const [assetsResponse, summaryResponse] = await Promise.all([
      request<ApiResponse<Page<Asset>>>(
        `inheritance?page=${pageNumber}&page_size=20`,
      ),
      request<ApiResponse<AssetSummary[]>>("inheritance/summary"),
    ])
    return { page: assetsResponse.data, summaries: summaryResponse.data }
  }, [pageNumber, request])

  const refreshAssets = useCallback(async () => {
    const result = await fetchAssets()
    setAssets(result.page.items)
    setPage(result.page)
    setSummaries(result.summaries)
  }, [fetchAssets])

  useEffect(() => {
    let active = true
    void fetchAssets()
      .then((result) => {
        if (!active) return
        setAssets(result.page.items)
        setPage(result.page)
        setSummaries(result.summaries)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los patrimonios.",
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchAssets])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const assetType = String(form.get("asset_type") ?? "other") as Asset["asset_type"]
    const otherType = String(form.get("other_type") ?? "").trim()
    const description = String(form.get("description") ?? "").trim()
    const payload: AssetCreate = {
      name: String(form.get("name") ?? "").trim(),
      description: description || null,
      asset_type: assetType,
      other_type: assetType === "other" ? otherType : null,
      currency: String(form.get("currency") ?? "PEN").toUpperCase(),
      current_value: Number(form.get("current_value")),
      market_value: Number(form.get("market_value")),
    }

    setIsCreating(true)
    setError(null)
    try {
      await request<ApiResponse<Asset>>("inheritance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear el patrimonio.",
      )
      setIsCreating(false)
      return
    }

    formElement.reset()
    setShowCreateForm(false)
    toast.success("Patrimonio creado.")
    try {
      await refreshAssets()
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? `Patrimonio creado, pero no se pudo actualizar la lista: ${refreshError.message}`
          : "Patrimonio creado, pero no se pudo actualizar la lista.",
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdate(
    event: FormEvent<HTMLFormElement>,
    asset: Asset,
  ) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload: AssetUpdate = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || null,
      current_value: Number(form.get("current_value")),
      market_value: Number(form.get("market_value")),
    }
    setError(null)
    try {
      const response = await request<ApiResponse<Asset>>(
        `inheritance/${encodeURIComponent(asset.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      setAssets((current) =>
        current.map((item) => item.id === asset.id ? response.data : item),
      )
      setEditingAsset(null)
      toast.success("Patrimonio actualizado.")
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el patrimonio.",
      )
    }
  }

  async function handleDelete(asset: Asset) {
    if (!window.confirm(`¿Eliminar el patrimonio "${asset.name}"?`)) return

    setError(null)
    try {
      await request<void>(`inheritance/${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      })
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el patrimonio.",
      )
      return
    }

    toast.success("Patrimonio eliminado.")
    try {
      await refreshAssets()
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? `Patrimonio eliminado, pero no se pudo actualizar la lista: ${refreshError.message}`
          : "Patrimonio eliminado, pero no se pudo actualizar la lista.",
      )
    }
  }

  return (
    <section className="space-y-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Patrimonios</h2>
          <p className="text-sm text-muted-foreground">
            Registra tus bienes y consulta su valor actual y de mercado.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateForm((open) => !open)}>
            {showCreateForm ? "Cancelar" : "Agregar patrimonio"}
          </Button>
        )}
      </div>

      {summaries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((summary) => (
            <Card key={summary.currency}>
              <CardHeader className="pb-2">
                <CardDescription>Total en {summary.currency}</CardDescription>
                <CardTitle>{summary.total_assets} bienes</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Valor actual</p>
                  <p className="font-medium">
                    {formatAmount(summary.current_value, summary.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor de mercado</p>
                  <p className="font-medium">
                    {formatAmount(summary.market_value, summary.currency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateForm && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo patrimonio</CardTitle>
            <CardDescription>
              Ingresa los datos y valores del bien.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="asset-name">Nombre</Label>
                <Input id="asset-name" name="name" maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-type">Tipo</Label>
                <select
                  id="asset-type"
                  name="asset_type"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="property"
                >
                  <option value="property">Inmueble</option>
                  <option value="vehicle">Vehículo</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-other-type">Especificación (si es otro)</Label>
                <Input id="asset-other-type" name="other_type" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-description">Descripción</Label>
                <Input id="asset-description" name="description" maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-currency">Moneda</Label>
                <Input
                  id="asset-currency"
                  name="currency"
                  defaultValue="PEN"
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-current-value">Valor actual</Label>
                <Input
                  id="asset-current-value"
                  name="current_value"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-market-value">Valor de mercado</Label>
                <Input
                  id="asset-market-value"
                  name="market_value"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Guardando..." : "Guardar patrimonio"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Mis bienes</CardTitle>
          <CardDescription>
            {page ? `${page.total} patrimonios registrados` : "Listado de patrimonios"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando patrimonios...</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has registrado patrimonios.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bien</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor actual</TableHead>
                  <TableHead>Valor de mercado</TableHead>
                  {(canUpdate || canDelete) && <TableHead>Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <p className="font-medium">{asset.name}</p>
                      {asset.description && (
                        <p className="text-xs text-muted-foreground">
                          {asset.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{assetTypeLabel(asset)}</TableCell>
                    <TableCell>
                      {formatAmount(asset.current_value, asset.currency)}
                    </TableCell>
                    <TableCell>
                      {formatAmount(asset.market_value, asset.currency)}
                    </TableCell>
                    {(canUpdate || canDelete) && (
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {canUpdate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditingAsset((current) =>
                                  current === asset.id ? null : asset.id,
                                )
                              }
                            >
                              {editingAsset === asset.id ? "Cerrar edición" : "Editar"}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleDelete(asset)}
                            >
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {assets.map((asset) =>
                  editingAsset === asset.id && canUpdate ? (
                    <TableRow key={`${asset.id}-edit`}>
                      <TableCell colSpan={canUpdate || canDelete ? 5 : 4}>
                        <form
                          className="grid gap-3 sm:grid-cols-2"
                          onSubmit={(event) => void handleUpdate(event, asset)}
                        >
                          <Input
                            name="name"
                            aria-label="Nombre del patrimonio"
                            defaultValue={asset.name}
                            maxLength={100}
                            required
                          />
                          <Input
                            name="description"
                            aria-label="Descripción"
                            defaultValue={asset.description ?? ""}
                            maxLength={500}
                          />
                          <Input
                            name="current_value"
                            aria-label="Valor actual"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={asset.current_value}
                            required
                          />
                          <Input
                            name="market_value"
                            aria-label="Valor de mercado"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={asset.market_value}
                            required
                          />
                          <Button type="submit">Guardar cambios</Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ) : null,
                )}
              </TableBody>
            </Table>
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
