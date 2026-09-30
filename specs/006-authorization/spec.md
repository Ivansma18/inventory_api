# Spec 006 - Authorization

## Contexto y objetivo

La API ya identifica al usuario autenticado, pero todavía no controla las operaciones que puede realizar. Esta fase incorpora autorización basada en roles para restringir las operaciones de productos, categorías, inventario y movimientos de stock, además de permitir que los administradores consulten usuarios y administren sus roles. Las rutas de lectura existentes permanecen públicas.

## Usuarios / actores

- Usuario autenticado con rol `ADMIN`.
- Usuario autenticado con rol `MANAGER`.
- Usuario autenticado con rol `OPERATOR`.
- Usuario autenticado con rol `VIEWER`.
- Usuario no autenticado.

## Historias de usuario

- H1: Como administrador quiero asignar roles a otros usuarios para controlar sus capacidades dentro de la API.
- H2: Como manager quiero administrar productos, categorías, inventario y movimientos para operar el inventario.
- H3: Como operador quiero consultar información y registrar movimientos de stock para realizar operaciones diarias.
- H4: Como viewer quiero consultar la información disponible sin modificarla.
- H5: Como sistema quiero rechazar operaciones no permitidas para proteger los datos.

## Requisitos funcionales

- RF-1: EL SISTEMA reconocerá los roles `ADMIN`, `MANAGER`, `OPERATOR` y `VIEWER`.
- RF-2: CUANDO se cree una cuenta nueva, EL SISTEMA le asignará el rol `VIEWER`.
- RF-3: ANTES de utilizar la gestión de roles por API, EL SISTEMA requerirá que la primera cuenta `ADMIN` haya sido configurada manualmente en la base de datos.
- RF-4: CUANDO un `ADMIN` solicite `GET /users`, EL SISTEMA responderá `200` con `{ data: [{ id, email, role }], pagination: { total, page, limit } }`, donde `total` será el número total de cuentas.
- RF-5: SI un usuario autenticado con sesión válida y rol distinto de `ADMIN` solicita la lista de usuarios, ENTONCES EL SISTEMA rechazará la solicitud con `403`.
- RF-6: CUANDO un `ADMIN` envíe `{ role }` a `PATCH /users/:id/role`, donde `:id` corresponde al `user.id` público, para un usuario existente y un rol definido, EL SISTEMA actualizará el rol y responderá `200` con `{ data: { id, email, role } }`.
- RF-7: SI un `ADMIN` solicita asignar un rol no definido, ENTONCES EL SISTEMA rechazará la solicitud con `400`.
- RF-8: SI un usuario autenticado con sesión válida y rol distinto de `ADMIN` solicita `PATCH /users/:id/role`, ENTONCES EL SISTEMA rechazará la solicitud con `403`.
- RF-9: SI un `ADMIN` solicita cambiar el rol de un usuario inexistente, ENTONCES EL SISTEMA responderá con `404`.
- RF-10: SI la ejecución aislada o concurrente de solicitudes de cambio de rol dejaría la plataforma sin ningún usuario con rol `ADMIN`, ENTONCES EL SISTEMA impedirá confirmar los cambios que violen esta condición y responderá `409` a las solicitudes rechazadas.
- RF-11: CUANDO un `ADMIN` solicite cambiar su propio rol y permanezca al menos un `ADMIN`, EL SISTEMA actualizará su rol.
- RF-12: MIENTRAS el usuario autenticado tenga rol `ADMIN`, EL SISTEMA le permitirá todas las operaciones definidas en esta especificación y las operaciones existentes de productos, categorías, inventario y movimientos de stock.
- RF-13: MIENTRAS el usuario autenticado tenga rol `MANAGER`, EL SISTEMA le permitirá crear, actualizar y desactivar productos y categorías; eliminar permanentemente categorías sin productos asociados; consultar inventario y movimientos; actualizar el stock mínimo; y registrar entradas, salidas y ajustes de stock.
- RF-14: MIENTRAS el usuario autenticado tenga rol `OPERATOR`, EL SISTEMA le permitirá registrar entradas, salidas y ajustes de stock.
- RF-15: MIENTRAS el usuario autenticado tenga rol `VIEWER`, EL SISTEMA no le permitirá operaciones que modifiquen recursos.
- RF-16: SI un usuario autenticado solicita una operación que su rol no permite, ENTONCES EL SISTEMA responderá con `403`.
- RF-17: SI una solicitud sin sesión válida se dirige a `POST /products`, `PATCH /products/:uuid`, `DELETE /products/:uuid`, `POST /categories`, `PATCH /categories/:uuid`, `DELETE /categories/:uuid`, `PATCH /inventory/:productUuid/minimum-stock`, `POST /inventory/:productUuid/entries`, `POST /inventory/:productUuid/exits`, `POST /inventory/:productUuid/adjustments`, `GET /users` o `PATCH /users/:id/role`, ENTONCES EL SISTEMA responderá con `401`; las rutas de autenticación conservarán el contrato de la Spec 005.
- RF-18: CUANDO un usuario se registre, inicie sesión o consulte su sesión, EL SISTEMA incluirá el rol actual de su cuenta como `user.role` en la identidad pública de la respuesta.
- RF-19: CUANDO el rol de un usuario cambie, EL SISTEMA aplicará el nuevo rol en la siguiente solicitud autenticada de cualquiera de sus sesiones activas sin requerir un nuevo inicio de sesión.
- RF-20: EL SISTEMA limitará las operaciones de cada rol a las definidas en RF-12, RF-13, RF-14 y RF-15.
- RF-21: CUANDO un `ADMIN` omita `page` o `limit` en `GET /users`, EL SISTEMA usará `page=1` y `limit=15`.
- RF-22: SI un `ADMIN` envía `page` o `limit` que no sea un entero mayor o igual que `1`, o un `limit` superior a `100`, ENTONCES EL SISTEMA rechazará la solicitud con `400`.
- RF-23: CUANDO se active la autorización, EL SISTEMA asignará el rol `VIEWER` por defecto a las cuentas existentes, excepto a la cuenta configurada manualmente como el primer `ADMIN`.

