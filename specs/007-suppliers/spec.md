# Spec 007 — Suppliers

## Contexto y objetivo

La API necesita administrar proveedores como base para incorporar compras en una fase posterior. Esta fase permite crear, consultar, listar, actualizar y desactivar proveedores, conservando su información y manteniendo disponibles las lecturas públicas del catálogo.

## Usuarios / actores

- Cliente no autenticado que consulta proveedores.
- Usuario autenticado con rol `ADMIN`.
- Usuario autenticado con rol `MANAGER`.
- Usuario autenticado con rol `OPERATOR`.
- Usuario autenticado con rol `VIEWER`.

## Historias de usuario

- H1: Como administrador o manager quiero registrar proveedores para identificar el origen de futuras compras.
- H2: Como administrador o manager quiero actualizar y reactivar proveedores para mantener vigente su información.
- H3: Como administrador o manager quiero desactivar proveedores sin borrar su información histórica.
- H4: Como cliente de la API quiero consultar, filtrar y localizar proveedores para obtener su información vigente.
- H5: Como usuario sin permisos de escritura quiero consultar proveedores sin modificar sus datos.

## Requisitos funcionales (criterios de aceptación en EARS)

- RF-1: CUANDO un cliente autorizado cree un proveedor con un nombre válido, EL SISTEMA ignorará cualquier valor enviado para `isActive`, lo creará con un UUID público, `isActive` en `true`, marcas de tiempo de creación y actualización, y responderá `201` con `{ data: { uuid, name, contactName, email, phone, notes, isActive, createdAt, updatedAt } }`.
- RF-2: SI el nombre está ausente durante la creación o si el nombre enviado queda vacío después de eliminar espacios exteriores, ENTONCES EL SISTEMA rechazará la creación o actualización con error `400`.
- RF-3: SI el nombre normalizado quitando espacios exteriores y convirtiéndolo a minúsculas ya pertenece a otro proveedor, ENTONCES EL SISTEMA rechazará la creación o actualización con error `409`, incluso si el otro proveedor está inactivo.
- RF-4: CUANDO un proveedor incluya un email de contacto válido, EL SISTEMA aceptará el valor como dato de contacto.
- RF-5: SI la solicitud incluye `email` con un valor distinto de `null` que no tiene un formato válido, ENTONCES EL SISTEMA rechazará la creación o actualización con error `400`.
- RF-6: CUANDO el cliente omita `contactName`, `email`, `phone` o `notes` al crear un proveedor, EL SISTEMA aceptará la creación y devolverá esos campos como `null`.
- RF-7: CUANDO el cliente envíe `null` para `contactName`, `email`, `phone` o `notes` al crear un proveedor, EL SISTEMA aceptará la creación y devolverá el campo como `null`.
- RF-8: CUANDO el cliente solicite un proveedor por un UUID existente, EL SISTEMA responderá `200` con sus campos `uuid`, `name`, `contactName`, `email`, `phone`, `notes`, `isActive`, `createdAt` y `updatedAt` dentro de `data`.
- RF-9: CUANDO el cliente consulte un proveedor inactivo por UUID, EL SISTEMA devolverá su información con `isActive: false`.
- RF-10: SI el UUID recibido para consultar, actualizar o desactivar un proveedor tiene formato inválido, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-11: SI un UUID válido no pertenece a un proveedor al consultar, actualizar o desactivar, ENTONCES EL SISTEMA responderá con error `404`.
- RF-12: CUANDO el cliente autorizado actualice un proveedor con valores válidos, EL SISTEMA actualizará únicamente los campos reconocidos que haya enviado y responderá `200` con `{ data: { uuid, name, contactName, email, phone, notes, isActive, createdAt, updatedAt } }`.
- RF-13: CUANDO el cliente omita un campo al actualizar un proveedor, EL SISTEMA conservará el valor existente de ese campo.
- RF-14: CUANDO el cliente envíe `null` para `contactName`, `email`, `phone` o `notes` al actualizar un proveedor, EL SISTEMA eliminará el valor existente de ese campo.
- RF-15: SI el cliente envía `name: null` al crear o actualizar un proveedor, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-16: CUANDO el cliente autorizado actualice un proveedor con `isActive: false`, EL SISTEMA lo desactivará sin eliminarlo y responderá exitosamente aunque ya esté inactivo.
- RF-17: CUANDO el cliente autorizado actualice un proveedor con `isActive: true`, EL SISTEMA lo activará y responderá exitosamente aunque ya esté activo.
- RF-18: CUANDO un cliente autorizado envíe `DELETE /suppliers/:uuid` para un proveedor existente, EL SISTEMA establecerá `isActive` en `false`, conservará el registro y responderá `200` con `{ data: { uuid, isActive: false } }`.
- RF-19: CUANDO un cliente autorizado envíe `DELETE /suppliers/:uuid` para un proveedor ya inactivo, EL SISTEMA conservará `isActive: false` y responderá `200` con `{ data: { uuid, isActive: false } }`.
- RF-20: CUANDO el cliente solicite el listado sin filtro de estado, EL SISTEMA devolverá únicamente proveedores con `isActive` en `true`.
- RF-21: CUANDO el cliente solicite el listado con `isActive=true` o `isActive=false`, EL SISTEMA devolverá únicamente proveedores cuyo estado coincida con el filtro.
- RF-22: CUANDO el cliente envíe `search`, EL SISTEMA eliminará sus espacios exteriores, tratará un resultado vacío como parámetro omitido y buscará coincidencias parciales sin distinguir mayúsculas y minúsculas en `name`, `contactName`, `email` y `phone`.
- RF-23: CUANDO el cliente omita `page` o `limit` al solicitar el listado, EL SISTEMA usará `page=1` y `limit=15`.
- RF-24: SI el cliente envía `page` o `limit` que no sea un entero mayor o igual que `1`, o envía un `limit` superior a `100`, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-25: CUANDO el cliente omita `sort` u `order`, EL SISTEMA usará `sort=name` y `order=asc` como valores predeterminados.
- RF-26: SI el cliente envía un valor de `sort` distinto de `name`, `createdAt` o `updatedAt`, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-27: SI el cliente envía un valor de `order` distinto de `asc` o `desc`, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-28: CUANDO dos proveedores tengan el mismo valor en el campo de ordenamiento, EL SISTEMA ordenará el resultado por `createdAt` ascendente y después por UUID ascendente.
- RF-29: CUANDO el cliente solicite una colección de proveedores, EL SISTEMA responderá `200` con `{ data: [{ uuid, name, contactName, email, phone, notes, isActive, createdAt, updatedAt }], pagination: { total, page, limit } }`, donde `total` contará únicamente los proveedores que coincidan con todos los filtros aplicados.
- RF-30: CUANDO una operación de proveedor se complete correctamente, EL SISTEMA devolverá el resultado principal dentro de `data`.
- RF-31: CUANDO el cliente envíe campos no definidos en los contratos de creación o actualización, EL SISTEMA ignorará esos campos.
- RF-32: SI una actualización no contiene campos reconocidos después de ignorar campos no definidos, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-33: CUANDO un cliente no autenticado solicite una operación de lectura de proveedores, EL SISTEMA permitirá consultar el listado o un proveedor individual.
- RF-34: SI una solicitud sin sesión válida intenta crear, actualizar o desactivar un proveedor, ENTONCES EL SISTEMA responderá con `401`.
- RF-35: MIENTRAS el usuario autenticado tenga rol `ADMIN` o `MANAGER`, EL SISTEMA le permitirá crear, actualizar, reactivar y desactivar proveedores.
- RF-36: SI un usuario autenticado con rol `OPERATOR` o `VIEWER` intenta crear, actualizar o desactivar un proveedor, ENTONCES EL SISTEMA responderá con `403`.
- RF-37: EL SISTEMA expondrá `POST /suppliers`, `GET /suppliers`, `GET /suppliers/:uuid`, `PATCH /suppliers/:uuid` y `DELETE /suppliers/:uuid`.
- RF-38: CUANDO un proveedor use un email de contacto ya asignado a otro proveedor, EL SISTEMA aceptará el valor si el nombre normalizado sigue siendo único.
- RF-39: SI el cliente envía `isActive` en el listado con un valor distinto de `true` o `false`, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-40: CUANDO el cliente cree o actualice un proveedor con un nombre válido, EL SISTEMA eliminará los espacios exteriores antes de guardarlo y conservará las mayúsculas y minúsculas del nombre recibido.
- RF-41: CUANDO el cliente envíe una cadena vacía o compuesta por espacios en `contactName`, `phone` o `notes`, EL SISTEMA aceptará y conservará exactamente el valor enviado.
- RF-42: SI el cliente envía `isActive: null` o un valor que no sea booleano al actualizar un proveedor, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-43: CUANDO solicitudes concurrentes intenten crear o renombrar proveedores distintos con el mismo nombre normalizado, EL SISTEMA permitirá completar como máximo una operación y rechazará las demás con error `409`.
- RF-44: SI una actualización con varios campos contiene uno o más valores inválidos o en conflicto, ENTONCES EL SISTEMA rechazará toda la actualización con el error aplicable y conservará sin cambios todos los campos del proveedor.
- RF-45: EL SISTEMA reconocerá únicamente `name`, `contactName`, `email`, `phone` y `notes` como campos de entrada para crear un proveedor.
- RF-46: EL SISTEMA reconocerá únicamente `name`, `contactName`, `email`, `phone`, `notes` e `isActive` como campos de entrada para actualizar un proveedor.

