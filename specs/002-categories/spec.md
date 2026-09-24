# Spec 002 — Categorías

## Contexto y objetivo

Las categorías organizan el catálogo de productos y establecen la primera relación entre features. Cada producto debe conservar una categoría activa una vez completada la migración gradual de la relación; los productos existentes podrán clasificarse antes de exigirla obligatoriamente.

## Usuarios / actores

- Cliente de la API que administra categorías y productos.

## Historias de usuario

- H1: Como administrador del catálogo quiero crear y mantener categorías para organizar los productos.
- H2: Como administrador del catálogo quiero asignar una categoría válida a cada producto para clasificarlo.
- H3: Como administrador del catálogo quiero impedir eliminar categorías en uso para no dejar productos sin clasificación.
- H4: Como administrador del catálogo quiero impedir desactivar categorías en uso para conservar productos asociados a categorías activas.

## Requisitos funcionales (criterios de aceptación en EARS)

- RF-1: CUANDO el cliente envíe una categoría con nombre válido, EL SISTEMA creará la categoría con UUID público, `isActive` en `true` y marcas de tiempo.
- RF-2: SI el nombre está ausente o vacío después de eliminar espacios exteriores, ENTONCES EL SISTEMA rechazará la creación o actualización con error `400`.
- RF-3: SI un nombre normalizado sin distinguir mayúsculas y minúsculas ya pertenece a otra categoría, ENTONCES EL SISTEMA rechazará la creación o actualización con error `409`, incluso si la otra categoría está inactiva.
- RF-4: CUANDO el cliente omita la descripción al crear una categoría, EL SISTEMA aceptará la creación.
- RF-5: CUANDO el cliente solicite una categoría existente mediante UUID, EL SISTEMA devolverá su información, incluido `isActive`.
- RF-6: SI el UUID de categoría tiene formato inválido, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-7: SI un UUID válido no pertenece a una categoría, ENTONCES EL SISTEMA responderá con error `404`.
- RF-8: CUANDO el cliente actualice una categoría existente con valores válidos, EL SISTEMA actualizará los campos proporcionados.
- RF-9: CUANDO el cliente omita `description` al actualizar una categoría, EL SISTEMA conservará la descripción existente.
- RF-10: CUANDO el cliente envíe `description: null` al actualizar una categoría, EL SISTEMA eliminará la descripción existente.
- RF-11: CUANDO el cliente actualice una categoría sin productos asociados con `isActive: false`, EL SISTEMA la desactivará sin eliminarla y responderá exitosamente aunque ya esté inactiva.
- RF-12: CUANDO el cliente actualice una categoría con `isActive: true`, EL SISTEMA la activará y responderá exitosamente aunque ya esté activa.
- RF-13: CUANDO el cliente solicite categorías sin filtro de estado, EL SISTEMA devolverá únicamente categorías activas.
- RF-14: CUANDO el cliente solicite categorías con `isActive=true` o `isActive=false`, EL SISTEMA devolverá únicamente categorías del estado indicado.
- RF-15: CUANDO el cliente envíe `search`, EL SISTEMA eliminará sus espacios exteriores, tratará un resultado vacío como parámetro omitido y buscará coincidencias parciales sin distinguir mayúsculas y minúsculas en el nombre.
- RF-16: CUANDO el cliente omita `page` o `limit`, EL SISTEMA usará `page=1` y `limit=15`.
- RF-17: SI el cliente envía un parámetro de listado inválido, incluidos `isActive`, `sort`, `order`, `page` o `limit`, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-18: CUANDO el cliente envíe u omita `sort` u `order`, EL SISTEMA admitirá `name`, `createdAt` y `updatedAt` para `sort`, `asc` y `desc` para `order`, usará `sort=name` y `order=asc` como valores predeterminados, y desempatará por `createdAt` ascendente y UUID ascendente.
- RF-19: CUANDO el cliente solicite una colección de categorías, EL SISTEMA devolverá `data` y `pagination.total`, `pagination.page` y `pagination.limit`, donde `total` contará únicamente las categorías que coincidan con todos los filtros aplicados.
- RF-20: CUANDO el cliente elimine una categoría sin productos asociados, EL SISTEMA la eliminará permanentemente y devolverá `200` con `{ data: { uuid } }`.
- RF-21: SI el cliente intenta eliminar una categoría con productos asociados, ENTONCES EL SISTEMA rechazará la operación con error `409`.
- RF-22: CUANDO el cliente cree un producto, EL SISTEMA requerirá una categoría activa existente.
- RF-23: SI la categoría indicada al crear un producto no existe, ENTONCES EL SISTEMA rechazará la creación con error `404`.
- RF-24: SI la categoría indicada al crear un producto está inactiva, ENTONCES EL SISTEMA rechazará la creación con error `409`.
- RF-25: CUANDO el cliente actualice la categoría de un producto con una categoría activa existente, EL SISTEMA asignará la nueva categoría.
- RF-26: SI la categoría indicada al actualizar un producto no existe, ENTONCES EL SISTEMA rechazará la actualización con error `404`.
- RF-27: SI la categoría indicada al actualizar un producto está inactiva, ENTONCES EL SISTEMA rechazará la actualización con error `409`.
- RF-28: CUANDO una operación de categoría o producto se complete correctamente, EL SISTEMA devolverá el resultado principal dentro de `data`.
- RF-29: CUANDO el cliente envíe campos no definidos en contratos de creación o actualización, EL SISTEMA ignorará esos campos.
- RF-30: SI una actualización no contiene campos reconocidos después de ignorar campos no definidos, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-31: SI el cliente intenta desactivar una categoría con uno o más productos asociados, ENTONCES EL SISTEMA rechazará la operación con error `409`.
- RF-32: CUANDO el cliente actualice un producto con categoría activa sin incluir `categoryUuid`, EL SISTEMA conservará su categoría activa existente.
- RF-33: CUANDO se habiliten las categorías en una base de datos con productos existentes, EL SISTEMA permitirá temporalmente que esos productos permanezcan sin categoría para poder clasificarlos.
- RF-34: SI una actualización de producto incluye un `categoryUuid` inválido, inexistente o inactivo, ENTONCES EL SISTEMA devolverá el error `400`, `404` o `409` de categoría antes de evaluar la existencia del producto.
- RF-35: CUANDO el cliente envíe `description: null` al crear una categoría, EL SISTEMA aceptará la creación sin descripción.
- RF-36: CUANDO una categoría no tenga descripción, EL SISTEMA devolverá `description: null` en su información.
- RF-37: EL SISTEMA expondrá `POST /categories`, `GET /categories`, `GET /categories/:uuid`, `PATCH /categories/:uuid` y `DELETE /categories/:uuid`.
- RF-38: SI el cliente omite `categoryUuid` al crear un producto, ENTONCES EL SISTEMA rechazará la creación con error `400`.
- RF-39: SI el cliente envía `categoryUuid: null` al crear o actualizar un producto, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-40: CUANDO una operación exitosa de categoría devuelva información de categoría, EL SISTEMA incluirá `uuid`, `name`, `description`, `isActive`, `createdAt` y `updatedAt` dentro de `data`.
- RF-41: SI la asociación de un producto no puede completarse porque la categoría se elimina o desactiva simultáneamente, ENTONCES EL SISTEMA rechazará la asociación con error `409` y garantizará que ningún producto quede asociado a una categoría eliminada o inactiva.
- RF-42: CUANDO no existan productos sin categoría después de la clasificación temporal, EL SISTEMA habilitará la relación obligatoria mediante una migración posterior.
- RF-43: SI la migración posterior encuentra algún producto sin categoría, ENTONCES EL SISTEMA fallará la migración de forma atómica sin modificar el esquema ni los datos.
- RF-44: CUANDO una operación exitosa devuelva información de producto, EL SISTEMA incluirá `categoryUuid` dentro de `data`.
- RF-45: MIENTRAS esté activa la clasificación temporal, CUANDO el cliente actualice un producto existente sin categoría sin incluir `categoryUuid`, EL SISTEMA aceptará la actualización y conservará `categoryUuid: null`.
- RF-46: MIENTRAS un producto existente permanezca sin categoría durante la clasificación temporal, CUANDO EL SISTEMA devuelva su información, EL SISTEMA incluirá `categoryUuid: null` dentro de `data`.

