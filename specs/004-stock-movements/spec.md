# Spec 004 — Movimientos de Stock

## Contexto y objetivo

La cantidad de inventario deja de modificarse directamente. Todo cambio de stock debe quedar registrado como un movimiento inmutable para mantener trazabilidad, calcular el stock resultante y evitar saldos negativos.

## Usuarios / actores

- Cliente de la API que registra entradas, salidas y ajustes de stock.
- Cliente de la API que consulta movimientos de stock.

## Historias de usuario

- H1: Como responsable de inventario quiero registrar entradas para aumentar existencias.
- H2: Como responsable de inventario quiero registrar salidas para descontar existencias sin permitir stock negativo.
- H3: Como responsable de inventario quiero ajustar una existencia a un stock final conocido.
- H4: Como responsable de inventario quiero consultar el historial de movimientos para auditar cambios de stock.

## Requisitos funcionales (criterios de aceptación en EARS)

- RF-1: CUANDO el cliente registre una entrada válida, EL SISTEMA creará un movimiento de tipo `IN`.
- RF-2: CUANDO se cree un movimiento de entrada, EL SISTEMA aumentará el stock del producto en la cantidad registrada.
- RF-3: CUANDO el cliente registre una salida válida, EL SISTEMA creará un movimiento de tipo `OUT`.
- RF-4: CUANDO se cree un movimiento de salida, EL SISTEMA reducirá el stock del producto en la cantidad registrada.
- RF-5: CUANDO el cliente registre un ajuste válido, EL SISTEMA creará un movimiento de tipo `ADJUSTMENT`.
- RF-6: CUANDO se cree un movimiento de ajuste, EL SISTEMA establecerá el stock del producto en la cantidad final indicada por `quantity`.
- RF-7: EL SISTEMA solo aceptará cantidades enteras mayores que cero para entradas y salidas.
- RF-8: EL SISTEMA solo aceptará cantidades finales enteras no negativas para ajustes.
- RF-9: SI una salida supera el stock disponible confirmado, ENTONCES EL SISTEMA rechazará la operación con `409` y código `INSUFFICIENT_STOCK`.
- RF-10: SI un ajuste no incluye `reason`, contiene un valor no textual o contiene un valor vacío después de eliminar espacios exteriores, ENTONCES EL SISTEMA rechazará la operación con `400`.
- RF-11: EL SISTEMA permitirá `reference` como campo opcional en entradas, salidas y ajustes.
- RF-12: CUANDO se cree un movimiento, EL SISTEMA registrará `previousStock` y `newStock`.
- RF-13: CUANDO una operación de movimiento se complete, EL SISTEMA persistirá conjuntamente el movimiento y el stock resultante.
- RF-14: SI no se puede persistir el movimiento o el stock resultante, ENTONCES EL SISTEMA no persistirá ninguno de los dos cambios.
- RF-15: MIENTRAS existan operaciones concurrentes sobre un producto, EL SISTEMA calculará cada movimiento sobre el stock confirmado más reciente.
- RF-16: MIENTRAS existan operaciones concurrentes sobre un producto, EL SISTEMA rechazará una salida que ya no disponga de stock suficiente con `409`.
- RF-17: EL SISTEMA no permitirá editar movimientos de stock.
- RF-18: EL SISTEMA no permitirá eliminar movimientos de stock.
- RF-19: EL SISTEMA no expondrá una operación pública para modificar directamente `Inventory.quantity`.
- RF-20: CUANDO el cliente solicite `POST /inventory/:productUuid/entries`, EL SISTEMA registrará una entrada del producto indicado.
- RF-21: CUANDO el cliente solicite `POST /inventory/:productUuid/exits`, EL SISTEMA registrará una salida del producto indicado.
- RF-22: CUANDO el cliente solicite `POST /inventory/:productUuid/adjustments`, EL SISTEMA registrará un ajuste del producto indicado.
- RF-23: CUANDO el cliente solicite `GET /inventory/:productUuid/movements`, EL SISTEMA devolverá los movimientos del producto indicado dentro de `data`.
- RF-24: CUANDO el cliente solicite `GET /stock-movements`, EL SISTEMA devolverá movimientos dentro de `data`.
- RF-25: CUANDO el cliente envíe un filtro `type` en cualquiera de los listados, EL SISTEMA devolverá únicamente movimientos del tipo solicitado.
- RF-26: CUANDO el cliente envíe `from`, `to` o ambos en formato ISO 8601 con zona horaria, EL SISTEMA devolverá únicamente movimientos dentro del rango inclusivo solicitado.
- RF-27: CUANDO el cliente envíe `productUuid` en el listado global, EL SISTEMA devolverá únicamente movimientos de ese producto.
- RF-28: CUANDO el cliente envíe `reference` en cualquiera de los listados, EL SISTEMA eliminará los espacios exteriores y tratará un resultado vacío como filtro omitido.
- RF-29: CUANDO el cliente solicite un listado de movimientos, EL SISTEMA devolverá `data` y `pagination.total`, `pagination.page` y `pagination.limit`.
- RF-30: SI `productUuid` no tiene formato válido, ENTONCES EL SISTEMA rechazará la solicitud con `400`.
- RF-31: SI `productUuid` válido no pertenece a un producto existente, ENTONCES EL SISTEMA rechazará la solicitud con `404`.
- RF-32: CUANDO un movimiento se cree o consulte correctamente, EL SISTEMA devolverá `uuid`, `productUuid`, `type`, `quantity`, `previousStock`, `newStock`, `reason`, `reference` y `createdAt`.
- RF-33: EL SISTEMA no registrará `createdBy` hasta que exista autenticación.
- RF-34: CUANDO el cliente omita `page` o `limit` en un listado de movimientos, EL SISTEMA usará `page=1` y `limit=15`.
- RF-35: CUANDO el cliente solicite un listado de movimientos, EL SISTEMA ordenará los resultados por `createdAt` descendente y `uuid` ascendente como desempate.
- RF-36: SI el cliente envía valores inválidos para UUID, tipo, fechas, referencia, paginación o un rango donde `from` sea posterior a `to`, ENTONCES EL SISTEMA rechazará la solicitud con `400` en el formato estándar de errores.
- RF-37: CUANDO el cliente omita `reason` en una entrada o salida, EL SISTEMA devolverá `reason` como `null`.
- RF-38: CUANDO un producto esté inactivo, EL SISTEMA permitirá registrar entradas, salidas y ajustes de stock.
- RF-39: SI el cliente envía un `limit` mayor que `100`, ENTONCES EL SISTEMA rechazará el listado con `400`.
- RF-40: MIENTRAS un movimiento sea de tipo `ADJUSTMENT`, EL SISTEMA interpretará `quantity` como el stock final solicitado.
- RF-41: CUANDO el cliente solicite un listado de movimientos, EL SISTEMA incluirá en `pagination.total` únicamente los movimientos que cumplan todos los filtros aplicados antes de paginar.
- RF-42: SI ocurre un fallo técnico al actualizar el inventario o crear el movimiento, ENTONCES EL SISTEMA responderá con `500` y código `INTERNAL_ERROR` en el formato estándar de errores.
- RF-43: SI un producto existente no tiene registro de inventario, ENTONCES EL SISTEMA responderá con `500` y código `INTERNAL_ERROR` en el formato estándar de errores.
- RF-44: CUANDO un movimiento no tenga referencia, EL SISTEMA devolverá `reference` como `null`.
- RF-45: CUANDO el cliente envíe un filtro `reference` no vacío en cualquiera de los listados, EL SISTEMA devolverá únicamente movimientos con referencia no nula que contenga el valor solicitado sin distinguir mayúsculas y minúsculas.
- RF-46: CUANDO el cliente registre una entrada, salida o ajuste válido, EL SISTEMA responderá `201` con el movimiento creado dentro de `data`.
- RF-47: CUANDO el cliente envíe campos no reconocidos al registrar una entrada, salida o ajuste, EL SISTEMA ignorará esos campos.
- RF-48: CUANDO el cliente repita una solicitud válida de entrada, salida o ajuste, EL SISTEMA creará un nuevo movimiento.
- RF-49: SI el cliente envía una cantidad ausente, nula, no numérica, decimal, cero o negativa para una entrada o salida, ENTONCES EL SISTEMA rechazará la operación con `400` en el formato estándar de errores.
- RF-50: SI el cliente envía una cantidad ausente, nula, no numérica, decimal o negativa para un ajuste, ENTONCES EL SISTEMA rechazará la operación con `400` en el formato estándar de errores.
- RF-51: CUANDO el cliente envíe una referencia nula o vacía después de eliminar espacios exteriores, EL SISTEMA la normalizará a `null`.
- RF-52: CUANDO el cliente envíe un motivo válido para un ajuste, EL SISTEMA eliminará sus espacios exteriores antes de persistirlo y devolverlo.
- RF-53: CUANDO el cliente registre una entrada o salida, EL SISTEMA reconocerá únicamente `quantity` y `reference` como campos de creación.
- RF-54: CUANDO el cliente registre un ajuste, EL SISTEMA reconocerá únicamente `quantity`, `reason` y `reference` como campos de creación.
- RF-55: CUANDO el cliente envíe `reason` al registrar una entrada o salida, EL SISTEMA lo ignorará como campo no reconocido.
- RF-56: SI el cliente envía `reference` con un valor distinto de texto o `null`, ENTONCES EL SISTEMA rechazará la operación con `400` en el formato estándar de errores.

