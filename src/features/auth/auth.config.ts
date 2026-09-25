import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "../../shared/database/prisma.js";
import { env } from "../../shared/config/env.js";

const sessionLifetimeSeconds = 60 * 60 * 24 * 400;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: sessionLifetimeSeconds,
    updateAge: sessionLifetimeSeconds,
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (
        context.path !== "/sign-up/email" &&
        context.path !== "/sign-in/email"
      ) {
        return;
      }

      const body = context.body as { email?: unknown } | undefined;
      if (typeof body?.email !== "string") {
        return;
      }

      return {
        context: {
          ...context,
          body: {
            ...body,
            email: body.email.trim().toLowerCase(),
          },
        },
      };
    }),
  },
});
