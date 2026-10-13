import { z } from "@hono/zod-openapi";

const publicAuthUserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
  })
  .openapi("PublicAuthUser");

const publicAuthSessionSchema = z
  .object({
    id: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi("PublicAuthSession");

export const publicAuthResponseSchema = z
  .object({
    data: z.object({
      user: publicAuthUserSchema,
      session: publicAuthSessionSchema,
    }),
  })
  .openapi("PublicAuthResponse");

const authEmailSchema = z
  .string()
  .email()
  .openapi({ example: "user@example.com" });
const authPasswordSchema = z
  .string()
  .min(8)
  .openapi({ example: "password123" });

export const authCredentialsSchema = z
  .object({ email: authEmailSchema, password: authPasswordSchema })
  .strip()
  .openapi("AuthCredentials");

export const authRegistrationSchema = z
  .object({
    name: z.string().openapi({ example: "Jane Doe" }),
    email: authEmailSchema,
    password: authPasswordSchema,
  })
  .strip()
  .openapi("AuthRegistration");

function authErrorSchema(name: string, code: string) {
  return z
    .object({
      error: z.object({
        code: z.literal(code),
        message: z.string(),
      }),
    })
    .openapi(name);
}

export const authValidationErrorResponseSchema = authErrorSchema(
  "AuthValidationErrorResponse",
  "VALIDATION_ERROR",
);
export const authUnauthorizedResponseSchema = authErrorSchema(
  "AuthUnauthorizedResponse",
  "UNAUTHORIZED",
);
export const authForbiddenResponseSchema = authErrorSchema(
  "AuthForbiddenResponse",
  "FORBIDDEN",
);
export const authInternalErrorResponseSchema = authErrorSchema(
  "AuthInternalErrorResponse",
  "INTERNAL_ERROR",
);
export const authSignOutErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
      message: z.string(),
    }),
  })
  .openapi("AuthSignOutErrorResponse");
export const authEmailAlreadyRegisteredResponseSchema = authErrorSchema(
  "AuthEmailAlreadyRegisteredResponse",
  "EMAIL_ALREADY_REGISTERED",
);
