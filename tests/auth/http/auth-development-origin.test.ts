import { randomUUID } from "node:crypto";

import { afterEach, expect, it } from "vitest";

process.env.NODE_ENV = "development";

const [{ app }, { prisma }] = await Promise.all([
  import("../../../src/app.js"),
  import("../../../src/shared/database/prisma.js"),
]);

const localFrontendOrigin = "http://localhost:5174";
const testPassword = "dev-origin-test-password";
const createdEmails: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  createdEmails.length = 0;
});

const getSessionCookie = (response: Response): string => {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Authentication response did not set the session cookie.");
  }

  return setCookie.split(";")[0];
};

it("accepts the local frontend origin and invalidates the browser session on sign-out", async () => {
  const email = `${randomUUID()}@example.com`;
  createdEmails.push(email);

  const registration = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Local origin test",
      email,
      password: testPassword,
    }),
  });
  expect(registration.status).toBe(201);

  const login = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: localFrontendOrigin,
    },
    body: JSON.stringify({ email, password: testPassword }),
  });
  expect(login.status).toBe(200);
  const cookie = getSessionCookie(login);

  const activeSession = await app.request("/api/auth/get-session", {
    headers: { cookie, origin: localFrontendOrigin },
  });
  expect(activeSession.status).toBe(200);

  const signOut = await app.request("/api/auth/sign-out", {
    method: "POST",
    headers: {
      cookie,
      origin: localFrontendOrigin,
      "content-type": "application/json",
    },
    body: "{}",
  });
  expect(signOut.status).toBe(204);

  const closedSession = await app.request("/api/auth/get-session", {
    headers: { cookie, origin: localFrontendOrigin },
  });
  expect(closedSession.status).toBe(401);
});
