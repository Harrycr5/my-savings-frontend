import { cn } from "cn"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  onSubmit,
  error,
  isSubmitting = false,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  onSubmit?: React.FormEventHandler<HTMLFormElement>
  error?: string | null
  isSubmitting?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Inicia sesión</CardTitle>
          <CardDescription>
            Ingresa a tu cuenta para revisar tus ahorros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Usuario/Correo</FieldLabel>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="usuario o correo electrónico"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <FieldDescription className="text-right">
                  <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
                </FieldDescription>
              </Field>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
                </Button>
                <FieldDescription className="text-center">
                  ¿No tienes cuenta? <Link to="/signup">Regístrate</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
