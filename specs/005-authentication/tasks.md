# Tareas - Spec 005 Authentication

- [x] T1. Añadir los modelos Prisma requeridos por Better Auth y su migración PostgreSQL, incluyendo usuario, sesión, cuenta, verificación, unicidad de email/token y relaciones. (RF-1, RF-5, RF-7, RF-12, RF-14, RF-24)
      Hecho cuando: el schema Prisma y la migración crean las entidades de autenticación sin modificar Product, Inventory ni StockMovement, y las pruebas verifican unicidad, relaciones y ausencia de contraseñas en texto plano.

- [x] T2. Configurar la instancia de Better Auth con adaptador Prisma, email/contraseña, normalización de email, ausencia de verificación de email, cookie de sesión y duración máxima de 400 días. (RF-3, RF-4, RF-14, RF-15, RF-24)
      Hecho cuando: las pruebas de configuración verifican email normalizado, contraseña mínima de 8 caracteres, login sin verificación de email, sesión válida dentro de 400 días y expiración posterior al límite.

- [x] T3. Definir los tipos públicos y mappers de autenticación para exponer únicamente `user.id`, `user.email`, `session.id` y `session.createdAt`. (RF-6, RF-7, RF-10, RF-23, RF-27)
      Hecho cuando: las pruebas de serialización demuestran que las respuestas no contienen contraseña, token, secreto, `expiresAt` ni campos adicionales de sesión.

- [x] T4. Montar el handler público de Better Auth para registro, login, consulta de sesión y sign-out, con normalización de cuerpos, códigos `201`, `200`, `204`, `400`, `401` y `409`. (RF-1 a RF-15, RF-23, RF-26, RF-27)
      Hecho cuando: las pruebas HTTP cubren el ciclo completo, email duplicado con `409 EMAIL_ALREADY_REGISTERED`, credenciales inválidas con `401`, sign-out idempotente con `204` y cookies emitidas correctamente.

- [x] T5. Implementar el middleware transversal que lea y valide la cookie, inyecte la identidad pública en el contexto y traduzca sesiones ausentes o inválidas a `401 UNAUTHORIZED`. (RF-9, RF-11, RF-16, RF-21, RF-25)
      Hecho cuando: las pruebas HTTP verifican identidad disponible para la petición, rechazo de cookie ausente/manipulada/cerrada y continuidad con una cookie válida.

- [ ] T6. Aplicar autenticación a `POST /products`, `PATCH /products/:uuid` y `DELETE /products/:uuid` sin proteger sus rutas de lectura. (RF-17, RF-18, RF-19, RF-21, RF-22)
      Hecho cuando: cada escritura responde `401` sin sesión, funciona con sesión válida y las lecturas de productos continúan públicas sin evaluación de roles.

- [ ] T7. Aplicar autenticación a `POST /inventory/:productUuid/entries`, `POST /inventory/:productUuid/exits` y `POST /inventory/:productUuid/adjustments`, manteniendo públicas las consultas. (RF-20, RF-21, RF-22)
      Hecho cuando: las tres operaciones responden `401` sin sesión, funcionan con sesión válida y las consultas de inventario y movimientos continúan públicas.

- [ ] T8. Registrar la feature de autenticación y sus schemas en `app.ts`, documentando los contratos públicos y errores aplicables en OpenAPI/Swagger. (RF-3, RF-5, RF-6, RF-7, RF-8, RF-10, RF-11, RF-13, RF-16, RF-23, RF-27)
      Hecho cuando: `/openapi.json` y `/docs` exponen las operaciones de autenticación con respuestas públicas limitadas a los campos de la spec y sin tokens ni secretos.

- [ ] T9. Añadir pruebas de ciclo de vida de autenticación con PostgreSQL para registro, login, sesión, sign-out, normalización, duplicados, validaciones y fallos de persistencia. (RF-1 a RF-15, RF-23, RF-24, RF-26, RF-27)
      Hecho cuando: la suite verifica todos los casos del ciclo de vida, no persiste contraseñas en texto plano y los campos desconocidos se ignoran en registro, login y consulta de sesión.

- [ ] T10. Añadir pruebas de sesiones múltiples, cierre de la sesión actual, cookies inválidas y persistencia de otras sesiones activas. (RF-12, RF-13, RF-14, RF-25)
      Hecho cuando: cerrar una sesión invalida solo esa sesión, devuelve `204`, rechaza su cookie posterior y mantiene operativas las demás sesiones del usuario.

