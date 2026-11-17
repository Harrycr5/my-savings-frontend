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

export function SignupForm({
  onSubmit,
  error,
  isSubmitting = false,
  ...props
}: Omit<React.ComponentProps<typeof Card>, "onSubmit"> & {
  onSubmit?: React.FormEventHandler<HTMLFormElement>
  error?: string | null
  isSubmitting?: boolean
}) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Crear una cuenta</CardTitle>
        <CardDescription>
          Ingresa tus datos para comenzar a organizar tus ahorros.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="given-name"
                placeholder="Tu nombre"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="last_name">Apellido</FieldLabel>
              <Input
                id="last_name"
                name="last_name"
                type="text"
                autoComplete="family-name"
                placeholder="Tu apellido"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="username">Nombre de usuario</FieldLabel>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9_]+"
                placeholder="usuario"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                required
              />
              <FieldDescription>
                Usaremos este correo para tu cuenta.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
              <FieldDescription>
                Debe tener entre 12 y 128 caracteres.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirmar contraseña
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
              <FieldDescription>Confirma tu contraseña.</FieldDescription>
            </Field>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
                <FieldDescription className="px-6 text-center">
                  ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
