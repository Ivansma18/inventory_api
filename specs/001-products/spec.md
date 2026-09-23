# Spec 001 — Productos

## Contexto y objetivo

La primera capacidad de negocio del sistema es el catálogo de productos. Debe permitir registrar, consultar, listar, actualizar y desactivar productos con reglas consistentes para SKU, nombre, precios y visibilidad, formando la base para las fases posteriores de inventario, compras y ventas.

## Usuarios / actores

- Cliente de la API que administra el catálogo de productos.

## Historias de usuario

- H1: Como administrador del catálogo quiero crear un producto para registrarlo antes de operar inventario.
- H2: Como administrador del catálogo quiero consultar y actualizar productos para mantener su información vigente.
- H3: Como administrador del catálogo quiero listar y filtrar productos para localizar productos activos o desactivados.
- H4: Como administrador del catálogo quiero desactivar un producto para dejar de mostrarlo en el catálogo activo sin borrar su historial.
- H5: Como administrador del catálogo quiero reactivar un producto para volver a incluirlo en el catálogo activo.

## Requisitos funcionales (criterios de aceptación en EARS)

- RF-1: CUANDO el cliente envíe un producto con SKU, nombre y precios válidos, EL SISTEMA creará el producto con un UUID público, `isActive` en `true` y marcas de tiempo de creación y actualización.
- RF-2: SI el SKU queda ausente o vacío después de eliminar sus espacios exteriores, ENTONCES EL SISTEMA rechazará la creación o actualización del producto con un error `400`.
- RF-3: SI el nombre queda ausente o vacío después de eliminar sus espacios exteriores, ENTONCES EL SISTEMA rechazará la creación o actualización del producto con un error `400`.
- RF-4: SI el precio de compra es negativo o tiene más de dos decimales, ENTONCES EL SISTEMA rechazará la creación o actualización del producto con un error `400`.
- RF-5: SI el precio de venta es negativo o tiene más de dos decimales, ENTONCES EL SISTEMA rechazará la creación o actualización del producto con un error `400`.
- RF-6: SI un SKU normalizado sin distinguir mayúsculas y minúsculas ya pertenece a otro producto, ENTONCES EL SISTEMA no creará ni actualizará el producto e informará un conflicto `409`, incluso si el otro producto está inactivo.
- RF-7: CUANDO el cliente omita la descripción al crear o actualizar un producto, EL SISTEMA aceptará la operación.
- RF-8: CUANDO el cliente solicite el listado de productos sin filtro de estado, EL SISTEMA devolverá únicamente productos con `isActive` en `true`.
- RF-9: CUANDO el cliente solicite el listado con `isActive=true` o `isActive=false`, EL SISTEMA devolverá únicamente productos cuyo estado coincida con el filtro.
- RF-10: CUANDO el cliente solicite un producto mediante un UUID existente, EL SISTEMA devolverá su información, incluido el valor actual de `isActive`.
- RF-11: SI un UUID válido solicitado no pertenece a un producto, ENTONCES EL SISTEMA informará que el producto no fue encontrado con un error `404`.
- RF-12: CUANDO el cliente actualice un producto existente con valores válidos, EL SISTEMA actualizará el SKU, nombre, descripción o precios proporcionados y conservará la unicidad del SKU.
- RF-13: CUANDO el cliente actualice un producto con `isActive: false`, EL SISTEMA establecerá `isActive` en `false` sin eliminar el producto y responderá exitosamente aunque ya esté inactivo.
- RF-14: CUANDO el cliente solicite una colección de productos, EL SISTEMA devolverá una respuesta con `data` y `pagination.total`, `pagination.page` y `pagination.limit`, donde `total` contará únicamente los productos que coincidan con los filtros aplicados.
- RF-15: CUANDO el cliente solicite una colección con `search` e `isActive`, EL SISTEMA devolverá únicamente los productos que cumplan ambos filtros.
- RF-16: CUANDO una operación de producto se complete correctamente, EL SISTEMA devolverá el resultado principal dentro de `data` para permitir la incorporación futura de metadatos adicionales.
- RF-17: CUANDO el cliente actualice un producto con `isActive: true`, EL SISTEMA establecerá `isActive` en `true` y responderá exitosamente aunque ya esté activo.
- RF-18: SI el UUID recibido tiene un formato inválido, ENTONCES EL SISTEMA rechazará la solicitud con un error `400`.
- RF-19: CUANDO el cliente omita `description` al actualizar un producto, EL SISTEMA conservará la descripción existente.
- RF-20: CUANDO el cliente envíe `description: null` al actualizar un producto, EL SISTEMA eliminará la descripción existente.
- RF-21: CUANDO el cliente actualice un producto sin incluir `isActive`, EL SISTEMA conservará el estado existente.
- RF-22: CUANDO el cliente omita `page` o `limit` al solicitar una colección, EL SISTEMA usará `page=1` para `page` omitido y `limit=15` para `limit` omitido.
- RF-23: SI el cliente solicita una colección con `page` o `limit` que no sea un entero mayor o igual que `1`, o con `limit` superior a `100`, ENTONCES EL SISTEMA rechazará la solicitud con un error `400`.
- RF-24: CUANDO el cliente envíe `search`, EL SISTEMA eliminará sus espacios exteriores, tratará un resultado vacío como parámetro omitido y buscará coincidencias parciales sin distinguir mayúsculas y minúsculas en SKU y nombre.
- RF-25: CUANDO el cliente envíe u omita `sort` u `order`, EL SISTEMA admitirá `asc` y `desc` para `order`, usará `sort=name` y `order=asc` como valores predeterminados, y desempatará por `createdAt` ascendente y luego por UUID ascendente.
- RF-26: CUANDO el cliente envíe `sort`, EL SISTEMA admitirá únicamente `name`, `sku`, `purchasePrice`, `salePrice`, `createdAt` o `updatedAt`.
- RF-27: SI el cliente envía un parámetro de listado inválido, ENTONCES EL SISTEMA rechazará la solicitud con un error `400`.
- RF-28: SI el cliente actualiza un UUID válido que no pertenece a un producto, ENTONCES EL SISTEMA rechazará la solicitud con un error `404`.
- RF-29: CUANDO un producto no tenga descripción, EL SISTEMA devolverá `description: null` en su información.
- RF-30: CUANDO el cliente envíe campos no definidos en el contrato de creación o actualización, EL SISTEMA ignorará esos campos.
- RF-31: SI el cliente actualiza un producto sin campos reconocidos después de ignorar los campos no definidos, ENTONCES EL SISTEMA rechazará la solicitud con un error `400`.
- RF-32: CUANDO el cliente cree un producto con los campos obligatorios válidos y campos no definidos, EL SISTEMA creará el producto e ignorará los campos no definidos.

