# Plan 005 - Authentication

## Contexto

La Spec 005 incorpora autenticación por email y contraseña para resolver la identidad de quien realiza una petición. La implementación debe permitir registro, inicio de sesión, consulta y cierre de sesión; establecer la sesión mediante cookie; exponer únicamente la identidad pública (`id`, `email`) y los metadatos de sesión (`id`, `createdAt`); y proteger las operaciones de escritura de productos y movimientos de inventario.

La autorización por roles y permisos queda fuera de alcance. Las lecturas existentes permanecerán públicas. La implementación respetará la separación entre la feature `auth`, el middleware transversal y la composición de `app.ts`.

## Módulos y responsabilidades

| Módulo                                              | Responsabilidad                                                                                                                                                            | RF cubiertos                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `prisma/schema.prisma` y migración de autenticación | Añadir las entidades persistentes requeridas por Better Auth para usuarios, sesiones, cuentas y verificaciones, con unicidad de email y token de sesión.                   | RF-1, RF-5, RF-7, RF-12, RF-14, RF-24                 |
| `src/features/auth/auth.config.ts`                  | Construir la instancia de Better Auth con email/contraseña habilitado, sin verificación de email, adaptador Prisma y configuración de cookies/sesiones.                    | RF-3 a RF-15, RF-23, RF-24, RF-27                     |
| `src/features/auth/auth.routes.ts`                  | Exponer el handler de Better Auth para registro, login, consulta de sesión y sign-out bajo la base pública de autenticación.                                               | RF-1 a RF-15, RF-23, RF-26, RF-27                     |
| `src/features/auth/auth.types.ts`                   | Definir los tipos públicos de identidad, metadatos de sesión y contexto de identidad autenticada, sin incluir secretos.                                                    | RF-6, RF-7, RF-10, RF-23, RF-27                       |
| `src/features/auth/index.ts`                        | Exponer únicamente la API pública de la feature auth para la composition root.                                                                                             | RF-1 a RF-15                                          |
| `src/shared/middlewares/auth.middleware.ts`         | Leer la cookie de sesión, validar la sesión con Better Auth, inyectar la identidad pública en el contexto y devolver el error estándar cuando no exista una sesión válida. | RF-9, RF-11, RF-16, RF-21, RF-25                      |
| `src/app.ts`                                        | Montar las rutas de autenticación, aplicar el middleware solo a las operaciones de escritura definidas y conservar públicas las lecturas.                                  | RF-16 a RF-22                                         |
| Schemas y contrato OpenAPI de autenticación         | Documentar los cuerpos de registro/login, respuestas públicas, errores `400`, `401`, `409` y `204`, sin documentar tokens ni secretos.                                     | RF-3 a RF-8, RF-10, RF-11, RF-13, RF-16, RF-23, RF-27 |
| Pruebas de autenticación y protección de rutas      | Verificar persistencia, cookies, sesiones, errores, identidad pública y acceso a endpoints protegidos y públicos.                                                          | RF-1 a RF-27                                          |

## Modelo de datos y contratos

### Persistencia

- Incorporar los modelos requeridos por el adaptador Prisma de Better Auth: usuario, sesión, cuenta y verificación.
- El usuario tendrá un email único, normalizado antes de persistirse, y los campos mínimos requeridos por el adaptador.
- La cuenta de email/contraseña almacenará únicamente el valor protegido por Better Auth; nunca se persistirá la contraseña original.
- La sesión tendrá un identificador único, token interno único, referencia al usuario y `createdAt`; los campos internos requeridos por Better Auth no se expondrán en respuestas.
- Las relaciones de sesiones y cuentas con el usuario tendrán eliminación en cascada cuando el usuario sea eliminado por una operación futura.
- La migración no modificará productos, inventarios ni movimientos existentes.
- La unicidad del email será garantizada por la base de datos además de la validación previa para evitar duplicados concurrentes.

### Contrato público

