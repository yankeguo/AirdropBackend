import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie } from 'hono/cookie';
import { Bindings, BINDING_KEYS, DEFAULT_COOKIE_OPTIONS, WEBSITES, GITHUB_CLIENT_USER_AGENT } from './config';
import { sessionLoad, sessionSave } from './session';
import { badRequest, serverInternalError } from './error';
import { HTTPException } from 'hono/http-exception';
import { randomHex } from './crypto';

const app = new Hono<{ Bindings: Bindings }>();

app.use(
	cors({
		origin: WEBSITES.map((w) => w.url),
		maxAge: 600,
		credentials: true,
	}),
);

app.onError((e, c) => {
	if (e instanceof HTTPException) {
		return c.json({ message: e.message }, e.status);
	}
	if ('getResponse' in e) {
		return e.getResponse();
	}
	if (e instanceof Error) {
		return c.json({ message: e.message }, 500);
	}
	return c.json({ message: 'Internal Server Error' }, 500);
});

app.get('/', async (c) => {
	return c.json({ message: 'Hello World!' });
});

app.get('/debug/session/save', async (c) => {
	await sessionSave(c, '_debug', { date: `${Date.now()}` }, 600);
	return c.json({});
});

app.get('/debug/session/load', async (c) => {
	return c.json((await sessionLoad<{ date: string }>(c, '_debug')) ?? {});
});

app.get('/debug/error', async (c) => {
	badRequest('This is a bad request');
});

app.get('/debug/bindings', async (c) => {
	const bindings: Record<string, any> = {};

	for (const key of BINDING_KEYS) {
		const value = (c.env as any)[key];
		if (value) {
			if (typeof value === 'string') {
				bindings[key] = {
					existed: true,
					length: value.length,
				};
			} else {
				bindings[key] = {
					existed: true,
				};
			}
		} else {
			bindings[key] = {
				existed: false,
			};
		}
	}

	return c.json({
		bindings,
	});
});

const SESSION_KEY_GITHUB = '_github';

const SESSION_KEY_GITHUB_STATE = '_github_state';
interface GitHubAccount {
	id: string;
	username: string;
}

app.get('/account/github', async (c) => {
	const account = await sessionLoad<GitHubAccount>(c, SESSION_KEY_GITHUB);
	return c.json(
		account ?? {
			id: '',
			username: '',
		},
	);
});

app.get('/account/github/authorize_url', async (c) => {
	const website = WEBSITES.find((w) => w.host === c.req.query('host')) ?? badRequest('invalid host');

	const clientId = (c.env[website.keys.GITHUB_CLIENT_ID] as string) ?? serverInternalError('missing GITHUB_CLIENT_ID');

	const state = randomHex(8);

	const u = new URL('https://github.com/login/oauth/authorize');
	u.searchParams.set('client_id', clientId);
	u.searchParams.set('redirect_uri', `${website.url}/oauth/github/callback`);
	u.searchParams.set('prompt', 'select_account');
	u.searchParams.set('state', state);

	await sessionSave(c, SESSION_KEY_GITHUB_STATE, { state }, 600);

	return c.json({ url: u.toString() });
});

app.post('/account/github/sign_in', async (c) => {
	const data = (await c.req.json()) ?? {};

	const website = WEBSITES.find((w) => w.host === data.host) ?? badRequest('invalid host');

	const client_id = (c.env[website.keys.GITHUB_CLIENT_ID] as string) ?? serverInternalError('missing GITHUB_CLIENT_ID');
	const client_secret = (c.env[website.keys.GITHUB_CLIENT_SECRET] as string) ?? serverInternalError('missing GITHUB_CLIENT_SECRET');

	const state = data.state ?? badRequest('missing state');
	const code = data.code ?? badRequest('missing code');
	const redirect_uri = data.redirect_uri ?? badRequest('missing redirect_uri');

	const { state: sessionState }: { state: string } =
		(await sessionLoad<{ state: string }>(c, SESSION_KEY_GITHUB_STATE)) ?? badRequest('missing session state');

	if (state !== sessionState) {
		return badRequest('invalid state');
	}

	let access_token: string;

	{
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
			return serverInternalError(await res.text());
		}

		const { access_token: _access_token } = (await res.json()) as { access_token: string };

		if (!_access_token) return serverInternalError('missing access_token');

		access_token = _access_token;
	}

	{
		const res = await fetch('https://api.github.com/user', {
			headers: {
				Accept: 'application/json',
				'User-Agent': GITHUB_CLIENT_USER_AGENT,
				Authorization: `Bearer ${access_token}`,
			},
		});

		if (res.status !== 200) {
			return serverInternalError(await res.text());
		}

		const { id, login } = (await res.json()) as { id: string; login: string };

		if (!id || !login) return serverInternalError('missing id or login');

		await sessionSave(c, SESSION_KEY_GITHUB, { id, username: login });
	}

	return c.json({ success: true });
});

export default app;
