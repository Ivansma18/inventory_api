# Plan 002 - Categorías

## Contexto

Este plan implementa la Spec 002 y la Fase 2 de `docs/ruta.md`: una feature `categories` y la relación de cada producto con una categoría. La fuente de verdad es `spec.md`, que no tiene dudas abiertas.

La implementación conservará las fronteras de `docs/constitution.md`: reglas y contratos sin frameworks en dominio, orquestación sin Prisma ni HTTP en aplicación, persistencia Prisma aislada en infraestructura, y Zod/OpenAPI, serialización y traducción de errores en HTTP. `app.ts` compondrá Categories y Products mediante sus APIs públicas; ningún módulo importará infraestructura o rutas internas de otra feature.

La relación se entregará gradualmente en dos despliegues. El primero incluirá una migración que permita temporalmente productos existentes sin categoría y exigirá categoría activa para productos nuevos. Tras clasificar todos los productos existentes, un segundo despliegue incorporará la migración que hará obligatoria la asociación y fallará atómicamente si queda alguno sin clasificar.

## Módulos y responsabilidades

| Módulo                                                                                     | Responsabilidad                                                                                                                                           | RF cubiertos                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `prisma/schema.prisma` y migraciones secuenciales                                          | Añadir `Category`, su nombre normalizado único y la relación temporalmente nullable desde `Product`; en un segundo despliegue, endurecerla a obligatoria. | RF-1, RF-3, RF-20, RF-21, RF-31, RF-33, RF-41 a RF-43            |
| `src/features/categories/domain/category.entity.ts`                                        | Representar la categoría, normalizar nombre y aplicar invariantes puras.                                                                                  | RF-1 a RF-4, RF-8 a RF-12, RF-35, RF-36                          |
| `src/features/categories/domain/category.repository.ts`                                    | Declarar creación, consulta, listado, actualización, eliminación y consulta de productos asociados.                                                       | RF-3, RF-5, RF-7, RF-13 a RF-21, RF-31                           |
| `src/features/categories/domain/category.errors.ts`                                        | Declarar errores de categoría sin códigos HTTP.                                                                                                           | RF-2, RF-3, RF-7, RF-21, RF-24, RF-26, RF-27, RF-31, RF-41       |
| `src/features/categories/application/category.service.ts`                                  | Orquestar operaciones de Categories, incluida la prohibición de desactivar o eliminar categorías con productos.                                           | RF-1 a RF-21, RF-31, RF-35, RF-36, RF-40                         |
| `src/features/categories/infrastructure/prisma-category.repository.ts`                     | Implementar persistencia, búsqueda por nombre normalizado, filtro/listado y operaciones serializables de cambio de estado o eliminación.                  | RF-1, RF-3, RF-5, RF-7, RF-13 a RF-21, RF-31, RF-41 a RF-43      |
| `src/features/categories/index.ts`                                                         | Exponer rutas y el lector público de estado de categorías usado por Products.                                                                             | RF-22 a RF-27, RF-34, RF-37, RF-41                               |
| `src/features/categories/http/category.schemas.ts`                                         | Definir schemas Zod/OpenAPI de cuerpos, UUID, query, respuestas y errores.                                                                                | RF-1 a RF-20, RF-29, RF-30, RF-35 a RF-40                        |
| `src/features/categories/http/category.mapper.ts`                                          | Serializar categorías sin exponer identificadores internos ni nombre normalizado.                                                                         | RF-5, RF-19, RF-20, RF-28, RF-36, RF-40                          |
| `src/features/categories/http/category.routes.ts`                                          | Publicar los cinco endpoints, validar solicitudes y traducir errores de negocio.                                                                          | RF-1 a RF-21, RF-28 a RF-31, RF-35 a RF-40                       |
| `src/features/products/domain/product.entity.ts` y contratos de repositorio                | Añadir `categoryUuid` nullable al producto de dominio durante la etapa temporal y soportar su conservación o asignación.                                  | RF-22, RF-25, RF-32, RF-33, RF-38, RF-39, RF-44 a RF-46          |
| `src/features/products/application/product.service.ts`                                     | Validar primero una categoría suministrada mediante el lector público y conservar la relación omitida según la etapa temporal.                            | RF-22 a RF-27, RF-32 a RF-34, RF-38, RF-39, RF-41, RF-44 a RF-46 |
| `src/features/products/infrastructure/prisma-product.repository.ts`                        | Mapear la relación Prisma y ejecutar creación/asignación dentro de una transacción serializable.                                                          | RF-22 a RF-27, RF-32 a RF-34, RF-41, RF-44 a RF-46               |
| `src/features/products/http/product.schemas.ts`, `product.mapper.ts` y `product.routes.ts` | Extender cuerpos, respuestas, OpenAPI y mapeo de errores de Products para `categoryUuid`.                                                                 | RF-22 a RF-29, RF-32, RF-34, RF-38, RF-39, RF-41, RF-44 a RF-46  |
| `src/features/products/index.ts` y `src/app.ts`                                            | Componer Products con el lector público de Categories y registrar `/categories`.                                                                          | RF-22 a RF-27, RF-34, RF-37, RF-41                               |
| `tests/categories/**/*.test.ts`, `tests/products/**/*.test.ts` y `tests/health.test.ts`    | Cubrir reglas puras, casos de uso, Prisma, contratos HTTP, OpenAPI, migraciones y regresión.                                                              | RF-1 a RF-46                                                     |