## Requisitos no funcionales

- Los contratos de categorías y la extensión de productos deben documentarse y validarse de forma consistente.
- Las reglas de categorías y asignación de productos deben contar con pruebas automatizadas independientes de base de datos y HTTP.
- Las respuestas y errores `400`, `404` y `409` deben documentarse cuando apliquen.
- La relación entre productos y categorías no debe permitir que Products dependa de detalles internos de Categories.

## Casos límite

- Nombre compuesto solo por espacios.
- Nombres que difieren únicamente en mayúsculas, minúsculas o espacios exteriores.
- Categoría inactiva asignada a un producto.
- Categoría inexistente asignada a un producto.
- Intento de eliminar una categoría con uno o varios productos.
- Eliminación de una categoría inexistente.
- Categoría activa o inactiva repetidamente.
- Intento de desactivar una categoría con productos asociados.
- Productos existentes sin categoría al habilitar la relación obligatoria.
- Clasificación temporal de productos existentes antes de exigir la relación obligatoria.
- Migración posterior con productos aún sin categoría, sin cambios parciales.
- Actualización parcial de producto que omite `categoryUuid`.
- Actualización de producto existente sin categoría durante la clasificación temporal.
- Respuesta de producto existente sin categoría con `categoryUuid: null`.
- Actualización de producto con categoría inválida y producto inexistente.
- Creación de producto sin `categoryUuid`.
- Creación o actualización de producto con `categoryUuid: null`.
- Valores inválidos de `isActive`, `sort` u `order`.
- Migración con uno o más productos sin categoría, sin cambios parciales.
- Asociación de producto concurrente con eliminación o desactivación de su categoría.
- Asociación concurrente rechazada con `409` tras eliminación o desactivación de categoría.
- Búsqueda vacía después de eliminar espacios exteriores.
- Categoría creada sin descripción o con `description: null`.
- Listado vacío, filtros combinados, parámetros inválidos y empates de ordenamiento.
- Actualización que contiene únicamente campos no definidos.

## Fuera de alcance

- Categorías jerárquicas, subcategorías o múltiples categorías por producto.
- Eliminación o reasignación automática de productos al eliminar una categoría.
- Asignación automática de una categoría inicial a productos existentes.
- Autenticación, autorización y roles.
- Inventario, movimientos de stock, compras y ventas.
- Eliminación de productos.

## Criterios de finalización

- Todos los requisitos funcionales están implementados y probados.
- Los contratos de categorías y los cambios de productos están documentados.
- Las reglas de unicidad, estado, eliminación y asignación obligatoria están cubiertas por pruebas automatizadas.
- La clasificación temporal, la migración posterior bloqueada por productos sin categoría y la prioridad de validación de categoría están cubiertas por pruebas automatizadas.
- La actualización y representación pública de productos sin categoría durante la clasificación temporal están cubiertas por pruebas automatizadas.
- La migración atómica, los valores inválidos de listado, `categoryUuid` ausente o nulo, la representación pública de categorías y productos, y la integridad bajo concurrencia están cubiertos por pruebas automatizadas.
- Los errores `400`, `404` y `409` están documentados y cubiertos cuando apliquen.

## Dudas abiertas

- Ninguna.
