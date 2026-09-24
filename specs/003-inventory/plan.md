# Plan 003 - Inventario

## Contexto

La Spec 003 implementa la Fase 3: separar el catálogo de productos de sus existencias. Debe crear un inventario inicial para los productos existentes y los nuevos, exponer consultas y actualización exclusiva de stock mínimo, y dejar la modificación de cantidades para Stock Movements en la Fase 4.

La implementación conservará las fronteras del proyecto: la lógica de estado e invariantes vivirá en `inventory/domain`, la orquestación en `inventory/application`, Prisma en `inventory/infrastructure` y los contratos OpenAPI/Zod en `inventory/http`. Products no importará infraestructura ni HTTP de Inventory. La spec no tiene dudas abiertas.

El código actual responde los fallos no controlados con `INTERNAL_SERVER_ERROR`; la Spec 003 exige `INTERNAL_ERROR`. El ajuste del manejador global afecta todas las respuestas `500` genéricas y debe verificarse como cambio de compatibilidad del contrato de error.

## Módulos y responsabilidades

| Módulo                                                                                           | Responsabilidad                                                                                                                       | RF cubiertos                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `prisma/schema.prisma` y migración de Inventory                                                  | Modelo uno-a-uno, valores iniciales, restricciones de integridad y creación de filas para productos existentes.                       | RF-1, RF-3, RF-4, RF-5                            |
| `products/domain/product.repository.ts` y `products/infrastructure/prisma-product.repository.ts` | Mantener la creación de producto como escritura atómica que crea su inventario inicial.                                               | RF-2, RF-34                                       |
| `inventory/domain/inventory.entity.ts`                                                           | Representación de inventario, validación de stock mínimo y cálculo puro de estado.                                                    | RF-4, RF-5, RF-6, RF-7, RF-8, RF-24, RF-25, RF-26 |
| `inventory/domain/inventory.repository.ts` y errores de dominio                                  | Contratos de consulta, listado y actualización; tipos de filtro, orden y resultado; error de producto no encontrado.                  | RF-3, RF-9, RF-11, RF-12 a RF-23, RF-33           |
| `inventory/application/inventory.service.ts`                                                     | Casos de uso `getProductStock`, `listInventory`, `updateMinimumStock` y adaptación de parámetros predeterminados.                     | RF-9, RF-11 a RF-25, RF-33                        |
| `inventory/infrastructure/prisma-inventory.repository.ts`                                        | Consultas Prisma con relación a Product, filtros calculados, total previo a paginación, orden estable y persistencia de stock mínimo. | RF-1, RF-3, RF-9, RF-11 a RF-25, RF-33            |
| `inventory/http/inventory.schemas.ts`, mapper y rutas                                            | Validación Zod, OpenAPI, serialización `data`, paginación y traducción HTTP de errores.                                               | RF-9, RF-10, RF-11, RF-13 a RF-31, RF-33          |
| `inventory/index.ts` y `src/app.ts`                                                              | Composition root y registro de `/inventory`.                                                                                          | RF-31                                             |
| `src/shared/errors/error-handler.ts`                                                             | Mantener el formato estándar de error y responder `500` con `INTERNAL_ERROR`.                                                         | RF-34                                             |

## Modelo de datos y contratos

### Persistencia

- Añadir `Inventory` con identificador interno, UUID, `productId` único, `quantity` entero con valor inicial `0`, `minimumStock` entero con valor inicial `0` y `updatedAt`.
- Modelar la relación uno-a-uno desde `Inventory.productId` hacia `Product.id`; `Product` expondrá la relación necesaria para escrituras anidadas y consultas.
- La migración creará la tabla, sus índices y restricciones de unicidad y no negatividad. Insertará una fila con ambos valores en `0` para cada producto existente, de modo idempotente ante datos ya provisionados.
- `quantity` no se expondrá como campo modificable en esta fase. Las restricciones de base de datos protegerán los invariantes ante accesos técnicos no previstos.

### Contrato de aplicación y dominio

- `Inventory` incluirá `productUuid`, resumen de producto, cantidad, stock mínimo y `updatedAt`. El estado se derivará mediante una función pura, no se almacenará.
- El estado será `OUT_OF_STOCK` si `quantity === 0`; `LOW_STOCK` si `quantity > 0 && quantity <= minimumStock`; y `IN_STOCK` si `quantity > minimumStock`.
- El contrato de listado aceptará `page`, `limit`, `search`, `isActive`, `status`, `sort`, `order` y desempates. Usará `page=1`, `limit=15`, `sort=name`, `order=asc`, seguido de `sku asc` y `productUuid asc`.
- El contrato de actualización aceptará únicamente `minimumStock` entero no negativo. No declarará una operación de actualización de cantidad.
- El error de dominio para una consulta o actualización cuyo producto no exista se traducirá a `404`. Los errores de forma de UUID, query y cuerpo se resolverán en la frontera HTTP con `400`.

