# Ruta completa de desarrollo — Inventory Backend

## 1. Objetivo del proyecto

Construir progresivamente un backend de inventario utilizando:

```text
TypeScript
Hono
OpenAPI / Swagger
Zod
Better Auth
Prisma
PostgreSQL
Vitest
```

siguiendo:

```text
Feature-Driven Architecture
+
DDD ligero
+
principios de arquitectura hexagonal
```

El objetivo no es únicamente terminar una API de inventario.

El proyecto servirá para aprender cómo evolucionar:

```text
CRUD
  ↓
Inventory System
  ↓
Sales System
  ↓
ERP pequeño
  ↓
SaaS Multi-Tenant
```

sin reemplazar la arquitectura inicial.

---

# 2. Evolución general

La ruta estará dividida en estas etapas:

```text
FASE 0
Fundamentos del proyecto
        ↓
FASE 1
Products
        ↓
FASE 2
Categories
        ↓
FASE 3
Inventory
        ↓
FASE 4
Stock Movements
        ↓
FASE 5
Authentication
        ↓
FASE 6
Authorization
        ↓
FASE 7
Suppliers
        ↓
FASE 8
Purchases
        ↓
FASE 9
Customers
        ↓
FASE 10
Sales
        ↓
FASE 11
Audit
        ↓
FASE 12
Reports
        ↓
FASE 13
Advanced architecture
        ↓
FASE 14
Multi-tenancy
        ↓
FASE 15
Production
```

Cada fase deberá quedar funcional y probada antes de avanzar.

---

# FASE 0 — Bootstrap y arquitectura

## Objetivo

Preparar la infraestructura mínima del backend.

Todavía no implementar negocio.

## Crear proyecto

Estructura inicial:

```text
inventory-api/
├── prisma/
│   └── schema.prisma
│
├── src/
│   ├── features/
│   ├── shared/
│   │   ├── config/
│   │   ├── database/
│   │   ├── errors/
│   │   ├── http/
│   │   └── middlewares/
│   │
│   ├── app.ts
│   └── index.ts
│
├── tests/
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Configurar

### TypeScript

Activar modo estricto:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Configurar alias:

```text
@/features/*
@/shared/*
```

---

## Variables de entorno

Crear:

```text
src/shared/config/env.ts
```

Validar con Zod:

```text
DATABASE_URL
PORT
NODE_ENV
BETTER_AUTH_SECRET
BETTER_AUTH_URL
```

Principio:

```text
variables inválidas
        ↓
aplicación no arranca
```

Fail-fast.

---

## Prisma

Crear:

```text
src/shared/database/prisma.ts
```

Responsabilidad:

```text
una única instancia de PrismaClient
```

Prisma solamente podrá utilizarse desde:

```text
shared/database
features/*/infrastructure
```

---

## Hono

Crear:

```text
src/app.ts
```

Responsabilidades:

```text
Hono app
middlewares
error handler
routes
OpenAPI
Swagger
```

Crear:

```text
src/index.ts
```

Responsabilidad exclusiva:

```text
arrancar servidor
```

---

## Health check

Crear:

```http
GET /health
```

Respuesta:

```json
{
  "status": "ok"
}
```

---

## Swagger

Exponer:

```text
/docs
```

y:

```text
/openapi.json
```

---

## Resultado esperado

Al terminar Fase 0:

```text
GET /health        → 200

GET /docs          → Swagger UI

GET /openapi.json  → OpenAPI document
```

Todavía:

```text
features/
└── vacío
```

---

# FASE 1 — Products

Primera feature real.

## Objetivo

Aprender el flujo arquitectónico completo.

```text
HTTP
 ↓
Application
 ↓
Domain
 ↓
Repository
 ↓
Infrastructure
 ↓
Prisma
```

---

# Estructura

```text
features/
└── products/
    ├── domain/
    │   ├── product.entity.ts
    │   ├── product.repository.ts
    │   └── product.errors.ts
    │
    ├── application/
    │   └── product.service.ts
    │
    ├── infrastructure/
    │   └── prisma-product.repository.ts
    │
    ├── http/
    │   ├── product.routes.ts
    │   ├── product.schemas.ts
    │   └── product.mapper.ts
    │
    └── index.ts
