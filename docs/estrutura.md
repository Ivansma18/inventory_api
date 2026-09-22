# Arquitectura base oficial

Stack principal:

- TypeScript
- Hono
- OpenAPI / Swagger
- Zod
- Better Auth
- Prisma
- PostgreSQL
- Vitest

Enfoque arquitectónico:

- Feature-Driven Architecture
- DDD ligero
- Principios de Hexagonal Architecture
- Separación explícita entre dominio, aplicación, infraestructura y transporte HTTP

---

# 1. Estructura general

```text
mi-api-hono/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── src/
│   │
│   ├── features/
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.config.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.types.ts
│   │   │   └── index.ts
│   │   │
│   │   └── products/
│   │       │
│   │       ├── domain/
│   │       │   ├── product.entity.ts
│   │       │   ├── product.repository.ts
│   │       │   └── product.errors.ts
│   │       │
│   │       ├── application/
│   │       │   └── product.service.ts
│   │       │
│   │       ├── infrastructure/
│   │       │   └── prisma-product.repository.ts
│   │       │
│   │       ├── http/
│   │       │   ├── product.routes.ts
│   │       │   ├── product.schemas.ts
│   │       │   └── product.mapper.ts
│   │       │
│   │       └── index.ts
│   │
│   ├── shared/
│   │   │
│   │   ├── config/
│   │   │   └── env.ts
│   │   │
│   │   ├── database/
│   │   │   └── prisma.ts
│   │   │
│   │   ├── errors/
│   │   │   ├── application-error.ts
│   │   │   └── error-handler.ts
│   │   │
│   │   ├── http/
│   │   │   ├── response.ts
│   │   │   └── pagination.ts
│   │   │
│   │   └── middlewares/
│   │       └── auth.middleware.ts
│   │
│   ├── app.ts
│   └── index.ts
│
├── tests/
│
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

# 2. Flujo principal

Una petición deberá seguir, en términos generales, este flujo:

```text
HTTP Request
     │
     ▼
Routes / Schemas
     │
     ▼
Application
Service / Use Case
     │
     ▼
Domain
Entities / Repository contracts
     │
     ▼
Infrastructure
Prisma Repository
     │
     ▼
Prisma
     │
     ▼
PostgreSQL
```

La respuesta sigue el camino inverso:

```text
PostgreSQL
    ↓
Prisma
    ↓
Repository
    ↓
Application
    ↓
HTTP Mapper
    ↓
HTTP Response
```

---

# 3. Regla fundamental de dependencias

Las dependencias siempre deben apuntar hacia el núcleo de la aplicación.

```text
            HTTP
             │
             ▼
       Application
             │
             ▼
          Domain
             ▲
             │
      Infrastructure
```

Conceptualmente:

```text
HTTP ───────────────► Application

Application ────────► Domain

Infrastructure ─────► Domain