### Contrato HTTP

- `GET /inventory` devolverá `{ data, pagination }`; cada elemento de `data` contendrá `productUuid`, `sku`, `name`, `categoryUuid`, `isActive`, `quantity`, `minimumStock`, `status` y `updatedAt`.
- `GET /inventory/:productUuid` y `PATCH /inventory/:productUuid/minimum-stock` devolverán `{ data }` con la misma representación.
- Los query params admitirán `isActive=true|false`, `status=IN_STOCK|LOW_STOCK|OUT_OF_STOCK`, búsqueda, paginación y los campos de orden especificados. Valores fuera de esos conjuntos devolverán `400`.
- El cuerpo de actualización eliminará campos desconocidos; si no queda `minimumStock`, devolverá `400`.
- Los fallos no controlados responderán el formato estándar `{ error: { code, message } }` con estado `500` y código `INTERNAL_ERROR`.

## Decisiones técnicas

### Relación uno-a-uno y migración de datos

- Elegida: usar una fila de Inventory por Product con `productId` único, valores por defecto y una migración que cree registros para todo producto existente.
- Descartada: calcular o almacenar cantidad dentro de Product. Mezclaría catálogo y existencias, contradiría el objetivo de la Fase 3 y dificultaría Stock Movements.
- RF cubiertos: RF-1, RF-3, RF-4, RF-5.

### Creación atómica de producto e inventario

- Elegida: extender la escritura Prisma de Product para crear Inventory como parte de la misma escritura transaccional/anidada.
- Descartada: crear primero Product y después invocar un servicio de Inventory. Un fallo intermedio dejaría un producto sin inventario y no cumpliría RF-34.
- Motivo arquitectónico: la infraestructura de Products usa la relación Prisma sin importar módulos internos de Inventory; Inventory conserva sus casos de uso de lectura y actualización. No se introduce un coordinador transaccional genérico sin necesidad actual.
- RF cubiertos: RF-2, RF-3, RF-34.

### Estado calculado y filtros de bajo stock

- Elegida: calcular `status` desde cantidad y stock mínimo en dominio, y traducir el filtro a condiciones de persistencia antes de contar y paginar.
- Descartada: persistir `status`. Sería información derivada que puede desincronizarse cuando la Fase 4 cambie cantidades.
- RF cubiertos: RF-6, RF-7, RF-8, RF-14, RF-22, RF-23.

### Listado estable sobre Product e Inventory

- Elegida: filtrar por campos de Product y Inventory en una única consulta relacional; aplicar `sku asc` y `productUuid asc` como desempates después del orden solicitado.
- Descartada: recuperar todos los registros y filtrar, calcular u ordenar en memoria. Invalidaría la paginación y el total sobre conjuntos grandes.
- RF cubiertos: RF-12 a RF-23.

### Errores y contrato global de 500

- Elegida: actualizar el manejador de errores no controlados para retornar `INTERNAL_ERROR`, conservando la forma pública existente `error.code` y `error.message`.
- Descartada: crear un error HTTP especial solo para la creación de inventario. La spec define un error interno estándar y el manejador global ya centraliza los `500`.
- Compatibilidad: clientes que dependan del código actual `INTERNAL_SERVER_ERROR` deberán adaptarse a `INTERNAL_ERROR`.
- RF cubiertos: RF-34.

## Estrategia de pruebas

