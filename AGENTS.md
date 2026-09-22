# AGENTS.md - Inventory API

## Proyecto

Backend de inventario evolutivo, diseñado para crecer hacia ventas, ERP ligero y SaaS multi-tenant. Usa TypeScript, Hono, OpenAPI/Swagger, Zod, Better Auth, Prisma, PostgreSQL y Vitest con organización por feature, DDD ligero y principios hexagonales.

## Estructura

- Organiza cada capacidad en `src/features/<feature>/`.
- Separa las capas en `domain/`, `application/`, `infrastructure/` y `http/` cuando la feature tenga lógica propia.
- Mantén código transversal real en `src/shared/`; no uses `shared/` como carpeta genérica.
- Usa `app.ts` para construir y configurar la aplicación; deja `index.ts` únicamente para iniciar el servidor.
- Expón desde `features/<feature>/index.ts` solo la API pública de la feature.

## Dependencias

- `domain/` contiene entidades, invariantes, contratos de repositorio y errores de negocio. Solo puede depender de TypeScript puro o utilidades seguras de dominio.
- `application/` orquesta casos de uso mediante contratos de dominio. No importa Hono, Prisma, HTTP ni detalles de infraestructura.
- `infrastructure/` implementa contratos del dominio y contiene Prisma, SDKs y detalles técnicos. No importa `http/`.
- `http/` contiene rutas Hono, esquemas Zod/OpenAPI, validación, serialización y mappers. No accede a Prisma ni contiene lógica de negocio compleja.
- Prisma solo puede usarse en `src/shared/database/` y `src/features/*/infrastructure/`.
- Una feature no importa la infraestructura ni la capa HTTP interna de otra; usa contratos o la API pública de la feature.

## Reglas

- Lee `docs/constitution.md` antes de crear o modificar specs, planes, tareas o código. Lee `docs/estrutura.md` antes de modificar la arquitectura y `docs/ruta.md` para respetar la fase de evolución aplicable.
- Mantén separados los DTOs HTTP, los tipos de aplicación, las entidades de dominio y los modelos Prisma; crea mappers cuando eviten acoplamiento entre capas.
- Los errores de negocio pertenecen a su feature y no conocen códigos HTTP; el manejador HTTP los traduce a respuestas.
- Usa nombres que expresen intención y mantén una responsabilidad clara por función, clase o módulo. No dejes código muerto, comentado o duplicado; los comentarios deben explicar el porqué, no el qué.
- Crea abstracciones, value objects, eventos o capas adicionales solo cuando exista una necesidad real.
- Las reglas de negocio deben poder probarse sin Hono, Prisma ni PostgreSQL.
- Al crear o modificar endpoints, actualiza los schemas Zod y el contrato OpenAPI/Swagger correspondiente.
- Al modificar el esquema de persistencia, crea o actualiza la migración de Prisma correspondiente.
- No incluyas secretos ni valores de `.env` en código, documentación o pruebas.

## Tests y comandos

- Ejecutar: `npm run dev`
- Tests: `npm test`
- Lint/formato: `npm run lint`, `npm run format` y `npm run typecheck`

## Al terminar cualquier tarea

- Ejecuta los comandos de pruebas y validación configurados para los archivos modificados.
- Antes de cerrar una fase, verifica que los endpoints, validaciones, mapeo de errores, documentación Swagger/OpenAPI, migraciones y reglas de dependencia aplicables estén actualizados.
