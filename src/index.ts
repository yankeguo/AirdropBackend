import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, BINDING_KEYS, WEBSITES, OWNER_GITHUB_USERNAME } from './config';
import { sessionClear, sessionLoad, sessionSave } from './session';
import { raise400, raise500 } from './error';
import { HTTPException } from 'hono/http-exception';
import { randomHex } from './crypto';
import { githubCheckIsFollowing, githubCreateAccessToken, githubCreateAuthorizeURL, githubGetUser } from './github';

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
	raise400('This is a bad request');
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
	const website = WEBSITES.find((w) => w.host === c.req.query('host')) ?? raise400('invalid host');

	const client_id = (c.env[website.keys.GITHUB_CLIENT_ID] as string) ?? raise500('missing GITHUB_CLIENT_ID');
	const redirect_uri = `${website.url}/oauth/github/callback`;
	const state = randomHex(8);

	const url = githubCreateAuthorizeURL({
		client_id,
		redirect_uri,
		state,
	});

	await sessionSave(c, SESSION_KEY_GITHUB_STATE, { state }, 600);

	return c.json({ url });
});

app.post('/account/github/sign_out', async (c) => {
	sessionClear(c, SESSION_KEY_GITHUB);
	return c.json({ success: true });
});

app.post('/account/github/sign_in', async (c) => {
	const data = (await c.req.json()) ?? {};

	const website = WEBSITES.find((w) => w.host === data.host) ?? raise400('invalid host');

	const client_id = (c.env[website.keys.GITHUB_CLIENT_ID] as string) ?? raise500('missing GITHUB_CLIENT_ID');
	const client_secret = (c.env[website.keys.GITHUB_CLIENT_SECRET] as string) ?? raise500('missing GITHUB_CLIENT_SECRET');

	const state = data.state ?? raise400('missing state');
	const code = data.code ?? raise400('missing code');
	const redirect_uri = data.redirect_uri ?? raise400('missing redirect_uri');

	const { state: sessionState }: { state: string } =
		(await sessionLoad<{ state: string }>(c, SESSION_KEY_GITHUB_STATE)) ?? raise400('missing session state');

	if (state !== sessionState) {
		return raise400('invalid state');
	}

	const access_token = await githubCreateAccessToken({
		client_id,
		client_secret,
		code,
		redirect_uri,
	});

	const { id, login } = await githubGetUser(access_token);

	const is_following = await githubCheckIsFollowing(access_token, OWNER_GITHUB_USERNAME);

	await sessionSave(c, SESSION_KEY_GITHUB, { id: id.toString(), username: login });

	return c.json({ success: true });
});

export default {
	async fetch(req: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(req, env, ctx);
	},
	async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {},
	async queue(batch: MessageBatch, env: Bindings, ctx: ExecutionContext): Promise<void> {
		batch.ackAll();
	},
};
