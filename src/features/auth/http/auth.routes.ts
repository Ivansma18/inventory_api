import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import { auth } from "../auth.config.js";
import { toAuthResponse } from "./auth.mapper.js";
import {
  authCredentialsSchema,
  authEmailAlreadyRegisteredResponseSchema,
  authRegistrationSchema,
  authUnauthorizedResponseSchema,
  authValidationErrorResponseSchema,
  publicAuthResponseSchema,
} from "./auth.schemas.js";

const signUpPath = "/sign-up/email";
const signInPath = "/sign-in/email";
const sessionPath = "/get-session";
const signOutPath = "/sign-out";

interface AuthResponseBody {
  user?: {
    id: string;
    email: string;
  };
  session?: {
    id: string;
    createdAt: Date | string;
  };
  message?: string;
  code?: string;
  error?: { code?: string; message?: string };
}

const authSuccessResponse = {
  content: { "application/json": { schema: publicAuthResponseSchema } },
};
const authValidationErrorResponse = {
  content: {
    "application/json": { schema: authValidationErrorResponseSchema },
  },
};
const authUnauthorizedResponse = {
  content: { "application/json": { schema: authUnauthorizedResponseSchema } },
};

const signUpRoute = createRoute({
  method: "post",
  path: signUpPath,
  tags: ["Authentication"],
  request: {
    body: {
      content: { "application/json": { schema: authRegistrationSchema } },
      required: true,
    },
  },
  responses: {
    201: { ...authSuccessResponse, description: "Account registered" },
    400: { ...authValidationErrorResponse, description: "Invalid credentials" },
    409: {
      content: {
        "application/json": {
          schema: authEmailAlreadyRegisteredResponseSchema,
        },
      },
      description: "Email already registered",
    },
  },
});

const signInRoute = createRoute({
  method: "post",
  path: signInPath,
  tags: ["Authentication"],
  request: {
    body: {
      content: { "application/json": { schema: authCredentialsSchema } },
      required: true,
    },
  },
  responses: {
    200: { ...authSuccessResponse, description: "Session started" },
    400: { ...authValidationErrorResponse, description: "Invalid credentials" },
    401: { ...authUnauthorizedResponse, description: "Invalid credentials" },
  },
});

const getSessionRoute = createRoute({
  method: "get",
  path: sessionPath,
  tags: ["Authentication"],
  responses: {
    200: { ...authSuccessResponse, description: "Current session" },
    401: { ...authUnauthorizedResponse, description: "Session is invalid" },
  },
});

const signOutRoute = createRoute({
  method: "post",
  path: signOutPath,
  tags: ["Authentication"],
  responses: {
    204: { description: "Current session closed" },
  },
});

export function createAuthRoutes(): OpenAPIHono {
  const routes = new OpenAPIHono();

  const handleAuth = async (context: Context) => {
    const response = await auth.handler(context.req.raw);
    const path = new URL(context.req.url).pathname;

    if (path.endsWith(signOutPath)) {
      return new Response(null, {
        status: 204,
        headers: copyResponseHeaders(response),
      });
    }

    const responseBody = await readJson(response);
    if (!response.ok) {
      return mapAuthError(path, response.status, responseBody);
    }

    if (path.endsWith(sessionPath)) {
      if (!responseBody?.user || !responseBody.session) {
        return unauthorizedResponse();
      }

      return publicResponse(
        toAuthResponse(responseBody.user, responseBody.session),
        response,
        200,
      );
    }

    if (path.endsWith(signUpPath) || path.endsWith(signInPath)) {
      const session =
        responseBody?.session ?? (await getSessionFromResponse(response));
      if (!responseBody?.user || !session) {
        return new Response(null, {
          status: 500,
          headers: copyResponseHeaders(response),
        });
      }

      return publicResponse(
        toAuthResponse(responseBody.user, session),
        response,
        path.endsWith(signUpPath) ? 201 : 200,
      );
    }

    return response;
  };

  routes.openAPIRegistry.registerPath(signUpRoute);
  routes.openAPIRegistry.registerPath(signInRoute);
  routes.openAPIRegistry.registerPath(getSessionRoute);
  routes.openAPIRegistry.registerPath(signOutRoute);
  routes.post(signUpPath, handleAuth);
  routes.post(signInPath, handleAuth);
  routes.get(sessionPath, handleAuth);
  routes.post(signOutPath, handleAuth);

  return routes;
}

async function getSessionFromResponse(response: Response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    return null;
  }

  const sessionCookie = setCookie.split(";")[0];
  const sessionResult = await auth.api.getSession({
    headers: new Headers({ cookie: sessionCookie }),
  });

  return sessionResult?.session ?? null;
}

async function readJson(response: Response): Promise<AuthResponseBody | null> {
  try {
    return (await response.clone().json()) as AuthResponseBody;
  } catch {
    return null;
  }
}

function publicResponse(
  body: unknown,
  source: Response,
  status: number,
): Response {
  const headers = copyResponseHeaders(source);
  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(body), { status, headers });
}

function mapAuthError(
  path: string,
  status: number,
  body: AuthResponseBody | null,
): Response {
  const message = String(body?.message ?? body?.error?.message ?? "");
  const errorCode = String(body?.code ?? body?.error?.code ?? "");

  if (
    status >= 500 ||
    /internal|server|database|failed to create user/i.test(
      `${errorCode} ${message}`,
    )
  ) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
    );
  }

  if (
    path.endsWith(signUpPath) &&
    (status === 409 || /already exists|already registered/i.test(message))
  ) {
    return errorResponse(409, "EMAIL_ALREADY_REGISTERED", message);
  }

  if (path.endsWith(signInPath) && status === 401) {
    return unauthorizedResponse();
  }

  return errorResponse(
    status >= 400 && status < 500 ? 400 : 500,
    "VALIDATION_ERROR",
    message || "Invalid authentication request.",
  );
}

function unauthorizedResponse(): Response {
  return errorResponse(401, "UNAUTHORIZED", "Authentication required");
}

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json({ error: { code, message } }, { status });
}

function copyResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (key !== "content-length" && key !== "content-type") {
      headers.set(key, value);
    }
  });
  return headers;
}