| RF    | Prueba                                                                                                             | Nivel                  | Evidencia esperada                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------- |
| RF-1  | Aplicar la migración sobre una base desechable con productos existentes y comprobar una fila inicial por producto. | integración            | Cada producto previo tiene `quantity=0` y `minimumStock=0`.      |
| RF-2  | Crear un producto mediante el repositorio Prisma y consultar su inventario.                                        | integración            | Se crea exactamente un inventario inicial.                       |
| RF-3  | Intentar crear dos inventarios para un producto y comprobar la restricción.                                        | integración            | PostgreSQL rechaza el duplicado.                                 |
| RF-4  | Validar entidad y restricciones de datos con cero, negativo y decimal.                                             | unitario/integración   | Solo se aceptan enteros no negativos.                            |
| RF-5  | Actualizar stock mínimo con cero, negativo y decimal.                                                              | unitario/HTTP          | Cero se acepta; los inválidos devuelven `400`.                   |
| RF-6  | Evaluar una cantidad cero.                                                                                         | unitario               | Estado `OUT_OF_STOCK`.                                           |
| RF-7  | Evaluar cantidades positivas iguales o inferiores al mínimo.                                                       | unitario               | Estado `LOW_STOCK`.                                              |
| RF-8  | Evaluar una cantidad superior al mínimo.                                                                           | unitario               | Estado `IN_STOCK`.                                               |
| RF-9  | Consultar inventario de producto existente.                                                                        | aplicación/HTTP        | `200` y representación dentro de `data`.                         |
| RF-10 | Consultar y actualizar con UUID inválido.                                                                          | HTTP                   | `400`.                                                           |
| RF-11 | Consultar y actualizar UUID válido sin producto.                                                                   | aplicación/HTTP        | `404`.                                                           |
| RF-12 | Listar inventarios de productos activos e inactivos sin filtro.                                                    | integración/HTTP       | Ambos estados aparecen.                                          |
| RF-13 | Filtrar `isActive=true`, `isActive=false` y un valor inválido.                                                     | HTTP                   | Filtrado correcto y `400` para inválido.                         |
| RF-14 | Filtrar cada estado calculado.                                                                                     | integración/HTTP       | Solo aparecen registros del estado solicitado.                   |
| RF-15 | Solicitar un estado no admitido.                                                                                   | HTTP                   | `400`.                                                           |
| RF-16 | Buscar SKU/nombre con mayúsculas y espacios, incluido resultado vacío.                                             | aplicación/integración | Coincidencias insensibles; búsqueda vacía se omite.              |
| RF-17 | Omitir `page` y `limit`.                                                                                           | aplicación/HTTP        | `page=1`, `limit=15`.                                            |
| RF-18 | Enviar páginas y límites no enteros, menores que uno o inválidos.                                                  | HTTP                   | `400`.                                                           |
| RF-19 | Enviar `limit=101`.                                                                                                | HTTP                   | `400`.                                                           |
| RF-20 | Ordenar cada campo en ambas direcciones y forzar empates.                                                          | integración            | Orden solicitado seguido de SKU y UUID ascendentes.              |
| RF-21 | Enviar `sort` u `order` no admitidos.                                                                              | HTTP                   | `400`.                                                           |
| RF-22 | Listar una página con resultados.                                                                                  | HTTP                   | `data` y `pagination` completos.                                 |
| RF-23 | Combinar búsqueda, actividad y estado con paginación.                                                              | integración            | `total` cuenta antes de paginar y solo coincidencias.            |
| RF-24 | Actualizar el mínimo y comprobar que la cantidad no cambia.                                                        | aplicación/integración | Solo cambia `minimumStock` y `updatedAt`.                        |
| RF-25 | Repetir el mismo stock mínimo.                                                                                     | aplicación/HTTP        | Respuesta exitosa idempotente.                                   |
| RF-26 | Enviar mínimo ausente, nulo, no numérico, decimal y negativo.                                                      | HTTP                   | `400`.                                                           |
| RF-27 | Ejecutar cada endpoint exitoso.                                                                                    | HTTP                   | Resultado principal dentro de `data`.                            |
| RF-28 | Verificar schemas, mapper y respuestas de lista/detalle/actualización.                                             | HTTP/OpenAPI           | Todos los campos públicos requeridos están presentes.            |
| RF-29 | Enviar campos desconocidos al PATCH junto con mínimo válido.                                                       | HTTP                   | Se ignoran y el mínimo se actualiza.                             |
| RF-30 | Enviar solo campos desconocidos al PATCH.                                                                          | HTTP                   | `400`.                                                           |
| RF-31 | Consultar OpenAPI, Swagger y los tres endpoints registrados.                                                       | integración            | Rutas y documentación disponibles.                               |
| RF-32 | Inspeccionar contratos y rutas de Inventory.                                                                       | manual/HTTP            | No existe operación pública para modificar cantidad.             |
| RF-33 | Consultar y actualizar mínimo de producto inactivo.                                                                | integración/HTTP       | Ambas operaciones son exitosas.                                  |
| RF-34 | Forzar un fallo en la escritura anidada y consultar la base. Verificar el manejador global.                        | integración/HTTP       | No existe Product parcial; respuesta `500` con `INTERNAL_ERROR`. |

## Riesgos y dudas abiertas

- Riesgo controlado: la migración debe ejecutarse sobre una base de prueba previa a Inventory para demostrar la provisión de productos existentes; no basta con probar solo el esquema final.
- Riesgo controlado: el cambio de `INTERNAL_SERVER_ERROR` a `INTERNAL_ERROR` afecta todos los fallos no controlados y requiere una prueba de regresión del manejador global.
- Dudas abiertas: ninguna.
