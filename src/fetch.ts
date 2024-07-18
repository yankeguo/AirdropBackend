import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Session, Variables, WEBSITES, DEFAULT_COOKIE_OPTIONS } from './types';
import { HTTPException } from 'hono/http-exception';
import {
	routeAccountGitHub,
	routeAccountGitHubAuthorizeURL,
	routeAccountGitHubSignIn,
	routeAccountGitHubSignOut,
	routeAccountTwitter,
	routeAccountTwitterAuthorizeURL,
	routeAccountTwitterSignIn,
	routeAccountTwitterSignOut,
	routeAirdropClaim,
	routeAirdropList,
	routeDebugBindings,
	routeDebugMinter,
	routeDebugMintings,
	routeDebugSession,
	routeRoot,
} from './routes';
import { createDatabase } from './utility';
import { EncryptedSession } from '@yankeguo/hono-cookie-session';
import { deleteCookie } from 'hono/cookie';

export const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use(
	cors({
		origin: WEBSITES.map((w) => w.url),
		maxAge: 600,
		credentials: true,
	}),
);

app.use(async (c, next) => {
	const db = createDatabase(c.env.DB_AIRDROP);
	const es = new EncryptedSession<Session>(c, c.env.SECRET_KEY, '_session', DEFAULT_COOKIE_OPTIONS);

	c.set('db', db);
	c.set('session', (await es.get()) ?? {});

	deleteCookie(c, '_github');
	deleteCookie(c, '_twitter');

	await next();

	await es.set(c.get('session') ?? {});
});

app.use('/debug/*', async (c, next) => {
	if (c.req.query('key') !== c.env.DEBUG_KEY) {
		return c.json({ message: 'Unauthorized' }, 400);
	}
	await next();
});

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

app.get('/', routeRoot);
app.get('/debug/session', routeDebugSession);
app.get('/debug/minter', routeDebugMinter);
app.get('/debug/bindings', routeDebugBindings);
app.get('/debug/mintings', routeDebugMintings);
app.get('/account/twitter', routeAccountTwitter);
app.get('/account/twitter/authorize_url', routeAccountTwitterAuthorizeURL);
app.post('/account/twitter/sign_out', routeAccountTwitterSignOut);
app.post('/account/twitter/sign_in', routeAccountTwitterSignIn);
app.get('/account/github', routeAccountGitHub);
app.get('/account/github/authorize_url', routeAccountGitHubAuthorizeURL);
app.post('/account/github/sign_out', routeAccountGitHubSignOut);
app.post('/account/github/sign_in', routeAccountGitHubSignIn);
app.post('/airdrop/claim', routeAirdropClaim);
app.get('/airdrop/list', routeAirdropList);