## Requisitos no funcionales

- Las operaciones de consulta y cambio de roles estarán documentadas mediante OpenAPI.
- Las respuestas `401`, `403`, `404` y `409` usarán el formato de errores estándar del proyecto.
- La autorización se evaluará antes de ejecutar la operación protegida.
- Las reglas de autorización se probarán sin depender de HTTP, Prisma o PostgreSQL.
- Las rutas HTTP no contendrán reglas de roles o permisos complejas.
- Las respuestas no expondrán contraseñas, tokens, secretos ni datos privados adicionales.
- Las respuestas exitosas de registro, inicio de sesión y consulta de sesión incluirán el rol actual como `user.role`; este campo amplía la identidad pública definida en la Spec 005.
- Las rutas de lectura existentes permanecerán públicas; `GET /users` será la única operación de lectura que exigirá `ADMIN`.

## Casos límite

- Registro de una cuenta nueva sin administrador inicial configurado.
- Configuración manual del primer `ADMIN` en la base de datos antes de utilizar la gestión de roles por API.
- Cuentas existentes al activar autorización, antes y después de configurar manualmente el primer `ADMIN`.
- Usuario `VIEWER` intentando modificar productos, categorías o inventario.
- Usuario `OPERATOR` intentando modificar productos, categorías o mínimos de stock.
- Usuario `MANAGER` intentando administrar roles.
- Usuario no autenticado intentando acceder a una operación protegida.
- Solicitud sin sesión válida a una escritura de negocio, `GET /users` o `PATCH /users/:id/role`, que responde `401`.
- Solicitud autenticada con sesión válida y rol distinto de `ADMIN` a `PATCH /users/:id/role`, que responde `403`.
- Registro y cierre de sesión sin sesión válida, que conservan el comportamiento definido en la Spec 005.
- Consulta pública de productos, categorías, inventario o movimientos sin sesión.
- Consulta de usuarios sin sesión, que responde `401`, o con sesión válida y rol distinto de `ADMIN`, que responde `403`.
- Lista de usuarios vacía, con parámetros de paginación inválidos o fuera de rango.
- Lista de usuarios con `page` o `limit` omitidos.
- Cambio de rol a un valor inválido.
- Cambio de rol de un usuario inexistente.
- Un `ADMIN` cambiando su propio rol.
- Cambio de rol del último `ADMIN`.
- Dos `ADMIN` intentando cambiar concurrentemente roles de forma que la plataforma quedaría sin ningún `ADMIN`; los cambios incompatibles son rechazados con `409` y permanece al menos un `ADMIN`.
- Un `MANAGER` eliminando permanentemente una categoría sin productos asociados.
- Un `MANAGER` intentando eliminar permanentemente una categoría con productos asociados.
- Varias sesiones activas de un usuario cuyo rol cambia.
- Sesión cerrada intentando acceder a una operación protegida.
- Consulta de usuarios con una cuenta sin permisos.
- Respuestas de registro, inicio de sesión y consulta de sesión con el rol actual y sin información sensible.

## Fuera de alcance

- Permisos individuales por usuario.
- Roles personalizados.
- Jerarquías de roles configurables.
- Gestión de usuarios distinta de listar usuarios y actualizar roles.
- Invitaciones de usuarios.
- Eliminación o desactivación de usuarios.
- Organización, tenant o aislamiento multi-tenant.
- Auditoría histórica de cambios de rol.
- Recuperación, cambio o verificación de contraseñas.
- Autorización basada en propiedad de recursos.

## Criterios de finalización

- Todos los RF están implementados y probados.
- Las cuentas nuevas reciben el rol `VIEWER`.
- Las cuentas existentes reciben el rol `VIEWER` por defecto al activar autorización, excepto la cuenta configurada manualmente como primer `ADMIN`.
- La gestión de roles por API permanece inaccesible hasta configurar manualmente el primer `ADMIN`.
- Un `ADMIN` puede listar usuarios y cambiar sus roles.
- La lista de usuarios y el cambio de rol devuelven los contratos y status codes definidos.
- Ningún cambio de rol puede dejar la plataforma sin un `ADMIN`.
- La garantía de conservar al menos un `ADMIN` se mantiene ante solicitudes concurrentes.
- Cada rol permite únicamente las operaciones definidas.
- `MANAGER` puede eliminar categorías sin productos asociados y no puede eliminar categorías con productos asociados.
- Las rutas de lectura existentes continúan siendo públicas.
- Las solicitudes sin sesión a las rutas enumeradas en RF-17 reciben `401`.
- Las solicitudes autenticadas sin permiso, incluidas las solicitudes no `ADMIN` a `PATCH /users/:id/role`, reciben `403`.
- Las respuestas de registro, inicio de sesión y consulta de sesión muestran el rol actual sin exponer información sensible.
- Los contratos OpenAPI y los errores correspondientes están documentados y probados.

## Dudas abiertas

- Ninguna.
