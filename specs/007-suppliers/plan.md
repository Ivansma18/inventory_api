# Plan 007 - Suppliers

## Contexto

La Spec 007 aprobada define la administración de proveedores de la fase 7: creación, consulta, listado, actualización parcial y desactivación lógica. Contiene RF-1 a RF-46 y no tiene dudas abiertas. Las compras y relaciones con productos quedan fuera de esta fase.

Este plan respeta `docs/constitution.md`, `docs/estrutura.md`, `docs/ruta.md` y `AGENTS.md`. La implementación seguirá las fronteras de dominio, aplicación, infraestructura y HTTP existentes en Categories y Products. El repositorio utiliza TypeScript, Hono con Zod/OpenAPI, Prisma con PostgreSQL, Better Auth y Vitest; no se necesitan dependencias adicionales.

Actualmente no hay modelo, implementación ni pruebas de Suppliers. Authorization ya centraliza los permisos y expone el middleware por su API pública. `src/app.ts` compone servicios, repositorios y rutas; `src/index.ts` solo inicia el servidor. Las pruebas se encuentran en `tests/**/*.test.ts` y Vitest desactiva el paralelismo entre archivos.

## Módulos y responsabilidades

| Módulo                                                                | Responsabilidad                                                                                                                                                                  | RF cubiertos                                                                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/features/suppliers/domain/supplier.entity.ts`                    | Representación de proveedor, nombre recortado y clave normalizada, estado inicial activo, valores opcionales y preparación de cambios parciales sin mutar la entidad original.   | RF-1, RF-2, RF-6, RF-7, RF-13 a RF-17, RF-40, RF-41, RF-44                                                                   |
| `src/features/suppliers/domain/supplier.repository.ts`                | Contratos de creación, consulta, listado y actualización parcial; campos de orden y desempates.                                                                                  | RF-3, RF-8, RF-9, RF-11, RF-12, RF-18 a RF-29, RF-38, RF-43, RF-44                                                           |
| `src/features/suppliers/domain/supplier.errors.ts`                    | Errores de nombre inválido, proveedor inexistente y nombre duplicado, sin códigos HTTP.                                                                                          | RF-2, RF-3, RF-11, RF-43                                                                                                     |
| `src/features/suppliers/application/supplier.service.ts`              | Casos de uso de crear, obtener, listar, actualizar y desactivar; generación de identidad y fechas; defaults de listado; consultas de unicidad y coordinación mediante contratos. | RF-1 a RF-3, RF-6 a RF-9, RF-11 a RF-29, RF-38, RF-40, RF-41, RF-44                                                          |
| `src/features/suppliers/infrastructure/prisma-supplier.repository.ts` | Persistencia y mapeo Prisma-dominio, búsqueda, conteo, orden, restricción única y actualización atómica de los campos recibidos.                                                 | RF-3, RF-6 a RF-9, RF-11 a RF-29, RF-38, RF-40, RF-41, RF-43, RF-44                                                          |
| `prisma/schema.prisma` y nueva migración                              | Tabla Supplier, UUID público, nombre normalizado único, datos de contacto opcionales, estado y fechas.                                                                           | RF-1, RF-3, RF-6, RF-7, RF-18, RF-19, RF-38, RF-43                                                                           |
| `src/features/suppliers/http/supplier.schemas.ts`                     | Contratos de entrada y salida, validación de email/UUID/query, eliminación de campos desconocidos y rechazo de PATCH vacío.                                                      | RF-2, RF-4 a RF-8, RF-10, RF-12, RF-15, RF-18, RF-19, RF-21, RF-24 a RF-27, RF-29 a RF-32, RF-39, RF-41, RF-42, RF-45, RF-46 |
| `src/features/suppliers/http/supplier.mapper.ts`                      | Selección explícita de campos públicos, fechas ISO y envelopes de datos/paginación.                                                                                              | RF-1, RF-6 a RF-9, RF-12, RF-18, RF-19, RF-29, RF-30                                                                         |
| `src/features/suppliers/http/supplier.routes.ts`                      | Cinco operaciones OpenAPI, delegación al servicio, traducción de errores y guardas de escritura mediante la API pública de Authorization.                                        | RF-1, RF-3 a RF-5, RF-8 a RF-12, RF-18, RF-19, RF-24, RF-26, RF-27, RF-29 a RF-37, RF-39, RF-42 a RF-46                      |
| `src/features/suppliers/index.ts` y `src/app.ts`                      | API pública mínima de la feature y composición de repositorio, servicio, autenticación y rutas en `/suppliers`.                                                                  | RF-33 a RF-37                                                                                                                |
| `src/features/authorization/domain/authorization.policy.ts`           | Ampliar permisos existentes con creación, actualización y desactivación de proveedores para ADMIN y MANAGER.                                                                     | RF-34 a RF-36                                                                                                                |

## Modelo de datos y contratos

### Persistencia y dominio

| Campo            | Persistencia propuesta                   | Dominio / exposición                                                                          |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`             | Entero autoincremental, clave primaria   | Solo persistencia; no se expone.                                                              |
| `uuid`           | String UUID, único, tipo PostgreSQL UUID | Identidad pública; generado por el sistema.                                                   |
| `name`           | String obligatorio                       | Nombre recortado; conserva mayúsculas/minúsculas.                                             |
| `nameNormalized` | String obligatorio, único                | `name.trim().toLowerCase()`; interno, no se expone.                                           |
| `contactName`    | String nullable                          | `string \| null`; vacío y espacios se conservan.                                              |
| `email`          | String nullable, sin unicidad            | `string \| null`; el formato se valida en la frontera HTTP cuando está presente y no es nulo. |
| `phone`          | String nullable                          | `string \| null`; sin normalización telefónica adicional.                                     |
| `notes`          | String nullable                          | `string \| null`; vacío y espacios se conservan.                                              |
| `isActive`       | Boolean con default `true`               | Estado de actividad; toda creación comienza activa.                                           |
| `createdAt`      | DateTime con default de creación         | Date en dominio; ISO 8601 en HTTP.                                                            |
| `updatedAt`      | DateTime de actualización                | Date en dominio; ISO 8601 en HTTP.                                                            |