## Requisitos no funcionales

- Los contratos de las operaciones de productos deben documentarse y validarse de forma consistente.
- Las reglas de producto deben contar con pruebas automatizadas independientes de la base de datos y del transporte HTTP.
- Las operaciones que modifiquen o consulten productos deben respetar el contrato de respuesta definido en esta spec.
- Las respuestas de producto deben documentar los errores `400`, `404` y `409` cuando apliquen.

## Casos límite

- SKU o nombre formados solo por espacios.
- SKU que solo difiere por mayúsculas, minúsculas o espacios exteriores respecto de otro producto.
- Actualización de un producto conservando su propio SKU normalizado.
- Intento de asignar el SKU de otro producto, incluso si está inactivo.
- Precios iguales a cero.
- Precios con más de dos decimales.
- Consulta individual de un producto desactivado, que debe devolver `isActive: false`.
- Listado sin resultados, que debe devolver una colección vacía y datos de paginación.
- UUID inválido y UUID válido inexistente.
- Actualización de un producto sin incluir `isActive`.
- Activación o desactivación repetida mediante `isActive`.
- Campos no definidos en los contratos de creación o actualización.
- Paginación, filtros u orden con parámetros inválidos.
- Búsqueda vacía después de eliminar espacios exteriores.
- Búsqueda y estado aplicados simultáneamente.
- Productos con el mismo valor en el campo de ordenamiento.
- Actualización que solo contiene campos no definidos.

## Fuera de alcance

- Autenticación, autorización y roles de usuarios.
- Categorías, existencias, movimientos de stock, compras y ventas.
- Eliminación física de productos.
- Monedas, impuestos, descuentos o reglas que relacionen el precio de compra con el de venta.
- Cambio del campo `isActive` por un campo `status`.
- Endpoints independientes de activación o desactivación.

## Criterios de finalización

- Todos los requisitos funcionales definidos y probados.
- Los contratos de creación, consulta, listado y actualización de estado documentados.
- Las reglas de SKU, nombre, precios, estado, búsqueda, orden y paginación cubiertas por pruebas automatizadas.
- Los errores `400`, `404` y `409` documentados y cubiertos cuando apliquen.
- Los filtros acumulativos, el orden estable y la actualización sin campos reconocidos cubiertos por pruebas automatizadas.

## Dudas abiertas

- Ninguna.
