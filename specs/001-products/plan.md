# Plan 001 - Productos

## Contexto

Este plan implementará la primera capacidad de negocio: catálogo de productos. La fuente de verdad es `spec.md`; no tiene dudas abiertas. Debe respetar la Fase 1 de `docs/ruta.md`: una feature `products` con un servicio de aplicación único, cuatro endpoints (`POST`, `GET` de colección, `GET` individual y `PATCH`) y sin autenticación ni eliminación física.

La implementación mantendrá las fronteras de `docs/constitution.md`: dominio sin frameworks, aplicación sin Prisma ni HTTP, repositorio Prisma en infraestructura y validación, OpenAPI, serialización y traducción de errores en HTTP. `app.ts` únicamente registrará la feature y conservará la configuración transversal existente.

## Módulos y responsabilidades

| Módulo                                                              | Responsabilidad                                                                                                                          | RF cubiertos                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `prisma/schema.prisma` y migración de Products                      | Persistir el modelo, índices y restricciones de unicidad necesarios.                                                                     | RF-1, RF-6, RF-10, RF-12, RF-13, RF-17, RF-28    |
| `src/features/products/domain/product.entity.ts`                    | Representar el producto y asegurar las invariantes puras de SKU, nombre y precios.                                                       | RF-1 a RF-5, RF-7, RF-19 a RF-21, RF-29          |
| `src/features/products/domain/product.repository.ts`                | Definir entradas y salidas de persistencia: crear, buscar por UUID/SKU normalizado, actualizar y listar con filtros, orden y paginación. | RF-6, RF-8 a RF-15, RF-22 a RF-26                |
| `src/features/products/domain/product.errors.ts`                    | Declarar errores de producto sin códigos HTTP.                                                                                           | RF-6, RF-11, RF-28                               |
| `src/features/products/application/product.service.ts`              | Orquestar creación, consulta, listado y actualización mediante el contrato de repositorio.                                               | RF-1 a RF-32                                     |
| `src/features/products/infrastructure/prisma-product.repository.ts` | Implementar el contrato con Prisma y mapear entre modelo de persistencia y tipos de dominio/aplicación.                                  | RF-1, RF-6, RF-8 a RF-15, RF-22 a RF-26          |
| `src/features/products/http/product.schemas.ts`                     | Definir schemas Zod/OpenAPI de cuerpos, parámetros, query y respuestas.                                                                  | RF-1 a RF-5, RF-18, RF-22 a RF-27, RF-29 a RF-32 |
| `src/features/products/http/product.mapper.ts`                      | Convertir resultados de aplicación en respuestas HTTP sin exponer campos internos de persistencia.                                       | RF-10, RF-14, RF-16, RF-29                       |
| `src/features/products/http/product.routes.ts`                      | Declarar rutas, validar solicitudes, delegar en el servicio y traducir errores de producto a HTTP.                                       | RF-1 a RF-32                                     |
| `src/features/products/index.ts` y `src/app.ts`                     | Componer repositorio, servicio y rutas; registrar `/products` sin iniciar el servidor.                                                   | RF-1 a RF-32                                     |
| `tests/products/**/*.test.ts`                                       | Probar reglas puras, casos de uso, repositorio Prisma y contrato HTTP.                                                                   | RF-1 a RF-32                                     |

## Modelo de datos y contratos

### Persistencia

El modelo `Product` contendrá un identificador interno, UUID público, SKU visible, SKU normalizado, nombre, descripción nullable, precio de compra, precio de venta, estado y timestamps. El UUID será único y se expondrá como `uuid`; el identificador interno y `skuNormalized` no se devolverán por HTTP.

`sku` se almacenará sin espacios exteriores y `skuNormalized` conservará su representación normalizada para comparación sin distinguir mayúsculas y minúsculas. Se aplicará una restricción única sobre `skuNormalized`, de modo que la garantía no dependa únicamente de una comprobación previa de la aplicación y se mantenga para productos inactivos.

Los precios se persistirán como valores decimales de escala dos, nunca como `float`. La migración creará la tabla, sus restricciones e índices necesarios, incluida la unicidad de UUID y SKU normalizado.

### Tipos de aplicación y repositorio

El servicio recibirá tipos propios de creación, actualización y listado, independientes de Zod y de Prisma. La actualización representará campos opcionales y distinguirá descripción omitida de `description: null`. El contrato de repositorio recibirá una consulta ya normalizada que incluya:

- `page` y `limit`.
- Búsqueda opcional por SKU o nombre.
- Estado efectivo, que será `true` si el cliente no envía `isActive`.
- Campo y dirección de orden.
- Desempates fijos por `createdAt` ascendente y UUID ascendente.

