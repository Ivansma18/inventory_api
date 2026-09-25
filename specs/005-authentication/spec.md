# Spec 005 — Authentication

## Contexto y objetivo

La API necesita identificar quién realiza cada petición antes de permitir operaciones de escritura. Esta fase incorpora registro e inicio de sesión mediante email y contraseña, consulta y cierre de sesión, además de proteger las operaciones que modifican productos o inventario. La autorización por roles y permisos queda fuera de esta fase.

## Usuarios / actores

- Usuario no autenticado que crea una cuenta.
- Usuario registrado que inicia sesión.
- Usuario autenticado que consulta o cierra su sesión.
- Cliente de la API que realiza operaciones protegidas.

## Historias de usuario

- H1: Como usuario nuevo quiero registrarme con email y contraseña para crear una cuenta.
- H2: Como usuario registrado quiero iniciar sesión para obtener una sesión autenticada.
- H3: Como usuario autenticado quiero consultar mi sesión actual para conocer mi identidad.
- H4: Como usuario autenticado quiero cerrar sesión para invalidar mi sesión.
- H5: Como sistema quiero rechazar operaciones protegidas sin sesión válida.

## Requisitos funcionales

- RF-1: CUANDO un usuario envíe un email y una contraseña válidos para registrarse, EL SISTEMA creará una cuenta autenticable.
- RF-2: EL SISTEMA aceptará únicamente email y contraseña durante el registro.
- RF-3: SI el email, después de eliminar espacios exteriores y convertirlo a minúsculas, no tiene un formato válido, ENTONCES EL SISTEMA rechazará el registro con `400`.
- RF-4: SI la contraseña contiene menos de 8 caracteres, ENTONCES EL SISTEMA rechazará el registro con `400`.
- RF-5: SI el email normalizado ya está registrado, ENTONCES EL SISTEMA rechazará el registro con `409` y código `EMAIL_ALREADY_REGISTERED` sin crear una segunda cuenta.
- RF-6: CUANDO el registro sea correcto, EL SISTEMA creará automáticamente una sesión y devolverá `201` con `{ data: { user: { id, email }, session: { id, createdAt } } }` sin exponer la contraseña.
- RF-7: CUANDO un usuario envíe credenciales válidas, EL SISTEMA iniciará una sesión autenticada y devolverá `200` con `{ data: { user: { id, email }, session: { id, createdAt } } }` sin exponer la contraseña.
- RF-8: SI el email o la contraseña no coinciden con una cuenta existente, ENTONCES EL SISTEMA responderá `401` con `{ error: { code: "UNAUTHORIZED", message: "Authentication required" } }`.
- RF-9: CUANDO el inicio de sesión sea correcto, EL SISTEMA establecerá la sesión del usuario para las siguientes peticiones autenticadas.
- RF-10: CUANDO un usuario consulte su sesión con una sesión válida, EL SISTEMA devolverá `200` con `{ data: { user: { id, email }, session: { id, createdAt } } }` sin exponer la contraseña.
- RF-11: SI un usuario consulta su sesión sin una sesión válida, ENTONCES EL SISTEMA responderá `401` con `{ error: { code: "UNAUTHORIZED", message: "Authentication required" } }`.
- RF-12: CUANDO un usuario cierre sesión, EL SISTEMA invalidará únicamente su sesión actual.
- RF-13: CUANDO un usuario solicite cerrar sesión sin una sesión válida, EL SISTEMA responderá `204` sin crear ni conservar una sesión.
- RF-14: MIENTRAS una sesión no sea cerrada y no hayan transcurrido 400 días desde su creación, EL SISTEMA la mantendrá activa.
- RF-15: EL SISTEMA no exigirá verificación del email para iniciar sesión.
- RF-16: MIENTRAS una petición no tenga una sesión válida, EL SISTEMA rechazará las operaciones protegidas con `401` y responderá `{ error: { code: "UNAUTHORIZED", message: "Authentication required" } }`.
- RF-17: EL SISTEMA exigirá autenticación para `POST /products`.
- RF-18: EL SISTEMA exigirá autenticación para `PATCH /products/:uuid`.
- RF-19: EL SISTEMA exigirá autenticación para `DELETE /products/:uuid`.
- RF-20: EL SISTEMA exigirá autenticación para `POST /inventory/:productUuid/entries`, `POST /inventory/:productUuid/exits` y `POST /inventory/:productUuid/adjustments`.
- RF-21: CUANDO una petición protegida tenga una sesión válida, EL SISTEMA permitirá que continúe hacia la operación solicitada.
- RF-22: EL SISTEMA no aplicará roles ni permisos en esta fase.
- RF-23: EL SISTEMA no expondrá contraseñas en ninguna respuesta.
- RF-24: EL SISTEMA no almacenará contraseñas en texto plano.
- RF-25: CUANDO la sesión actual sea cerrada, EL SISTEMA rechazará las peticiones posteriores que dependan de esa sesión sin invalidar otras sesiones activas del mismo usuario.
- RF-26: CUANDO el cliente envíe campos no reconocidos durante el registro, inicio de sesión o consulta de sesión, EL SISTEMA los ignorará y procesará únicamente los campos definidos para la operación.
- RF-27: EL SISTEMA no incluirá tokens, secretos, `expiresAt` ni otros campos adicionales en `session` dentro de las respuestas de registro, inicio de sesión o consulta de sesión.
- RF-28: CUANDO un usuario autenticado solicite `DELETE /products/:uuid` para un producto existente, EL SISTEMA establecerá `isActive=false`, conservará el producto y devolverá `200` con `{ data: { uuid, isActive: false } }`.

