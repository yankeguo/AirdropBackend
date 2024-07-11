import { raise500 } from './error';

export const GITHUB_CLIENT_USER_AGENT = 'yankeguo/airdrop-backend';

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
			'User-Agent': GITHUB_CLIENT_USER_AGENT,
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
			'User-Agent': GITHUB_CLIENT_USER_AGENT,
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
			'User-Agent': GITHUB_CLIENT_USER_AGENT,
			Authorization: `Bearer ${access_token}`,
		},
	});
	if (res.status === 204) return true;
	if (res.status === 404) return false;

	return raise500(await res.text());
}
