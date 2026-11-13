export function methodNotAllowedBody(allowedMethods: string): Record<string, unknown> {
  return {
    code: "METHOD_NOT_ALLOWED",
    message: `HTTP method not allowed. Use: ${allowedMethods}`,
    allow: allowedMethods.split(",").map((m) => m.trim()),
  };
}

export function allowHeader(allowedMethods: string): Record<string, string> {
  return { Allow: allowedMethods };
}