El resultado de listado incluirá los productos paginados y el total que coincide con todos los filtros antes de paginar.

### HTTP y OpenAPI

Se publicarán estos contratos bajo `/products`:

| Operación               | Entrada                                                                                          | Éxito                             | Errores documentados |
| ----------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------- |
| `POST /products`        | SKU, nombre y precios requeridos; descripción opcional; propiedades no reconocidas se descartan. | `201` con `{ data: product }`.    | `400`, `409`         |
| `GET /products`         | `page`, `limit`, `search`, `isActive`, `sort`, `order`.                                          | `200` con `{ data, pagination }`. | `400`                |
| `GET /products/:uuid`   | UUID de ruta.                                                                                    | `200` con `{ data: product }`.    | `400`, `404`         |
| `PATCH /products/:uuid` | Campos reconocidos opcionales; al menos uno debe permanecer tras descartar los no reconocidos.   | `200` con `{ data: product }`.    | `400`, `404`, `409`  |

La representación pública de `product` incluirá `uuid`, `sku`, `name`, `description`, `purchasePrice`, `salePrice`, `isActive`, `createdAt` y `updatedAt`. La forma exacta de decimal y timestamp será uniforme en todos los schemas de respuesta y se verificará contra el documento OpenAPI.

La capa HTTP eliminará propiedades no reconocidas antes de entregar la entrada al servicio. Para `PATCH`, comprobará después que exista al menos un campo reconocido; para `POST`, el schema seguirá exigiendo los campos obligatorios. Los errores de validación se devolverán como `400`; `ProductNotFoundError` se traducirá a `404` y el conflicto de SKU a `409`. El manejador genérico existente conservará el tratamiento de errores inesperados como `500`.

## Decisiones técnicas

### Estructura mínima por feature

- Elegida: usar `domain/`, `application/product.service.ts`, `infrastructure/`, `http/` e `index.ts`, sin separar todavía cada caso de uso en archivos distintos.
- Descartada: crear un use case, DTO y mapper por cada operación desde el inicio. Añadiría archivos y abstracciones sin necesidad en Fase 1.
- RF cubiertos: RF-1 a RF-32.

### Unicidad de SKU mediante columna normalizada

- Elegida: mantener `sku` visible y una columna interna `skuNormalized` con índice único; el dominio/aplicación normaliza con trim y comparación insensible a mayúsculas antes de consultar.
- Descartada: depender de una comprobación de existencia en memoria o de un índice único sensible a mayúsculas. Ambas alternativas permiten duplicados bajo concurrencia o con variaciones de capitalización.
- RF cubiertos: RF-2, RF-6, RF-12.

### Valores monetarios decimales

- Elegida: validar máximo dos decimales y persistir precios como `Decimal` de Prisma/PostgreSQL; los mappers serializan una forma de contrato consistente.
- Descartada: usar `number`/`float` en persistencia. Puede introducir errores de precisión en precios.
- RF cubiertos: RF-1, RF-4, RF-5, RF-12.

### Filtrado, orden y paginación dentro del repositorio

- Elegida: el servicio construye una consulta normalizada y el repositorio aplica filtros, orden, conteo y paginación en PostgreSQL. El filtro predeterminado activo también llegará explícito al repositorio.
- Descartada: recuperar todos los productos y filtrar o paginar en aplicación. No escala y puede producir un `total` o páginas incorrectos.
- RF cubiertos: RF-8, RF-9, RF-14, RF-15, RF-22 a RF-26.

### Desempates fijos de orden

- Elegida: toda consulta ordenará primero por el campo y dirección solicitados, luego por `createdAt` ascendente y finalmente por UUID ascendente.
- Descartada: confiar en el orden natural de PostgreSQL. No garantiza páginas estables cuando hay valores repetidos.
- RF cubiertos: RF-25.

### Validación tolerante de propiedades adicionales

- Elegida: los schemas de creación y actualización eliminarán propiedades no definidas. `PATCH` rechazará con `400` un cuerpo que quede vacío tras esa eliminación.
- Descartada: rechazar toda propiedad adicional o aceptar un `PATCH` sin cambios. La primera contradice RF-30/RF-32; la segunda contradice RF-31.
- RF cubiertos: RF-30 a RF-32.

### Traducción de errores en el router de Products

- Elegida: el subrouter de Products reconocerá los errores de dominio de su feature y los convertirá a las respuestas documentadas; el manejador global seguirá resolviendo errores inesperados.
- Descartada: hacer que errores de dominio incluyan códigos HTTP o que el manejador compartido importe errores específicos de Products. Ambas alternativas rompen las fronteras de dependencias.
- RF cubiertos: RF-6, RF-11, RF-18, RF-23, RF-27, RF-28.

