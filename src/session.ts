import { Context } from 'hono';
import { getSignedCookie, deleteCookie, setSignedCookie } from 'hono/cookie';
import { Bindings, DEFAULT_COOKIE_OPTIONS, DEFAULT_SESSION_AGE } from './config';

function _sessionEncode(value: object, maxAge: number): string {
	const exp = Math.floor(Date.now() / 1000 + maxAge);
	return `${exp}:${JSON.stringify(value)}`;
}

function _sessionDecode<T>(raw: string): T | null {
	const idx = raw.indexOf(':');
	if (idx === -1) {
		return null;
	}
	const exp = parseInt(raw.slice(0, idx)) ?? 0;
	if (exp < Date.now() / 1000) {
		return null;
	}
	try {
		const value = JSON.parse(raw.slice(idx + 1));
		// must be an plain object
		if (value?.constructor !== Object) {
			return null;
		}
		return value as T;
	} catch (e) {
		return null;
	}
}

export function sessionClear(c: Context<{ Bindings: Bindings }>, name: string) {
	deleteCookie(c, name, DEFAULT_COOKIE_OPTIONS);
}

export async function sessionSave(c: Context<{ Bindings: Bindings }>, name: string, value: any, maxAge?: number) {
	maxAge = maxAge ?? DEFAULT_SESSION_AGE;
	await setSignedCookie(c, name, _sessionEncode(value, maxAge), c.env.SECRET_KEY, { ...DEFAULT_COOKIE_OPTIONS, maxAge });
}

export async function sessionLoad<T>(c: Context<{ Bindings: Bindings }>, name: string): Promise<T | null> {
	const raw = await getSignedCookie(c, c.env.SECRET_KEY, name);
	if (!raw) {
		return null;
	}
	const value = _sessionDecode<T>(raw);
	if (!value) {
		sessionClear(c, name);
		return null;
	}
	return value;
}
