# Tareas - Spec 002 Categorías

- [x] T1. Definir el dominio de Categories: entidad, normalización de nombre, invariantes, errores y contratos de repositorio; escribir pruebas unitarias puras. (RF-1, RF-2, RF-3, RF-4, RF-8, RF-9, RF-10, RF-11, RF-12, RF-35, RF-36)
      Hecho cuando: las pruebas cubren trim, nombre vacío, nombres equivalentes, descripción omitida o nula y cambios idempotentes de estado sin usar Hono, Prisma ni PostgreSQL.

- [x] T2. Crear la primera migración de Categories y relación temporal nullable desde Products; regenerar Prisma y cubrir el esquema con pruebas de integración. (RF-1, RF-3, RF-20, RF-21, RF-31, RF-33, RF-41)
      Hecho cuando: `Category` tiene UUID y nombre normalizado únicos, `Product` admite temporalmente relación nula, la clave foránea impide borrados inválidos y `npm run prisma:generate` finaliza correctamente.

- [x] T3. Implementar y probar `CategoryService` para crear, consultar y actualizar categorías con un repositorio falso. (RF-1, RF-3, RF-4, RF-5, RF-7, RF-8, RF-9, RF-10, RF-11, RF-12, RF-35, RF-36)
      Hecho cuando: las pruebas de aplicación cubren creación, duplicados incluso inactivos, consulta inexistente, actualización parcial, descripción nula y estados idempotentes sin infraestructura.

- [x] T4. Implementar y probar en aplicación el listado normalizado de categorías mediante un repositorio falso. (RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19)
      Hecho cuando: las pruebas cubren estado activo predeterminado, filtros acumulativos, búsqueda vacía, paginación, orden permitido y desempates estables.

- [x] T5. Implementar el repositorio Prisma de Categories para creación, búsqueda, actualización y listado; agregar pruebas de integración. (RF-1, RF-3, RF-5, RF-7, RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19, RF-36)
      Hecho cuando: las pruebas de PostgreSQL confirman mapeo, unicidad normalizada, filtros, total previo a paginación, orden y representación nullable.

- [x] T6. Implementar las operaciones de desactivación y eliminación de Categories con verificación de productos asociados, transacciones serializables y pruebas de integración. (RF-20, RF-21, RF-31, RF-41)
      Hecho cuando: categorías sin productos se desactivan o eliminan según el contrato, las categorías en uso devuelven conflicto y las pruebas concurrentes no dejan productos asociados a categorías eliminadas o inactivas.

- [x] T7. Definir schemas Zod/OpenAPI y mappers HTTP de Categories para cuerpos, UUID, query, respuestas y propiedades adicionales; cubrirlos con pruebas. (RF-1, RF-2, RF-4, RF-6, RF-13 a RF-20, RF-29, RF-30, RF-35, RF-36, RF-40)
      Hecho cuando: los schemas validan entradas y query, descartan campos no reconocidos, rechazan actualizaciones vacías y documentan respuestas y errores aplicables.

- [x] T8. Implementar las rutas HTTP de Categories, traducir errores de negocio y probar los cinco contratos con `app.request`. (RF-1 a RF-21, RF-28 a RF-31, RF-35 a RF-37, RF-40)
      Hecho cuando: `POST`, ambos `GET`, `PATCH` y `DELETE /categories` devuelven las respuestas, códigos y envolturas OpenAPI especificadas.

- [x] T9. Extender el dominio y la aplicación de Products para `categoryUuid`, inyectar el lector público de Categories y escribir pruebas con falsos. (RF-22 a RF-27, RF-32 a RF-34, RF-38, RF-39, RF-44 a RF-46)
      Hecho cuando: crear exige una categoría activa, actualizar valida primero una categoría proporcionada, conserva la asociación omitida y permite temporalmente `null` solo en productos heredados.

- [x] T10. Extender el repositorio Prisma de Products para la relación y asegurar la asignación frente a desactivación o eliminación concurrente; agregar pruebas de integración. (RF-22 a RF-27, RF-32 a RF-34, RF-41, RF-44 a RF-46)
      Hecho cuando: persistencia y mapeo conservan `categoryUuid`, las asociaciones inválidas se rechazan y una asociación que pierde una carrera de concurrencia se traduce en conflicto.

- [x] T11. Extender schemas, mapper, rutas y OpenAPI de Products para `categoryUuid`; cubrir contratos HTTP y prioridad de errores. (RF-22 a RF-29, RF-32, RF-34, RF-38, RF-39, RF-41, RF-44 a RF-46)
      Hecho cuando: creación, consulta, listado y actualización publican `categoryUuid`, validan su presencia o nulidad y documentan `400`, `404` y `409` por categoría.

