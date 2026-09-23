# Tareas - Spec 001 Productos

- [ ] T1. Definir el nucleo de dominio de Products: entidad, normalizacion de SKU, invariantes, errores y contrato de repositorio; escribir sus pruebas unitarias puras. (RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-12, RF-19, RF-20, RF-21, RF-29)
      Hecho cuando: las pruebas de dominio cubren valores validos, trim, campos vacios, precios invalidos y cero, descripcion omitida o nula, y no importan Hono, Prisma ni PostgreSQL.

- [ ] T2. Incorporar el modelo `Product` en Prisma con UUID publico, SKU normalizado unico, precios decimales, estado y timestamps; crear la migracion y comprobar la generacion del cliente. (RF-1, RF-6, RF-10, RF-12, RF-13, RF-17, RF-28)
      Hecho cuando: la migracion crea las columnas, restricciones e indices planificados, y `npm run prisma:generate` finaliza correctamente.

- [ ] T3. Implementar y probar en aplicacion las operaciones de crear, obtener y actualizar Products con un repositorio falso. (RF-1, RF-6, RF-7, RF-10, RF-11, RF-12, RF-13, RF-17, RF-19, RF-20, RF-21, RF-28, RF-29)
      Hecho cuando: las pruebas de aplicacion prueban creacion activa, SKU duplicado incluso inactivo, consulta inexistente, actualizacion parcial, descripcion nula y cambios de estado idempotentes sin usar Prisma ni Hono.

- [ ] T4. Implementar y probar en aplicacion el contrato de listado normalizado con filtros acumulativos, defaults, paginacion y orden estable mediante repositorio falso. (RF-8, RF-9, RF-14, RF-15, RF-22, RF-24, RF-25, RF-26)
      Hecho cuando: las pruebas verifican estado activo predeterminado, combinacion de `search` e `isActive`, busqueda vacia omitida, total filtrado, pagina y limite predeterminados, y desempates por `createdAt` y UUID.

- [ ] T5. Implementar el repositorio Prisma para creacion, busqueda por UUID y SKU normalizado, y actualizacion; agregar pruebas de integracion con una base de datos de prueba. (RF-1, RF-6, RF-10, RF-12, RF-13, RF-17, RF-28)
      Hecho cuando: las pruebas de integracion confirman el mapeo de persistencia, la restriccion unica de SKU normalizado y la conservacion de datos al actualizar.

- [ ] T6. Implementar el listado del repositorio Prisma con filtros en PostgreSQL, conteo previo a paginacion y orden principal con desempates; agregar pruebas de integracion. (RF-8, RF-9, RF-14, RF-15, RF-22, RF-24, RF-25, RF-26)
      Hecho cuando: las pruebas de integracion verifican filtros, busqueda insensible a mayusculas, total correcto, pagina, limite y orden estable para todos los campos permitidos.

- [ ] T7. Definir schemas Zod/OpenAPI y mappers HTTP de Products para cuerpos, UUID, query, respuestas y propiedades adicionales; cubrir los schemas con pruebas. (RF-1, RF-2, RF-3, RF-4, RF-5, RF-18, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27, RF-29, RF-30, RF-31, RF-32)
      Hecho cuando: los schemas documentan entradas, respuestas y errores; descartan campos adicionales; `PATCH` rechaza un cuerpo sin campos reconocidos; y las pruebas cubren parametros invalidos con error `400`.

- [ ] T8. Implementar rutas HTTP de creacion, consulta individual y actualizacion, incluida la traduccion local de errores de Products; probar sus contratos mediante `app.request`. (RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-10, RF-11, RF-12, RF-13, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-28, RF-29, RF-30, RF-31, RF-32)
      Hecho cuando: `POST /products`, `GET /products/:uuid` y `PATCH /products/:uuid` delegan al servicio, devuelven `{ data }`, publican los codigos `400`, `404` y `409` aplicables, y sus pruebas de contrato pasan.

- [ ] T9. Implementar la ruta HTTP de listado, componer la API publica de la feature y registrar Products en `app.ts`; ampliar las pruebas de OpenAPI y regresion. (RF-8, RF-9, RF-14, RF-15, RF-16, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27)
      Hecho cuando: `GET /products` aplica y serializa la consulta esperada, `/openapi.json` publica los cuatro endpoints de Products, y las pruebas existentes de salud y Swagger siguen pasando.

