# Tareas - Spec 004 Movimientos de Stock

- [x] T1. Definir tipos, entidad y errores de dominio para movimientos, con calculos puros para entrada, salida y ajuste, y sus pruebas unitarias. (RF-1 a RF-9, RF-12, RF-40)
      Hecho cuando: las pruebas de dominio verifican los tres tipos, stocks anterior/nuevo, ajuste a cero, cantidades invalidas y `InsufficientStockError` sin Hono ni Prisma.

- [x] T2. Añadir el enum y modelo Prisma `StockMovement`, relaciones, UUID e indices, y crear la migracion correspondiente. (RF-1 a RF-6, RF-12, RF-17, RF-18, RF-32, RF-33, RF-40)
      Hecho cuando: el esquema representa el historial inmutable relacionado con Product y la migracion se genera sin modificar datos existentes.

- [x] T3. Crear pruebas de integracion del esquema y la migracion de StockMovement. (RF-12, RF-17, RF-18, RF-32, RF-33)
      Hecho cuando: PostgreSQL crea movimientos con UUID, relacion obligatoria e indices esperados, y no hay escritura de `createdBy`, actualizacion ni eliminacion expuestas por el contrato.

- [x] T4. Definir el contrato de repositorio atomico, los tipos de intencion de movimiento y los tipos de filtros, orden y paginacion. (RF-13 a RF-18, RF-23 a RF-29, RF-35, RF-41, RF-43, RF-45, RF-48)
      Hecho cuando: el dominio expone contratos sin Prisma ni HTTP para registrar movimientos y consultar historiales con orden `createdAt desc`, `uuid asc`.

- [x] T5. Implementar los casos de uso de entrada, salida y ajuste con fakes y pruebas de aplicacion para normalizacion de motivo y referencia. (RF-1 a RF-16, RF-37, RF-38, RF-40, RF-44, RF-48, RF-51, RF-52)
      Hecho cuando: las pruebas verifican intenciones correctas, producto inactivo permitido, referencias nulas o vacias normalizadas, motivo de ajuste recortado y solicitudes repetidas independientes.

- [x] T6. Implementar los casos de uso de listado por producto y global, con valores predeterminados, filtros y normalizacion de referencia. (RF-23 a RF-29, RF-34, RF-35, RF-39, RF-41, RF-45)
      Hecho cuando: las pruebas de aplicacion verifican `page=1`, `limit=15`, limite maximo, filtros combinados y omision de referencia vacia.

- [x] T7. Implementar `PrismaStockMovementRepository` para crear entrada, salida y ajuste en una transaccion atomica, y cubrirlo con pruebas de integracion. (RF-1 a RF-16, RF-38, RF-42, RF-43, RF-48)
      Hecho cuando: cada operacion actualiza Inventory y crea exactamente un movimiento con los stocks correctos; producto inexistente, Inventory ausente, producto inactivo y rollback estan cubiertos.

- [x] T8. Incorporar aislamiento serializable y reintentos acotados de conflictos en el repositorio Prisma, con pruebas de concurrencia. (RF-9, RF-13 a RF-16, RF-42)
      Hecho cuando: salidas concurrentes no persisten stock negativo y combinaciones ajuste-entrada y ajuste-salida no pierden actualizaciones ni generan historiales inconsistentes.

- [x] T9. Implementar en el repositorio Prisma los listados con filtros, total antes de paginar y orden estable, junto con pruebas de integracion. (RF-23 a RF-29, RF-35, RF-41, RF-45)
      Hecho cuando: las pruebas verifican tipos, fechas inclusivas abiertas, producto global, referencias case-insensitive no nulas, total filtrado y desempate por UUID.

- [x] T10. Definir schemas Zod/OpenAPI y pruebas de validacion para params, cuerpos de creacion, query de listados y respuestas. (RF-7, RF-8, RF-10, RF-11, RF-25 a RF-32, RF-34, RF-36, RF-39, RF-44, RF-47, RF-49 a RF-56)
      Hecho cuando: los schemas aceptan exclusivamente los cuerpos definidos, eliminan campos desconocidos, aceptan `reference: null` y rechazan todos los valores invalidos con `400`.

- [ ] T11. Implementar el mapper y las rutas HTTP de creacion de movimientos, con traduccion de errores y pruebas de rutas. (RF-9, RF-20 a RF-22, RF-30 a RF-32, RF-36 a RF-38, RF-42 a RF-44, RF-46, RF-47, RF-49 a RF-56)
      Hecho cuando: las tres rutas devuelven `201 { data }`, exponen todos los campos publicos, mapean insuficiencia a `409`, producto inexistente a `404` y validaciones a `400`.

- [ ] T12. Implementar las rutas HTTP de listado por producto y global, con mapeo de paginacion y pruebas de rutas. (RF-23 a RF-31, RF-34 a RF-36, RF-39, RF-41, RF-45)
      Hecho cuando: ambos listados devuelven `data` y `pagination`, validan filtros y reflejan correctamente el total, orden y filtros delegados al servicio.

