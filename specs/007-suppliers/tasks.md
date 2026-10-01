# Tareas - Spec 007 Suppliers

Plan aprobado: `plan.md`. Cada tarea está dimensionada para aproximadamente 30 minutos y se ejecuta respetando sus dependencias. Las pruebas se escriben antes o dentro de la tarea que introduce el comportamiento; todas las tareas permanecen pendientes hasta su implementación y verificación.

- [ ] T1. Definir la entidad Supplier, el error de nombre inválido y la creación pura con pruebas de dominio. (RF-1, RF-2, RF-6, RF-7, RF-40, RF-41)
      Hecho cuando: `tests/suppliers/domain/` verifica nombre recortado con capitalización conservada, clave normalizada, estado activo, fechas recibidas y contactos omitidos/nulos/vacíos, sin frameworks ni base de datos.

- [ ] T2. Definir la preparación pura de cambios parciales de Supplier y probar las transiciones de estado. (RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-40, RF-41, RF-44)
      Hecho cuando: pruebas de dominio verifican campos omitidos intactos, null que limpia opcionales, nombres inválidos rechazados, valores vacíos conservados y activación/desactivación repetidas; no se muta la entidad original y el patch contiene solo campos enviados más las fechas y claves derivadas necesarias.

- [ ] T3. Definir los contratos de repositorio y tipos de listado, los errores de inexistencia/duplicado y el caso de uso de consulta por UUID con un fake. (RF-8, RF-9, RF-11, RF-26, RF-27, RF-28)
      Hecho cuando: los contratos incluyen creación, búsqueda por UUID/nombre normalizado, listado y actualización parcial; pruebas de aplicación confirman consulta de activos/inactivos y error de inexistencia sin Prisma ni HTTP.

- [ ] T4. Implementar el caso de uso de creación con UUID/reloj inyectables y comprobación de nombre duplicado. (RF-1, RF-2, RF-3, RF-6, RF-7, RF-38, RF-40, RF-41)
      Hecho cuando: pruebas con fake confirman identidad/fechas del sistema, nombre único incluso frente a inactivos, contactos opcionales y emails repetidos entre nombres distintos; un conflicto no llama a la escritura.

- [ ] T5. Implementar el caso de uso de actualización parcial con comprobación de nombre duplicado. (RF-3, RF-11, RF-12, RF-13, RF-14, RF-16, RF-17, RF-38, RF-40, RF-41, RF-44)
      Hecho cuando: pruebas con fake confirman cambios válidos, conservación del propio nombre, conflicto con otro proveedor y envío exclusivo de campos recibidos al repositorio; una validación o conflicto previo impide cualquier escritura.

- [ ] T6. Implementar el caso de uso de desactivación mediante el contrato de actualización. (RF-11, RF-18, RF-19)
      Hecho cuando: pruebas de aplicación verifican estado falso sin borrar filas, resultado `{ uuid, isActive: false }`, repetición exitosa y error para UUID inexistente.

- [ ] T7. Implementar el caso de uso de listado con defaults y búsqueda recortada. (RF-20, RF-21, RF-22, RF-23, RF-25, RF-28, RF-29)
      Hecho cuando: el fake recibe defaults solo para valores omitidos, búsqueda vacía como ausente, filtros/orden explícitos y desempates acordados; las pruebas verifican la propagación del total y resultados.

- [ ] T8. Añadir el modelo Supplier y su migración, con pruebas de esquema PostgreSQL. (RF-1, RF-3, RF-6, RF-7, RF-38, RF-43)
      Hecho cuando: Prisma genera el cliente y la migración crea UUID/nombre normalizado únicos, contactos nullable, estado activo y fechas; pruebas verifican defaults, duplicados de nombre rechazados y email no único sin alterar los modelos existentes.

- [ ] T9. Implementar creación y consultas del repositorio Prisma con mapeo explícito de dominio. (RF-1, RF-3, RF-6, RF-7, RF-8, RF-9, RF-38, RF-40, RF-41)
      Hecho cuando: pruebas PostgreSQL verifican round trips, consultas por UUID/nombre normalizado, inexistencia, contactos exactos y traducción del conflicto persistido de nombre al error de dominio; no se expone el id interno.

- [ ] T10. Implementar la actualización parcial del repositorio en una única escritura. (RF-3, RF-11, RF-12, RF-13, RF-14, RF-16, RF-17, RF-18, RF-19, RF-40, RF-41, RF-44)
      Hecho cuando: pruebas PostgreSQL verifican campos omitidos intactos, opcionales nulos, estados y fila conservada tras desactivación; un conflicto de nombre deja todos los campos y updatedAt intactos, y un `P2025` produce el error de inexistencia.

