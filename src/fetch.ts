import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Environment, WEBSITES } from './config';
import { HTTPException } from 'hono/http-exception';
import {
	routeAccountGitHub,
	routeAccountGitHubAuthorizeURL,
	routeAccountGitHubSignIn,
	routeAccountGitHubSignOut,
	routeAirdropClaim,
	routeAirdropList,
	routeDebugBindings,
	routeDebugMinter,
	routeRoot,
} from './routes';

export const app = new Hono<{ Bindings: Environment }>();

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

app.get('/', routeRoot);
app.get('/debug/minter', routeDebugMinter);
app.get('/debug/bindings', routeDebugBindings);
app.get('/account/github', routeAccountGitHub);
app.get('/account/github/authorize_url', routeAccountGitHubAuthorizeURL);
app.post('/account/github/sign_out', routeAccountGitHubSignOut);
app.post('/account/github/sign_in', routeAccountGitHubSignIn);
app.post('/airdrop/claim', routeAirdropClaim);
app.get('/airdrop/list', routeAirdropList);
