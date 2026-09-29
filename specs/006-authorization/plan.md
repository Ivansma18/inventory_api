# Plan 006 - Authorization

## Contexto

La Spec 006 introduce autorización basada en los cuatro roles fijos `ADMIN`, `MANAGER`, `OPERATOR` y `VIEWER`. La implementación ampliará el usuario existente de Better Auth con un rol persistido, expondrá ese rol en la identidad pública y añadirá administración de usuarios restringida a `ADMIN`.

La feature `authorization` será independiente de `auth`: Auth seguirá validando sesiones y exponiendo la identidad autenticada; Authorization evaluará permisos. La composición seguirá en `src/app.ts`. Las consultas de negocio existentes permanecerán públicas y las escrituras se protegerán según el rol y la matriz de la spec. Los cambios de rol deberán aplicarse en la siguiente petición de todas las sesiones activas.

La Spec 006 no deja dudas abiertas. Este plan no cambia el contrato de la spec ni crea tareas o implementación.

## Módulos y responsabilidades

| Módulo                                                                                                                                           | Responsabilidad                                                                                                                                                                            | RF cubiertos                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `prisma/schema.prisma` y una nueva migración                                                                                                     | Añadir el rol fijo al usuario existente, con valor predeterminado `VIEWER`; aplicar ese valor a las cuentas ya persistidas.                                                                | RF-1, RF-2, RF-23                                    |
| `src/features/auth/auth.config.ts`, `auth.types.ts`, `http/auth.mapper.ts`, `http/auth.schemas.ts` y `src/shared/middlewares/auth.middleware.ts` | Reconocer el campo de rol persistido como un campo de servidor, exponerlo en las respuestas de autenticación y sesión, y mantener la identidad autenticada actualizada para cada petición. | RF-2, RF-18, RF-19                                   |
| `src/features/authorization/domain/`                                                                                                             | Definir los roles conocidos, permisos de esta fase, política pura rol-permiso y errores de autorización y de invariantes de administración.                                                | RF-1, RF-7, RF-8, RF-10, RF-11, RF-12 a RF-16, RF-20 |
| `src/features/authorization/application/`                                                                                                        | Orquestar la autorización, listar usuarios y cambiar el rol mediante un contrato de repositorio, sin depender de Prisma ni Hono.                                                           | RF-4 a RF-20                                         |
| `src/features/authorization/infrastructure/`                                                                                                     | Implementar con Prisma la consulta paginada de usuarios y el cambio transaccional de rol, incluida la protección del último `ADMIN`.                                                       | RF-4, RF-6, RF-9 a RF-11, RF-19, RF-21 a RF-23       |
| `src/features/authorization/http/`                                                                                                               | Exponer `GET /users` y `PATCH /users/:id/role`; validar entradas, mapear DTOs y errores, y documentar los contratos en OpenAPI.                                                            | RF-4 a RF-9, RF-17, RF-21, RF-22                     |
| Rutas HTTP existentes de Products, Categories, Inventory y Stock Movements                                                                       | Recibir el guard de autorización desde la composición y evaluarlo en cada escritura protegida; mantener las lecturas públicas.                                                             | RF-12 a RF-17, RF-20                                 |
| `src/app.ts`                                                                                                                                     | Componer el repositorio, casos de uso y guardas de autorización; pasar las dependencias a las rutas y conservar `/api/auth` bajo el contrato de Spec 005.                                  | RF-3, RF-5, RF-8, RF-12 a RF-19                      |
| Pruebas de `authorization`, `auth` y rutas existentes                                                                                            | Cubrir políticas puras, persistencia, concurrencia, respuestas HTTP, sesiones, seguridad y OpenAPI.                                                                                        | RF-1 a RF-23                                         |

## Modelo de datos y contratos

### Persistencia

- Extender el modelo `User` ya utilizado por Better Auth; no crear otra tabla de usuarios.
- Persistir el campo de rol con los valores cerrados `ADMIN`, `MANAGER`, `OPERATOR` y `VIEWER`.
- El esquema y la migración asignarán `VIEWER` por defecto a usuarios nuevos y a cuentas existentes al aplicar la migración.
- Tras aplicar la migración, la primera cuenta `ADMIN` se configurará manualmente en la base de datos antes de usar los endpoints administrativos. No se añadirá una ruta de bootstrap ni se promoverá automáticamente al primer usuario registrado.
- No se crearán tablas de roles o permisos: los cuatro roles y sus capacidades son fijos en esta fase.

### Contratos de autorización

- `GET /users?page&limit` responderá `200` con `{ data: [{ id, email, role }], pagination: { total, page, limit } }`.
- `page` y `limit` usarán `1` y `15` como valores predeterminados; ambos serán enteros mayores o iguales a uno y `limit` tendrá máximo `100`.
- `PATCH /users/:id/role` recibirá `{ role }`, donde `:id` es el `user.id` público, y responderá `200` con `{ data: { id, email, role } }`.
- Los DTOs administrativos expondrán únicamente `id`, `email` y `role`; no incluirán `name`, credenciales, tokens ni otros campos internos.
- Los errores observables serán: `400` para rol o paginación inválidos, `401` para ausencia de sesión válida, `403` para rol autenticado no autorizado, `404` para usuario inexistente y `409` al intentar dejar la plataforma sin un `ADMIN`.