## Estrategia de pruebas

| RF                         | Prueba                                                                                        | Nivel                                                 | Evidencia esperada                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| RF-1                       | Crear un producto válido, con UUID, timestamps y estado activo.                               | Dominio y aplicación                                  | Producto creado con valores normalizados y `isActive=true`.                            |
| RF-2, RF-3                 | Rechazar SKU o nombre ausentes, vacíos o compuestos solo por espacios.                        | Dominio y HTTP                                        | Regla pura rechazada y respuesta `400`.                                                |
| RF-4, RF-5                 | Rechazar precios negativos o con más de dos decimales; aceptar cero.                          | Dominio y HTTP                                        | Regla pura rechazada y respuesta `400`; cero aceptado.                                 |
| RF-6                       | Crear o actualizar con SKU igual por capitalización, espacios o producto inactivo.            | Aplicación con repositorio falso e integración Prisma | Conflicto de dominio y respuesta `409`; índice impide duplicado.                       |
| RF-7, RF-19, RF-20, RF-29  | Crear/actualizar sin descripción y actualizar con descripción `null`.                         | Aplicación y HTTP                                     | Omisión conserva el valor al actualizar; `null` lo elimina y se devuelve `null`.       |
| RF-8, RF-9, RF-15          | Listar sin estado, por estado y con búsqueda más estado.                                      | Aplicación con repositorio falso e integración Prisma | Solo se devuelven los productos que satisfacen el filtro efectivo acumulativo.         |
| RF-10, RF-11, RF-18, RF-28 | Consultar y actualizar UUID existente, inexistente e inválido.                                | HTTP                                                  | Respuestas `200`, `404` y `400` según corresponda.                                     |
| RF-12, RF-21               | Actualizar parcialmente SKU, nombre, descripción o precios sin cambiar estado si no se envía. | Aplicación y HTTP                                     | Solo se modifican campos proporcionados y el estado se conserva.                       |
| RF-13, RF-17               | Desactivar o activar el mismo producto repetidamente.                                         | Aplicación y HTTP                                     | Estado final solicitado y respuesta exitosa idempotente.                               |
| RF-14, RF-16               | Verificar envoltura `data`, metadatos de paginación y total filtrado.                         | HTTP                                                  | Estructura y total del contrato coinciden con OpenAPI.                                 |
| RF-22, RF-23, RF-27        | Omitir defaults y enviar paginación, filtros, sort u order inválidos.                         | HTTP                                                  | Defaults aplicados; entradas inválidas responden `400`.                                |
| RF-24                      | Buscar por SKU/nombre sin distinguir capitalización, con coincidencia parcial y con espacios. | Aplicación e integración Prisma                       | Resultados correctos; búsqueda vacía se comporta como omitida.                         |
| RF-25, RF-26               | Ordenar por cada campo permitido, ambas direcciones y empates.                                | Integración Prisma y HTTP                             | Orden principal y desempates `createdAt`/UUID estables; campo inválido responde `400`. |
| RF-30, RF-32               | Crear con campos adicionales junto con todos los requeridos.                                  | HTTP                                                  | Producto creado; propiedades extra no se persisten ni se exponen.                      |
| RF-31                      | Actualizar solo con campos adicionales.                                                       | HTTP                                                  | Respuesta `400` y producto sin modificaciones.                                         |
| Contrato OpenAPI           | Consultar `/openapi.json` tras registrar Products.                                            | HTTP                                                  | Los cuatro endpoints, schemas y códigos de respuesta están publicados.                 |
| Regresión                  | Mantener pruebas existentes de salud, Swagger y manejo de errores inesperados.                | HTTP                                                  | `GET /health`, `/docs` y `500` transversal continúan funcionando.                      |

Las pruebas de dominio y aplicación no usarán Hono, Prisma ni PostgreSQL. El repositorio Prisma se verificará contra una base de datos de prueba configurada para integración; los contratos HTTP usarán `app.request` y dobles de repositorio/servicio cuando no necesiten persistencia real.

## Riesgos y dudas abiertas

- No hay dudas abiertas de producto.
- La migración y las pruebas de integración requieren una `DATABASE_URL` de prueba accesible; no se incluirán credenciales en el repositorio.
- La precisión máxima de almacenamiento decimal será elegida en la migración sin convertirla en una regla de negocio adicional; la regla observable permanece en un máximo de dos decimales.