- [ ] T13. Componer la feature Stock Movements, registrar las cinco rutas en `app.ts` y verificar OpenAPI y Swagger. (RF-19 a RF-24, RF-46)
      Hecho cuando: las tres operaciones aparecen bajo `/inventory`, el listado global bajo `/stock-movements`, las cinco rutas estan en `/openapi.json` y no se agrega una ruta publica para `Inventory.quantity`.

## Orden y dependencias

| Tarea | Depende de  | Motivo                                                               |
| ----- | ----------- | -------------------------------------------------------------------- |
| T1    | Ninguna     | Las reglas puras pueden definirse y probarse sin persistencia.       |
| T2    | Ninguna     | El modelo Prisma y la migracion habilitan el repositorio.            |
| T3    | T2          | Verifica el esquema y la migracion creados.                          |
| T4    | T1          | El contrato reutiliza los tipos y errores de dominio.                |
| T5    | T1, T4      | Los casos de creacion necesitan reglas y puerto de persistencia.     |
| T6    | T4          | Los listados usan los tipos de consulta del contrato.                |
| T7    | T1, T2, T4  | La escritura atomica necesita reglas, modelo y contrato.             |
| T8    | T7          | La concurrencia verifica la implementacion atomica real.             |
| T9    | T2, T4      | El listado Prisma requiere modelo y tipos de consulta.               |
| T10   | T4          | Los schemas reflejan contratos de entrada, consulta y salida.        |
| T11   | T5, T7, T10 | Las rutas de creacion requieren servicio, persistencia y validacion. |
| T12   | T6, T9, T10 | Las rutas de listado requieren servicio, consultas y validacion.     |
| T13   | T11, T12    | El registro publica rutas ya implementadas.                          |

## Cobertura de requisitos

| RF            | Tarea                | Evidencia                                                           |
| ------------- | -------------------- | ------------------------------------------------------------------- |
| RF-1 a RF-8   | T1, T5, T7, T10      | Reglas puras, casos de uso, transaccion y validacion de cantidades. |
| RF-9          | T1, T7, T8, T11      | Error de dominio, persistencia, concurrencia y respuesta `409`.     |
| RF-10, RF-11  | T5, T10, T11         | Normalizacion y validacion de motivo y referencia.                  |
| RF-12         | T1, T2, T3, T7       | Modelo y movimientos con stocks anterior y nuevo.                   |
| RF-13 a RF-16 | T4, T7, T8           | Contrato atomico, rollback y concurrencia serializable.             |
| RF-17, RF-18  | T2, T3, T4, T13      | Modelo, contrato y API sin edicion ni eliminacion.                  |
| RF-19         | T13                  | No se registra una modificacion publica de cantidad.                |
| RF-20 a RF-22 | T11, T13             | Rutas de creacion bajo `/inventory`.                                |
| RF-23, RF-24  | T12, T13             | Rutas de historial por producto y global.                           |
| RF-25 a RF-29 | T6, T9, T10, T12     | Filtros, normalizacion de consulta y respuestas paginadas.          |
| RF-30, RF-31  | T10, T11, T12        | UUID invalido `400` y producto inexistente `404`.                   |
| RF-32, RF-33  | T2, T3, T10, T11     | Representacion publica completa sin `createdBy`.                    |
| RF-34, RF-35  | T6, T9, T10, T12     | Defaults, limite y orden cronologico estable.                       |
| RF-36         | T10, T11, T12        | Validaciones HTTP de params, cuerpos y queries.                     |
| RF-37, RF-38  | T5, T7, T11          | Motivo nulo en entrada/salida y productos inactivos permitidos.     |
| RF-39         | T6, T10, T12         | Limite maximo validado.                                             |
| RF-40         | T1, T5, T7           | Ajuste interpreta cantidad como stock final.                        |
| RF-41         | T6, T9, T12          | Conteo filtrado antes de paginar.                                   |
| RF-42, RF-43  | T7, T8, T11          | Rollback, errores internos e inconsistencia de Inventory.           |
| RF-44, RF-45  | T5, T6, T9, T10, T12 | Referencias nulas y filtro parcial case-insensitive.                |
| RF-46         | T11, T13             | Creaciones `201` con movimiento dentro de `data`.                   |
| RF-47         | T10, T11             | Campos no reconocidos ignorados.                                    |
| RF-48         | T5, T7               | Solicitudes validas repetidas crean movimientos independientes.     |
| RF-49, RF-50  | T1, T10, T11         | Cantidades invalidas se rechazan con `400`.                         |
| RF-51, RF-52  | T5, T10, T11         | Normalizacion de referencia y motivo.                               |
| RF-53 a RF-56 | T10, T11             | Cuerpos reconocidos y tipos de texto validados.                     |
