import { useState, type FormEvent } from "react"
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
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import type {
  ApiResponse,
  UserRead,
  UserSession,
  UserUpdate,
} from "@/lib/api-types"

type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export function AccountSettingsSection({
  user,
  request,
  updateUser,
}: {
  user: UserSession
  request: ApiRequest
  updateUser: (user: UserSession) => void
}) {
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const lastName = String(form.get("last_name") ?? "").trim()
    const docNumber = String(form.get("doc_number") ?? "").trim()
    const avatarUrl = String(form.get("avatar_url") ?? "").trim()
    const payload: UserUpdate = {
      name,
      last_name: lastName,
      doc_number: docNumber || null,
      avatar_url: avatarUrl || null,
    }

    setProfileError(null)
    setIsSavingProfile(true)
    try {
      const response = await request<ApiResponse<UserRead>>("users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const updatedUser: UserSession = {
        ...user,
        name: response.data.name,
        last_name: response.data.last_name,
        doc_number: response.data.doc_number,
        avatar_url: response.data.avatar_url,
      }
      updateUser(updatedUser)
      toast.success("Tu perfil se actualizó.")
    } catch (saveError) {
      setProfileError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar tu perfil.",
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const currentPassword = String(form.get("current_password") ?? "")
    const newPassword = String(form.get("new_password") ?? "")
    const confirmation = String(form.get("confirm_password") ?? "")
    if (newPassword !== confirmation) {
      setPasswordError("Las contraseñas nuevas no coinciden.")
      return
    }

    setPasswordError(null)
    setIsChangingPassword(true)
    try {
      await request<ApiResponse<null>>("auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      formElement.reset()
      toast.success("Tu contraseña se cambió.")
    } catch (changeError) {
      setPasswordError(
        changeError instanceof Error
          ? changeError.message
          : "No se pudo cambiar la contraseña.",
      )
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <section className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          Administra tus datos personales y la seguridad de tu cuenta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del perfil</CardTitle>
          <CardDescription>
            Actualiza tu nombre, documento y foto de perfil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void handleProfileSave(event)}
          >
            <div className="flex items-center gap-4 sm:col-span-2">
              <Avatar className="size-16">
                <AvatarImage src={user.avatar_url ?? ""} alt={user.name} />
                <AvatarFallback>
                  {`${user.name} ${user.last_name}`.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium">{user.name} {user.last_name}</p>
                <p className="text-muted-foreground">{user.username}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">Nombre</Label>
              <Input
                id="account-name"
                name="name"
                defaultValue={user.name}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-last-name">Apellido</Label>
              <Input
                id="account-last-name"
                name="last_name"
                defaultValue={user.last_name}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-doc-number">Documento (DNI)</Label>
              <Input
                id="account-doc-number"
                name="doc_number"
                defaultValue={user.doc_number ?? ""}
                inputMode="numeric"
                pattern="[0-9]{8}"
                minLength={8}
                maxLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-avatar-url">URL de la foto</Label>
              <Input
                id="account-avatar-url"
                name="avatar_url"
                type="url"
                defaultValue={user.avatar_url ?? ""}
                maxLength={255}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Pega un enlace a la imagen. La API no ofrece carga de archivos.
              </p>
            </div>
            {profileError && (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {profileError}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Guardando..." : "Guardar perfil"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            La nueva contraseña debe tener al menos 12 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void handlePasswordChange(event)}
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Contraseña actual</Label>
              <Input
                id="current-password"
                name="current_password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
              />
            </div>
            <div className="hidden sm:block" />
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">
                Confirma la nueva contraseña
              </Label>
              <Input
                id="confirm-new-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {passwordError}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? "Actualizando..." : "Cambiar contraseña"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
