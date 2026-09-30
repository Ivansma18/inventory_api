# Tareas - Spec 006 Authorization

- [x] T1. Añadir `User.role` con los cuatro roles fijos y valor predeterminado `VIEWER`; crear la migración de backfill para las cuentas existentes y probarla sobre un usuario preexistente. (RF-1, RF-2, RF-23)
      Hecho cuando: Prisma genera el modelo con el enum y default acordados; una prueba PostgreSQL aplica la migración sobre una cuenta existente, verifica `VIEWER` y confirma que puede promoverse manualmente a `ADMIN`.

- [x] T2. Configurar el campo de rol persistido en Better Auth como no editable por clientes y exponerlo en las respuestas públicas de registro, login y consulta de sesión. (RF-2, RF-18)
      Hecho cuando: pruebas HTTP confirman que una cuenta nueva recibe `VIEWER`, que un `role: ADMIN` enviado en el registro no eleva privilegios, que registro/login/sesión incluyen `user.role` y que `session` conserva únicamente `id` y `createdAt`.

- [x] T3. Definir la política pura rol-permiso para `ADMIN`, `MANAGER`, `OPERATOR` y `VIEWER`, con pruebas unitarias de todos los permisos declarados y denegados. (RF-1, RF-12, RF-13, RF-14, RF-15, RF-16, RF-20)
      Hecho cuando: una matriz de pruebas cubre cada rol frente a escrituras de productos, categorías, stock mínimo, movimientos y administración de usuarios, sin Hono, Prisma ni PostgreSQL.

- [x] T4. Implementar la guarda HTTP central de autorización, encadenada después de la autenticación, y probar sus respuestas de acceso permitido y denegado. (RF-5, RF-8, RF-16, RF-17)
      Hecho cuando: las pruebas verifican `401` sin sesión válida, `403` con sesión válida pero sin el permiso requerido, y continuidad cuando el rol sí está autorizado; los errores usan el formato estándar.

- [x] T5. Definir el contrato de repositorio y el caso de uso de consulta paginada de usuarios, usando un repositorio falso en las pruebas de aplicación. (RF-4, RF-21, RF-22)
      Hecho cuando: las pruebas de aplicación verifican que la consulta entrega `id`, `email`, `role` y el total recibido del repositorio sin depender de Prisma ni HTTP.

- [x] T6. Definir el caso de uso de cambio de rol y sus errores de usuario inexistente y último `ADMIN`, con pruebas sobre un repositorio falso. (RF-6, RF-9, RF-10, RF-11)
      Hecho cuando: las pruebas verifican actualización de rol, propagación del resultado del repositorio, `UserNotFound` y rechazo del último administrador sin Hono ni PostgreSQL.

- [x] T7. Implementar la consulta Prisma paginada de usuarios, incluyendo conteo total y selección exclusiva de campos públicos, con pruebas de integración PostgreSQL. (RF-4, RF-21, RF-22)
      Hecho cuando: las pruebas verifican páginas, límites, `total`, campos `id/email/role` y omisión de datos privados; los valores predeterminados y límites inválidos se validan posteriormente en HTTP.

- [x] T8. Implementar el cambio de rol en el repositorio Prisma dentro de una transacción serializable y probar cambios válidos, usuario inexistente y último `ADMIN`. (RF-6, RF-9, RF-10, RF-11)
      Hecho cuando: pruebas PostgreSQL verifican persistencia del rol, `404` por usuario inexistente, `409` al intentar dejar cero administradores y auto-cambio permitido mientras permanezca otro `ADMIN`.

- [x] T9. Añadir una prueba PostgreSQL de cambios concurrentes que intenten degradar a los dos últimos `ADMIN` y ajustar el reintento transaccional si la prueba lo requiere. (RF-10, RF-11)
      Hecho cuando: dos operaciones concurrentes no pueden confirmar un estado sin `ADMIN`; al menos una operación incompatible se rechaza con `409` y queda al menos un usuario `ADMIN`.

- [x] T10. Implementar `GET /users` con validación Zod, paginación, respuesta pública y contrato OpenAPI. (RF-4, RF-5, RF-17, RF-21, RF-22)
      Hecho cuando: pruebas HTTP verifican `200 { data, pagination }`, campos exactos, defaults `page=1/limit=15`, `400` para valores inválidos, `401` sin sesión y `403` para sesión válida no `ADMIN`; OpenAPI documenta estos contratos.