La migración crea una tabla nueva sin modificar ni reclasificar los datos existentes. No incorpora relaciones, unicidad de email, borrado físico ni modelos de compras. Los índices únicos de UUID y nombre normalizado son suficientes para las invariantes de esta fase; no se incorporarán índices especulativos para reportes futuros.

### Entradas y contratos de aplicación

- `CreateSupplierInput`: `name` obligatorio; `contactName`, `email`, `phone` y `notes` opcionales y nullable. No contiene `isActive`, UUID ni fechas.
- `UpdateSupplierInput`: los cinco campos anteriores opcionales, más `isActive?: boolean`; `name` no admite null. Distingue campo omitido de campo explícitamente nulo.
- `ListSuppliersInput`: `page`, `limit`, `search`, `isActive`, `sort` y `order` opcionales. El servicio aplica `page=1`, `limit=15`, `isActive=true`, `sort=name` y `order=asc` a los parámetros omitidos.
- `SupplierListQuery`: consulta resuelta con campos de orden `name | createdAt | updatedAt`, dirección `asc | desc` y desempates `createdAt asc`, `uuid asc`.
- `SupplierListResult`: `{ suppliers: Supplier[], total: number }`, independiente del envelope HTTP.
- `SupplierRepository`: `create(supplier)`, `findByUuid(uuid)`, `findByNameNormalized(nameNormalized)`, `findMany(query)` y `update(uuid, changes)`. La actualización recibe solo los campos efectivamente cambiados, incluida la clave normalizada cuando cambia el nombre y la fecha de actualización.
- `SupplierService`: `createSupplier`, `getSupplier`, `listSuppliers`, `updateSupplier` y `deactivateSupplier`; UUID y reloj inyectables siguiendo el patrón del servicio de Categories.
- `SupplierHttpService`: interfaz consumida por la fábrica de rutas para permitir pruebas con dobles sin importar infraestructura.

