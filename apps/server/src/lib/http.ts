export function jsonResponse<T>(body: T, init?: ResponseInit) {
  return Response.json(body, init);
}