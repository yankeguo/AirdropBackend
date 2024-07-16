import { Context } from 'hono';
import { getSignedCookie, deleteCookie, setSignedCookie } from 'hono/cookie';
import { Environment } from './config';
import { HTTPException } from 'hono/http-exception';
import { StatusCode } from 'hono/utils/http-status';
import { drizzle } from 'drizzle-orm/d1';
import { tAirdrops } from './schema';
import { CookieOptions } from 'hono/utils/cookie';

export const DEFAULT_SESSION_MAX_AGE = 3600 * 24 * 3;

export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
	path: '/',
	maxAge: DEFAULT_SESSION_MAX_AGE,
	httpOnly: true,
	secure: true,
	partitioned: true,
	sameSite: 'None',
};

export function useDatabase(c: Context<{ Bindings: Environment }>) {
	return createDatabase(c.env.DB_AIRDROP);
}

export function createDatabase(db: D1Database) {
	return drizzle(db, { schema: { tAirdrops } });
}

export async function airdropMarkEligible(db: ReturnType<typeof useDatabase>, nftId: string, userId: string) {
	const id = `${nftId}::${userId}`;

	await db
		.insert(tAirdrops)
		.values({
			id,
			nft_id: nftId,
			user_id: userId,
			is_eligible: 1,
			eligible_at: Date.now() / 1000,
		})
		.onConflictDoNothing();
}

export function randomHex(byteLen: number): string {
	const bytes = new Uint8Array(byteLen);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function raise(status: StatusCode, message: string): never {
	throw new HTTPException(status, { message });
}

export function raise400(message: string): never {
	throw new HTTPException(400, { message });
}

export function raise500(message: string): never {
	throw new HTTPException(500, { message });
}

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

export function sessionClear(c: Context<{ Bindings: Environment }>, name: string) {
	deleteCookie(c, name, DEFAULT_COOKIE_OPTIONS);
}

export async function sessionSave(c: Context<{ Bindings: Environment }>, name: string, value: any, maxAge?: number) {
	maxAge = maxAge ?? DEFAULT_SESSION_MAX_AGE;
	await setSignedCookie(c, name, _sessionEncode(value, maxAge), c.env.SECRET_KEY, { ...DEFAULT_COOKIE_OPTIONS, maxAge });
}

export async function sessionLoad<T>(c: Context<{ Bindings: Environment }>, name: string): Promise<T | null> {
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

export const CLIENT_USER_AGENT = 'yankeguo/airdrop-backend';

export function githubCreateAuthorizeURL({
	redirect_uri,
	client_id,
	state,
}: {
	redirect_uri: string;
	client_id: string;
	state: string;
}): string {
	const u = new URL('https://github.com/login/oauth/authorize');
	u.searchParams.set('client_id', client_id);
	u.searchParams.set('redirect_uri', redirect_uri);
	u.searchParams.set('prompt', 'select_account');
	u.searchParams.set('state', state);
	return u.toString();
}

export async function githubCreateAccessToken({
	client_id,
	client_secret,
	code,
	redirect_uri,
}: {
	client_id: string;
	client_secret: string;
	code: string;
	redirect_uri: string;
}): Promise<string> {
	const res = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'User-Agent': CLIENT_USER_AGENT,
		},
		body: JSON.stringify({
			client_id,
			client_secret,
			code,
			redirect_uri,
		}),
	});

	if (res.status !== 200) {
		return raise500(await res.text());
	}

	const data = (await res.json()) as any;

	if (typeof data !== 'object') return raise500('github/create_access_token: invalid response data');

	if (typeof data.access_token !== 'string') return raise500('github/create_access_token: invalid response access_token');

	return data.access_token as string;
}

export async function githubGetUser(access_token: string): Promise<{ id: number; login: string }> {
	const res = await fetch('https://api.github.com/user', {
		headers: {
			Accept: 'application/json',
			'User-Agent': CLIENT_USER_AGENT,
			Authorization: `Bearer ${access_token}`,
		},
	});

	if (res.status !== 200) {
		return raise500(await res.text());
	}

	const data = (await res.json()) as any;

	if (typeof data !== 'object') return raise500('github/get_user: invalid response data');

	if (typeof data.id !== 'number') return raise500('github/get_user: invalid response id');

	if (typeof data.login !== 'string') return raise500('github/get_user: invalid response login');

	return { id: data.id, login: data.login };
}

