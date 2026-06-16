type MiddlewareNext = () => Promise<Response> | Response;

/**
 * Placeholder pass-through middleware. Token handling and route guards belong
 * to the auth plugin / adapter; the media plugin only registers this so a
 * consumer can opt into a media-owned middleware slot without owning auth.
 */
export function onRequest(_context: unknown, next: MiddlewareNext): Promise<Response> | Response {
  return next();
}