El dominio prepara cambios válidos antes de persistir y no muta la representación original. La ausencia de un campo no se transforma en null. `deactivateSupplier` usa la misma operación de actualización de estado que PATCH y devuelve `{ uuid, isActive: false }`.

### Contrato HTTP

| Operación                 | Acceso                                      | Éxito                                                                        | Errores previstos                 |
| ------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| `POST /suppliers`         | ADMIN, MANAGER                              | `201` con `{ data: SupplierResponse }`                                       | `400`, `401`, `403`, `409`        |
| `GET /suppliers`          | Público                                     | `200` con `{ data: SupplierResponse[], pagination: { total, page, limit } }` | `400`                             |
| `GET /suppliers/:uuid`    | Público, incluso para proveedores inactivos | `200` con `{ data: SupplierResponse }`                                       | `400`, `404`                      |
| `PATCH /suppliers/:uuid`  | ADMIN, MANAGER                              | `200` con `{ data: SupplierResponse }`                                       | `400`, `401`, `403`, `404`, `409` |
| `DELETE /suppliers/:uuid` | ADMIN, MANAGER                              | `200` con `{ data: { uuid, isActive: false } }`                              | `400`, `401`, `403`, `404`        |

`SupplierResponse` contiene exactamente `uuid`, `name`, `contactName`, `email`, `phone`, `notes`, `isActive`, `createdAt` y `updatedAt`. Cada campo opcional sin valor se representa como null, incluido después de limpiarlo mediante PATCH.

Los schemas de entrada eliminan claves desconocidas. Así se ignoran `isActive` en POST y UUID/fechas en POST y PATCH. La comprobación de PATCH no vacío se realiza después de eliminar esas claves. El estado de query admite las cadenas `true` y `false`; el estado en JSON solo admite booleanos. La búsqueda recortada se aplica como OR entre los cuatro campos definidos, combinada con AND con el filtro de estado. El conteo utiliza exactamente el mismo filtro que el listado. Una página sin resultados devuelve `data: []` con los metadatos correspondientes.

### Errores observables

| Origen                                | Traducción HTTP                       | Uso                                                                                                        |
| ------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hook de validación Zod/OpenAPI        | `400`, `VALIDATION_ERROR`             | Campos con tipos o valores inválidos, email inválido, UUID/query inválidos y PATCH sin campos reconocidos. |
| `InvalidSupplierNameError`            | `400`, `INVALID_SUPPLIER_DATA`        | Defensa de la regla de nombre en dominio.                                                                  |
| `SupplierNotFoundError`               | `404`, `SUPPLIER_NOT_FOUND`           | UUID válido inexistente.                                                                                   |
| `SupplierNameAlreadyExistsError`      | `409`, `SUPPLIER_NAME_ALREADY_EXISTS` | Duplicado detectado por servicio o restricción persistida.                                                 |
| Middleware de autenticación existente | `401`, `UNAUTHORIZED`                 | Escritura sin sesión válida.                                                                               |
| Middleware de autorización existente  | `403`, `FORBIDDEN`                    | Escritura con OPERATOR o VIEWER.                                                                           |

Todos usan `{ error: { code, message } }`. La infraestructura traduce violaciones de unicidad del nombre a errores de dominio y no expone detalles del proveedor de datos; un `P2025` de actualización se traduce a `SupplierNotFoundError`. Los fallos inesperados se delegan al manejador transversal existente.

## Decisiones técnicas

### 1. Feature independiente con servicio de aplicación

- Elegida: estructura por capas y un `SupplierService` con los cinco casos de uso, siguiendo Categories; exportar por `index.ts` la fábrica de rutas y los contratos necesarios. Prisma se usa únicamente en infraestructura y en la composición se inyectan las dependencias.
- Descartada: repositorio CRUD genérico compartido o un caso de uso por archivo desde el inicio; no hay complejidad que justifique nuevas abstracciones para este alcance.
- RF cubiertos: RF-1 a RF-46; constitución, principios 1 a 8.