- [ ] T11. Implementar el listado Prisma con búsqueda, filtros, paginación y conteo consistente. (RF-20, RF-21, RF-22, RF-23, RF-25, RF-26, RF-27, RF-28, RF-29)
      Hecho cuando: pruebas PostgreSQL cubren coincidencias parciales en los cuatro campos, combinación con estado, ambos órdenes, tres campos de orden, desempates, páginas vacías y total filtrado; filas y conteo comparten filtro y transacción `RepeatableRead`.

- [ ] T12. Probar las colisiones concurrentes de nombre en persistencia y ajustar su traducción si es necesario. (RF-3, RF-43, RF-44)
      Hecho cuando: pruebas simultáneas de creación, dos renombres y creación contra renombre verifican una operación exitosa, las demás rechazadas por nombre duplicado y un único proveedor con la clave objetivo; los cambios del perdedor no se persisten.

- [ ] T13. Definir schemas de creación y PATCH con pruebas de validación. (RF-1, RF-2, RF-4, RF-5, RF-6, RF-7, RF-13, RF-14, RF-15, RF-31, RF-32, RF-41, RF-42, RF-45, RF-46)
      Hecho cuando: pruebas verifican los campos exactos de POST/PATCH, email presente/no nulo válido, omisión/null permitidos, cadenas vacías conservadas, estado JSON booleano y eliminación de campos ajenos antes de rechazar un PATCH vacío; POST ignora isActive.

- [ ] T14. Definir schemas de UUID, query, respuestas y errores. (RF-8, RF-10, RF-18, RF-19, RF-24, RF-26, RF-27, RF-29, RF-30, RF-39)
      Hecho cuando: pruebas de schemas validan UUID, enteros positivos, limit máximo 100, sort/order y estado textual; las respuestas contienen nueve campos públicos con opcionales nullable, paginación y envelope reducido de desactivación.

- [ ] T15. Implementar mappers HTTP de detalle, listado y desactivación. (RF-1, RF-6, RF-7, RF-8, RF-9, RF-12, RF-18, RF-19, RF-29, RF-30)
      Hecho cuando: pruebas verifican fechas ISO, campos públicos exactos, opcionales null, envelopes y metadatos; id y nameNormalized no aparecen en respuestas.

- [ ] T16. Ampliar la política central con los tres permisos de Suppliers. (RF-34, RF-35, RF-36)
      Hecho cuando: pruebas unitarias confirman permisos de creación/actualización/desactivación para ADMIN y MANAGER, denegación para OPERATOR y VIEWER y conservación de la matriz de permisos anterior.

- [ ] T17. Crear la fábrica de rutas y las dos lecturas públicas, con schemas y documentación OpenAPI. (RF-8, RF-9, RF-10, RF-11, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-33, RF-37, RF-39)
      Hecho cuando: pruebas HTTP con un servicio doble verifican `200` en listado/detalle, envelopes, defaults, query inválida con `400`, inexistencia con `404` y consultas sin sesión; las rutas no importan infraestructura.

- [ ] T18. Añadir POST con guardas de autenticación/autorización, validación y OpenAPI. (RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-15, RF-30, RF-31, RF-34, RF-35, RF-36, RF-37, RF-38, RF-40, RF-41, RF-45)
      Hecho cuando: pruebas de ruta verifican `201`, datos limpios entregados al servicio y traducción de errores `400/409`; las guardas van antes de validación/ejecución, producen `401/403` cuando corresponde y OpenAPI documenta seguridad y respuestas.

- [ ] T19. Añadir PATCH con guardas, validación, traducción de errores y OpenAPI. (RF-3, RF-4, RF-5, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-30, RF-31, RF-32, RF-34, RF-35, RF-36, RF-37, RF-38, RF-40, RF-41, RF-42, RF-44, RF-46)
      Hecho cuando: pruebas de ruta verifican `200`, patch limpio y errores `400/401/403/404/409`; valores inválidos y PATCH vacío no ejecutan el servicio, y el contrato OpenAPI refleja cambios de estado y campos nullable.

- [ ] T20. Añadir DELETE de desactivación con guardas y OpenAPI. (RF-10, RF-11, RF-18, RF-19, RF-30, RF-34, RF-35, RF-36, RF-37)
      Hecho cuando: pruebas de ruta verifican `200 { data: { uuid, isActive: false } }` incluso al repetir, errores `400/401/403/404` y delegación al caso de uso de desactivación sin borrado físico.

- [ ] T21. Exponer la API pública de Suppliers y componerla en app con persistencia y sesiones reales. (RF-1, RF-8, RF-9, RF-12, RF-16, RF-17, RF-18, RF-19, RF-20, RF-30, RF-33, RF-37)
      Hecho cuando: un flujo HTTP/PostgreSQL registra, consulta, actualiza, desactiva y reactiva un proveedor; la fila persiste y el listado predeterminado respeta su estado; las cinco operaciones quedan montadas en `/suppliers` y `index.ts` del servidor no cambia.