## Modelo de datos y contratos

### Persistencia y migraciones

La primera migración creará `Category` con identificador interno, UUID público, nombre visible, nombre normalizado único, descripción nullable, estado y timestamps. `Product` obtendrá una relación nullable hacia Category mediante el identificador interno; el UUID de categoría será el único valor expuesto fuera de persistencia.

La relación tendrá una restricción referencial que impida eliminar una categoría con productos. La regla adicional de no asociar productos a categorías inactivas no puede expresarse únicamente con una clave foránea, por lo que las operaciones de asociación, desactivación y eliminación se ejecutarán con aislamiento `Serializable`, reintento de conflictos transitorios y validación final dentro de la transacción.

La migración de endurecimiento no se añadirá a la cadena del primer despliegue. Solo se creará y aplicará en un segundo despliegue, después de clasificar los productos existentes. Debe comprobar que no haya filas de `Product` con relación nula antes de endurecer la columna. Si encuentra alguna, abortará la migración y conservará sin cambios el esquema y los datos.

### Categorías

La entidad `Category` tendrá `uuid`, `name`, `nameNormalized`, `description`, `isActive`, `createdAt` y `updatedAt`. El nombre se recortará y comparará sin distinguir mayúsculas y minúsculas; `nameNormalized` tendrá una restricción única incluso para categorías inactivas.

La consulta de colección normalizada incluirá `page`, `limit`, `search`, estado efectivo, campo de orden, dirección y desempates fijos por `createdAt` ascendente y UUID ascendente. El repositorio aplicará filtros, conteo y paginación en PostgreSQL.

La representación pública de una categoría será:

```text
uuid, name, description, isActive, createdAt, updatedAt
```

### Comunicación Categories -> Products

Categories expondrá desde su API pública un lector de categoría que permita determinar si un UUID existe y si está activo. Products dependerá únicamente de ese contrato público, nunca de `prisma-category.repository.ts` ni de rutas de Categories.

Al crear un producto, `categoryUuid` será obligatorio y deberá identificar una categoría activa. En una actualización, si se proporciona `categoryUuid`, Products validará el UUID y estado de categoría antes de buscar el producto, preservando la prioridad de errores de RF-34. Si se omite, conservará el valor actual. Durante la primera etapa, un producto heredado puede conservar `categoryUuid: null`; después de la segunda migración no podrá persistir ese estado.

