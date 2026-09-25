export function jsonResponse<T>(body: T, init?: ResponseInit) {
  return Response.json(body, init);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)/i.exec(authorization);
  return match?.[1];
}
