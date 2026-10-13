const localFrontendOrigin = "http://localhost:5174";

export const createTrustedOrigins = (
  backendOrigin: string,
  nodeEnvironment: string,
): string[] =>
  nodeEnvironment === "development"
    ? [backendOrigin, localFrontendOrigin]
    : [backendOrigin];