- [x] T11. Implementar `PATCH /users/:id/role` con validación de rol, respuesta pública, traducción de errores y contrato OpenAPI. (RF-6, RF-7, RF-8, RF-9, RF-10, RF-11, RF-17)
      Hecho cuando: pruebas HTTP verifican `200` y `{ data: { id, email, role } }`, `400` para rol inválido, `401` sin sesión, `403` para no `ADMIN` autenticado, `404` para usuario inexistente y `409` al intentar eliminar al último administrador.

- [x] T12. Componer en `app.ts` el repositorio, los casos de uso, la guarda y las rutas de Authorization; configurar manualmente el primer `ADMIN` en pruebas de integración. (RF-3, RF-5, RF-8, RF-17)
      Hecho cuando: las rutas administrativas reales devuelven `403` mientras solo haya cuentas `VIEWER`, funcionan tras promover manualmente una cuenta en PostgreSQL y no alteran el contrato de registro, login ni sign-out de la Spec 005.

- [x] T13. Aplicar permisos por rol a las escrituras de Products, preservando públicas sus lecturas y documentando `401`/`403` en OpenAPI. (RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-20)
      Hecho cuando: pruebas HTTP verifican que `ADMIN` y `MANAGER` pueden escribir; `OPERATOR` y `VIEWER` reciben `403`; sin sesión se recibe `401`; y las lecturas siguen públicas.

- [ ] T14. Aplicar permisos por rol a las escrituras de Categories, incluyendo la eliminación de categorías sin productos y el rechazo de las que están en uso. (RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-20)
      Hecho cuando: pruebas HTTP verifican escrituras de `ADMIN`/`MANAGER`, rechazos `403` para `OPERATOR`/`VIEWER`, `401` sin sesión, `200` al eliminar una categoría sin productos, `409` si tiene productos y lecturas públicas; OpenAPI refleja `401`/`403`.

- [ ] T15. Aplicar permisos por rol a `PATCH /inventory/:productUuid/minimum-stock`, manteniendo públicas las consultas de inventario. (RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-20)
      Hecho cuando: pruebas HTTP verifican permiso de `ADMIN`/`MANAGER`, `403` para `OPERATOR`/`VIEWER`, `401` sin sesión, lecturas públicas y respuestas OpenAPI `401`/`403`.

- [ ] T16. Aplicar permisos por rol a entradas, salidas y ajustes de stock, manteniendo públicas las consultas de movimientos. (RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-20)
      Hecho cuando: pruebas HTTP verifican que `ADMIN`, `MANAGER` y `OPERATOR` pueden registrar movimientos; `VIEWER` recibe `403`; sin sesión se recibe `401`; las lecturas siguen públicas y OpenAPI documenta `401`/`403`.

- [ ] T17. Verificar que un cambio de rol se aplique en la siguiente petición de todas las sesiones activas del usuario sin volver a iniciar sesión. (RF-18, RF-19)
      Hecho cuando: una prueba HTTP/PostgreSQL crea varias sesiones, cambia el rol mediante `PATCH /users/:id/role` y confirma que cada cookie ve el nuevo `user.role` y los permisos actualizados en su siguiente petición.

- [ ] T18. Añadir pruebas de contrato OpenAPI y regresión de rutas públicas para toda la fase de autorización. (RF-4, RF-5, RF-6, RF-7, RF-8, RF-9, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17)
      Hecho cuando: `/openapi.json` documenta `sessionCookie`, `401` y `403` en todas las escrituras protegidas y los endpoints administrativos; las lecturas de negocio siguen sin seguridad de Authorization y los endpoints de autenticación conservan la Spec 005.

- [ ] T19. Ejecutar la validación completa de la Spec 006 y revisar dependencias, cobertura de RF y migración. (RF-1 a RF-23)
      Hecho cuando: pasan `npm test`, `npm run typecheck`, `npm run lint`, `npm run format` y `git diff --check`; la revisión confirma migración, OpenAPI, errores, separación de capas, roles por endpoint y protección concurrente del último `ADMIN`.

## Orden y dependencias

