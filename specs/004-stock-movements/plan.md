# Plan 004 - Movimientos de Stock

## Contexto

La Spec 004 implementa la Fase 4: cada cambio de `Inventory.quantity` pasa por un movimiento inmutable de tipo `IN`, `OUT` o `ADJUSTMENT`. La feature debe registrar el stock anterior y resultante, impedir saldos negativos, soportar consultas paginadas y conservar consistencia bajo concurrencia.

La implementacion creara `src/features/stock-movements/` con capas `domain`, `application`, `infrastructure` y `http`. Las reglas puras no dependeran de Hono, Prisma ni PostgreSQL. Prisma y las transacciones viviran exclusivamente en infraestructura; Zod/OpenAPI y la traduccion de errores viviran en HTTP. La spec no tiene dudas abiertas y no contradice la constitucion.

La feature accedera a las tablas `Product`, `Inventory` y `StockMovement` desde su propia infraestructura Prisma, sin importar infraestructura ni HTTP de Inventory o Products. Esto conserva las fronteras entre features y permite que la operacion que actualiza el inventario y crea el movimiento sea una unica transaccion.

## Modulos y responsabilidades

| Modulo                                                                       | Responsabilidad                                                                                                                                       | RF cubiertos                                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma` y migracion de StockMovement                          | Declarar el enum de tipo, el modelo inmutable, sus relaciones, UUID publico e indices para historial por producto y orden cronologico.                | RF-1 a RF-6, RF-12 a RF-18, RF-32, RF-33, RF-40                                                          |
| `stock-movements/domain/stock-movement.entity.ts`                            | Representar el movimiento y calcular de forma pura `previousStock` y `newStock` para entrada, salida y ajuste.                                        | RF-1 a RF-8, RF-12, RF-40, RF-52                                                                         |
| `stock-movements/domain/stock-movement.errors.ts`                            | Declarar errores de producto inexistente y stock insuficiente sin codigos HTTP.                                                                       | RF-9, RF-31                                                                                              |
| `stock-movements/domain/stock-movement.repository.ts`                        | Definir el contrato para registrar una operacion de forma atomica y consultar movimientos con filtros, orden estable y paginacion.                    | RF-13 a RF-18, RF-23 a RF-29, RF-35, RF-41, RF-43, RF-45, RF-48                                          |
| `stock-movements/application/stock-movement.service.ts`                      | Orquestar entradas, salidas, ajustes y listados; normalizar `reason` y `reference`; aplicar valores predeterminados de consulta.                      | RF-1 a RF-16, RF-23 a RF-29, RF-34, RF-35, RF-37, RF-38, RF-40, RF-41, RF-44, RF-45, RF-48, RF-51, RF-52 |
| `stock-movements/infrastructure/prisma-stock-movement.repository.ts`         | Ejecutar la transaccion serializable, reintentar conflictos de escritura, leer el stock confirmado, persistir ambos cambios y aplicar filtros Prisma. | RF-9, RF-12 a RF-18, RF-23 a RF-27, RF-35, RF-38, RF-41 a RF-45, RF-48                                   |
| `stock-movements/http/stock-movement.schemas.ts`                             | Definir schemas Zod/OpenAPI para los tres cuerpos, params, filtros y respuestas.                                                                      | RF-7, RF-8, RF-10, RF-11, RF-25 a RF-32, RF-34, RF-36, RF-39, RF-44 a RF-47, RF-49 a RF-56               |
| `stock-movements/http/stock-movement.mapper.ts` y `stock-movement.routes.ts` | Serializar respuestas, montar las cinco operaciones y traducir errores de dominio a respuestas HTTP.                                                  | RF-9, RF-20 a RF-24, RF-29 a RF-32, RF-36, RF-42, RF-43, RF-46, RF-47                                    |
| `stock-movements/index.ts` y `src/app.ts`                                    | Construir las dependencias Prisma y registrar las tres rutas de producto bajo `/inventory` y el listado bajo `/stock-movements`.                      | RF-19 a RF-24                                                                                            |

## Modelo de datos y contratos

### Persistencia

- Agregar el enum `StockMovementType` con `IN`, `OUT` y `ADJUSTMENT`.
- Agregar `StockMovement` con `id` interno, `uuid` unico UUID publico, `productId` obligatorio, `type`, `quantity`, `previousStock`, `newStock`, `reason` nullable, `reference` nullable y `createdAt`.
- Relacionar `StockMovement.productId` con `Product.id` usando eliminacion restrictiva. `Product` expondra la coleccion necesaria para la relacion Prisma.
- Crear indices para el historial por producto y orden cronologico, como `[productId, createdAt, uuid]`, y para el listado global ordenado por `[createdAt, uuid]`. Los filtros de tipo y producto se combinaran con esos indices sin introducir extensiones de base de datos fuera de alcance.
- La migracion no modifica datos existentes: todos los productos ya tienen Inventory por la Fase 3. La ausencia tecnica de Inventory para un producto existente se detectara como inconsistencia y respondera `500` con `INTERNAL_ERROR`.
- No se agregaran operaciones de actualizacion o eliminacion de `StockMovement`; la inmutabilidad se preserva por la API y por la ausencia de metodos de repositorio para mutarlo.

### Dominio y aplicacion

- La entidad de dominio expondra una representacion de movimiento con `uuid`, `productUuid`, tipo, cantidad, stocks anterior y nuevo, motivo, referencia y fecha.
- Las funciones puras calcularan entrada como `previousStock + quantity`, salida como `previousStock - quantity` y ajuste como `quantity` final. Rechazaran cantidades fuera de las invariantes y salidas que superen el stock recibido.
- El servicio expondria operaciones separadas para crear entrada, salida y ajuste, mas operaciones de listado por producto y global. Cada operacion enviara una intencion al repositorio atomico; el adaptador leera el stock vigente dentro de la transaccion antes de usar la regla pura.
- `reason` solo es un campo reconocido de ajustes: debe ser texto no vacio tras `trim()` y se persistira recortado. En entradas y salidas se ignora por ser un campo no reconocido.
- `reference` puede omitirse, ser `null` o ser texto. El servicio la recorta y transforma una cadena vacia en `null`; cualquier otro tipo se rechaza en HTTP con `400`.
- Las consultas usaran `page=1`, `limit=15`, maximo `100`, orden `createdAt desc` seguido de `uuid asc`, y `pagination.total` calculado antes de `skip` y `take`.
- Los filtros admitiran tipo, rango de `createdAt` inclusivo con extremos opcionales, `productUuid` solo en el listado global y coincidencia parcial case-insensitive de referencias no nulas. Un filtro de referencia vacio se omite.

### Contrato HTTP

- `POST /inventory/{productUuid}/entries` y `POST /inventory/{productUuid}/exits` aceptaran `{ quantity, reference? }`; `reason` y cualquier otro campo desconocido se eliminaran antes de llamar al servicio.
- `POST /inventory/{productUuid}/adjustments` aceptara `{ quantity, reason, reference? }`; los campos desconocidos se eliminaran.
- Las tres creaciones devolveran `201` y `{ data: StockMovementResponse }`.
- `GET /inventory/{productUuid}/movements` y `GET /stock-movements` devolveran `{ data: StockMovementResponse[], pagination }`. Solo el listado global acepta `productUuid`.
- `StockMovementResponse` incluira exactamente `uuid`, `productUuid`, `type`, `quantity`, `previousStock`, `newStock`, `reason`, `reference` y `createdAt`; los valores ausentes se serializan como `null`.
- Parametros UUID, cuerpos, tipos, fechas, filtros y paginacion invalidos devolveran `400` con `{ error: { code: "VALIDATION_ERROR", message } }`.
- El error de salida insuficiente se traducira a `409` con codigo `INSUFFICIENT_STOCK`; un producto UUID valido inexistente a `404`; las fallas tecnicas y la inconsistencia de Inventory se delegaran al manejador global como `500` con `INTERNAL_ERROR`.

## Decisiones tecnicas

### Transaccion serializable con reintento acotado

- Elegida: encapsular la lectura de Inventory, el calculo sobre el stock leido, la actualizacion de cantidad y la insercion del movimiento en una transaccion Prisma interactiva de aislamiento `Serializable`. Reintentar un numero acotado de conflictos de serializacion o deadlocks antes de propagar el fallo.
- Descartada: leer Inventory en aplicacion y ejecutar despues dos escrituras independientes. Puede perder actualizaciones o permitir salidas concurrentes sobre el mismo saldo.
- Descartada: bloquear o actualizar directamente desde las rutas HTTP. Acoplaria Hono a Prisma y violaria la frontera HTTP.
- RF cubiertos: RF-9, RF-12 a RF-16, RF-42, RF-43.

### Regla pura y adaptador atomico

- Elegida: mantener en dominio el calculo de cada movimiento y sus invariantes; el repositorio Prisma invoca esa regla dentro de la transaccion con el stock confirmado que acaba de leer.
- Descartada: calcular deltas y validar insuficiencia solo en Prisma. Las reglas no tendrian pruebas unitarias independientes de PostgreSQL.
- RF cubiertos: RF-1 a RF-8, RF-9, RF-12, RF-15, RF-16, RF-40.

### Repositorio propio de Stock Movements

- Elegida: la feature tendra un adaptador Prisma propio que usa las tablas relacionadas sin importar `PrismaInventoryRepository` ni `PrismaProductRepository`.
- Descartada: reutilizar la infraestructura interna de Inventory. Incumpliria la regla de dependencia entre features y ocultaria la transaccion de la operacion en una capa ajena.
- RF cubiertos: RF-13, RF-14, RF-19, RF-42, RF-43.

### Dos montajes HTTP para una feature

- Elegida: exponer desde la API publica de Stock Movements una subruta para montarse bajo `/inventory` y otra para `/stock-movements`; `app.ts` registrara ambas sin modificar las rutas existentes de Inventory.
- Descartada: incorporar las cinco rutas a la feature Inventory. Mezclaria consulta de existencias con el nuevo agregado historico y dificultaria su evolucion posterior.
- RF cubiertos: RF-19 a RF-24.

### Validacion por schemas de operacion

- Elegida: usar schemas independientes para entrada, salida y ajuste, todos con `.strip()` para ignorar campos desconocidos. Los schemas distinguira `reference: null` de los tipos invalidos y exigira `reason` solo al ajuste.
- Descartada: un unico schema de movimiento condicionado por `type`. El tipo procede de la ruta, no del cuerpo, y el contrato seria menos claro en Swagger.
- RF cubiertos: RF-7, RF-8, RF-10, RF-11, RF-36, RF-47, RF-49 a RF-56.

### Listado delegando filtros a PostgreSQL

- Elegida: construir `where`, `orderBy`, conteo y pagina en el repositorio Prisma; usar los mismos filtros para `findMany` y `count`.
- Descartada: recuperar movimientos y filtrar u ordenar en memoria. Romperia `pagination.total`, escalabilidad y orden estable.
- RF cubiertos: RF-23 a RF-29, RF-34, RF-35, RF-39, RF-41, RF-45.

## Estrategia de pruebas

| RF                                               | Prueba                                                                                                      | Nivel                          | Evidencia esperada                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| RF-1 a RF-8, RF-12, RF-40                        | Crear movimientos puros de cada tipo con cantidades limite.                                                 | unitario de dominio            | Deltas, stock final de ajuste y registros anterior/nuevo correctos; valores invalidos se rechazan.           |
| RF-9, RF-16                                      | Intentar salida superior al stock y dos salidas concurrentes.                                               | dominio/integracion PostgreSQL | Error de insuficiencia; ninguna combinacion persiste stock negativo.                                         |
| RF-10, RF-11, RF-37, RF-44, RF-51, RF-52         | Crear ajustes con motivo ausente, vacio, no textual y espacios; crear referencias ausentes, nulas y vacias. | HTTP/aplicacion                | `400` para motivo invalido; valores normalizados y `null` en respuestas segun contrato.                      |
| RF-13, RF-14, RF-42                              | Forzar fallos entre actualizacion de Inventory e insercion de StockMovement.                                | integracion PostgreSQL/HTTP    | Rollback total y `500 INTERNAL_ERROR` ante fallo tecnico.                                                    |
| RF-15, RF-16                                     | Ejecutar en paralelo entradas, salidas y ajustes sobre el mismo producto.                                   | integracion PostgreSQL         | Cada movimiento encadena el stock confirmado mas reciente y no hay actualizaciones perdidas.                 |
| RF-17 a RF-19                                    | Inspeccionar contratos, rutas y operacion de repositorio publica.                                           | manual/HTTP                    | No hay endpoint ni metodo de edicion, eliminacion o cambio directo de `Inventory.quantity`.                  |
| RF-20 a RF-24, RF-46                             | Invocar las tres rutas de creacion y ambos listados.                                                        | HTTP/OpenAPI                   | Rutas registradas, documentadas y creaciones con `201 { data }`.                                             |
| RF-25 a RF-29, RF-34, RF-35, RF-39, RF-41, RF-45 | Sembrar movimientos de los tres tipos y consultar con filtros individuales, combinados y varias paginas.    | integracion PostgreSQL/HTTP    | Filtros inclusivos y case-insensitive correctos; orden `createdAt desc`, `uuid asc`; total previo a paginar. |
| RF-30, RF-31                                     | Usar UUID invalido y UUID valido sin Product en creacion y consulta.                                        | HTTP                           | `400` para forma invalida y `404` para producto inexistente.                                                 |
| RF-32, RF-33                                     | Verificar mapper, schema de respuesta y fila almacenada.                                                    | HTTP/integracion               | Todos los campos publicos requeridos presentes; no existe `createdBy` almacenado ni expuesto.                |
| RF-36                                            | Enviar tipo, fechas, referencias, rangos y pagina/limit invalidos.                                          | HTTP                           | Cada entrada invalida responde `400 VALIDATION_ERROR`.                                                       |
| RF-38                                            | Registrar y listar movimientos de producto inactivo.                                                        | integracion PostgreSQL/HTTP    | Las operaciones se completan sin tratar la inactividad como error.                                           |
| RF-43                                            | Eliminar o simular la ausencia de Inventory para un Product existente antes de operar.                      | integracion PostgreSQL/HTTP    | `500 INTERNAL_ERROR`, sin StockMovement parcial.                                                             |
| RF-47, RF-53 a RF-56                             | Enviar campos desconocidos, `reason` en entrada/salida y tipos de texto invalidos.                          | HTTP                           | Campos se ignoran; `reason` de entrada/salida no se persiste; tipos invalidos devuelven `400`.               |
| RF-48                                            | Repetir una misma solicitud valida sin clave de idempotencia.                                               | integracion PostgreSQL/HTTP    | Se crean dos movimientos independientes y ambos afectan el stock en secuencia.                               |

## Riesgos y dudas abiertas

- Riesgo controlado: PostgreSQL puede abortar una transaccion serializable concurrente. El adaptador debe reintentar solo conflictos de serializacion o deadlocks y conservar el error de negocio de stock insuficiente cuando se reevalua el saldo.
- Riesgo controlado: la manipulacion directa de Inventory usada por pruebas existentes debe continuar limitada a la preparacion tecnica de datos; las pruebas nuevas deben cambiar existencias exclusivamente a traves de movimientos.
- Riesgo controlado: la migracion debe verificarse con `prisma migrate` y pruebas de integracion para asegurar que las relaciones e indices se generan contra PostgreSQL.
- Dudas abiertas: ninguna.