### 2. Nombre de presentación y clave de unicidad separados

- Elegida: recortar el nombre en dominio, conservar su capitalización y derivar `nameNormalized` en minúsculas con índice único que incluya proveedores inactivos. La consulta previa permite detectar conflictos habituales; la restricción es la garantía definitiva bajo concurrencia. En infraestructura, mapear `P2002` correspondiente al nombre a `SupplierNameAlreadyExistsError`, sin reintentar como upsert.
- Descartada: solo consultar antes de escribir, porque dos solicitudes pueden superar la consulta simultáneamente; guardar el nombre visible en minúsculas contradiría RF-40. Un índice condicionado a activos permitiría duplicados prohibidos.
- RF cubiertos: RF-2, RF-3, RF-38, RF-40, RF-43.

### 3. PATCH parcial mediante una única escritura

- Elegida: validar completamente la solicitud y preparar los cambios antes de emitir una sola actualización Prisma con todos los campos enviados. Una violación de unicidad impide confirmar la escritura completa. Persistir solo campos enviados evita sobrescribir campos omitidos con una fotografía antigua del proveedor. No hace falta una transacción serializable para modificar una única fila protegida por una restricción única.
- Descartada: guardar campo por campo, porque deja cambios parciales; reemplazar la fila con la entidad completa después de una lectura, porque puede sobrescribir cambios concurrentes en campos omitidos; añadir versionado optimista sin un requisito que lo exija.
- RF cubiertos: RF-3, RF-12 a RF-17, RF-42 a RF-44, RF-46.

### 4. Desactivación, sin borrado físico

- Elegida: DELETE modifica exclusivamente `isActive` y la marca de actualización mediante el contrato de actualización; no elimina filas. Repetirlo conserva el estado y devuelve el mismo contrato. Reactivar se realiza por PATCH.
- Descartada: reutilizar `deleteIfUnused` de Categories o anticipar validación contra compras; el borrado físico y las relaciones de compras están fuera del alcance.
- RF cubiertos: RF-9, RF-11, RF-16 a RF-21.

### 5. Validación de frontera y conservación de valores opcionales

- Elegida: Zod/OpenAPI valida tipos, formato del email, UUID, query y estructura del PATCH; `.strip()` elimina campos desconocidos. Los textos de contacto no usan trim ni conversión de vacío a null. El email nullable/optional solo se valida cuando se proporciona un valor no nulo; no se añade normalización de email no acordada en la spec. El dominio mantiene nombre/estado y semántica de omitido frente a null sin depender de Zod.
- Descartada: `.strict()` rechazaría campos que deben ignorarse; coerción de booleanos en JSON aceptaría entradas prohibidas; reutilizar normalización de emails de Authentication introduciría comportamiento adicional.
- RF cubiertos: RF-2, RF-4 a RF-7, RF-10, RF-13 a RF-15, RF-24, RF-26, RF-27, RF-31, RF-32, RF-39, RF-41, RF-42, RF-45, RF-46.

### 6. Listado consistente con Categories

- Elegida: paginación offset mediante `skip/take`, búsqueda insensible a mayúsculas y minúsculas en los cuatro campos definidos, filtro activo predeterminado y orden con desempates explícitos. Consultar filas y total usando un mismo filtro dentro de una transacción de lectura con aislamiento `RepeatableRead` para usar un snapshot consistente si hay escrituras simultáneas, sin introducir bloqueos de escritura.
- Descartada: cursores, búsqueda de texto completa o índices de búsqueda anticipados; no son necesarios para cumplir esta fase. Buscar en notas o usar unicidad del email ampliaría el alcance.
- RF cubiertos: RF-20 a RF-29, RF-38, RF-39.

### 7. Permisos centralizados y composición explícita

