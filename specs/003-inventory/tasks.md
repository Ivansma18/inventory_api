# Tareas - Spec 003 Inventario

- [x] T1. Definir la entidad Inventory, sus invariantes enteras no negativas, el cálculo de estado y sus pruebas unitarias. (RF-4, RF-5, RF-6, RF-7, RF-8, RF-24, RF-25)
      Hecho cuando: las pruebas de dominio cubren los tres estados, mínimo cero, mínimo negativo y decimal rechazados, y actualización idempotente del mínimo sin alterar cantidad.

- [ ] T2. Añadir el modelo Prisma Inventory uno-a-uno con Product y generar una migración con valores iniciales, unicidad, restricciones de no negatividad y provisión idempotente de productos existentes. (RF-1, RF-3, RF-4, RF-5)
      Hecho cuando: el esquema y la migración definen `productId` único, valores iniciales cero y restricciones de enteros no negativos.

- [ ] T3. Crear pruebas de integración del esquema y de la migración de Inventory. (RF-1, RF-3, RF-4, RF-5)
      Hecho cuando: una base desechable con productos previos recibe exactamente un inventario inicial por producto y PostgreSQL rechaza duplicados, negativos y decimales.

- [ ] T4. Extender la persistencia de Products para crear atómicamente el inventario inicial y cubrir éxito y rollback con pruebas de integración. (RF-2, RF-3, RF-34)
      Hecho cuando: crear un producto deja un único inventario con ceros y un fallo provocado no deja un Product parcial.

- [ ] T5. Definir contratos de repositorio, tipos de consulta, desempates y error de dominio para Inventory. (RF-3, RF-9, RF-11, RF-12 a RF-23, RF-33)
      Hecho cuando: el dominio expone contratos sin Prisma ni HTTP para detalle, listado y actualización de mínimo, con los filtros y orden permitidos.

- [ ] T6. Implementar InventoryService con casos de uso de detalle, listado y actualización de stock mínimo, junto con fakes y pruebas de aplicación. (RF-9, RF-11, RF-16, RF-17, RF-24, RF-25, RF-33)
      Hecho cuando: las pruebas de aplicación verifican producto inexistente, valores predeterminados, búsqueda normalizada, mínimo idempotente y producto inactivo.

- [ ] T7. Implementar PrismaInventoryRepository para detalle y actualización de mínimo, con mapeo a dominio y pruebas de integración. (RF-3, RF-9, RF-11, RF-24, RF-25, RF-33)
      Hecho cuando: el repositorio devuelve el resumen de producto requerido, actualiza solo el mínimo y admite productos inactivos.

- [ ] T8. Implementar el listado Prisma de Inventory con filtros relacionales, estados calculados, total previo a paginación y orden estable; añadir sus pruebas de integración. (RF-12, RF-14, RF-16, RF-20, RF-22, RF-23)
      Hecho cuando: las pruebas cubren actividad, estado, búsqueda, filtros combinados, total sin paginar, todos los órdenes y desempates por SKU y UUID.

- [ ] T9. Definir los schemas Zod/OpenAPI y las pruebas de validación para params, query, cuerpo de actualización y respuestas de Inventory. (RF-10, RF-13, RF-15, RF-18, RF-19, RF-21, RF-26, RF-28, RF-29, RF-30)
      Hecho cuando: los contratos aceptan solo los valores especificados, eliminan campos desconocidos y rechazan entradas inválidas con `400`.

- [ ] T10. Implementar mapper y rutas HTTP de Inventory, con traducción `404`, respuestas `data` y pruebas de rutas. (RF-9, RF-10, RF-11, RF-13, RF-15, RF-17 a RF-19, RF-21, RF-22, RF-24 a RF-30, RF-33)
      Hecho cuando: los tres endpoints devuelven las formas públicas especificadas y las pruebas cubren éxito, validación, filtros, paginación y producto inexistente.

- [ ] T11. Componer la feature Inventory, registrar `/inventory` y actualizar la comprobación de OpenAPI y Swagger. (RF-31, RF-32)
      Hecho cuando: los tres endpoints aparecen en `/openapi.json`, están disponibles en Swagger y no existe una ruta pública para modificar cantidad.

- [ ] T12. Ajustar el manejador global de errores a `INTERNAL_ERROR` y añadir regresión HTTP para el fallo atómico de creación de producto. (RF-34)
      Hecho cuando: un fallo no controlado responde `500` con `{ error: { code: "INTERNAL_ERROR", message } }` y el rollback de creación no persiste el producto.