## Requisitos no funcionales

- Los contratos de movimientos deben validarse y documentarse mediante OpenAPI/Swagger.
- Las reglas de entradas, salidas, ajustes e insuficiencia de stock deben contar con pruebas independientes de HTTP y PostgreSQL.
- La persistencia conjunta de stock y movimiento debe contar con pruebas de rollback y concurrencia entre ajustes y entradas o salidas.
- Los errores `400`, `404`, `409` y `500` aplicables deben documentarse y probarse.

## Casos límite

- Entrada de cantidad cero, negativa, decimal o no numérica.
- Salida de cantidad cero, negativa, decimal o no numérica.
- Salida exactamente igual al stock disponible.
- Salida superior al stock disponible.
- Ajuste a cero.
- Ajuste negativo, decimal o no numérico.
- Ajuste sin motivo.
- Ajuste con motivo vacío después de eliminar espacios exteriores.
- Ajuste con motivo no textual.
- Ajuste con motivo válido que contiene espacios exteriores.
- Referencia ausente.
- Referencia nula.
- Referencia vacía después de eliminar espacios exteriores.
- Referencia no textual.
- Movimiento con referencia nula al filtrar por referencia.
- Producto inexistente o UUID inválido.
- Producto existente sin registro de inventario.
- Producto inactivo.
- Filtro de tipo, fecha, referencia, producto o paginación inválido.
- Rango de fechas con `from` posterior a `to`.
- Rango de fechas con límites inclusivos.
- Rango de fechas con solo `from` o solo `to`.
- Dos salidas concurrentes que compiten por el mismo stock.
- Ajuste concurrente con una entrada sobre el mismo producto.
- Ajuste concurrente con una salida sobre el mismo producto.
- Fallo al registrar el movimiento después de modificar el stock.
- Fallo al modificar el stock antes de registrar el movimiento.
- Listados sin resultados.
- Filtros combinados con paginación.
- Campos no reconocidos al registrar un movimiento.
- Solicitud de movimiento repetida.

