# Constitución del proyecto

Principios no negociables. Toda spec, plan, tarea y cambio debe cumplirlos.

1. **Organización por feature**: toda capacidad de negocio reside en `src/features/<feature>/`; `src/shared/` solo contiene infraestructura o utilidades realmente transversales.
2. **Dependencias hacia el dominio**: `domain/` no importa frameworks ni capas externas, salvo utilidades seguras de dominio en `shared/`; `application/` depende de `domain/` y de elementos transversales permitidos; `infrastructure/` implementa contratos de dominio, puede usar `shared/` y nunca importa `http/`.
3. **Persistencia aislada**: Prisma solo se usa en `src/shared/database/` y `src/features/*/infrastructure/`; queda prohibido en `domain/`, `application/` y `http/`. Todo cambio del esquema de persistencia incluye su migración Prisma correspondiente.
4. **HTTP como frontera**: rutas HTTP validan y serializan con Zod/OpenAPI, delegan en casos de uso y no contienen acceso a Prisma ni reglas complejas de negocio. Los errores de negocio no incluyen códigos HTTP y se traducen en el manejador HTTP. Todo endpoint nuevo o modificado actualiza sus schemas Zod y contrato OpenAPI/Swagger.
5. **Contratos sin acoplamiento**: DTOs HTTP, tipos de aplicación, entidades de dominio y modelos Prisma se mantienen conceptualmente separados. Las features solo consumen la API pública o contratos explícitos de otras features, nunca su infraestructura ni HTTP internos.
6. **Pruebas de reglas de negocio**: las reglas de dominio y los casos de uso se prueban sin Hono, Prisma ni PostgreSQL. La infraestructura se cubre con pruebas de integración y los flujos HTTP con pruebas de integración o E2E.
7. **Evolución mínima**: las nuevas capas, value objects, eventos y abstracciones solo se incorporan ante una necesidad actual verificable. `app.ts` compone la aplicación y `index.ts` se limita a iniciar el proceso.
8. **Identidad y permisos separados**: autenticación responde quién realiza la petición y autorización qué puede hacer. Ambas responsabilidades se mantienen en features o componentes independientes cuando exista lógica propia.
