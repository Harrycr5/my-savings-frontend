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
import type {
  ApiResponse,
  Page,
  Permission,
  Profile,
  ProfileCreate,
  ProfileDetail,
} from "@/lib/api-types"
import { hasPermission, permissions } from "@/lib/permissions"

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export function ProfilesSection({
  request,
  userPermissions,
  isSuperAdmin,
}: {
  request: ApiRequest
  userPermissions: readonly string[]
  isSuperAdmin: boolean
}) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [page, setPage] = useState<Page<Profile> | null>(null)
  const [permissionsList, setPermissionsList] = useState<Permission[]>([])
  const [selectedProfile, setSelectedProfile] = useState<ProfileDetail | null>(null)
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission(
    userPermissions,
    permissions.profilesCreate,
    isSuperAdmin,
  )
  const canUpdate = hasPermission(
    userPermissions,
    permissions.profilesUpdate,
    isSuperAdmin,
  )
  const canReadPermissions = hasPermission(
    userPermissions,
    permissions.permissionsRead,
    isSuperAdmin,
  )

  const fetchProfiles = useCallback(async () => {
    const response = await request<ApiResponse<Page<Profile>>>(
      "profiles?page=1&page_size=100",
    )
    return response.data
  }, [request])

  useEffect(() => {
    let active = true
    void fetchProfiles()
      .then(async (result) => {
        if (!active) return
        setProfiles(result.items)
        setPage(result)
        if (canReadPermissions) {
          const permissionResponse = await request<ApiResponse<Page<Permission>>>(
            "permissions?page=1&page_size=100",
          )
          if (active) setPermissionsList(permissionResponse.data.items)
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los perfiles.",
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [canReadPermissions, fetchProfiles, request])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const description = String(form.get("description") ?? "").trim()
    const payload: ProfileCreate = {
      code: String(form.get("code") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      description: description || null,
    }
    setIsCreating(true)
    setError(null)
    try {
      await request<ApiResponse<Profile>>("profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear el perfil.",
      )
      setIsCreating(false)
      return
    }

    formElement.reset()
    setShowCreateForm(false)
    toast.success("Perfil creado.")
    try {
      const result = await fetchProfiles()
      setProfiles(result.items)
      setPage(result)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? `Perfil creado, pero no se pudo actualizar la lista: ${refreshError.message}`
          : "Perfil creado, pero no se pudo actualizar la lista.",
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function openProfile(profile: Profile) {
    setError(null)
    setSelectedProfile(null)
    setSelectedPermissionIds([])
    try {
      const response = await request<ApiResponse<ProfileDetail>>(
        `profiles/${encodeURIComponent(profile.id)}`,
      )
      setSelectedProfile(response.data)
      setSelectedPermissionIds(
        response.data.permissions.map((permission) => permission.id),
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el detalle del perfil.",
      )
    }
  }

  async function saveProfilePermissions() {
    if (!selectedProfile || !canUpdate || !canReadPermissions) return

    const currentIds = new Set(
      selectedProfile.permissions.map((permission) => permission.id),
    )
    const selectedIds = new Set(selectedPermissionIds)
    const toAdd = [...selectedIds].filter((id) => !currentIds.has(id))
    const toRemove = [...currentIds].filter((id) => !selectedIds.has(id))

    setIsSaving(true)
    setError(null)
    try {
      if (toAdd.length > 0) {
        await request<ApiResponse<ProfileDetail>>(
          `profiles/${encodeURIComponent(selectedProfile.id)}/permissions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permission_ids: toAdd }),
          },
        )
      }
      if (toRemove.length > 0) {
        await request<ApiResponse<ProfileDetail>>(
          `profiles/${encodeURIComponent(selectedProfile.id)}/permissions`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permission_ids: toRemove }),
          },
        )
      }

      const response = await request<ApiResponse<ProfileDetail>>(
        `profiles/${encodeURIComponent(selectedProfile.id)}`,
      )
      setSelectedProfile(response.data)
      setSelectedPermissionIds(
        response.data.permissions.map((permission) => permission.id),
      )
      toast.success("Permisos del perfil actualizados.")
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron actualizar los permisos del perfil.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    )
  }

  return (
    <section className="space-y-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Perfiles</h2>
          <p className="text-sm text-muted-foreground">
            Administra perfiles y asigna los permisos disponibles.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateForm((open) => !open)}>
            {showCreateForm ? "Cancelar" : "Crear perfil"}
          </Button>
        )}
      </div>

      {showCreateForm && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo perfil</CardTitle>
            <CardDescription>
              El código debe comenzar con una letra y usar minúsculas, números o guion bajo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-3" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="profile-code">Código</Label>
                <Input
                  id="profile-code"
                  name="code"
                  pattern="[a-z][a-z0-9_]*"
                  maxLength={50}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nombre</Label>
                <Input id="profile-name" name="name" maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-description">Descripción</Label>
                <Input
                  id="profile-description"
                  name="description"
                  maxLength={255}
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Guardando..." : "Guardar perfil"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perfiles disponibles</CardTitle>
            <CardDescription>
              {page ? `${page.total} perfiles` : "Listado de perfiles"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando perfiles...</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay perfiles disponibles.
              </p>
            ) : (
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.code} · {profile.is_active ? "Activo" : "Inactivo"}
                      </p>
                      {profile.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {profile.description}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openProfile(profile)}
                    >
                      Ver permisos
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedProfile ? selectedProfile.name : "Permisos del perfil"}
            </CardTitle>
            <CardDescription>
              {selectedProfile
                ? "Permisos que habilitan acciones de este perfil."
                : "Selecciona un perfil para consultar sus permisos."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedProfile ? (
              <p className="text-sm text-muted-foreground">
                El detalle aparecerá aquí.
              </p>
            ) : !canReadPermissions ? (
              <p className="text-sm text-muted-foreground">
                Tu perfil no tiene permiso para consultar el catálogo de permisos.
              </p>
            ) : permissionsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay permisos disponibles.
              </p>
            ) : (
              <>
                <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-lg border p-3">
                  {permissionsList.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex cursor-pointer items-start gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedPermissionIds.includes(permission.id)}
                        disabled={!canUpdate || isSaving}
                        onChange={() => togglePermission(permission.id)}
                      />
                      <span>
                        <span className="block font-medium">{permission.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {permission.code}
                          {permission.description
                            ? ` · ${permission.description}`
                            : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {canUpdate && (
                  <Button
                    type="button"
                    onClick={() => void saveProfilePermissions()}
                    disabled={isSaving}
                  >
                    {isSaving ? "Guardando..." : "Guardar permisos"}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