- La base de autenticación será una ruta dedicada para las operaciones estándar de Better Auth: registro, login, sesión y sign-out.
- El registro aceptará únicamente email y contraseña; los campos desconocidos se eliminarán del input antes de procesarlo.
- El login aceptará únicamente email y contraseña; los campos desconocidos se ignorarán.
- La consulta de sesión no aceptará datos adicionales; los campos desconocidos se ignorarán.
- El email se normalizará con `trim()` y conversión a minúsculas antes de validarse y persistirse.
- La contraseña tendrá mínimo 8 caracteres.
- El registro correcto responderá `201` y establecerá una cookie de sesión.
- El login correcto responderá `200` y establecerá una cookie de sesión.
- Registro y login devolverán `{ data: { user: { id, email }, session: { id, createdAt } } }`.
- La consulta de sesión válida devolverá `200` con la misma forma pública de usuario y sesión.
- El sign-out invalidará solo la sesión asociada a la cookie actual y devolverá `204`.
- El sign-out sin sesión válida también devolverá `204` y eliminará cualquier cookie de sesión recibida.
- Las credenciales inválidas, las sesiones ausentes y las sesiones inválidas devolverán `401` con `{ error: { code: "UNAUTHORIZED", message: "Authentication required" } }`.
- Un email duplicado devolverá `409` con código `EMAIL_ALREADY_REGISTERED`.
- Los errores de validación de email o contraseña devolverán `400` en el formato estándar del proyecto.
- El campo `session` público contendrá exactamente `id` y `createdAt`; no contendrá `expiresAt`, tokens, secretos ni otros campos.
- La cookie será el único mecanismo de autenticación entre peticiones.

### Rutas protegidas

- Proteger `POST /products`.
- Proteger `PATCH /products/:uuid`.
- Proteger `DELETE /products/:uuid`.
- Proteger `POST /inventory/:productUuid/entries`.
- Proteger `POST /inventory/:productUuid/exits`.
- Proteger `POST /inventory/:productUuid/adjustments`.
- Mantener públicas las rutas de lectura existentes y la consulta de movimientos.
- Una sesión válida permitirá continuar hacia la ruta protegida sin introducir autorización por roles.
- La identidad pública validada estará disponible para el contexto de la petición para futuras features que necesiten atribución.

## Decisiones técnicas

### Adaptador Prisma oficial de Better Auth

- Elegida: utilizar el adaptador Prisma de Better Auth contra el mismo PostgreSQL del proyecto y generar la estructura requerida antes de crear la migración.
- Descartada: crear un sistema de usuarios y sesiones propio. Duplicaría responsabilidades de seguridad, cookies y hashing que ya resuelve Better Auth.
- RF cubiertos: RF-1, RF-5, RF-7, RF-12, RF-14, RF-23, RF-24.

### Handler dedicado de autenticación

- Elegida: montar el handler estándar de Better Auth bajo una base de autenticación dedicada y exponer desde `features/auth/index.ts` solo el router/handler público.
- Descartada: implementar manualmente cuatro endpoints con lógica de contraseñas y sesiones. Aumentaría el riesgo de divergencias con el adaptador y el protocolo de cookies.
- RF cubiertos: RF-1 a RF-15, RF-23, RF-26, RF-27.

### Mapper público de identidad y sesión

- Elegida: transformar las respuestas de Better Auth a los DTOs públicos definidos por la spec, conservando solo `user.id`, `user.email`, `session.id` y `session.createdAt`.
- Descartada: devolver directamente el objeto de sesión de Better Auth. Puede incluir `expiresAt`, tokens internos u otros campos que la spec prohíbe exponer.
- RF cubiertos: RF-6, RF-7, RF-10, RF-23, RF-27.

### Cookie como transporte único

- Elegida: usar la cookie de sesión de Better Auth para autenticar peticiones y leerla desde el middleware mediante las cabeceras de la petición.
- Descartada: devolver tokens para que el cliente los envíe manualmente. Contradiría el contrato aprobado y ampliaría la superficie de exposición de credenciales.
- RF cubiertos: RF-9, RF-12, RF-13, RF-14, RF-25, RF-27.

### Middleware selectivo en la composition root

- Elegida: aplicar el middleware de autenticación únicamente a los métodos de escritura indicados por la spec y dejar las consultas públicas.
- Descartada: proteger todo el prefijo `/products` o `/inventory`. Cambiaría el comportamiento de las lecturas fuera del alcance aprobado.
- RF cubiertos: RF-16 a RF-22, RF-25.

### Sesión sin expiración automática

- Elegida: configurar la política de sesión para que la sesión no expire automáticamente y solo deje de ser válida mediante el sign-out de la sesión actual.
- Descartada: usar una expiración fija o por inactividad. Contradiría RF-14 y requeriría ampliar el contrato de sesión con un comportamiento no aprobado.
- RF cubiertos: RF-12, RF-14, RF-25.