- Elegida: añadir `supplier:create`, `supplier:update` y `supplier:deactivate` a Authorization; ADMIN y MANAGER reciben los tres. PATCH usa actualización para cualquier cambio, incluido estado, y DELETE usa desactivación. Las rutas consumen `createAuthorizationMiddleware` por `authorization/index.ts`, con autenticación antes de autorización y validación; las lecturas no usan estas guardas. `app.ts` monta Suppliers e inyecta el middleware de sesión vigente.
- Descartada: comparar roles dentro de cada handler o inventar autenticación para Suppliers; duplicaría responsabilidades. No añadir permiso de lectura protegido porque las consultas son públicas.
- RF cubiertos: RF-33 a RF-37; regresión de Spec 006.

## Estrategia de pruebas

Se escribirán pruebas de reglas y casos de uso con un repositorio fake, reloj y UUID controlados; pruebas de schema/rutas con dobles; e integración de persistencia y aplicación real con PostgreSQL y sesiones. Las pruebas concurrentes deben usar solicitudes simultáneas dentro del mismo test, aunque Vitest serialice los archivos, y comprobar los resultados y datos finales. No se considerará la prueba fake evidencia suficiente de concurrencia persistida.

| RF    | Prueba                                                                                                            | Nivel                               | Evidencia esperada                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| RF-1  | Crear con nombre y contacto; enviar además estado/identidad/fechas ajenos.                                        | Unitario + HTTP/PostgreSQL          | `201`, UUID y fechas del sistema, activo y contrato público completo.                  |
| RF-2  | Nombre ausente en POST o nombre vacío/espacios en POST/PATCH.                                                     | Dominio + schema/HTTP               | Error de nombre o `400`; no se persiste.                                               |
| RF-3  | Duplicados con distinta capitalización/espacios; incluir proveedor inactivo y actualización del propio nombre.    | Aplicación + PostgreSQL/HTTP        | Conflictos `409` para otro proveedor; conservar el propio nombre no provoca conflicto. |
| RF-4  | Crear y actualizar con un email válido.                                                                           | Schema + HTTP                       | Contacto aceptado y devuelto.                                                          |
| RF-5  | Email no nulo inválido, vacío o de tipo incorrecto.                                                               | Schema + HTTP                       | `400`; sin escritura.                                                                  |
| RF-6  | Crear con solo nombre.                                                                                            | Dominio/aplicación + HTTP           | Cuatro campos opcionales devueltos como null.                                          |
| RF-7  | Crear con campos opcionales explícitamente nulos.                                                                 | Dominio + HTTP                      | Operación aceptada y valores null.                                                     |
| RF-8  | Obtener UUID existente con datos de contacto.                                                                     | Aplicación + HTTP                   | `200`, nueve campos públicos, sin id/clave normalizada.                                |
| RF-9  | Consultar proveedor desactivado por UUID.                                                                         | HTTP/PostgreSQL                     | `200` con `isActive: false`.                                                           |
| RF-10 | UUID mal formado en GET/PATCH/DELETE.                                                                             | Schema + HTTP                       | `400`, no se ejecuta el servicio.                                                      |
| RF-11 | UUID válido inexistente en GET/PATCH/DELETE.                                                                      | Aplicación + HTTP                   | `404`, formato estándar.                                                               |
| RF-12 | PATCH de varios campos reconocidos válidos.                                                                       | Aplicación + HTTP/PostgreSQL        | `200`, cambios guardados y respuesta completa.                                         |
| RF-13 | PATCH de un campo que omite el resto, incluido email.                                                             | Dominio + aplicación/HTTP           | Valores omitidos conservados.                                                          |
| RF-14 | Limpiar cada campo opcional con null.                                                                             | Dominio + HTTP/PostgreSQL           | Campo guardado y devuelto como null.                                                   |
| RF-15 | Nombre null en POST y PATCH.                                                                                      | Schema + HTTP                       | `400`.                                                                                 |
| RF-16 | PATCH falso sobre proveedor activo e inactivo.                                                                    | Aplicación + HTTP/PostgreSQL        | Éxito, fila conservada e inactiva.                                                     |
| RF-17 | PATCH verdadero sobre proveedor inactivo y activo.                                                                | Aplicación + HTTP/PostgreSQL        | Éxito y fila activa.                                                                   |
| RF-18 | DELETE de proveedor activo.                                                                                       | Aplicación + HTTP/PostgreSQL        | `200`, envelope reducido y fila conservada.                                            |
| RF-19 | Repetir DELETE sobre proveedor inactivo.                                                                          | HTTP/PostgreSQL                     | `200`, mismo contrato y estado inactivo.                                               |
| RF-20 | Listar sin estado con fixtures activos e inactivos.                                                               | Aplicación + PostgreSQL/HTTP        | Solo activos.                                                                          |
| RF-21 | Listar con cada valor de estado.                                                                                  | PostgreSQL/HTTP                     | Solo proveedores del estado solicitado.                                                |
| RF-22 | Buscar fragmentos y capitalizaciones en cada campo; búsqueda vacía y con espacios exteriores.                     | Aplicación + PostgreSQL/HTTP        | OR entre campos y vacío equivalente a omisión.                                         |
| RF-23 | Omitir page, limit y cada uno por separado.                                                                       | Aplicación + HTTP                   | Defaults aplicados solo a parámetros omitidos.                                         |
| RF-24 | Cero, negativos, decimales, texto inválido y límite superior; aceptar limit=100.                                  | Schema + HTTP                       | `400` para inválidos y aceptación del límite.                                          |
| RF-25 | Omitir sort/order o uno de ellos.                                                                                 | Aplicación + HTTP                   | Nombre ascendente por defecto; respetar el parámetro presente.                         |
| RF-26 | Sort desconocido y los tres sorts admitidos.                                                                      | Schema + PostgreSQL/HTTP            | `400` o secuencia ordenada correspondiente.                                            |
| RF-27 | Order desconocido y ambas direcciones admitidas.                                                                  | Schema + PostgreSQL/HTTP            | `400` o secuencia asc/desc correspondiente.                                            |
| RF-28 | Fixtures con valores de orden empatados.                                                                          | PostgreSQL                          | Desempates por creación ascendente y UUID ascendente.                                  |
| RF-29 | Filtros combinados, varias páginas, cero coincidencias y página posterior a la última.                            | PostgreSQL/HTTP                     | Envelope paginado, total filtrado y colección vacía cuando corresponde.                |
| RF-30 | Verificar envelopes de las cinco operaciones.                                                                     | HTTP                                | Resultado principal dentro de data.                                                    |
| RF-31 | Campos desconocidos mezclados con entradas válidas.                                                               | Schema + HTTP                       | Campos descartados; información persistida solo del contrato.                          |
| RF-32 | PATCH vacío o solo con campos desconocidos/UUID/fechas.                                                           | Schema + HTTP                       | `400`, ninguna actualización.                                                          |
| RF-33 | GET listado e individual sin cookie.                                                                              | Integración HTTP                    | Consultas públicas con `200`.                                                          |
| RF-34 | POST/PATCH/DELETE sin sesión o con sesión inválida.                                                               | Integración HTTP                    | `401`, sin cambios persistidos.                                                        |
| RF-35 | Matriz ADMIN/MANAGER para crear, actualizar, reactivar y desactivar.                                              | Política unitaria + HTTP/PostgreSQL | Operaciones permitidas.                                                                |
| RF-36 | Matriz OPERATOR/VIEWER para las tres escrituras.                                                                  | Política unitaria + HTTP/PostgreSQL | `403`, sin cambios persistidos.                                                        |
| RF-37 | Montaje de las cinco rutas y documento OpenAPI.                                                                   | Integración HTTP/OpenAPI            | Métodos, paths, schemas, respuestas y seguridad de escrituras presentes.               |
| RF-38 | Dos proveedores con distinto nombre y mismo email.                                                                | Aplicación + PostgreSQL/HTTP        | Creación/actualización aceptadas, sin restricción de email único.                      |
| RF-39 | Filtro de estado vacío o diferente de true/false.                                                                 | Schema + HTTP                       | `400`.                                                                                 |
| RF-40 | Nombre con espacios exteriores y capitalización mixta.                                                            | Dominio + PostgreSQL/HTTP           | Nombre recortado visible y clave normalizada interna.                                  |
| RF-41 | Contacto/teléfono/notas vacíos y compuestos por espacios.                                                         | Dominio + HTTP/PostgreSQL           | Valor exacto conservado en creación y actualización.                                   |
| RF-42 | PATCH con estado null, número, texto u objeto.                                                                    | Schema + HTTP                       | `400`, sin modificaciones.                                                             |
| RF-43 | Creaciones simultáneas, dos renombres simultáneos y creación contra renombre a un nombre libre normalizado igual. | PostgreSQL + integración HTTP       | Una operación exitosa, otras `409`; solo un proveedor conserva el nombre objetivo.     |
| RF-44 | PATCH con campos válidos y email inválido; PATCH con cambio de contacto/estado y nombre duplicado.                | Aplicación + HTTP/PostgreSQL        | `400` o `409` y todos los campos, incluida updatedAt, sin cambios.                     |
| RF-45 | Inspeccionar schema POST y enviar uuid/fechas/isActive con nombre válido.                                         | Schema + HTTP/OpenAPI               | Solo los cinco campos aceptados; valores del sistema no reemplazados.                  |
| RF-46 | Inspeccionar schema PATCH y enviar campos propios más uuid/fechas.                                                | Schema + HTTP/OpenAPI               | Solo los seis campos reconocidos se procesan.                                          |

