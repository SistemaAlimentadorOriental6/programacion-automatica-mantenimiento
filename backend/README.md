# SAO6 Backend - Arquitectura SOLID

Este backend ha sido rediseñado siguiendo los principios **SOLID** y una arquitectura de capas (Hexagonal/Clean) para garantizar la escalabilidad, mantenibilidad y facilidad de pruebas.

## Estructura del Proyecto

- `cmd/api/`: Punto de entrada de la aplicación.
- `internal/`: Código privado de la aplicación.
  - `auth/`: Dominio de autenticación (SOLID: Responsabilidad Única).
    - `domain.go`: Modelos del negocio.
    - `repository.go`: Interfaz y acceso a datos (Inversión de Dependencias).
    - `service.go`: Lógica de negocio y validaciones.
    - `handler.go`: Capa de transporte (HTTP con Fiber).
  - `config/`: Gestión de configuración centralizada.
  - `platform/`: Implementaciones técnicas y drivers.
    - `db/`: Código generado por sqlc para SQL Server.
    - `server/`: Configuración y arranque del servidor Fiber.

## Requisitos

- Go 1.21+
- SQL Server (UNOEE)

## Ejecución

Para iniciar el servidor:

```bash
go run cmd/api/main.go
```

## Endpoints

### Login

- **URL:** `/api/auth/login`
- **Método:** `POST`
- **Body:**

```json
{
  "email": "usuario@ejemplo.com",
  "password": "nit_del_empleado"
}
```

---