- [ ] T11. Ejecutar la validación completa de la fase y comprobar compatibilidad con las rutas existentes, dependencias de capas, formato y documentación. (RF-1 a RF-27)
      Hecho cuando: pasan `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, `git diff --check`, y se verifica que no se introducen roles, permisos ni protección accidental de lecturas.

## Orden y dependencias

| Tarea | Depende de          | Motivo                                                                             |
| ----- | ------------------- | ---------------------------------------------------------------------------------- |
| T1    | Ninguna             | La configuración de Better Auth necesita las tablas y relaciones persistentes.     |
| T2    | T1                  | El adaptador y la configuración requieren el schema Prisma disponible.             |
| T3    | T2                  | Los mappers dependen de las formas de usuario y sesión producidas por Better Auth. |
| T4    | T2, T3              | El handler necesita la instancia configurada y el contrato público.                |
| T5    | T2, T3              | El middleware necesita validar sesiones y exponer la identidad pública.            |
| T6    | T5                  | La protección de productos requiere el middleware autenticador.                    |
| T7    | T5                  | La protección de movimientos requiere el middleware autenticador.                  |
| T8    | T3, T4, T5, T6, T7  | OpenAPI debe reflejar endpoints, respuestas y protección ya compuestos.            |
| T9    | T1, T4              | Las pruebas de ciclo de vida requieren persistencia y handler funcional.           |
| T10   | T4, T5              | Las pruebas de sesiones múltiples requieren cookies y middleware funcionales.      |
| T11   | T6, T7, T8, T9, T10 | La validación final depende de toda la fase integrada.                             |

## Cobertura de requisitos

| RF    | Tarea           | Evidencia                                                                |
| ----- | --------------- | ------------------------------------------------------------------------ |
| RF-1  | T1, T4, T9      | Registro válido crea usuario y sesión.                                   |
| RF-2  | T3, T4, T9      | Registro reconoce únicamente email y contraseña.                         |
| RF-3  | T2, T4, T9      | Email inválido responde `400` después de normalización.                  |
| RF-4  | T2, T4, T9      | Contraseña menor de 8 caracteres responde `400`.                         |
| RF-5  | T1, T4, T9      | Email normalizado duplicado responde `409 EMAIL_ALREADY_REGISTERED`.     |
| RF-6  | T3, T4, T8, T9  | Registro responde `201`, cookie y DTO público exacto.                    |
| RF-7  | T3, T4, T8, T9  | Login responde `200`, cookie y DTO público exacto.                       |
| RF-8  | T4, T8, T9      | Credenciales inválidas responden `401 UNAUTHORIZED`.                     |
| RF-9  | T4, T5, T9      | Cookie creada en login autentica peticiones posteriores.                 |
| RF-10 | T3, T4, T8, T9  | Consulta válida responde identidad y sesión pública.                     |
| RF-11 | T5, T8, T9      | Consulta sin sesión responde `401 UNAUTHORIZED`.                         |
| RF-12 | T4, T10         | Sign-out invalida solo la sesión actual.                                 |
| RF-13 | T4, T9, T10     | Sign-out sin sesión responde `204` idempotentemente.                     |
| RF-14 | T2, T9, T10     | Sesión continúa activa dentro de 400 días y expira después del límite.    |
| RF-15 | T2, T9          | Login permitido sin verificación de email.                               |
| RF-16 | T5, T6, T7, T10 | Operaciones protegidas rechazan sesiones ausentes o inválidas.           |
| RF-17 | T6, T11         | `POST /products` protegido y validado.                                   |
| RF-18 | T6, T11         | `PATCH /products/:uuid` protegido y validado.                            |
| RF-19 | T6, T11         | `DELETE /products/:uuid` protegido y validado.                           |
| RF-20 | T7, T11         | Tres operaciones de movimientos protegidas y validadas.                  |
| RF-21 | T5, T6, T7, T10 | Sesión válida permite continuar y conservar sesiones paralelas.          |
| RF-22 | T6, T7, T11     | No se evalúan roles ni permisos.                                         |
| RF-23 | T3, T4, T8, T9  | Ninguna respuesta expone contraseñas.                                    |
| RF-24 | T1, T2, T9      | Persistencia usa contraseña protegida, nunca texto plano.                |
| RF-25 | T5, T10         | Cookie de sesión cerrada es rechazada posteriormente.                    |
| RF-26 | T4, T9          | Campos desconocidos se ignoran en las tres operaciones de autenticación. |
| RF-27 | T3, T8, T9      | Respuestas contienen solo metadatos de sesión permitidos.                |