## Orden y dependencias

| Tarea | Depende de     | Motivo                                                           |
| ----- | -------------- | ---------------------------------------------------------------- |
| T1    | Ninguna        | Las reglas puras no requieren persistencia.                      |
| T2    | Ninguna        | El modelo y la migración habilitan la infraestructura.           |
| T3    | T2             | Verifica el esquema y la migración creados.                      |
| T4    | T2             | La escritura atómica requiere la relación Prisma.                |
| T5    | T1             | Reutiliza los tipos y estado del dominio.                        |
| T6    | T5             | El servicio depende de los contratos de repositorio.             |
| T7    | T2, T5         | La implementación Prisma requiere modelo y contrato.             |
| T8    | T2, T5         | El listado requiere modelo, filtros y desempates.                |
| T9    | T5             | Los schemas reflejan los contratos de consulta y respuesta.      |
| T10   | T6, T7, T8, T9 | Las rutas requieren casos de uso, persistencia y contratos HTTP. |
| T11   | T10            | La composición registra rutas ya implementadas.                  |
| T12   | T4, T11        | Verifica el fallo atómico por HTTP y el manejador global.        |

## Cobertura de requisitos

| RF    | Tarea              | Evidencia                                                       |
| ----- | ------------------ | --------------------------------------------------------------- |
| RF-1  | T2, T3             | Migración crea inventarios iniciales para productos existentes. |
| RF-2  | T4                 | Escritura atómica crea inventario para producto nuevo.          |
| RF-3  | T2, T3, T4, T5, T7 | Relación única y contratos de inventario.                       |
| RF-4  | T1, T2, T3         | Invariante, restricción y pruebas de enteros no negativos.      |
| RF-5  | T1, T2, T3         | Validación y restricción de stock mínimo.                       |
| RF-6  | T1                 | Estado `OUT_OF_STOCK`.                                          |
| RF-7  | T1                 | Estado `LOW_STOCK`.                                             |
| RF-8  | T1                 | Estado `IN_STOCK`.                                              |
| RF-9  | T5, T6, T7, T10    | Consulta de detalle y respuesta HTTP.                           |
| RF-10 | T9, T10            | UUID inválido devuelve `400`.                                   |
| RF-11 | T5, T6, T7, T10    | Producto inexistente devuelve `404`.                            |
| RF-12 | T5, T8, T10        | Listado incluye productos activos e inactivos.                  |
| RF-13 | T9, T10            | Filtro estricto de `isActive`.                                  |
| RF-14 | T8, T10            | Filtro por estado calculado.                                    |
| RF-15 | T9, T10            | Estado inválido devuelve `400`.                                 |
| RF-16 | T6, T8, T10        | Búsqueda normalizada por SKU y nombre.                          |
| RF-17 | T6, T10            | Valores predeterminados de paginación.                          |
| RF-18 | T9, T10            | Página y límite inválidos devuelven `400`.                      |
| RF-19 | T9, T10            | Límite superior a 100 devuelve `400`.                           |
| RF-20 | T5, T8, T9, T10    | Campos, dirección y desempates estables.                        |
| RF-21 | T9, T10            | Orden inválido devuelve `400`.                                  |
| RF-22 | T8, T10            | `data` y paginación completos.                                  |
| RF-23 | T8, T10            | Total calculado antes de paginar.                               |
| RF-24 | T1, T6, T7, T10    | Actualización conserva cantidad.                                |
| RF-25 | T1, T6, T7, T10    | Actualización idempotente.                                      |
| RF-26 | T1, T9, T10        | Stock mínimo inválido devuelve `400`.                           |
| RF-27 | T10                | Respuestas exitosas usan `data`.                                |
| RF-28 | T9, T10            | Schemas y mapper incluyen representación completa.              |
| RF-29 | T9, T10            | PATCH ignora campos desconocidos.                               |
| RF-30 | T9, T10            | PATCH sin campos reconocidos devuelve `400`.                    |
| RF-31 | T10, T11           | Rutas y OpenAPI publicados.                                     |
| RF-32 | T11                | No se registra modificación pública de cantidad.                |
| RF-33 | T6, T7, T10        | Producto inactivo se consulta y actualiza.                      |
| RF-34 | T4, T12            | Rollback y respuesta `500` con `INTERNAL_ERROR`.                |
