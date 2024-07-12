import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, BINDING_KEYS, WEBSITES, OWNER_GITHUB_USERNAME, NFTS, GNOSIS_ENDPOINT, QUEUE_NAME_AIRDROP_MINT } from './config';
import { sessionClear, sessionLoad, sessionSave } from './session';
import { raise400, raise500 } from './error';
import { HTTPException } from 'hono/http-exception';
import { randomHex } from './crypto';
import { githubCheckIsFollowing, githubCreateAccessToken, githubCreateAuthorizeURL, githubCreateUserID, githubGetUser } from './github';
import { airdropMarkEligible, useDatabase } from './database';
import { tAirdrops } from './schema';
import { eq } from 'drizzle-orm/sqlite-core/expressions';
import { isAddress as isEthereumAddress } from 'web3-validator';
import { Web3 } from 'web3';
import { queueAirdropMint } from './queue';

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

app.get('/debug/minter', async (c) => {
	const web3 = new Web3(GNOSIS_ENDPOINT);
	const wallet = web3.eth.accounts.wallet.add(c.env.MINTER_PRIVATE_KEY);
	const address = wallet.at(0)?.address;

	return c.json({
		address,
	});
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

	if (is_following) {
		const nftId = `github_follower_${new Date().getFullYear()}`;

		await airdropMarkEligible(useDatabase(c), nftId, githubCreateUserID(id.toString()));
	}

	await sessionSave(c, SESSION_KEY_GITHUB, { id: id.toString(), username: login });

	return c.json({ success: true });
});

async function collectSignedUserIds(c: Context<{ Bindings: Bindings }>) {
	const userIds: string[] = [];

	// load github user id
	const account = await sessionLoad<GitHubAccount>(c, SESSION_KEY_GITHUB);
	if (account) {
		userIds.push(githubCreateUserID(account.id));
	}

	return userIds;
}

app.post('/airdrop/claim', async (c) => {
	const { nft_id, address } = (await c.req.json()) as { nft_id: string; address: string };
	if (typeof nft_id !== 'string' || !nft_id) {
		raise400('invalid nft_id');
	}
	if (typeof address !== 'string' || !address || !isEthereumAddress(address)) {
		raise400('invalid address');
	}

	const userIds = await collectSignedUserIds(c);

	if (userIds.length === 0) {
		raise400('no signed in user');
	}

	const db = useDatabase(c);

	const airdrop = await db.query.tAirdrops.findFirst({
		where: (airdrops, { eq, and, inArray }) => {
			return and(eq(airdrops.nft_id, nft_id), inArray(airdrops.user_id, userIds), eq(airdrops.is_eligible, 1), eq(airdrops.is_claimed, 0));
		},
	});

	if (!airdrop) {
		raise400('not eligible or already claimed');
	}

	await db
		.update(tAirdrops)
		.set({
			is_claimed: 1,
			claimed_at: Date.now() / 1000,
			claim_address: address,
		})
		.where(eq(tAirdrops.id, airdrop.id));

	await c.env.QUEUE_AIRDROP_MINT.send({ airdrop_id: airdrop.id });

	return c.json({ success: true });
});

app.get('/airdrop/list', async (c) => {
	const userIds = await collectSignedUserIds(c);

	const db = useDatabase(c);

	const records = userIds.length
		? await db.query.tAirdrops.findMany({
				where: (users, { inArray }) => inArray(users.user_id, userIds),
			})
		: [];

	const result = NFTS.map((nft) => {
		let is_eligible = false;
		let eligible_at: number | null = null;
		let is_claimed = false;
		let claimed_at: number | null = null;
		let claim_address: string | null = null;
		let is_minted = false;
		let minted_at: number | null = null;
		let mint_tx: string | null = null;

		for (const record of records) {
			if (record.nft_id !== nft.id) {
				continue;
			}
			if (record.is_eligible) {
				is_eligible = true;
				eligible_at = record.eligible_at;
			}
			if (record.is_claimed) {
				is_claimed = true;
				claimed_at = record.claimed_at;
				claim_address = record.claim_address;
			}
			if (record.is_minted) {
				is_minted = true;
				minted_at = record.minted_at;
				mint_tx = record.mint_tx;
			}
		}

		return {
			...nft,
			is_eligible,
			eligible_at,
			is_claimed,
			claimed_at,
			claim_address,
			is_minted,
			minted_at,
			mint_tx,
		};
	});

	return c.json(result);
});

export default {
	async fetch(req: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(req, env, ctx);
	},

	scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {},

	async queue(batch: MessageBatch, env: Bindings, ctx: ExecutionContext): Promise<void> {
		const fn: (env: Bindings, ctx: ExecutionContext, args: any) => Promise<void> = (function () {
			switch (batch.queue) {
				case QUEUE_NAME_AIRDROP_MINT:
					return queueAirdropMint;
				default:
					throw new Error('unknown queue');
			}
		})();

		for (const msg of batch.messages) {
			try {
				await fn(env, ctx, msg.body);
				msg.ack();
			} catch (e) {
				console.error(e);
				msg.retry();
			}
		}
	},
};
