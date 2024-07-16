import { Web3 } from 'web3';
import { isAddress as isEthereumAddress } from 'web3-validator';
import { Environment, ENVIRONMENT_KEYS, NFTS, OWNER_GITHUB_USERNAME, RPC_ENDPOINTS, WEBSITES } from './config';
import { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { tAirdrops } from './schema';
import {
	sessionLoad,
	raise400,
	raise500,
	randomHex,
	githubCreateAuthorizeURL,
	sessionSave,
	sessionClear,
	githubCreateAccessToken,
	githubGetUser,
	githubCheckIsFollowing,
	airdropMarkEligible,
	useDatabase,
	githubCreateUserID,
} from './utility';
import TwitterApi from 'twitter-api-v2';

type RouteFn = (c: Context<{ Bindings: Environment }>) => Promise<Response>;

export const routeRoot: RouteFn = async (c) => {
	return c.json({ message: 'Hello World!' });
};

export const routeDebugMinter: RouteFn = async (c) => {
	const endpoint = RPC_ENDPOINTS['gnosis'] ?? raise500('missing gnosis endpoint');
	const web3 = new Web3(endpoint);
	const wallet = web3.eth.accounts.wallet.add(c.env.MINTER_PRIVATE_KEY);
	const address = wallet.at(0)?.address;

	return c.json({
		address,
	});
};

export const routeDebugBindings: RouteFn = async (c) => {
	const bindings: Record<string, any> = {};

	for (const key of ENVIRONMENT_KEYS) {
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
};

const SESSION_KEY_GITHUB = '_github';

const SESSION_KEY_GITHUB_STATE = '_github_state';

interface GitHubAccount {
	id: string;
	username: string;
}

export const routeAccountGitHub: RouteFn = async (c) => {
	const account = await sessionLoad<GitHubAccount>(c, SESSION_KEY_GITHUB);
	return c.json(
		account ?? {
			id: '',
			username: '',
		},
	);
};

const SESSION_KEY_TWITTER_STATE = '_twitter_state';

interface TwitterState {
	codeVerifier: string;
	state: string;
}

export const routeAccountTwitterAuthorizeURL: RouteFn = async (c) => {
	const website = WEBSITES.find((w) => w.host === c.req.query('host')) ?? raise400('invalid host');
	const clientId = (c.env[website.keys.TWITTER_CLIENT_ID] as string) ?? raise500('missing TWITTER_CLIENT_ID');
	const clientSecret = (c.env[website.keys.TWITTER_CLIENT_SECRET] as string) ?? raise500('missing TWITTER_CLIENT_SECRET');
	const client = new TwitterApi({ clientId, clientSecret });
	const { url, codeVerifier, state } = client.generateOAuth2AuthLink(`${website.url}/oauth/twitter/callback`, {
		scope: ['tweet.read', 'follows.read', 'users.read'],
	});
	await sessionSave(c, SESSION_KEY_TWITTER_STATE, { codeVerifier, state }, 600);
	return c.json({ url });
};

export const routeAccountGitHubAuthorizeURL: RouteFn = async (c) => {
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
};

export const routeAccountGitHubSignOut: RouteFn = async (c) => {
	sessionClear(c, SESSION_KEY_GITHUB);
	return c.json({ success: true });
};

export const routeAccountGitHubSignIn: RouteFn = async (c) => {
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
};

async function collectSignedUserIds(c: Context<{ Bindings: Environment }>) {
	const userIds: string[] = [];

	// load github user id
	const account = await sessionLoad<GitHubAccount>(c, SESSION_KEY_GITHUB);
	if (account) {
		userIds.push(githubCreateUserID(account.id));
	}

	return userIds;
}

export const routeAirdropClaim: RouteFn = async (c) => {
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
};

export const routeAirdropList: RouteFn = async (c) => {
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
};