### Distribución de evidencia y cierre

- `tests/suppliers/domain/`: normalización, estado y cambios opcionales; sin Hono, Prisma ni PostgreSQL.
- `tests/suppliers/application/`: servicio y defaults con fake; sin infraestructura ni transporte.
- `tests/suppliers/infrastructure/`: modelo/migración, round trips, búsqueda, paginación, unicidad real, concurrencia y atomicidad; fixtures con identificadores propios y limpieza selectiva.
- `tests/suppliers/http/`: schemas, mappers, rutas, errores, OpenAPI y flujos montados en app con sesiones reales.
- Ampliar pruebas de política de Authorization y su regresión de rutas protegidas para incluir Suppliers sin cambiar permisos de los recursos existentes.
- Inspeccionar `openapi.json`: seguridad `sessionCookie` en escrituras, ausencia de seguridad en lecturas, tipos nullable, campos de entrada y códigos documentados.
- Tras implementar: ejecutar `npm test`, `npm run typecheck`, `npm run lint`, `npm run format` y `git diff --check`; regenerar el cliente y verificar la migración con los comandos de Prisma configurados. La validación de Spec 007 deberá contar con evidencia RF por RF antes de cerrar la fase.
- Para este documento: comprobar su formato Markdown con `npx prettier --check specs/007-suppliers/plan.md` y revisar la trazabilidad completa. No se implementa código ni se generan tareas durante la elaboración del plan.

## Riesgos y dudas abiertas

- Una consulta de nombre libre no garantiza unicidad: la restricción persistida y su traducción de errores son obligatorias, con pruebas de carrera reales.
- Persistir la entidad completa desde una lectura antigua puede sobrescribir campos omitidos: el contrato de actualización debe enviar un patch de campos, no un reemplazo completo.
- Los schemas deben distinguir omisión, null y cadena vacía; aplicar trim indiscriminadamente a contacto/teléfono/notas incumpliría RF-41.
- Las pruebas de Authorization pueden enumerar permisos y rutas: deberán ampliarse al incorporar Suppliers conservando la cobertura de Spec 006.
- Las pruebas de integración requieren PostgreSQL y la migración aplicada; cualquier impedimento del entorno se reportará antes de emitir evidencia de cumplimiento.
- Dudas abiertas: ninguna. El plan queda pendiente de aprobación antes de generar tareas o código.
