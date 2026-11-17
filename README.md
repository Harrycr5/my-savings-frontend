# my-savings-frontend

Frontend para el proyecto de tesis, creado con React, Vite, Tailwind CSS y shadcn/ui.

## Iniciar

```bash
npm install
npm run dev
```

## Pantallas

- `/login`: inicio de sesión.
- `/forgot-password`: recuperación de contraseña mediante código de verificación.
- `/signup`: creación de cuenta.
- `/dashboard`: resumen general.
- `/dashboard/cajas`: saldos, movimientos y conceptos por caja.
- `/dashboard/patrimonios`: bienes, valores y resumen por moneda.
- `/dashboard/deudas`: vencimientos y registro/historial de pagos.
- `/dashboard/usuarios`: listado de usuarios.
- `/dashboard/perfiles`: perfiles y asignación de permisos.
- `/dashboard/configuracion`: datos personales, foto mediante URL y cambio de contraseña.

El registro, el inicio de sesión y el cierre de sesión usan el API. Para los perfiles normales, la navegación y las acciones se muestran según los códigos de `user.permissions` enviados por el backend. El superadmin (`user.is_admin`) puede acceder a todas las secciones sin permisos asignados. El API sigue siendo responsable de autorizar cada solicitud.

## API local

Configura `VITE_API_URL` en `.env` (puedes copiar `.env.example`). Reinicia Vite después de cambiar variables de entorno. El backend debe permitir solicitudes desde el origen de Vite mediante CORS. La sesión se conserva en `sessionStorage` para sobrevivir recargas y los tokens se renuevan al recibir un `401`; se cierra al cerrar la pestaña.