## Requisitos no funcionales

- Los contratos de autenticación estarán documentados mediante OpenAPI cuando sean endpoints propios de la API.
- Las respuestas de error de autenticación usarán el formato estándar del proyecto.
- Los emails se normalizarán eliminando espacios exteriores y convirtiéndolos a minúsculas antes de validarlos y persistirlos.
- Las contraseñas se protegerán mediante un mecanismo irreversible de almacenamiento.
- Las respuestas exitosas de registro, inicio de sesión y consulta de sesión usarán las estructuras definidas en RF-6, RF-7 y RF-10.
- La identidad pública de un usuario incluirá únicamente `id` y `email`.
- La sesión se transportará mediante una cookie de sesión y el campo `session` de las respuestas contendrá exactamente `id` y `createdAt`.
- La cookie y la sesión tendrán una duración máxima de 400 días.
- Las pruebas cubrirán registro, inicio de sesión, consulta de sesión, cierre de sesión y protección de endpoints.
- Las pruebas no expondrán credenciales reales ni secretos.
- La identidad autenticada estará disponible para las capas que necesiten registrar el usuario de la petición.
- Las operaciones de lectura existentes permanecerán públicas, salvo que una decisión posterior indique lo contrario.

## Casos límite

- Registro con email vacío.
- Registro con email en mayúsculas.
- Registro con espacios exteriores en el email.
- Registro con contraseña vacía.
- Contraseña con exactamente 8 caracteres.
- Registro con email duplicado.
- Registro con email duplicado usando diferencias de mayúsculas o espacios exteriores.
- Inicio de sesión con email inexistente.
- Inicio de sesión con contraseña incorrecta.
- Consulta de sesión sin credenciales.
- Cierre de sesión con sesión inexistente.
- Cierre de sesión exitoso con respuesta `204`.
- Petición protegida sin sesión.
- Petición protegida con sesión cerrada.
- Petición protegida con sesión válida.
- Campos desconocidos durante el registro.
- Registro exitoso con creación automática de sesión.
- Inicio de sesión exitoso con respuesta `200`.
- Usuario con varias sesiones activas.
- Sesión próxima a cumplir 400 días.
- Sesión con más de 400 días.
- Cierre de una sesión sin invalidar las demás sesiones del usuario.
- Cookie de sesión ausente, inválida o asociada a una sesión cerrada.
- Cookie válida cuyo identificador no corresponde a una sesión existente.
- Cookie manipulada.
- Cierre de sesión de una sesión ya cerrada.
- Eliminación lógica de un producto activo.
- Eliminación lógica repetida de un producto ya inactivo.
- Eliminación de un producto inexistente.
- Eliminación con UUID inválido.
- Fallo de persistencia durante el registro, inicio o cierre de sesión.
- Campos desconocidos durante el inicio o consulta de sesión.
- Respuestas de autenticación sin tokens ni secretos de sesión.
- Respuestas de sesión sin `expiresAt` ni campos adicionales.
- Intento de exponer la contraseña en respuestas o errores.

## Fuera de alcance

- Roles `ADMIN`, `MANAGER`, `OPERATOR` y `VIEWER`.
- Permisos específicos por operación.
- Autorización basada en roles.
- Verificación de email.
- Recuperación o cambio de contraseña.
- Autenticación multifactor.
- Inicio de sesión mediante proveedores externos.
- Gestión administrativa de usuarios.
- Registro de `createdBy` en movimientos de stock.
- Invitaciones de usuarios.
- Multi-tenant y aislamiento por organización.

## Criterios de finalización

- Todos los RF están implementados y probados.
- Un usuario puede registrarse con email y contraseña.
- Un usuario registrado puede iniciar y cerrar sesión con las respuestas definidas.
- La sesión actual puede consultarse con una respuesta `200`, `user.id`, `user.email` y la sesión activa.
- Las operaciones protegidas rechazan solicitudes sin sesión con `401 UNAUTHORIZED` y el formato estándar.
- Las operaciones protegidas permiten solicitudes con sesión válida.
- El cierre de una sesión no invalida otras sesiones activas del mismo usuario.
- Las contraseñas no se exponen ni almacenan en texto plano.
- Las respuestas de autenticación no incluyen tokens ni secretos de sesión.
- Las respuestas de sesión contienen exactamente `id` y `createdAt`.
- Las sesiones no permanecen activas después de 400 días desde su creación.
- No se introducen roles ni permisos.
- Las lecturas existentes continúan funcionando según el contrato actual.
- Los contratos y errores de autenticación están documentados y probados.
- La eliminación lógica de productos protegida por sesión conserva el registro y devuelve `uuid` e `isActive=false`.

## Dudas abiertas

- Ninguna.