- [ ] T22. Verificar la matriz de acceso en los endpoints montados con sesiones reales. (RF-33, RF-34, RF-35, RF-36)
      Hecho cuando: pruebas HTTP/PostgreSQL cubren escrituras de ADMIN/MANAGER, `403` para OPERATOR/VIEWER, `401` sin sesión válida y lecturas públicas; los rechazos no alteran datos y las rutas existentes conservan sus permisos.

- [ ] T23. Verificar conflictos concurrentes mediante los endpoints montados. (RF-3, RF-43)
      Hecho cuando: solicitudes simultáneas POST/POST, PATCH/PATCH y POST/PATCH para proveedores distintos y el mismo nombre libre normalizado producen una confirmación y conflictos `409`, conservando un único nombre objetivo en PostgreSQL.

- [ ] T24. Verificar atomicidad del PATCH y contratos de campos en la aplicación real. (RF-1, RF-5, RF-13, RF-14, RF-31, RF-32, RF-41, RF-42, RF-44, RF-45, RF-46)
      Hecho cuando: PATCH con contacto/estado válidos y email inválido o nombre duplicado devuelve `400/409` sin modificar ningún campo ni updatedAt; pruebas también confirman campos del sistema ignorados, email omitido conservado, null que limpia y cadenas vacías preservadas.

- [ ] T25. Añadir pruebas de contrato OpenAPI y regresión de seguridad de Suppliers. (RF-1, RF-8, RF-10, RF-11, RF-12, RF-18, RF-19, RF-24, RF-29, RF-30, RF-33, RF-34, RF-35, RF-36, RF-37, RF-39, RF-42, RF-45, RF-46)
      Hecho cuando: `openapi.json` incluye las cinco operaciones con schemas y respuestas aplicables, `sessionCookie` solo en escrituras, campos de entrada exactos y salida nullable; las lecturas existentes y los contratos de autenticación siguen públicos según las specs anteriores.

- [ ] T26. Ejecutar los checks de cierre y validar la Spec 007 RF por RF con evidencia. (RF-1 a RF-46)
      Hecho cuando: pasan `npm test`, `npm run typecheck`, `npm run lint`, `npm run format` y `git diff --check`; Prisma tiene la migración aplicada y el cliente generado, y la revisión confirma cada RF, OpenAPI, errores y fronteras de dependencia, sin pendientes ocultos.

## Orden y dependencias

El orden numérico es una secuencia válida de ejecución. Las dependencias de la tabla son prerrequisitos explícitos; T26 comprueba la fase integrada y no sustituye las verificaciones de cada tarea.

| Tarea | Depende de                       | Motivo                    |
| ----- | -------------------------------- | ------------------------- |
| T1    | Ninguna                          | Dominio de creacion.      |
| T2    | T1                               | Patch sobre entidad.      |
| T3    | T1                               | Contratos de dominio.     |
| T4    | T1, T3                           | Creacion con repositorio. |
| T5    | T2, T3, T4                       | Cambios y unicidad.       |
| T6    | T3, T5                           | Cambio de estado.         |
| T7    | T3                               | Consulta resuelta.        |
| T8    | T1, T3                           | Modelo persistido.        |
| T9    | T8, T3, T4                       | Creacion y consultas.     |
| T10   | T9, T2, T5, T6                   | Patch persistido.         |
| T11   | T9, T7                           | Listado persistido.       |
| T12   | T9, T10                          | Carrera de escritura.     |
| T13   | T1, T2                           | Entradas HTTP.            |
| T14   | T3, T13                          | Query y respuestas.       |
| T15   | T14                              | Serializacion.            |
| T16   | Ninguna                          | Politica existente.       |
| T17   | T3, T7, T14, T15                 | Lecturas HTTP.            |
| T18   | T4, T13, T15, T16, T17           | Creacion HTTP.            |
| T19   | T5, T13, T14, T16, T18           | Actualizacion HTTP.       |
| T20   | T6, T14, T16, T19                | Desactivacion HTTP.       |
| T21   | T9, T10, T11, T17, T18, T19, T20 | Composicion real.         |
| T22   | T16, T21                         | Sesiones y permisos.      |
| T23   | T12, T21                         | Concurrencia HTTP.        |
| T24   | T21, T22                         | Atomicidad HTTP.          |
| T25   | T21, T22                         | Contrato publicado.       |
| T26   | T1 a T25                         | Cierre de fase.           |

## Cobertura de requisitos