Domain ─────────────► nada externo
```

El dominio es la parte más independiente del sistema.

---

# 4. Domain

Ruta:

```text
features/<feature>/domain/
```

Ejemplo:

```text
features/products/domain/
├── product.entity.ts
├── product.repository.ts
└── product.errors.ts
```

Responsabilidades:

- Entidades.
- Value Objects.
- Reglas puras de negocio.
- Contratos de repositorios.
- Errores de dominio.
- Políticas de dominio.
- Invariantes.

Puede depender de:

```text
domain
└── TypeScript puro
```

No puede depender de:

```text
Hono
Prisma
Better Auth
Zod
OpenAPI
HTTP
PostgreSQL
Redis
SDK externos
application
infrastructure
```

Regla:

> El dominio debe poder ejecutarse sin saber que existe Hono, Prisma o una base de datos.

Ejemplo válido:

```ts
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<Product>;
}
```

Ejemplo incorrecto:

```ts
import type { PrismaClient } from "@prisma/client";
```

dentro de `domain`.

---

# 5. Application

Ruta:

```text
features/<feature>/application/
```

Responsabilidades:

- Casos de uso.
- Orquestación.
- Coordinación entre entidades y repositorios.
- Flujos de aplicación.
- Autorizaciones específicas del caso de uso.
- Transacciones de aplicación cuando corresponda.

Ejemplo inicial:

```text
application/
└── product.service.ts
```

Cuando crezca:

```text
application/
├── create-product.use-case.ts
├── get-product.use-case.ts
├── list-products.use-case.ts
├── update-product.use-case.ts
└── delete-product.use-case.ts
```

Puede depender de:

```text
application
↓
domain
```

No debería depender directamente de:

```text
Hono
Prisma
OpenAPI
HTTP
PostgreSQL
```

Especialmente queda prohibido:

```ts
prisma.product.create(...)
```

dentro de `application`.

Debe utilizar contratos:

```ts
export class CreateProductUseCase {
  constructor(private readonly products: ProductRepository) {}
}
```

---

# 6. Infrastructure

Ruta:

```text
features/<feature>/infrastructure/
```

Responsabilidades:

- Prisma.
- Repositorios concretos.
- SDK externos.
- Storage.
- Cache.
- Colas.
- APIs externas.
- Implementaciones técnicas.

Ejemplo:

```text
infrastructure/
└── prisma-product.repository.ts
```

Puede depender de:

```text
infrastructure
├── domain
└── shared infrastructure
```

Ejemplo:

```ts
export class PrismaProductRepository implements ProductRepository {
  // implementación
}
```

La infraestructura implementa contratos definidos por el dominio.

```text
Domain
ProductRepository
       ▲
       │ implements
       │
Infrastructure
PrismaProductRepository
```

Nunca debe ocurrir lo contrario:

```text
Domain
    ↓
PrismaProductRepository
```

---

# 7. HTTP

Ruta:

```text
features/<feature>/http/
```

Responsabilidades:

- Rutas Hono.
- Validación Zod.
- OpenAPI.
- Request/response.
- Status codes.
- Headers.
- Query params.
- Path params.
- Serialización.
- Mappers HTTP.

Ejemplo:

```text
http/
├── product.routes.ts
├── product.schemas.ts
└── product.mapper.ts
```

Puede depender de:

```text
HTTP
├── application
├── domain types cuando sea necesario
└── shared/http
```

No debe:

```text
acceder directamente a Prisma
ejecutar reglas complejas de negocio
crear consultas SQL
implementar lógica de dominio
```

Incorrecto:

```ts
app.post("/products", async (c) => {
  const product = await prisma.product.create(...);
});
```

Correcto:

```ts
app.post("/products", async (c) => {
  const input = c.req.valid("json");

  const product = await createProduct.execute(input);

  return c.json(product, 201);
});
```

---

# 8. Schemas HTTP

Los schemas representan el contrato de la API.

Ejemplo:

```text
http/product.schemas.ts
```

Pueden incluir:

```ts
CreateProductSchema;
UpdateProductSchema;
ProductResponseSchema;
ProductParamsSchema;
ProductQuerySchema;
```

Se utilizan para:

```text
Zod validation
+
OpenAPI generation
+
Swagger documentation
```

No deben convertirse automáticamente en entidades de dominio.

Debe mantenerse conceptualmente:

```text
HTTP Schema
     ≠
Domain Entity
     ≠
Prisma Model
```

Aunque inicialmente compartan campos similares.

---

# 9. Prisma

Prisma pertenece exclusivamente a infraestructura.

Uso permitido:

```text
shared/database/prisma.ts