```

---

# Modelo Product

Campos iniciales:

```text
id
uuid
sku
name
description
purchasePrice
salePrice
isActive
createdAt
updatedAt
```

Por ejemplo:

```text
Product

id             internal DB ID
uuid           public identifier
sku            inventory identifier
name
description
purchasePrice
salePrice
isActive
createdAt
updatedAt
```

---

# Reglas de negocio

Implementar reglas simples.

### SKU obligatorio

```text
SKU no puede estar vacío
```

### SKU único

```text
no pueden existir dos productos
con el mismo SKU
```

### Nombre

```text
nombre obligatorio
```

### Precios

```text
purchasePrice >= 0
salePrice >= 0
```

---

# Repository

Definir:

```ts
interface ProductRepository {
  findById(uuid: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findMany(...): Promise<Product[]>;
  create(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
}
```

Sin Prisma.

---

# Casos de uso iniciales

Mientras el módulo sea pequeño:

```text
product.service.ts
```

Implementar:

```text
createProduct()
getProduct()
listProducts()
updateProduct()
deactivateProduct()
```

---

# Endpoints

```http
POST   /products
GET    /products
GET    /products/:uuid
PATCH  /products/:uuid
DELETE /products/:uuid
```

`DELETE` inicialmente será soft delete:

```text
isActive = false
```

---

# HTTP Query

Preparar:

```http
GET /products?page=1&limit=20
```

Agregar:

```text
search
isActive
sort
order
```

Ejemplo:

```http
GET /products?search=frame&page=1&limit=20
```

---

# Errores

Crear:

```text
ProductNotFoundError
ProductSkuAlreadyExistsError
InvalidProductPriceError
```

Mapper global:

```text
ProductNotFoundError
        ↓
404

ProductSkuAlreadyExistsError
        ↓
409
```

---

# Tests

Domain:

```text
Product creation
invalid purchase price
invalid sale price
```

Application:

```text
create product
duplicate SKU
find product
update product
deactivate product
```

Utilizar:

```text
FakeProductRepository
```

No Prisma.

---

# FASE 2 — Categories

## Objetivo

Introducir relaciones entre features.

Estructura:

```text
features/
├── products/
└── categories/
```

Category:

```text
id
uuid
name
description
isActive
createdAt
updatedAt
```

---

# Endpoints

```http
POST   /categories
GET    /categories
GET    /categories/:uuid
PATCH  /categories/:uuid
DELETE /categories/:uuid
```

---

# Relación

Inicialmente:

```text
Category
   │
   └── Products
```

Un producto pertenece a una categoría.

---

# Regla importante

Products no debe importar:

```text
categories/infrastructure/*
```

Evitar:

```text
products
   ↓
PrismaCategoryRepository
```

La validación puede realizarse mediante un contrato:

```ts
interface CategoryReader {
  exists(uuid: string): Promise<boolean>;
}
```

---

# Concepto aprendido

```text
comunicación entre features
sin acoplar infraestructura
```

---

# FASE 3 — Inventory

Aquí empieza realmente el sistema de inventario.

Crear:

```text
features/inventory/
```

---

# Concepto principal

Separar:

```text
Product
```

de:

```text
Inventory
```

Un producto describe:

```text
qué es
```

Inventory describe:

```text
cuánto existe
```

---

# Inventory

Campos:

```text
id
uuid
productId
quantity
minimumStock
updatedAt
```

---

# Reglas

```text
quantity >= 0

minimumStock >= 0
```

Nunca permitir:

```text
stock negativo
```

---

# Casos de uso

```text
getProductStock
listInventory
updateMinimumStock
checkLowStock
```

---

# Endpoints

```http
GET   /inventory
GET   /inventory/:productUuid
PATCH /inventory/:productUuid/minimum-stock
```

---

# Estados calculados

No necesariamente guardarlos en DB.

Calcular:

```text
IN_STOCK
LOW_STOCK
OUT_OF_STOCK
```

Reglas:

```text
quantity === 0
→ OUT_OF_STOCK

quantity <= minimumStock
→ LOW_STOCK

quantity > minimumStock
→ IN_STOCK
```

---

# FASE 4 — Stock Movements

Esta es una de las fases más importantes.

A partir de aquí:

> El stock ya no debe modificarse directamente.

Crear:

```text
features/stock-movements/
```

---

# StockMovement

Campos:

```text
id
uuid
productId

type
quantity

previousStock
newStock

reason
reference

createdBy
createdAt
```

---

# Tipos

Inicialmente:

```text
IN
OUT
ADJUSTMENT
```

---

# Regla central

Eliminar conceptualmente:

```text
inventory.quantity = 200
```

desde un endpoint.

Todo cambio debe ocurrir mediante:

```text
StockMovement
```

Ejemplo:

```text
stock actual = 20

entrada = 5

20 + 5 = 25
```

Crear:

```text
StockMovement

type = IN
quantity = 5
previousStock = 20
newStock = 25
```

---

# Casos de uso

Separar ahora application:

```text
application/
├── create-stock-entry.use-case.ts
├── create-stock-exit.use-case.ts
├── adjust-stock.use-case.ts
└── list-stock-movements.use-case.ts
```

---

# Endpoints

```http
POST /inventory/:productUuid/entries

POST /inventory/:productUuid/exits

POST /inventory/:productUuid/adjustments

GET /inventory/:productUuid/movements

GET /stock-movements
```

---

# Reglas

Entrada:

```text
quantity > 0
```

Salida:

```text
quantity > 0

quantity <= stock disponible
```

Ajuste:

```text
requiere motivo
```

---

# Error

```text
InsufficientStockError
```

HTTP:

```text
409 Conflict
```

---

# Transacciones

Aquí introducir Prisma Transaction.

La operación:

```text
crear movement
+
actualizar inventory
```

debe ser atómica.

```text
BEGIN

update inventory

insert movement

COMMIT
```

Si algo falla:

```text
ROLLBACK
```

---

# FASE 5 — Authentication

Ahora integrar Better Auth.

Crear:

```text
features/auth/
├── auth.config.ts
├── auth.routes.ts
├── auth.types.ts
└── index.ts
```

---

# Objetivo

Resolver:

```text
¿Quién hace la petición?
```

No todavía:

```text
¿Tiene permiso?
```

Eso será Authorization.

---

# Endpoints

Los definidos por Better Auth para:

```text
sign-up
sign-in
session
sign-out
```

según configuración.

---

# Middleware

Crear:

```text
shared/middlewares/auth.middleware.ts
```

Responsabilidad:

```text
leer sesión
        ↓
validar usuario
        ↓
inyectar identidad al context
```

---

# Proteger

Inicialmente proteger:

```text
POST /products
PATCH /products/*
DELETE /products/*

POST /inventory/*
```

Las consultas pueden ser privadas o públicas dependiendo del proyecto.

---

# FASE 6 — Authorization

Crear:

```text
features/authorization/
```

Ahora resolver:

```text
¿Qué puede hacer este usuario?
```

---

# Primera versión

Roles:

```text
ADMIN
MANAGER
OPERATOR
VIEWER
```

---

# Permisos

Ejemplo:

```text
product:create
product:read
product:update
product:delete

inventory:read
inventory:entry
inventory:exit
inventory:adjust
```

---

# Evolución recomendada

Evitar:

```ts
if (user.role === "ADMIN")
```

distribuido por toda la aplicación.

Introducir:

```text
AuthorizationService
```

o:

```text
PermissionChecker
```

---

# Flujo

```text
Request
 ↓
Authentication
 ↓
User
 ↓
Authorization
 ↓
Permission
 ↓
Use Case
```

---

# FASE 7 — Suppliers

Ahora empezar la evolución hacia compras.

Crear:

```text
features/suppliers/
```

Supplier:

```text
id
uuid
name
contactName
email
phone
notes
isActive
createdAt
updatedAt
```

---

# Endpoints

```http
POST   /suppliers
GET    /suppliers
GET    /suppliers/:uuid
PATCH  /suppliers/:uuid
DELETE /suppliers/:uuid
```

---

# Relación

Posteriormente:

```text
Supplier
    ↓
Purchases
    ↓
Products
```

---

# FASE 8 — Purchases

Crear:

```text
features/purchases/
```

Esta fase introduce un agregado más interesante.

---

# Purchase

```text
Purchase
├── supplier
├── items[]
├── subtotal
├── total
├── status
└── timestamps
```

---

# PurchaseItem

```text
product
quantity
unitCost
subtotal
```

Importante:

```text
unitCost
```

debe quedar registrado históricamente.

No depender posteriormente del precio actual del producto.

---

# Estados

```text
DRAFT
RECEIVED
CANCELLED
```

---

# Regla fundamental

Cuando una compra cambia:

```text
DRAFT
 ↓
RECEIVED
```

se generan movimientos:

```text
StockMovement(IN)
```

por cada producto.

---

# Flujo

```text
ReceivePurchaseUseCase
       │
       ├── PurchaseRepository
       ├── InventoryRepository
       └── StockMovementRepository
```

Todo dentro de una transacción.

---

# FASE 9 — Customers

Crear:

```text
features/customers/
```

Campos:

```text
uuid
name
email
phone
notes
createdAt
updatedAt
```

Preparación para ventas.

---

# FASE 10 — Sales

Ahora el Inventory System evoluciona a Sales System.

Crear:

```text
features/sales/
```

---

# Sale

```text
Sale
├── customer
├── items[]
├── subtotal
├── discount
├── total
├── status
└── timestamps
```

---

# SaleItem

```text
product
quantity
unitPrice
subtotal
```

Guardar precio histórico.

---

# Estados

```text
DRAFT
COMPLETED
CANCELLED
```

---

# Regla

Completar venta:

```text
Sale COMPLETED
        ↓
StockMovement OUT
        ↓
Inventory decreases
```

---

# Stock insuficiente

Antes de completar:

```text
verificar todos los items
```

Si alguno falla:

```text
venta completa falla
```

No:

```text
producto A descontado
producto B falló
producto C sin procesar
```

Todo debe ser transaccional.

---

# Cancelaciones

Si una venta completada se cancela:

```text
StockMovement
type = IN
reason = SALE_CANCELLED
```

No eliminar los movimientos anteriores.

Generar movimiento compensatorio.

---

# Concepto aprendido

```text
inmutabilidad histórica
+
compensación
```

---

# FASE 11 — Audit

Crear:

```text
features/audit/
```

Registrar acciones importantes.

---

# AuditLog

```text
id
uuid
actorId
action
entity
entityId
metadata
createdAt
```

Ejemplos:

```text
PRODUCT_CREATED

PRODUCT_UPDATED

STOCK_ADJUSTED

PURCHASE_RECEIVED

SALE_COMPLETED

SALE_CANCELLED
```

---

# Regla

Audit no debe contaminar cada controller con:

```ts
audit(...)
```

por todas partes.

Debe introducirse en:

```text
application
```

o mediante mecanismos transversales/eventos.

---

# FASE 12 — Reports

Crear:

```text
features/reports/
```

No representa necesariamente un dominio complejo.

Será principalmente lectura.

---

# Reportes

Implementar:

```text
stock actual

productos con stock bajo

productos agotados

movimientos por periodo

entradas por periodo

salidas por periodo

compras por periodo

ventas por periodo

productos más vendidos

valor estimado del inventario
```

---

# Endpoints

Ejemplos:

```http
GET /reports/inventory/summary

GET /reports/inventory/low-stock

GET /reports/inventory/out-of-stock

GET /reports/stock-movements

GET /reports/sales

GET /reports/purchases
```

Filtros:

```text
from
to
product
category
```

---

# FASE 13 — Arquitectura avanzada

Hasta este momento el sistema ya será considerable.

Ahora introducir conceptos solamente donde hagan falta.

---

## Value Objects

Ejemplos:

```text
Money
Sku
Quantity
Email
```

Money:

```text
amount
currency
```

Quantity:

```text
nunca negativa
```

---

## Domain Events

Introducir eventos para desacoplar ciertos procesos.

Por ejemplo:

```text
SaleCompleted
PurchaseReceived
StockChanged
StockLow
```

Flujo:

```text
CompleteSaleUseCase
       ↓
SaleCompleted
       ├── Inventory
       ├── Audit
       └── Notifications
```

---

## Application Ports

Para servicios externos:

```ts
interface EmailNotifier {}

interface FileStorage {}

interface EventPublisher {}
```

Infrastructure:

```text
ResendEmailNotifier

S3FileStorage

RabbitMqEventPublisher
```

---

# FASE 14 — Multi-tenancy

Aquí el sistema evoluciona hacia SaaS.

Crear:

```text
features/organizations/
```

o:

```text
features/tenants/
```

---

# Tenant

Cada organización tendrá:

```text
users
products
inventory
suppliers
customers
purchases
sales
```

---

# Regla crítica

Toda información de negocio pertenece a:

```text
tenantId
```

Nunca:

```text
Tenant A
   ↓
datos Tenant B
```

---

# Membership

Introducir:

```text
User
 ↓
Membership
 ↓
Tenant
```

Un usuario podría pertenecer a varias organizaciones.

---

# Authorization

Ahora:

```text
User
 +
Tenant
 +
Role
 +
Permission
```

determinan acceso.

---

# Requests

El contexto pasa a contener:

```text
authenticatedUser
tenant
membership
permissions
```

---

# FASE 15 — Production readiness

Hasta ahora se ha trabajado principalmente en negocio.

Ahora endurecer la aplicación.

---

# Logging

Agregar logging estructurado.

Cada request debería tener:

```text
requestId
```

Logs:

```text
timestamp
level
requestId
method
path
userId
duration
error
```

Evitar:

```ts
console.log(...)
```

como estrategia de observabilidad.

---

# Security

Implementar:

```text
CORS explícito

secure headers

rate limiting

body limits

validation

session security

secret management
```

---

# Database

Revisar:

```text
indexes
unique constraints
foreign keys
transactions
pagination
N+1
```

Especial atención a:

```text
tenantId

sku

productId

createdAt

status
```

---

# Pagination

Para colecciones grandes preferir eventualmente:

```text
cursor pagination
```

sobre:

```text
OFFSET
```

cuando sea necesario.

---

# Idempotencia

Operaciones críticas:

```text
complete sale
receive purchase
payment
webhooks
```

deberían soportar protección ante ejecución duplicada cuando aplique.

---

# Concurrency

Analizar:

```text
dos ventas intentando consumir
el mismo stock al mismo tiempo
```

No confiar únicamente en:

```text
leer stock
↓
if stock >= quantity
↓
update
```

sin considerar concurrencia.

Introducir:

```text
transacciones
atomic updates
constraints
optimistic locking
```

según necesidad.

---

# Testing final

La pirámide recomendada:

```text
                 E2E
                  △
                 / \
                /   \
         Integration Tests
              /       \
             /         \
            /           \
          Unit Tests
```

---

# Unit tests

Principalmente:

```text
domain
application
```

---

# Integration tests

Principalmente:

```text
Prisma repositories
database
auth
```

---

# E2E

Flujos completos.

Ejemplo:

```text
login
 ↓
create category
 ↓
create product
 ↓
stock entry
 ↓
create customer
 ↓
create sale
 ↓
complete sale
 ↓
verify inventory
```

---

# Arquitectura objetivo final

Al completar la ruta:

```text
src/
├── features/
│   ├── auth/
│   ├── authorization/
│   ├── users/
│   ├── organizations/
│   │
│   ├── categories/
│   ├── products/
│   ├── inventory/
│   ├── stock-movements/
│   │
│   ├── suppliers/
│   ├── purchases/
│   │
│   ├── customers/
│   ├── sales/
│   │
│   ├── audit/
│   └── reports/
│
├── shared/
│   ├── config/
│   ├── database/
│   ├── errors/
│   ├── http/
│   ├── logging/
│   ├── middlewares/
│   └── security/
│
├── app.ts
└── index.ts
```

Cada feature compleja podrá tener:

```text
feature/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   ├── errors/
│   └── events/
│
├── application/
│   ├── use-cases/
│   ├── ports/
│   └── dto/
│
├── infrastructure/
│   ├── persistence/
│   └── external/
│
├── http/
│   ├── routes/
│   ├── schemas/
│   └── mappers/
│
└── index.ts
```

Pero solamente después de que la feature tenga tamaño suficiente para justificarlo.

---

# Evolución arquitectónica esperada

## Nivel 1

```text
Products
```

Aprendes:

```text
HTTP
Application
Domain
Repository
Prisma
```

---

## Nivel 2

```text
Products
+
Categories
```

Aprendes:

```text
relaciones entre features
```

---

## Nivel 3

```text
Inventory
+
Stock Movements
```

Aprendes:

```text
reglas reales de dominio
transacciones
consistencia
```

---

## Nivel 4

```text
Auth
+
Authorization
```

Aprendes:

```text
identidad
RBAC
seguridad
```

---

## Nivel 5

```text
Suppliers
+
Purchases
```

Aprendes:

```text
agregados
transacciones complejas
```

---

## Nivel 6

```text
Customers
+
Sales
```

Aprendes:

```text
flujos empresariales
compensaciones
historial
```

---

## Nivel 7

```text
Audit
+
Reports
```

Aprendes:

```text
observabilidad del negocio
read models
reporting
```

---

## Nivel 8

```text
Events
+
Ports
+
Integrations
```

Aprendes:

```text
desacoplamiento
arquitectura hexagonal
```

---

## Nivel 9

```text
Multi-Tenant SaaS
```

Aprendes:

```text
tenant isolation
memberships
advanced authorization
SaaS architecture
```

---

# Regla de avance

No avanzar simplemente porque un CRUD funciona.

Cada fase debe cumplir cuatro condiciones:

```text
funcional
+
arquitectónicamente correcta
+
probada
+
documentada
```

Antes de pasar de fase:

```text
✓ endpoints funcionando

✓ Swagger actualizado

✓ validaciones implementadas

✓ errores correctamente mapeados

✓ reglas de dependencia respetadas

✓ tests pasando

✓ migrations actualizadas

✓ lint/typecheck funcionando
```

---

# Orden final recomendado

```text
00. Project bootstrap

01. Products

02. Categories

03. Inventory

04. Stock Movements

05. Better Auth

06. Authorization / RBAC

07. Suppliers

08. Purchases

09. Customers

10. Sales

11. Audit

12. Reports

13. Value Objects

14. Domain Events

15. External Ports / Adapters

16. Multi-Tenancy

17. Logging / Observability

18. Security hardening

19. Concurrency / Idempotency

20. Integration tests

21. E2E tests

22. Production deployment
```

---

# Resultado final

El proyecto empieza siendo:

```text
Inventory API
```

evoluciona a:

```text
Inventory Management System
```

después:

```text
Inventory + Purchasing + Sales
```

posteriormente:

```text
Mini ERP
```

y finalmente puede transformarse en:

```text
Multi-Tenant Inventory SaaS
```

sin abandonar la arquitectura inicial.

La idea fundamental de toda la ruta será:

```text
Agregar complejidad de negocio
        ↓
introducir arquitectura necesaria
        ↓
no agregar abstracciones por anticipación
```

Es decir:

> primero aparece el problema y después introducimos el patrón que lo resuelve.