| Tarea | Depende de            | Motivo                                                                                        |
| ----- | --------------------- | --------------------------------------------------------------------------------------------- |
| T1    | Ninguna               | El rol persistido y su migración son la base de Better Auth y de Authorization.               |
| T2    | T1                    | Better Auth debe reconocer y devolver el rol ya persistido.                                   |
| T3    | Ninguna               | La política estática es lógica pura y puede probarse antes de la persistencia.                |
| T4    | T2, T3                | La guarda necesita identidad con rol y una política evaluable.                                |
| T5    | T3                    | Los casos de uso de administración usan roles y contratos del dominio.                        |
| T6    | T3, T5                | El cambio de rol necesita los contratos de usuario y la regla del último administrador.       |
| T7    | T1, T5                | La lectura paginada requiere el modelo persistido y el contrato de repositorio.               |
| T8    | T1, T6                | La actualización transaccional implementa el contrato de cambio de rol.                       |
| T9    | T8                    | La prueba concurrente valida el comportamiento del repositorio implementado.                  |
| T10   | T4, T5, T7            | El endpoint lista usuarios mediante el caso de uso, la persistencia y la guarda.              |
| T11   | T4, T6, T8            | El endpoint actualiza roles mediante el caso de uso, la transacción y la guarda.              |
| T12   | T2, T4, T10, T11      | La composición real conecta autenticación, Authorization y administración de usuarios.        |
| T13   | T3, T4, T12           | La ruta de Products usa el guard compuesto y su política de permisos.                         |
| T14   | T3, T4, T12           | La ruta de Categories usa el guard compuesto y su política de permisos.                       |
| T15   | T3, T4, T12           | La ruta de stock mínimo usa el guard compuesto y su política de permisos.                     |
| T16   | T3, T4, T12           | Las rutas de movimientos usan el guard compuesto y su política de permisos.                   |
| T17   | T2, T11, T12, T13-T16 | La propagación de rol debe verificarse a través de actualización, sesiones y guards montados. |
| T18   | T10-T16               | El contrato OpenAPI/regresión requiere que todas las rutas estén conectadas y protegidas.     |
| T19   | T1-T18                | La validación final depende de la fase integrada.                                             |

## Cobertura de requisitos

| RF    | Tarea            | Evidencia                                                                                                        |
| ----- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| RF-1  | T1, T3           | Enum persistido y política unitaria con los cuatro roles exactos.                                                |
| RF-2  | T1, T2           | Defaults de base de datos y registro; el cliente no puede asignar `ADMIN`.                                       |
| RF-3  | T12              | Endpoints administrativos no disponibles como `ADMIN` hasta la promoción manual.                                 |
| RF-4  | T5, T7, T10, T18 | Lista de usuarios con campos, total, envoltura y OpenAPI.                                                        |
| RF-5  | T4, T10, T12     | `GET /users`: 403 con sesión válida no `ADMIN`, 401 sin sesión.                                                  |
| RF-6  | T6, T8, T11      | Cambio de rol correcto, persistencia y respuesta `200`.                                                          |
| RF-7  | T11              | Rol inválido rechazado con `400`.                                                                                |
| RF-8  | T4, T11          | `PATCH /users/:id/role`: no `ADMIN` autenticado recibe `403`.                                                    |
| RF-9  | T6, T8, T11      | Usuario inexistente produce `404`.                                                                               |
| RF-10 | T6, T8, T9       | El último `ADMIN` se conserva bajo solicitudes individuales y concurrentes; cambios incompatibles reciben `409`. |
| RF-11 | T6, T8, T9       | Auto-cambio permitido si queda otro `ADMIN`; auto-democión del último se rechaza.                                |
| RF-12 | T3, T13-T16      | `ADMIN` puede ejecutar todas las operaciones definidas.                                                          |
| RF-13 | T3, T13-T15      | Matriz de `MANAGER`, incluida eliminación de categoría no usada y stock mínimo.                                  |
| RF-14 | T3, T16          | `OPERATOR` puede registrar entradas, salidas y ajustes.                                                          |
| RF-15 | T3, T13-T16      | `VIEWER` no puede ejecutar escrituras.                                                                           |
| RF-16 | T3, T4, T13-T16  | Peticiones autenticadas sin permiso reciben `403`.                                                               |
| RF-17 | T4, T10-T16, T18 | Rutas protegidas sin sesión reciben `401`; autenticación y lecturas conservan sus contratos.                     |
| RF-18 | T2, T17          | La identidad de sesión incluye el rol actual.                                                                    |
| RF-19 | T2, T17          | Todas las sesiones activas reciben el cambio en su siguiente petición.                                           |
| RF-20 | T3, T13-T16      | La matriz estática no concede permisos fuera de los listados.                                                    |
| RF-21 | T5, T7, T10      | Omisión de `page`/`limit` produce `1/15`.                                                                        |
| RF-22 | T5, T7, T10      | Paginación inválida o límite mayor a 100 produce `400`.                                                          |
| RF-23 | T1               | Las cuentas existentes quedan en `VIEWER` tras la migración; la promoción inicial es manual.                     |
