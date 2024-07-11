import { HTTPException } from 'hono/http-exception';
import { StatusCode } from 'hono/utils/http-status';

export function raise(status: StatusCode, message: string): never {
	throw new HTTPException(status, { message });
}

export function raise400(message: string): never {
	throw new HTTPException(400, { message });
}

export function raise500(message: string): never {
	throw new HTTPException(500, { message });
}