## Fuera de alcance

- Edición o eliminación de movimientos.
- Modificación directa de la cantidad de inventario.
- Atribución del movimiento a un usuario.
- Autenticación, autorización y roles.
- Movimientos originados automáticamente por compras, ventas, devoluciones o cancelaciones.
- Inventarios por almacén, ubicación, lote o variante.
- Alertas automáticas de stock bajo.
- Idempotencia mediante claves de operación externas; las solicitudes válidas repetidas crean movimientos independientes.

## Criterios de finalización

- Todos los RF están implementados y probados.
- Las operaciones de entrada, salida y ajuste actualizan el inventario y crean su movimiento de forma conjunta.
- No es posible persistir un stock negativo.
- Las operaciones concurrentes no permiten salidas que excedan el stock confirmado.
- Las cinco rutas están disponibles y documentadas.
- No existe una ruta pública para modificar directamente la cantidad de inventario.
- Los listados validan filtros, paginación y orden predeterminado.
- `pagination.total` cuenta únicamente los movimientos filtrados antes de paginar.
- Los rangos de fechas abiertos e inclusivos se filtran correctamente.
- Las referencias vacías se omiten y las referencias nulas se excluyen de filtros no vacíos.
- Los ajustes registran `quantity` como el stock final solicitado.
- Los movimientos sobre productos inactivos se completan correctamente.
- Los fallos técnicos y los datos de inventario inconsistentes responden con `INTERNAL_ERROR`.
- Las operaciones de creación responden `201` con el movimiento dentro de `data`.
- Las respuestas de movimiento incluyen su `uuid` público.
- Los motivos vacíos se rechazan y los campos no reconocidos se ignoran.
- Las cantidades inválidas se rechazan con `400` en los tres tipos de movimiento.
- Las referencias nulas o vacías se normalizan a `null` y los motivos válidos se persisten recortados.
- Los endpoints reconocen exclusivamente los campos de creación definidos para cada tipo de movimiento.
- Los motivos enviados en entradas y salidas se ignoran como campos no reconocidos.
- Los motivos y referencias con tipos no válidos se rechazan con `400`, salvo `reference: null`.
- Las solicitudes válidas repetidas crean movimientos independientes.
- Las pruebas de concurrencia cubren ajustes simultáneos con entradas y salidas.

## Dudas abiertas

- Ninguna.