### Permisos

La política estática se expresará mediante permisos de operación y una tabla de capacidades central:

| Rol        | Operaciones autorizadas                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN`    | Todas las operaciones de negocio y administración definidas en la Spec 006.                                                                                            |
| `MANAGER`  | Crear, actualizar y desactivar productos y categorías; eliminar categorías sin productos asociados; actualizar el stock mínimo; registrar entradas, salidas y ajustes. |
| `OPERATOR` | Registrar entradas, salidas y ajustes.                                                                                                                                 |
| `VIEWER`   | Ninguna escritura.                                                                                                                                                     |

Las lecturas de negocio no exigirán permiso ni sesión. `GET /users` será la única lectura de esta fase restringida a `ADMIN`. La eliminación de una categoría con productos asociados seguirá siendo rechazada por la regla de negocio existente con `409`, incluso para `MANAGER`.

### Contrato de autenticación

- El rol almacenado en `User` será un campo adicional del usuario de Better Auth, con valores restringidos a los cuatro roles, valor predeterminado `VIEWER`, entrada deshabilitada para clientes y retorno habilitado en los objetos del servidor y el contrato público.
- Registro, inicio de sesión y consulta de sesión incluirán `user.role`; el objeto `session` conservará únicamente `id` y `createdAt`.
- El middleware de autenticación obtendrá el rol vigente del usuario al validar cada petición, forzando la lectura actual del usuario en vez de usar una respuesta de caché de cookie. El rol no se copiará como fuente de autorización en una sesión persistida ni en una cookie con caché.
- Los endpoints de registro, login, consulta de sesión y sign-out conservarán el contrato público de la Spec 005 y no recibirán la guarda de Authorization.

## Decisiones técnicas

### Roles fijos y política central

- Elegida: representar los roles y permisos mediante tipos y un mapa estático de Authorization, con la matriz definida por la spec.
- Descartada: persistir roles/permisos configurables en tablas separadas. La spec define un conjunto cerrado y no requiere administrar políticas dinámicas.
- RF cubiertos: RF-1, RF-12 a RF-16, RF-20.

### Rol en el usuario persistido

- Elegida: almacenar `role` en el registro de usuario existente y configurarlo como campo de Better Auth no editable por el cliente. La migración establece `VIEWER` para usuarios nuevos y preexistentes; el primer `ADMIN` se promueve manualmente.
- Descartada: aceptar el rol durante el registro o elegir automáticamente al primer usuario. La primera opción permite autoasignación privilegiada y la segunda contradice la decisión aprobada de bootstrap manual.
- RF cubiertos: RF-2, RF-3, RF-18, RF-23.

### Rol vigente en todas las sesiones

- Elegida: evaluar el rol obtenido del usuario persistido al validar cada petición y deshabilitar el uso de caché de sesión para autorización, de modo que no se conserve un rol antiguo.
- Descartada: persistir una copia del rol dentro de cada sesión o confiar en un valor de cookie. Un cambio de rol dejaría las sesiones activas desactualizadas.
- RF cubiertos: RF-18, RF-19.

### Protección del último administrador

- Elegida: comprobar el cambio de rol y el recuento de administradores dentro de una transacción PostgreSQL con aislamiento `Serializable`, reintentando conflictos serializables siguiendo el patrón ya utilizado por los repositorios del proyecto. Si el cambio dejaría cero administradores, la operación termina con un error de dominio que HTTP traduce a `409`.
- Descartada: contar administradores y actualizar el usuario en consultas independientes o con aislamiento predeterminado. Dos peticiones concurrentes podrían observar varios administradores y confirmar ambas degradaciones.
- RF cubiertos: RF-9 a RF-11.

### Guardas de autorización centralizadas

- Elegida: implementar el mapa estático rol-permiso y una guarda en la feature `authorization`; exponerla por la API pública de la feature y componerla desde `app.ts` junto con autenticación antes de cada escritura protegida. Los routers reciben la dependencia por composición y no duplican condiciones de rol.
- Descartada: distribuir comparaciones como `user.role === "ADMIN"` dentro de handlers o servicios de cada feature. Duplicaría reglas y permitiría divergencias entre endpoints.
- RF cubiertos: RF-5, RF-8, RF-12 a RF-17, RF-20.

### Administración de roles dentro de Authorization

- Elegida: alojar los casos de uso acotados de consulta de usuarios y cambio de rol en `features/authorization`, usando un contrato de repositorio propio que la infraestructura implementa sobre el modelo Prisma `User`.
- Descartada: crear una feature general de usuarios con operaciones adicionales de perfil o ciclo de vida no solicitadas por esta spec.
- RF cubiertos: RF-3 a RF-11, RF-21 a RF-23.

## Estrategia de pruebas

| RF                       | Prueba                                                                                                                                                                          | Nivel                                    | Evidencia esperada                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-1, RF-2, RF-23        | Verificar roles admitidos, valor predeterminado `VIEWER` en el registro y en cuentas existentes al aplicar la migración; configurar manualmente un usuario como primer `ADMIN`. | Unitario + integración PostgreSQL        | Solo existen los cuatro roles permitidos; usuarios nuevos y preexistentes quedan como `VIEWER` salvo la cuenta promovida manualmente.                                              |
| RF-3                     | Consultar y modificar roles con y sin una cuenta `ADMIN` configurada manualmente.                                                                                               | Integración HTTP + PostgreSQL            | Antes del bootstrap no se habilita gestión administrativa; después, el `ADMIN` configurado accede a las operaciones administrativas.                                               |
| RF-4, RF-21, RF-22       | Listar usuarios sin parámetros, con páginas/limites explícitos, `limit=100`, valores menores que uno, decimales y `limit=101`.                                                  | Integración HTTP + PostgreSQL            | `200`, campos públicos exactos, total de cuentas, defaults `1/15`; parámetros inválidos responden `400`.                                                                           |
| RF-5, RF-8, RF-16, RF-17 | Probar cada endpoint restringido sin sesión y con cada rol; incluir registro y sign-out sin sesión, y lecturas públicas.                                                        | Integración HTTP                         | Rutas enumeradas sin sesión responden `401`; rol autenticado sin permiso responde `403`; autenticación de Spec 005 y lecturas públicas mantienen su comportamiento.                |
| RF-6, RF-7, RF-9         | Cambiar roles válidos, enviar un rol desconocido e intentar actualizar un usuario inexistente.                                                                                  | Unitario + integración HTTP + PostgreSQL | `200` con `{ data: { id, email, role } }`, `400` y `404`, respectivamente; ningún campo sensible se serializa.                                                                     |
| RF-10, RF-11             | Demover el propio rol manteniendo otro `ADMIN`; intentar demover al último y ejecutar cambios concurrentes de los dos últimos administradores.                                  | Unitario + integración PostgreSQL        | Cambios válidos se aplican; la plataforma conserva al menos un `ADMIN`; los cambios que violan la invariante reciben `409`.                                                        |
| RF-12 a RF-15, RF-20     | Probar la matriz completa de permisos para rutas de productos, categorías, stock mínimo y movimientos, incluyendo eliminación de categoría usada.                               | Unitario de política + integración HTTP  | Cada rol permite solo sus operaciones; lecturas siguen públicas; una categoría con productos asociados conserva el `409` de la regla existente.                                    |
| RF-18, RF-19             | Consultar registro, login y sesión; mantener varias sesiones abiertas, cambiar el rol y volver a hacer peticiones con cada cookie.                                              | Integración HTTP + PostgreSQL            | `user.role` muestra el rol persistido actual en registro/login/sesión y la siguiente petición de cada sesión ve el cambio sin volver a iniciar sesión.                             |
| RF-4 a RF-9, RF-17       | Verificar schemas y respuestas de `GET /users` y `PATCH /users/:id/role`, junto con seguridad de cookie y errores, en `/openapi.json`.                                          | Integración HTTP/OpenAPI                 | OpenAPI documenta cuerpos, respuestas `200`, `400`, `401`, `403`, `404`, `409`, paginación y `sessionCookie`, sin datos internos.                                                  |
| RF-12 a RF-17            | Inspeccionar `/openapi.json` para cada escritura de productos, categorías, inventario y movimientos.                                                                            | Integración HTTP/OpenAPI                 | Todas las rutas protegidas documentan `sessionCookie`, `401` y `403`; la política de autorización no se añade a las rutas públicas de lectura ni a los endpoints de autenticación. |
| Todos                    | Ejecutar suite completa, typecheck, lint y formato al integrar la fase.                                                                                                         | Validación del repositorio               | Pasan `npm test`, `npm run typecheck`, `npm run lint`, `npm run format` y `git diff --check`; no cambian las rutas de autenticación ni las lecturas públicas.                      |

## Riesgos y dudas abiertas

- Riesgo operativo: hasta que una cuenta sea promovida manualmente a `ADMIN` en la base de datos, los endpoints administrativos no estarán disponibles; la migración y el procedimiento de promoción deberán ejecutarse en ese orden.
- Riesgo de consistencia: la garantía del último `ADMIN` depende de que todos los cambios de rol pasen por la transacción serializable del repositorio y de que sus conflictos se reintenten o se traduzcan al error definido.
- Riesgo de frescura: el contrato exige efecto en la siguiente petición de cualquier sesión; Authorization no debe usar una sesión cacheada que contenga el rol previo.
- Dudas abiertas: ninguna.