La representación pública de Product agregará `categoryUuid`. Será `null` exclusivamente para productos existentes no clasificados durante la etapa temporal.

### HTTP y OpenAPI

Categories se publicará bajo `/categories`:

| Operación                  | Entrada                                                                                   | Éxito                             | Errores documentados |
| -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------- | -------------------- |
| `POST /categories`         | Nombre requerido; descripción opcional o `null`; propiedades no reconocidas se descartan. | `201` con `{ data: category }`.   | `400`, `409`         |
| `GET /categories`          | `page`, `limit`, `search`, `isActive`, `sort`, `order`.                                   | `200` con `{ data, pagination }`. | `400`                |
| `GET /categories/:uuid`    | UUID de ruta.                                                                             | `200` con `{ data: category }`.   | `400`, `404`         |
| `PATCH /categories/:uuid`  | Campos reconocidos opcionales; debe quedar al menos uno tras descartar extras.            | `200` con `{ data: category }`.   | `400`, `404`, `409`  |
| `DELETE /categories/:uuid` | UUID de ruta.                                                                             | `200` con `{ data: { uuid } }`.   | `400`, `404`, `409`  |

Products añadirá `categoryUuid` a sus contratos de creación, actualización y respuesta. Su creación documentará `400`, `404` y `409`; la actualización también documentará los mismos errores por categoría, además de conflictos de SKU. `categoryUuid: null` será inválido en entrada; el `null` de transición solo aparecerá como salida de productos heredados.

## Decisiones técnicas

### Migración gradual de la relación

- Elegida: usar una primera migración con relación nullable para clasificar productos existentes y crear la migración obligatoria solo para un segundo despliegue tras una comprobación atómica.
- Descartada: asignar automáticamente una categoría inicial. Contradice el fuera de alcance de la spec.
- Descartada: bloquear toda la fase cuando existan productos. Impediría clasificar los datos existentes mediante la API.
- RF cubiertos: RF-33, RF-42, RF-43, RF-45, RF-46.

### Unicidad de categorías mediante nombre normalizado

- Elegida: almacenar `name` recortado y `nameNormalized` único, conservando el nombre visible separado de su clave de comparación.
- Descartada: comprobar duplicados solo en aplicación o usar una unicidad sensible a mayúsculas. No cubre concurrencia ni variantes de capitalización.
- RF cubiertos: RF-2, RF-3.

### Contrato público de lectura de Categories

- Elegida: exponer un lector de estado desde `features/categories/index.ts` e inyectarlo al componer Products.
- Descartada: importar `PrismaCategoryRepository` desde Products. Rompe la frontera entre features establecida por la ruta y la constitución.
- RF cubiertos: RF-22 a RF-27, RF-34, RF-41.

### Integridad relacional con transacciones serializables

- Elegida: realizar asociación, desactivación y eliminación mediante transacciones Prisma con aislamiento `Serializable`, reintentando conflictos de serialización y traduciendo el resultado que no preserva la invariante a `409`.
- Descartada: validar estado o conteo fuera de una transacción. Deja una ventana entre validar y escribir que puede asociar productos a categorías eliminadas o inactivas.
- RF cubiertos: RF-20, RF-21, RF-24, RF-27, RF-31, RF-41.

### Extensión compatible de la respuesta de Product

- Elegida: añadir siempre `categoryUuid` a la representación pública y usar `null` solo para datos heredados durante la etapa temporal.
- Descartada: ocultar la relación en Products o devolver formas distintas según el endpoint. No permite consultar la clasificación de forma consistente.
- RF cubiertos: RF-32, RF-33, RF-38, RF-39, RF-44 a RF-46.

### Filtros, orden y paginación en el repositorio

- Elegida: normalizar la query en aplicación y aplicar búsqueda, estado, conteo, orden y paginación dentro de PostgreSQL.
- Descartada: cargar todas las categorías y filtrar en aplicación. No garantiza el total correcto ni escala para colecciones grandes.
- RF cubiertos: RF-13 a RF-19.