La evidencia de cada fila se concreta en el criterio de hecho de sus tareas. La matriz incluye los 46 RF del plan aprobado.

| RF    | Tarea                                       | Evidencia                           |
| ----- | ------------------------------------------- | ----------------------------------- |
| RF-1  | T1, T4, T8, T9, T18, T21, T24               | Creacion activa e identidad propia. |
| RF-2  | T1, T4, T13, T18                            | Nombre obligatorio.                 |
| RF-3  | T4, T5, T8, T9, T10, T12, T18, T19, T23     | Conflicto de nombre.                |
| RF-4  | T13, T18, T19                               | Email valido.                       |
| RF-5  | T13, T18, T19, T24                          | Email invalido rechazado.           |
| RF-6  | T1, T4, T8, T9, T15, T18                    | Opcionales omitidos.                |
| RF-7  | T1, T4, T8, T9, T15, T18                    | Opcionales nulos.                   |
| RF-8  | T3, T9, T14, T15, T17, T21                  | Detalle publico.                    |
| RF-9  | T3, T9, T15, T17, T21                       | Consulta de inactivo.               |
| RF-10 | T14, T17, T19, T20                          | UUID invalido.                      |
| RF-11 | T3, T5, T6, T10, T17, T19, T20              | UUID inexistente.                   |
| RF-12 | T2, T5, T10, T15, T19, T21                  | Patch valido.                       |
| RF-13 | T2, T5, T10, T13, T19, T24                  | Omision conserva.                   |
| RF-14 | T2, T5, T10, T13, T19, T24                  | Null limpia.                        |
| RF-15 | T2, T13, T18, T19                           | Nombre nulo rechazado.              |
| RF-16 | T2, T5, T10, T19, T21                       | Desactivar por PATCH.               |
| RF-17 | T2, T5, T10, T19, T21                       | Reactivar por PATCH.                |
| RF-18 | T6, T10, T14, T15, T20, T21                 | DELETE conserva fila.               |
| RF-19 | T6, T10, T14, T15, T20, T21                 | DELETE repetido.                    |
| RF-20 | T7, T11, T17, T21                           | Activos por defecto.                |
| RF-21 | T7, T11, T17                                | Filtro de estado.                   |
| RF-22 | T7, T11, T17                                | Busqueda en cuatro campos.          |
| RF-23 | T7, T11, T17                                | Defaults de pagina.                 |
| RF-24 | T14, T17                                    | Limites de pagina.                  |
| RF-25 | T7, T11, T17                                | Orden por defecto.                  |
| RF-26 | T3, T11, T14, T17                           | Sorts admitidos.                    |
| RF-27 | T3, T11, T14, T17                           | Direcciones admitidas.              |
| RF-28 | T3, T7, T11, T17                            | Desempates estables.                |
| RF-29 | T7, T11, T14, T15, T17                      | Total y paginas filtrados.          |
| RF-30 | T14, T15, T17, T18, T19, T20, T21           | Envelopes de datos.                 |
| RF-31 | T13, T18, T19, T24                          | Campos ajenos ignorados.            |
| RF-32 | T13, T19, T24                               | Patch vacio rechazado.              |
| RF-33 | T17, T21, T22, T25                          | Lecturas publicas.                  |
| RF-34 | T16, T18, T19, T20, T22, T25                | Escritura sin sesion: 401.          |
| RF-35 | T16, T18, T19, T20, T22, T25                | ADMIN y MANAGER escriben.           |
| RF-36 | T16, T18, T19, T20, T22, T25                | OPERATOR y VIEWER: 403.             |
| RF-37 | T17, T18, T19, T20, T21, T25                | Cinco rutas documentadas.           |
| RF-38 | T4, T5, T8, T9, T18, T19                    | Email puede repetirse.              |
| RF-39 | T14, T17, T25                               | Estado query invalido.              |
| RF-40 | T1, T2, T4, T5, T9, T10, T18, T19           | Nombre recortado.                   |
| RF-41 | T1, T2, T4, T5, T9, T10, T13, T18, T19, T24 | Textos vacios conservados.          |
| RF-42 | T13, T19, T24, T25                          | Estado JSON invalido.               |
| RF-43 | T8, T12, T23                                | Carrera con un ganador.             |
| RF-44 | T2, T5, T10, T12, T19, T24                  | Patch sin cambios parciales.        |
| RF-45 | T13, T18, T24, T25                          | Entrada POST exacta.                |
| RF-46 | T13, T19, T24, T25                          | Entrada PATCH exacta.               |

La verificación transversal de T26 incluye todos los RF, migración y reglas de dependencia. Las pruebas de cada capa se ejecutan al terminar su tarea; la ejecución completa de cierre se reserva para T26.
