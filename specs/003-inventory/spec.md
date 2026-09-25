# Spec 003 — Inventario

## Contexto y objetivo

El inventario separa la definición del producto de su disponibilidad física. Cada producto tendrá un registro de inventario inicializado en cero para conocer existencias, definir un stock mínimo y detectar productos agotados o con nivel bajo antes de incorporar movimientos de stock en la siguiente fase.

## Usuarios / actores

- Cliente de la API que consulta existencias y configura niveles mínimos de stock.

## Historias de usuario

- H1: Como responsable de inventario quiero consultar la existencia de un producto para conocer su disponibilidad.
- H2: Como responsable de inventario quiero configurar el stock mínimo de un producto para detectar faltantes.
- H3: Como responsable de inventario quiero listar y filtrar existencias para identificar productos agotados o con stock bajo.

## Requisitos funcionales (criterios de aceptación en EARS)

- RF-1: CUANDO se habilite inventario para productos existentes, EL SISTEMA creará un registro de inventario por cada producto con cantidad y stock mínimo en cero.
- RF-2: CUANDO se cree un producto, EL SISTEMA creará su registro de inventario con cantidad y stock mínimo en cero.
- RF-3: EL SISTEMA mantendrá una única información de inventario por producto.
- RF-4: EL SISTEMA solo permitirá cantidades de inventario enteras y no negativas.
- RF-5: EL SISTEMA no permitirá que el stock mínimo sea menor que cero.
- RF-6: CUANDO la cantidad de un producto sea cero, EL SISTEMA devolverá su estado como `OUT_OF_STOCK`.
- RF-7: CUANDO la cantidad de un producto sea mayor que cero y menor o igual a su stock mínimo, EL SISTEMA devolverá su estado como `LOW_STOCK`.
- RF-8: CUANDO la cantidad de un producto sea mayor que su stock mínimo, EL SISTEMA devolverá su estado como `IN_STOCK`.
- RF-9: CUANDO el cliente solicite `GET /inventory/:productUuid` para un producto existente, EL SISTEMA devolverá la información de su inventario dentro de `data`.
- RF-10: SI `productUuid` tiene formato inválido, ENTONCES EL SISTEMA rechazará la consulta o actualización con error `400`.
- RF-11: SI `productUuid` válido no pertenece a un producto existente, ENTONCES EL SISTEMA rechazará la consulta o actualización con error `404`.
- RF-12: CUANDO el cliente solicite `GET /inventory`, EL SISTEMA devolverá el inventario de productos activos e inactivos.
- RF-13: CUANDO el cliente envíe `isActive=true` o `isActive=false` en `GET /inventory`, EL SISTEMA devolverá únicamente productos del estado indicado, y SI envía cualquier otro valor, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-14: CUANDO el cliente envíe `status=IN_STOCK`, `status=LOW_STOCK` o `status=OUT_OF_STOCK`, EL SISTEMA devolverá únicamente inventarios con ese estado calculado.
- RF-15: SI el cliente envía un valor de `status` no admitido, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-16: CUANDO el cliente envíe `search`, EL SISTEMA eliminará los espacios exteriores, tratará un resultado vacío como parámetro omitido y buscará coincidencias parciales sin distinguir mayúsculas y minúsculas en SKU y nombre.
- RF-17: CUANDO el cliente omita `page` o `limit`, EL SISTEMA usará `page=1` y `limit=15`.
- RF-18: SI el cliente envía `page` o `limit` inválidos, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-19: SI el cliente envía un `limit` mayor que 100, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-20: CUANDO el cliente envíe u omita `sort` u `order`, EL SISTEMA admitirá `name`, `sku`, `quantity`, `minimumStock` y `updatedAt` para `sort`, admitirá `asc` y `desc` para `order`, usará `sort=name` y `order=asc` como valores predeterminados, y desempatará por `sku` ascendente y `productUuid` ascendente.
- RF-21: SI el cliente envía un `sort` u `order` no admitido, ENTONCES EL SISTEMA rechazará el listado con error `400`.
- RF-22: CUANDO el cliente solicite una colección de inventarios, EL SISTEMA devolverá `data` y `pagination.total`, `pagination.page` y `pagination.limit`.
- RF-23: CUANDO el cliente combine filtros de listado, EL SISTEMA incluirá en `pagination.total` únicamente los inventarios que cumplan todos los filtros aplicados.
- RF-24: CUANDO el cliente actualice el stock mínimo de un producto con un valor válido, EL SISTEMA conservará la cantidad existente y actualizará el stock mínimo.
- RF-25: CUANDO el cliente actualice el stock mínimo de un producto con el mismo valor almacenado, EL SISTEMA responderá exitosamente.
- RF-26: SI el cliente envía un stock mínimo ausente, nulo, no numérico, no entero o negativo, ENTONCES EL SISTEMA rechazará la actualización con error `400`.
- RF-27: CUANDO una consulta o actualización de inventario se complete correctamente, EL SISTEMA devolverá el resultado principal dentro de `data`.
- RF-28: CUANDO una respuesta exitosa devuelva información de inventario, EL SISTEMA incluirá `productUuid`, `sku`, `name`, `categoryUuid`, `isActive`, `quantity`, `minimumStock`, `status` y `updatedAt` dentro de `data`.
- RF-29: CUANDO el cliente envíe campos no definidos al actualizar el stock mínimo, EL SISTEMA ignorará esos campos.
- RF-30: SI una actualización no contiene campos reconocidos después de ignorar campos no definidos, ENTONCES EL SISTEMA rechazará la solicitud con error `400`.
- RF-31: EL SISTEMA expondrá `GET /inventory`, `GET /inventory/:productUuid` y `PATCH /inventory/:productUuid/minimum-stock`.
- RF-32: EL SISTEMA no expondrá una operación que permita modificar directamente la cantidad de inventario en esta fase.
- RF-33: CUANDO un producto esté inactivo, EL SISTEMA permitirá consultar su inventario y actualizar su stock mínimo.
- RF-34: SI no puede crearse el inventario requerido para un producto nuevo, ENTONCES EL SISTEMA no dejará creado el producto sin su inventario y responderá con error `500` y código `INTERNAL_ERROR` en el formato estándar de errores de la API.