## Estrategia de pruebas

| RF                                      | Prueba                                                                                                                                                                                   | Nivel                                           | Evidencia esperada                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| RF-1 a RF-4, RF-8 a RF-12, RF-35, RF-36 | Crear y actualizar categorías válidas; trim, nombre vacío, descripción omitida o nula y cambios de estado idempotentes.                                                                  | Dominio y aplicación                            | Invariantes puras, normalización y valores finales correctos.                      |
| RF-3                                    | Crear o actualizar categorías con el mismo nombre por capitalización, espacios o categoría inactiva.                                                                                     | Aplicación con falso e integración Prisma       | Conflicto de dominio y restricción única de PostgreSQL.                            |
| RF-5 a RF-7                             | Consultar UUID existente, inexistente e inválido.                                                                                                                                        | Aplicación y HTTP                               | Respuestas `200`, `404` y `400`.                                                   |
| RF-13 a RF-19                           | Listar sin estado, por estado, con búsqueda vacía, filtros acumulativos, paginación, cada campo de orden y empates.                                                                      | Aplicación con falso, integración Prisma y HTTP | Defaults, total filtrado y orden estable correctos; query inválida devuelve `400`. |
| RF-20, RF-21, RF-31                     | Eliminar o desactivar categorías sin productos y con productos asociados.                                                                                                                | Aplicación, integración Prisma y HTTP           | Eliminación `200`; operaciones bloqueadas con `409`.                               |
| RF-22 a RF-27, RF-34, RF-38, RF-39      | Crear y actualizar Products con categoría activa, inexistente, inactiva, UUID inválido, ausente o nulo; verificar prioridad de categoría antes de producto inexistente.                  | Aplicación y HTTP                               | Asociación correcta y errores `400`, `404` o `409` documentados.                   |
| RF-28 a RF-30, RF-37, RF-40             | Verificar envolturas, descarte de propiedades extra, actualización vacía, cinco rutas y schemas OpenAPI.                                                                                 | HTTP                                            | Contratos `{ data }`, paginación, errores y OpenAPI consistentes.                  |
| RF-32, RF-44                            | Actualizar Product con categoría omitida y comprobar `categoryUuid` en creación, consulta, listado y actualización.                                                                      | Aplicación, integración Prisma y HTTP           | La asociación se conserva y se expone siempre.                                     |
| RF-33, RF-42, RF-43, RF-45, RF-46       | Ejecutar la primera migración con productos existentes, clasificar por `PATCH`, validar salida nullable y verificar que la migración final falla sin cambios si queda una relación nula. | Integración de migraciones y HTTP               | Transición gradual correcta y segunda migración atómica.                           |
| RF-41                                   | Ejecutar asociación concurrente contra desactivación y eliminación de la misma categoría.                                                                                                | Integración Prisma                              | El estado final mantiene integridad; la asociación que pierde responde `409`.      |
| Regresión                               | Ejecutar pruebas existentes de Products, salud, Swagger y el documento OpenAPI completo.                                                                                                 | Suite completa                                  | Los contratos ya publicados siguen funcionando con `categoryUuid` añadido.         |

Las pruebas de dominio y aplicación usarán falsos de repositorio y lector de categorías, sin Hono, Prisma ni PostgreSQL. Las pruebas de infraestructura y migraciones usarán la base de prueba configurada. Las pruebas HTTP usarán `app.request` y comprobarán tanto la respuesta como el documento `/openapi.json`.

## Riesgos y dudas abiertas

- No hay dudas abiertas de producto ni categorías.
- La segunda migración requiere coordinación operativa: solo debe ejecutarse cuando la clasificación temporal haya terminado.
- Las pruebas concurrentes y de migración requieren una `DATABASE_URL` de prueba aislada y no incluirán credenciales en el repositorio.
