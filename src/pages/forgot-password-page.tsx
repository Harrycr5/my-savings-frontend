import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
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
import { apiRequest } from "@/lib/api"
import type { ApiResponse } from "@/lib/api-types"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado."
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const form = new FormData(event.currentTarget)
    const submittedEmail = String(form.get("email") ?? "").trim()

    try {
      await apiRequest<ApiResponse<null>>("auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail }),
      })
      setEmail(submittedEmail)
      setIsCodeSent(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const code = String(form.get("code") ?? "").trim()
    const newPassword = String(form.get("new_password") ?? "")
    const confirmation = String(form.get("confirm_password") ?? "")

    if (newPassword !== confirmation) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setIsSubmitting(true)
    try {
      await apiRequest<ApiResponse<null>>("auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          new_password: newPassword,
        }),
      })
      setIsComplete(true)
    } catch (resetError) {
      setError(getErrorMessage(resetError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isComplete
            ? "Contraseña actualizada"
            : isCodeSent
              ? "Restablece tu contraseña"
              : "Recupera tu contraseña"}
        </CardTitle>
        <CardDescription>
          {isComplete
            ? "Ya puedes iniciar sesión con tu nueva contraseña."
            : isCodeSent
              ? `Ingresa el código de 6 dígitos enviado a ${email}.`
              : "Te enviaremos un código para verificar tu correo."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isComplete ? (
          <Button asChild className="w-full">
            <Link to="/login">Volver a iniciar sesión</Link>
          </Button>
        ) : isCodeSent ? (
          <form className="space-y-4" onSubmit={handleResetPassword}>
            <div className="space-y-2">
              <Label htmlFor="reset-code">Código de verificación</Label>
              <Input
                id="reset-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-new-password">Nueva contraseña</Label>
              <Input
                id="reset-new-password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password">
                Confirma la nueva contraseña
              </Label>
              <Input
                id="reset-confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Actualizando..." : "Cambiar contraseña"}
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="link"
              onClick={() => {
                setIsCodeSent(false)
                setError(null)
              }}
            >
              Usar otro correo
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleRequestCode}>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Correo electrónico</Label>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar código"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link className="underline underline-offset-4" to="/login">
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