## Requisitos no funcionales

- Los contratos de inventario deben validarse y documentarse de forma consistente.
- Las reglas de estado y stock mínimo deben contar con pruebas automatizadas independientes de HTTP y base de datos.
- Las respuestas y errores `400`, `404` y `500` deben documentarse cuando apliquen.
- Las operaciones que crean un producto y su inventario deben evitar estados parciales.
- La funcionalidad de inventario no debe depender de detalles internos de Products o Categories.

## Casos límite

- Productos existentes al habilitar inventario.
- Creación de producto con inventario inicial.
- Cantidad igual a cero.
- Cantidad de inventario decimal.
- Cantidad positiva igual al stock mínimo.
- Stock mínimo igual a cero.
- Productos activos e inactivos.
- Búsqueda vacía después de eliminar espacios exteriores.
- Filtros de estado e inactividad combinados.
- Valores de `isActive` distintos de `true` o `false`.
- Empates en el campo de ordenamiento.
- Parámetros de listado inválidos.
- Stock mínimo nulo, negativo, decimal o no numérico.
- Actualización que contiene únicamente campos no definidos.
- Producto inexistente o UUID inválido.
- Fallo durante la creación conjunta de producto e inventario.

## Fuera de alcance

- Modificación directa de la cantidad de inventario.
- Entradas, salidas, ajustes o historial de movimientos de stock.
- Reservas de stock.
- Alertas, notificaciones o reabastecimiento automático.
- Inventarios por almacén, ubicación, lote o variante.
- Autenticación, autorización y roles.
- Eliminación de productos.

## Criterios de finalización

- Todos los requisitos funcionales están implementados y probados.
- Los contratos y operaciones de inventario están documentados.
- La inicialización de inventario para productos existentes y nuevos, con cantidades enteras no negativas, está cubierta por pruebas automatizadas.
- Los estados calculados, filtros, paginación, búsqueda y ordenamiento están cubiertos por pruebas automatizadas.
- La actualización de stock mínimo y sus validaciones están cubiertas por pruebas automatizadas.
- Los errores `400`, `404` y `500`, incluido `INTERNAL_ERROR`, están documentados y cubiertos cuando apliquen.
- La creación de producto e inventario no deja estados parciales ante un fallo.

## Dudas abiertas

- Ninguna.