## Requisitos no funcionales

- Los contratos de proveedores y sus errores estarán documentados mediante OpenAPI.
- Las respuestas de error `400`, `401`, `403`, `404` y `409` usarán el formato estándar del proyecto cuando apliquen.
- Las respuestas públicas no expondrán datos distintos de los campos de proveedor definidos en esta spec.
- Las reglas de nombre único y transición de estado podrán verificarse independientemente del transporte HTTP.
- La unicidad del nombre se conservará ante solicitudes concurrentes de creación o actualización.
- Las actualizaciones con varios campos se aplicarán de forma íntegra o no se aplicarán cuando algún campo falle la validación.
- Las lecturas de proveedores permanecerán públicas y las escrituras respetarán los roles definidos en RF-35 y RF-36.

## Casos límite

- Nombre ausente o compuesto solo por espacios.
- Nombres que difieren únicamente en mayúsculas, minúsculas o espacios exteriores.
- Nombre aceptado con espacios exteriores, que debe guardarse recortado y conservando sus mayúsculas y minúsculas.
- Intento de crear o renombrar un proveedor con el nombre normalizado de un proveedor inactivo.
- Email ausente, nulo, válido o con formato inválido.
- Campos `uuid`, `createdAt` y `updatedAt` enviados en solicitudes de creación o actualización.
- Email omitido en PATCH, que debe conservar el valor existente.
- Email inválido enviado junto con `null` en otro campo opcional.
- Campos de contacto opcionales omitidos o nulos al crear.
- Cadenas vacías o compuestas por espacios en `contactName`, `phone` y `notes`.
- Actualización que omite campos opcionales o los envía como `null`.
- Creación con `isActive` enviado, que debe crear el proveedor activo.
- Actualización con `isActive: null` o con un valor no booleano.
- Solicitudes concurrentes que intentan asignar el mismo nombre normalizado a proveedores distintos, sin crear duplicados.
- Actualización con varios campos en la que uno es inválido, sin cambios parciales.
- Actualización que contiene únicamente campos no definidos.
- Creación o actualización con `name: null`.
- UUID inválido y UUID válido inexistente.
- Consulta individual de un proveedor inactivo.
- Desactivación repetida de un proveedor mediante `DELETE`.
- Reactivación de un proveedor mediante `PATCH` con `isActive: true`.
- Listado sin resultados y respuesta con colección vacía y paginación.
- Listado sin filtro de estado y listados con `isActive=true` o `isActive=false`.
- Búsqueda vacía después de eliminar espacios exteriores.
- Búsqueda parcial por nombre o por cualquiera de los campos de contacto.
- Búsqueda y filtro de estado aplicados simultáneamente.
- Parámetros inválidos de estado, ordenamiento o paginación.
- Valores repetidos para el campo de ordenamiento.
- Solicitud no autenticada de una lectura pública.
- Solicitud no autenticada de una escritura, que debe responder `401`.
- Solicitud de escritura autenticada con roles `OPERATOR` o `VIEWER`, que debe responder `403`.
- Gestión de proveedores autenticada con roles `ADMIN` y `MANAGER`.

