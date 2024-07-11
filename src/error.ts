import { HTTPException } from 'hono/http-exception';

export function badRequest(message: string): never {
	throw new HTTPException(400, { message });
}

export function serverInternalError(message: string): never {
	throw new HTTPException(500, { message });
}
