/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, getSignedCookie, setCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { Bindings, CORS_ORIGINS, DEFAULT_COOKIE_OPTIONS } from './config';

const app = new Hono<{ Bindings: Bindings }>();

app.use(
	cors({
		origin: CORS_ORIGINS,
		maxAge: 600,
		credentials: true,
	}),
);

app.get('/', async (c) => {
	return c.json({ message: 'Hello World!' });
});

app.get('/check', async (c) => {
	setCookie(c, '_now', Date.now().toString(), DEFAULT_COOKIE_OPTIONS);
	return c.json({
		bindings: {
			SECRET_KEY: {
				length: c.env.SECRET_KEY.length,
			},
			KV_NONCE_DEDUP: !!c.env.KV_NONCE_DEDUP,
		},
	});
});

app.get('/user', async (c) => {
	return c.json({
		address: (await getSignedCookie(c, c.env.SECRET_KEY, '_address')) ?? '',
		github: (await getSignedCookie(c, c.env.SECRET_KEY, '_github')) ?? '',
	});
});

export default app;