### Contrato OpenAPI explícito para respuestas públicas

- Elegida: registrar schemas OpenAPI propios para las respuestas de autenticación que expongan únicamente los campos aprobados, aunque el handler interno sea de Better Auth.
- Descartada: documentar solo el handler genérico sin validar sus respuestas contra el contrato público. Podría publicar campos sensibles o incompatibles.
- RF cubiertos: RF-3 a RF-8, RF-10, RF-11, RF-13, RF-16, RF-23, RF-27.

## Estrategia de pruebas

| RF                           | Prueba                                                                                                                       | Nivel                         | Evidencia esperada                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| RF-1, RF-2, RF-3, RF-4, RF-6 | Registrar usuario con credenciales válidas, email inválido, email con espacios/mayúsculas y contraseñas de 7 y 8 caracteres. | integración HTTP + PostgreSQL | Cuenta creada solo con email/contraseña válidos; `201`, cookie y DTO público correctos; validaciones `400`.   |
| RF-5                         | Registrar dos veces el mismo email y repetir con diferencias de mayúsculas/espacios.                                         | integración HTTP + PostgreSQL | Una sola cuenta y `409 EMAIL_ALREADY_REGISTERED`.                                                             |
| RF-7, RF-8, RF-9             | Iniciar sesión con credenciales válidas, email inexistente y contraseña incorrecta.                                          | integración HTTP              | `200` con cookie y DTO público; errores genéricos `401`.                                                      |
| RF-10, RF-11                 | Consultar sesión con cookie válida, ausente, manipulada y asociada a sesión inexistente.                                     | integración HTTP              | `200` con exactamente `user.id`, `user.email`, `session.id`, `session.createdAt`; errores `401` estándar.     |
| RF-12, RF-13, RF-25          | Cerrar sesión con cookie válida, ausente y ya cerrada; intentar usar la cookie después.                                      | integración HTTP + PostgreSQL | `204`; sesión actual inválida; otras sesiones del mismo usuario siguen funcionando.                           |
| RF-14                        | Mantener una sesión entre peticiones posteriores sin expiración configurada.                                                 | integración HTTP              | La sesión continúa válida hasta sign-out.                                                                     |
| RF-15                        | Iniciar sesión inmediatamente después del registro sin verificación de email.                                                | integración HTTP              | Login permitido sin flujo de verificación.                                                                    |
| RF-16, RF-21                 | Ejecutar cada ruta protegida sin cookie y con cookie válida.                                                                 | integración HTTP              | Sin cookie: `401 UNAUTHORIZED`; con cookie: la petición continúa.                                             |
| RF-17 a RF-20                | Probar escrituras protegidas y lecturas públicas de productos, inventario y movimientos.                                     | integración HTTP              | Solo las rutas definidas requieren sesión; las lecturas continúan públicas.                                   |
| RF-22                        | Ejecutar operaciones con usuarios autenticados sin roles asignados.                                                          | integración HTTP              | La sesión es suficiente; no se evalúan permisos ni roles.                                                     |
| RF-23, RF-24, RF-27          | Inspeccionar respuestas, cookie y filas persistidas tras registro/login.                                                     | integración HTTP + PostgreSQL | No aparecen contraseñas, tokens, secretos ni `expiresAt` en respuestas; la contraseña no está en texto plano. |
| RF-26                        | Enviar campos desconocidos en registro, login y consulta de sesión.                                                          | integración HTTP              | Los campos desconocidos se ignoran y no alteran la cuenta ni la sesión.                                       |

## Riesgos y dudas abiertas

- Riesgo controlado: el esquema interno de Better Auth puede requerir `expiresAt` para persistencia aunque la respuesta pública no lo exponga. La prueba de sesión indefinida debe verificar que no se invalide automáticamente durante la vida de la aplicación; si la versión instalada impide esta política, el comportamiento debe volver a `change-manager` antes de implementar una alternativa.
- Riesgo controlado: las cookies requieren configuración coherente de CORS y credenciales cuando el cliente esté en otro origen. La prueba HTTP debe cubrir el envío y recepción de la cookie sin incluir secretos en logs.
- Riesgo controlado: los endpoints estándar de Better Auth pueden no ser rutas OpenAPI nativas. El contrato público debe verificarse en `/openapi.json` sin exponer campos internos.
- Dudas abiertas: ninguna.