- [ ] T12. Componer la API pública de Categories, inyectar su lector en Products, registrar `/categories` en `app.ts` y ampliar las pruebas de OpenAPI y regresión. (RF-22 a RF-27, RF-34, RF-37, RF-41)
      Hecho cuando: no hay importaciones cruzadas de infraestructura, `/openapi.json` publica los nueve endpoints de Products y Categories y salud, Swagger y manejo global de errores continúan funcionando.

- [ ] T13. Tras completar la clasificación temporal, crear y verificar la segunda migración que exige categoría obligatoria en Products. (RF-42, RF-43)
      Hecho cuando: en una base de prueba sin relaciones nulas la migración endurece la relación; con una relación nula aborta atómicamente sin modificar esquema ni datos. Esta tarea no se inicia hasta confirmar que no quedan productos sin categoría en el despliegue previo.

- [ ] T14. Ejecutar la suite completa y validaciones de calidad, corregir fallos atribuibles a la fase y verificar migraciones, contratos y dependencias. (RF-1 a RF-46)
      Hecho cuando: `npm run prisma:generate`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format` y `npm run build` finalizan correctamente; OpenAPI, las dos etapas de migración y la separación entre features quedan verificadas.

## Orden y dependencias

| Tarea | Depende de     | Motivo                                                                                    |
| ----- | -------------- | ----------------------------------------------------------------------------------------- |
| T1    | Ninguna        | Define reglas, errores y puertos de Categories.                                           |
| T2    | Ninguna        | Establece el primer modelo persistente y la relación temporal.                            |
| T3    | T1             | El servicio usa entidad, errores y repositorio.                                           |
| T4    | T1             | El listado usa el contrato de consulta de Categories.                                     |
| T5    | T1, T2, T3, T4 | Implementa los puertos contra el modelo migrado.                                          |
| T6    | T2, T3, T5     | Requiere la relación persistente y las operaciones de Categories.                         |
| T7    | T1             | Los schemas reflejan contratos e invariantes sin Prisma.                                  |
| T8    | T3, T4, T6, T7 | Las rutas requieren servicio, operaciones de uso y contratos HTTP.                        |
| T9    | T1, T2, T3     | Products consume el lector público y la relación temporal de Categories.                  |
| T10   | T2, T5, T6, T9 | Requiere ambas persistencias y reglas de concurrencia.                                    |
| T11   | T7, T9, T10    | Los contratos HTTP de Products necesitan dominio, aplicación y persistencia actualizados. |
| T12   | T8, T11        | Compone ambas APIs públicas y publica el contrato integrado.                              |
| T13   | T12            | Solo puede ejecutarse tras la clasificación temporal confirmada en el despliegue previo.  |
| T14   | T1 a T13       | Verifica la fase integrada y sus dos etapas de migración.                                 |

## Cobertura de requisitos

| RF                  | Tarea                  | Evidencia                                                      |
| ------------------- | ---------------------- | -------------------------------------------------------------- |
| RF-1 a RF-4         | T1, T2, T3, T5, T7, T8 | Dominio, aplicación, Prisma y creación HTTP.                   |
| RF-5 a RF-7         | T3, T5, T7, T8         | Consulta individual y UUID válido, inexistente o inválido.     |
| RF-8 a RF-12        | T1, T3, T6, T7, T8     | Actualización parcial, descripción y estado.                   |
| RF-13 a RF-19       | T4, T5, T7, T8         | Filtros, búsqueda, paginación, total y orden.                  |
| RF-20, RF-21, RF-31 | T2, T6, T8             | Eliminación o desactivación con productos asociados.           |
| RF-22 a RF-27       | T9, T10, T11, T12      | Categoría activa requerida y errores de categoría en Products. |
| RF-28 a RF-30       | T7, T8, T11            | Envolturas, campos desconocidos y actualización vacía.         |
| RF-32               | T9, T10, T11           | Conservación de categoría omitida.                             |
| RF-33               | T2, T9, T10, T13       | Relación temporal nullable para productos existentes.          |
| RF-34               | T9, T11                | Prioridad de validación de categoría.                          |
| RF-35, RF-36        | T1, T3, T7, T8         | Descripción nula y serialización pública.                      |
| RF-37               | T8, T12                | Cinco endpoints de Categories en OpenAPI.                      |
| RF-38, RF-39        | T9, T11                | `categoryUuid` ausente o nulo devuelve `400`.                  |
| RF-40               | T7, T8                 | Forma pública completa de Category.                            |
| RF-41               | T6, T10, T11           | Integridad y conflicto bajo concurrencia.                      |
| RF-42, RF-43        | T13                    | Segunda migración condicionada y atómica.                      |
| RF-44               | T9, T10, T11           | `categoryUuid` en toda respuesta de Product.                   |
| RF-45, RF-46        | T9, T10, T11, T13      | Comportamiento y respuesta temporal de productos heredados.    |