- [ ] T10. Ejecutar la suite completa y las validaciones de calidad, corregir fallos atribuibles a la feature y verificar cobertura de contratos, migracion y dependencias. (RF-1 a RF-32)
      Hecho cuando: `npm run prisma:generate`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format` y `npm run build` finalizan correctamente, con migracion, OpenAPI y pruebas de Products actualizados.

## Orden y dependencias

| Tarea | Depende de     | Motivo                                                                    |
| ----- | -------------- | ------------------------------------------------------------------------- |
| T1    | Ninguna        | Define las reglas y puertos que las demas capas consumen.                 |
| T2    | Ninguna        | Establece la persistencia requerida por la infraestructura.               |
| T3    | T1             | El servicio de mutacion usa entidad, errores y repositorio.               |
| T4    | T1             | El servicio de listado usa el contrato de consulta del repositorio.       |
| T5    | T1, T2, T3     | Implementa el puerto de mutacion contra el modelo migrado.                |
| T6    | T1, T2, T4     | Implementa el puerto de listado contra el modelo migrado.                 |
| T7    | T1             | Los schemas reflejan las invariantes y contratos, sin depender de Prisma. |
| T8    | T3, T5, T7     | Las rutas de mutacion requieren servicio, composicion y contratos HTTP.   |
| T9    | T4, T6, T7, T8 | Completa el router, la API publica, el registro de la feature y OpenAPI.  |
| T10   | T1 a T9        | Verifica la feature integrada y la regresion del proyecto.                |

## Cobertura de requisitos

| RF    | Tarea                  | Evidencia                                                           |
| ----- | ---------------------- | ------------------------------------------------------------------- |
| RF-1  | T1, T2, T3, T5, T7, T8 | Pruebas de dominio, aplicacion, integracion y contrato de creacion. |
| RF-2  | T1, T7, T8             | Pruebas de invariante y validacion HTTP.                            |
| RF-3  | T1, T7, T8             | Pruebas de invariante y validacion HTTP.                            |
| RF-4  | T1, T7, T8             | Pruebas de precision y rango de precio.                             |
| RF-5  | T1, T7, T8             | Pruebas de precision y rango de precio.                             |
| RF-6  | T1, T3, T5, T8         | Pruebas de conflicto y restriccion unica.                           |
| RF-7  | T1, T3, T8             | Pruebas de descripcion opcional.                                    |
| RF-8  | T4, T6, T9             | Pruebas de listado activo predeterminado.                           |
| RF-9  | T4, T6, T9             | Pruebas de filtro de estado.                                        |
| RF-10 | T2, T3, T5, T8         | Pruebas de consulta individual.                                     |
| RF-11 | T3, T8                 | Pruebas de producto inexistente y `404`.                            |
| RF-12 | T1, T3, T5, T8         | Pruebas de actualizacion parcial y SKU.                             |
| RF-13 | T2, T3, T5, T8         | Pruebas de desactivacion idempotente.                               |
| RF-14 | T4, T6, T9             | Pruebas de `data`, paginacion y total filtrado.                     |
| RF-15 | T4, T6, T9             | Pruebas de filtros acumulativos.                                    |
| RF-16 | T8, T9                 | Pruebas de envoltura `data`.                                        |
| RF-17 | T2, T3, T5, T8         | Pruebas de reactivacion idempotente.                                |
| RF-18 | T7, T8                 | Pruebas de UUID invalido y `400`.                                   |
| RF-19 | T1, T3, T8             | Pruebas de descripcion omitida al actualizar.                       |
| RF-20 | T1, T3, T8             | Pruebas de descripcion nula al actualizar.                          |
| RF-21 | T1, T3, T8             | Pruebas de conservacion de estado.                                  |
| RF-22 | T4, T6, T7, T9         | Pruebas de defaults de pagina y limite.                             |
| RF-23 | T7, T9                 | Pruebas de paginacion invalida y `400`.                             |
| RF-24 | T4, T6, T7, T9         | Pruebas de busqueda parcial, trim e insensibilidad a mayusculas.    |
| RF-25 | T4, T6, T7, T9         | Pruebas de orden y desempates estables.                             |
| RF-26 | T4, T6, T7, T9         | Pruebas de campos de orden permitidos.                              |
| RF-27 | T7, T9                 | Pruebas de parametros de listado invalidos y `400`.                 |
| RF-28 | T2, T3, T5, T8         | Pruebas de actualizacion inexistente y `404`.                       |
| RF-29 | T1, T3, T7, T8         | Pruebas de serializacion de descripcion nula.                       |
| RF-30 | T7, T8                 | Pruebas de descarte de campos adicionales.                          |
| RF-31 | T7, T8                 | Pruebas de `PATCH` sin campos reconocidos y `400`.                  |
| RF-32 | T7, T8                 | Pruebas de creacion valida con campos adicionales.                  |
