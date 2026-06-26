type MiddlewareNext = () => Promise<Response> | Response;

function withCsp(response: Response, policy: string): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", policy);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function onRequest(_context: unknown, next: MiddlewareNext): Promise<Response> | Response {
  // Policy is injected by vite.define in the integration setup; read as a runtime env var in tests.
  const policy = import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY;
  if (!policy) {
    return next();
  }
  const result = next();
  if (result instanceof Promise) {
    return result.then(r => withCsp(r, policy));
  }
  return withCsp(result, policy);
}