export async function githubCheckIsFollowing(access_token: string, username: string): Promise<boolean> {
	const res = await fetch(`https://api.github.com/user/following/${username}`, {
		headers: {
			'User-Agent': CLIENT_USER_AGENT,
			Authorization: `Bearer ${access_token}`,
		},
	});
	if (res.status === 204) return true;
	if (res.status === 404) return false;

	return raise500(await res.text());
}

export function githubCreateUserID(id: number | string): string {
	return `github::${id}`;
}

export function twitterCreateUserID(id: string): string {
	return `twitter::${id}`;
}

export function twitterCreateAuthorizeURL({
	redirect_uri,
	client_id,
	scope,
	state,
	code_challenge,
}: {
	redirect_uri: string;
	client_id: string;
	scope: string[];
	state: string;
	code_challenge: string;
}): string {
	const u = new URL('https://twitter.com/i/oauth2/authorize');
	u.searchParams.set('response_type', 'code');
	u.searchParams.set('client_id', client_id);
	u.searchParams.set('redirect_uri', redirect_uri);
	u.searchParams.set('scope', scope.join(' '));
	u.searchParams.set('state', state);
	u.searchParams.set('code_challenge', code_challenge);
	u.searchParams.set('code_challenge_method', 'plain');
	return u.toString();
}

export async function twitterCreateAccessToken({
	code,
	client_id,
	client_secret,
	redirect_uri,
	code_verifier,
}: {
	code: string;
	client_id: string;
	client_secret: string;
	redirect_uri: string;
	code_verifier: string;
}) {
	const form = new URLSearchParams();

	form.set('code', code);
	form.set('redirect_uri', redirect_uri);
	form.set('grant_type', 'authorization_code');
	form.set('code_verifier', code_verifier);

	const res = await fetch('https://api.twitter.com/2/oauth2/token', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${btoa(`${client_id}:${client_secret}`)}`,
			'User-Agent': CLIENT_USER_AGENT,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: form.toString(),
	});

	if (res.status !== 200) {
		return raise500(await res.text());
	}

	const data = (await res.json()) as any;

	if (!data) {
		return raise500('twitter/create_access_token: invalid response data');
	}

	if (typeof data.access_token !== 'string') {
		return raise500('twitter/create_access_token: invalid response access_token');
	}

	return data.access_token as string;
}

export async function twitterGetUser(access_token: string) {
	const url = new URL('https://api.twitter.com/2/users/me');
	url.searchParams.set('user.fields', 'id,username');

	const res = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${access_token}`,
			'User-Agent': CLIENT_USER_AGENT,
		},
	});

	if (res.status !== 200) {
		return raise500(await res.text());
	}

	const data = (await res.json()) as any;

	if (!data) {
		return raise500('twitter/get_user: invalid response data');
	}

	if (typeof data.data !== 'object') {
		return raise500('twitter/get_user: invalid response data.data');
	}

	if (typeof data.data.id !== 'string') {
		return raise500('twitter/get_user: invalid response data.data.id');
	}

	if (typeof data.data.username !== 'string') {
		return raise500('twitter/get_user: invalid response data.data.username');
	}

	return { id: data.data.id as string, username: data.data.username as string };
}

export async function twitterCheckIsFollowing(access_token: string, username: string): Promise<boolean> {
	const url = new URL('https://api.twitter.com/2/users/by/username/' + username);
	url.searchParams.set('user.fields', 'id,connection_status');

	const res = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${access_token}`,
			'User-Agent': CLIENT_USER_AGENT,
		},
	});

	if (res.status !== 200) {
		return raise500(await res.text());
	}

	const data = (await res.json()) as any;

	if (!data) {
		return raise500('twitter/check_is_following: invalid response data');
	}

	if (typeof data.data !== 'object') {
		return raise500('twitter/check_is_following: invalid response data.data');
	}

	if (typeof data.data.id !== 'string') {
		return raise500('twitter/check_is_following: invalid response data.data.id');
	}

	if (typeof data.data.connection_status !== 'object') {
		return raise500('twitter/check_is_following: invalid response data.data.connection_status');
	}

	if (!Array.isArray(data.data.connection_status)) {
		return raise500('twitter/check_is_following: invalid response data.data.connection_status not array');
	}

	return data.data.connection_status.includes('following');
}