features/*/infrastructure/*
```

Uso prohibido:

```text
domain/*
application/*
http/*
```

Flujo correcto:

```text
Application
    ↓
Repository interface
    ↓
Prisma Repository
    ↓
PrismaClient
```

---

# 10. Shared

Ruta:

```text
src/shared/
```

`shared` debe contener únicamente elementos genuinamente transversales.

Permitido:

```text
shared/
├── config/
├── database/
├── errors/
├── http/
├── logging/
├── middlewares/
└── security/
```

No permitido:

```text
shared/
├── product.service.ts
├── user.repository.ts
├── order.entity.ts
└── inventory.helper.ts
```

Si algo pertenece a una feature, permanece dentro de ella.

Regla:

> Que dos módulos utilicen algo similar no significa automáticamente que deba moverse a `shared`.

Primero debe existir una abstracción transversal real.

---

# 11. Comunicación entre features

Una feature no debe acceder directamente a la infraestructura interna de otra.

Incorrecto:

```text
orders/application
        ↓
products/infrastructure/prisma-product.repository
```

También evitar:

```text
orders
   ↓
products/http
```

Preferible:

```text
orders/application
        ↓
products/application
```

o mediante un contrato explícito:

```text
orders
   ↓
ProductReader
   ↓
products
```

Cuando el sistema crezca todavía más, estas comunicaciones pueden evolucionar hacia:

```text
Application Ports
Domain Events
Integration Events
Message Broker
```

pero no son necesarios desde el inicio.

---

# 12. Index de cada feature

Cada módulo debe exponer únicamente aquello que el exterior necesita.

Ejemplo:

```text
products/index.ts
```

Puede exportar:

```ts
export { productRoutes } from "./http/product.routes";
```

y mantener internos:

```text
domain/
application/
infrastructure/
```

Esto ayuda a evitar imports arbitrarios desde otras features.

---

# 13. Composition Root

La creación de dependencias debe realizarse en un punto claramente definido.

Por ejemplo:

```ts
const productRepository = new PrismaProductRepository(prisma);

const createProduct = new CreateProductUseCase(productRepository);

const productRoutes = createProductRoutes({
  createProduct,
});
```

Así:

```text
CreateProductUseCase
```

no necesita crear:

```text
PrismaProductRepository
```

internamente.

Incorrecto:

```ts
class CreateProductUseCase {
  private repository = new PrismaProductRepository();
}
```

Correcto:

```ts
class CreateProductUseCase {
  constructor(private readonly repository: ProductRepository) {}
}
```

---

# 14. app.ts

`app.ts` construye la aplicación Hono.

Responsabilidades:

```text
CORS
middlewares
error handling
logging
OpenAPI
Swagger
route registration
```

Ejemplo conceptual:

```ts
const app = new OpenAPIHono();

app.use(...);

app.route("/auth", authRoutes);
app.route("/products", productRoutes);

configureOpenAPI(app);

export { app };
```

No debe iniciar el servidor.

---

# 15. index.ts

`index.ts` debe ser mínimo.

Responsabilidad:

```text
iniciar el servidor
```

Ejemplo:

```ts
import { serve } from "@hono/node-server";
import { app } from "./app";

serve({
  fetch: app.fetch,
  port: 3000,
});
```

No debería contener lógica de negocio.

---

# 16. Better Auth

Better Auth constituye una excepción parcial porque implementa buena parte del subsistema de autenticación.

Estructura inicial:

```text
features/auth/
├── auth.config.ts
├── auth.routes.ts
├── auth.types.ts
└── index.ts
```

No es necesario crear artificialmente:

```text
domain/
application/
infrastructure/
```

hasta que exista lógica propia que lo justifique.

Debe distinguirse:

```text
Authentication
¿Quién es el usuario?
```

de:

```text
Authorization
¿Qué puede hacer?
```

Si posteriormente existe RBAC:

```text
features/
├── auth/
├── users/
└── authorization/
```

Authorization debe convertirse en una feature independiente.

---

# 17. Manejo de errores

Los errores de negocio pertenecen a su feature.

Ejemplo:

```text
products/domain/product.errors.ts
```

```ts
export class ProductNotFoundError extends Error {}

export class ProductAlreadyExistsError extends Error {}
```

El dominio no conoce códigos HTTP.

Incorrecto:

```ts
throw new HttpException(404);
```

Correcto:

```ts
throw new ProductNotFoundError();
```

Después:

```text
ProductNotFoundError
        ↓
HTTP Error Handler
        ↓
404 Not Found
```

---

# 18. Regla de DTOs y modelos

Nunca asumir:

```text
DTO = Entity = Prisma Model
```

Deben mantenerse separados conceptualmente:

```text
HTTP

CreateProductRequest
        ↓
Application

CreateProductInput
        ↓
Domain

Product
        ↓
Infrastructure

Prisma Product
        ↓
Database
```

No siempre será necesario crear un tipo diferente para cada paso.

La regla es conceptual:

> No acoplar una capa a otra únicamente para evitar escribir un mapper pequeño.

---

# 19. Testing

La estrategia recomendada:

```text
Domain
→ Unit tests

Application
→ Unit tests

Infrastructure
→ Integration tests

HTTP
→ Integration / E2E tests
```

Ejemplo de application test:

```text
CreateProductUseCase
         ↓
FakeProductRepository
```

No requiere:

```text
PostgreSQL
Prisma
Hono
```

Para integración:

```text
Hono
 ↓
Application
 ↓
Prisma
 ↓
Test Database
```

---

# 20. Reglas oficiales de importación

## Permitido

```text
http
 ├── application
 ├── domain
 └── shared


application
 ├── domain
 └── shared


infrastructure
 ├── domain
 └── shared


domain
 └── shared/domain-safe utilities
```

## Prohibido

```text
domain → application

domain → infrastructure

domain → http

domain → Prisma

domain → Hono


application → infrastructure

application → Prisma

application → Hono

application → HTTP


infrastructure → http


feature A → infrastructure de feature B

feature A → http de feature B
```

---

# 21. Matriz de dependencias

| Desde          | Domain | Application | Infrastructure | HTTP |   Shared |
| -------------- | -----: | ----------: | -------------: | ---: | -------: |
| Domain         |     Sí |          No |             No |   No | Limitado |
| Application    |     Sí |          Sí |             No |   No |       Sí |
| Infrastructure |     Sí |    Limitado |             Sí |   No |       Sí |
| HTTP           |     Sí |          Sí |             No |   Sí |       Sí |

La regla realmente importante es:

```text
Domain nunca mira hacia afuera.
```

---

# 22. Evolución del proyecto

No es obligatorio crear todos los conceptos desde el inicio.

## Fase 1 — Proyecto pequeño

```text
products/
├── domain/
│   └── product.repository.ts
├── application/
│   └── product.service.ts
├── infrastructure/
│   └── prisma-product.repository.ts
├── http/
│   ├── product.routes.ts
│   └── product.schemas.ts
└── index.ts
```

## Fase 2 — Más casos de uso

```text
application/
├── create-product.use-case.ts
├── update-product.use-case.ts
├── get-product.use-case.ts
├── list-products.use-case.ts
└── delete-product.use-case.ts
```

## Fase 3 — Mayor complejidad de negocio

```text
domain/
├── entities/
├── value-objects/
├── repositories/
├── services/
├── policies/
└── errors/
```

## Fase 4 — Más infraestructura

```text
infrastructure/
├── persistence/
├── cache/
├── storage/
├── messaging/
└── external-services/
```

La arquitectura debe crecer únicamente cuando exista una necesidad real.

---

# 23. Principios obligatorios

Toda nueva feature deberá respetar estos principios:

1. La organización principal será por feature.

2. Hono pertenece exclusivamente a la frontera HTTP.

3. Prisma pertenece exclusivamente a infraestructura.

4. El dominio no depende de frameworks.

5. Application orquesta casos de uso, no implementa detalles técnicos.

6. Los repositorios se definen mediante contratos y se implementan en infraestructura.

7. HTTP no contiene lógica compleja de negocio.

8. Las features no acceden directamente a la infraestructura interna de otras features.

9. `shared` no se utilizará como carpeta genérica para código sin ubicación clara.

10. Las abstracciones se crearán cuando exista una necesidad real, no anticipadamente.

11. Las reglas de negocio importantes deben poder probarse sin Hono, Prisma o PostgreSQL.

12. Authentication y Authorization deben mantenerse como responsabilidades independientes.

13. Los errores del dominio no conocen códigos HTTP.

14. `app.ts` configura la aplicación; `index.ts` inicia el proceso.

15. Se prioriza simplicidad sin romper las fronteras arquitectónicas.

---

# 24. Regla final

La arquitectura puede resumirse en una sola dirección:

```text
Frameworks / Drivers
        │
        ▼
       HTTP
        │
        ▼
   Application
        │
        ▼
      Domain
        ▲
        │
 Infrastructure
```

Y en una regla:

> La lógica del negocio no debe depender de cómo llega una petición, dónde se guarda la información ni qué framework ejecuta la aplicación.
