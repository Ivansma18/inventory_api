import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";

import { categoryRoutes } from "./features/categories/index.js";
import { productRoutes } from "./features/products/index.js";
import { errorHandler } from "./shared/errors/error-handler.js";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok"),
          }),
        },
      },
      description: "Service is healthy",
    },
  },
});

const app = new OpenAPIHono();

app.use("*", cors());
app.onError(errorHandler);

app.openapi(healthRoute, (context) => context.json({ status: "ok" }, 200));
app.route("/products", productRoutes);
app.route("/categories", categoryRoutes);

app.doc("/openapi.json", {
  openapi: "3.0.3",
  info: {
    title: "Inventory API",
    version: "0.1.0",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

export { app };
