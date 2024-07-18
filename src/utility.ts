import { AirdropDrizzleDatabase, Bindings, WEBSITES } from './types';
import { HTTPException } from 'hono/http-exception';
import { StatusCode } from 'hono/utils/http-status';
import { drizzle } from 'drizzle-orm/d1';
import { tAirdrops } from './schema';

export function createDatabase(db: D1Database) {
	return drizzle(db, { schema: { tAirdrops } });
}

export async function airdropMarkEligible(db: AirdropDrizzleDatabase, nftId: string, userId: string) {
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
		return raise500('twitter/create_access_token: ' + (await res.text()));
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
		return raise500('twitter/get_user: ' + (await res.text()));
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

export async function twitterCheckIsFollowingLegacy(access_token: string, username: string): Promise<boolean> {
	const url = new URL('https://api.twitter.com/1.1/friendships/lookup.json');
	url.searchParams.set('screen_name', username);

	const res = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${access_token}`,
			'User-Agent': CLIENT_USER_AGENT,
		},
	});

	if (res.status !== 200) {
		return raise500('twitter/check_is_following: ' + (await res.text()));
	}

	const data = (await res.json()) as any;

	if (!data) {
		return raise500('twitter/check_is_following: invalid response data');
	}

	if (!Array.isArray(data)) {
		return raise500('twitter/check_is_following: invalid response not array');
	}

	for (const item of data) {
		if (typeof item !== 'object') {
			return raise500('twitter/check_is_following: invalid response item not object');
		}
		if (typeof item.screen_name !== 'string') {
			return raise500('twitter/check_is_following: invalid response item.screen_name');
		}
		if (!Array.isArray(item.connections)) {
			return raise500('twitter/check_is_following: invalid response item.connections not array');
		}
		if (item.screen_name === username) {
			return item.connections.includes('following');
		}
	}

	return false;
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
		return raise500('twitter/check_is_following: ' + (await res.text()));
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

export interface WebsiteOptions {
	host: string;
	url: string;
	github: {
		clientId: string;
		clientSecret: string;
	};
	twitter: {
		clientId: string;
		clientSecret: string;
	};
}

export function websiteOptionsFromEnv(env: Bindings, host: string): WebsiteOptions {
	const kw = WEBSITES.find((w) => w.host === host);
	if (!kw) {
		raise400(`websiteOptionsFromEnv: unknown host ${host}`);
	}
	const opts = {
		host: kw.host,
		url: kw.url,
		github: {
			clientId: env[kw.keys.GITHUB_CLIENT_ID] as string,
			clientSecret: env[kw.keys.GITHUB_CLIENT_SECRET] as string,
		},
		twitter: {
			clientId: env[kw.keys.TWITTER_CLIENT_ID] as string,
			clientSecret: env[kw.keys.TWITTER_CLIENT_SECRET] as string,
		},
	};
	if (!opts.github.clientId) {
		raise500(`websiteOptionsFromEnv: missing github client id for ${host}`);
	}
	if (!opts.github.clientSecret) {
		raise500(`websiteOptionsFromEnv: missing github client secret for ${host}`);
	}
	if (!opts.twitter.clientId) {
		raise500(`websiteOptionsFromEnv: missing twitter client id for ${host}`);
	}
	if (!opts.twitter.clientSecret) {
		raise500(`websiteOptionsFromEnv: missing twitter client secret for ${host}`);
	}
	return opts;
}

export function rpcEndpointFromEnv(_env: Bindings, chain: string): string | null {
	const env = _env as Record<string, any>;
	const key = `RPC_ENDPOINT_${chain.toUpperCase()}`;

	if (env[key]) {
		return env[key] as string;
	}

	return null;
}