## Fuera de alcance

- Compras, recepción de compras y generación de movimientos de stock.
- Relación entre proveedores y productos o compras.
- Múltiples contactos por proveedor.
- Términos de pago, cuentas por pagar, impuestos o condiciones comerciales.
- Eliminación física de proveedores.
- Roles o permisos distintos de los definidos en esta spec.
- Invitaciones, usuarios proveedores o acceso de proveedores a la API.

## Criterios de finalización

- Todos los requisitos funcionales están implementados y cubiertos por pruebas.
- Los contratos de creación, consulta individual, listado, actualización y desactivación están documentados.
- La unicidad del nombre normalizado se conserva incluso para proveedores inactivos.
- La unicidad del nombre normalizado se conserva ante solicitudes concurrentes y los nombres guardados no contienen espacios exteriores.
- La creación ignora `isActive` enviado por el cliente y crea el proveedor activo.
- Los campos `contactName`, `phone` y `notes` conservan las cadenas vacías o compuestas por espacios que reciba el sistema.
- Una actualización con `isActive` no booleano se rechaza y una actualización inválida de varios campos no aplica cambios parciales.
- La búsqueda, filtros, ordenamiento y paginación cumplen los valores predeterminados y límites definidos.
- La desactivación conserva el registro y la reactivación vuelve a incluirlo en el listado predeterminado.
- Los clientes no autenticados pueden consultar proveedores, mientras que las escrituras requieren los roles definidos.
- Las respuestas de éxito y los errores aplicables están documentados y probados.
- Las pruebas cubren campos opcionales, UUID inválidos o inexistentes, nombres duplicados, estados y parámetros de listado inválidos.
- Los contratos de entrada ignoran `uuid`, `createdAt` y `updatedAt` enviados por el cliente.
- Las pruebas verifican que el email omitido al crear queda sin valor, el omitido al actualizar se conserva y un email no nulo inválido se rechaza.

## Dudas abiertas

- Ninguna.
