import { Web3 } from 'web3';
import { isAddress as isEthereumAddress } from 'web3-validator';
import { Environment, ENVIRONMENT_KEYS, NFTS, OWNER_GITHUB_USERNAME } from './config';
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
	twitterCreateAuthorizeURL,
	twitterCreateAccessToken,
	twitterGetUser,
	twitterCreateUserID,
	rpcEndpointFromEnv,
	websiteOptionsFromEnv,
} from './utility';

type RouteAction = (c: Context<{ Bindings: Environment }>) => Promise<Response>;

interface GitHubState {
	state: string;
}

interface GitHubAccount {
	id: string;
	username: string;
}

interface TwitterState {
	code_challenge: string;
	state: string;
}

interface TwitterAccount {
	id: string;
	username: string;
}

const SESSION_KEY_GITHUB = '_github';

const SESSION_KEY_GITHUB_STATE = '_github_state';

const SESSION_KEY_TWITTER = '_twitter';

const SESSION_KEY_TWITTER_STATE = '_twitter_state';

export const routeRoot: RouteAction = async (c) => {
	return c.json({ message: 'Hello World!' });
};

export const routeDebugMinter: RouteAction = async (c) => {
	if (c.env.DEBUG_KEY !== c.req.query('key')) {
		return raise400('invalid key');
	}

	const endpoint = rpcEndpointFromEnv(c.env, 'gnosis') ?? raise500('missing RPC_ENDPOINT_GNOSIS');
	const web3 = new Web3(endpoint);
	const wallet = web3.eth.accounts.wallet.add(c.env.MINTER_PRIVATE_KEY);
	const address = wallet.at(0)?.address!;

	const balance = await web3.eth.getBalance(address);

	return c.json({
		address,
		balance: balance.toString(),
	});
};

export const routeDebugBindings: RouteAction = async (c) => {
	if (c.env.DEBUG_KEY !== c.req.query('key')) {
		return raise400('invalid key');
	}

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

export const routeAccountGitHub: RouteAction = async (c) => {
	const account = await sessionLoad<GitHubAccount>(c, SESSION_KEY_GITHUB);
	return c.json(
		account ?? {
			id: '',
			username: '',
		},
	);
};

export const routeAccountGitHubAuthorizeURL: RouteAction = async (c) => {
	const website = websiteOptionsFromEnv(c.env, c.req.query('host') ?? 'none');

	const redirect_uri = `${website.url}/oauth/github/callback`;
	const state = randomHex(8);

	const url = githubCreateAuthorizeURL({
		client_id: website.github.clientId,
		redirect_uri,
		state,
	});

	await sessionSave(c, SESSION_KEY_GITHUB_STATE, { state }, 600);

	return c.json({ url });
};

export const routeAccountGitHubSignOut: RouteAction = async (c) => {
	sessionClear(c, SESSION_KEY_GITHUB);
	return c.json({ success: true });
};

export const routeAccountGitHubSignIn: RouteAction = async (c) => {
	const data = (await c.req.json()) ?? {};

	const website = websiteOptionsFromEnv(c.env, data.host ?? 'none');

	const state = data.state ?? raise400('missing state');
	const code = data.code ?? raise400('missing code');
	const redirect_uri = data.redirect_uri ?? raise400('missing redirect_uri');

	const ss = (await sessionLoad<GitHubState>(c, SESSION_KEY_GITHUB_STATE)) ?? raise400('missing session state');

	if (state !== ss.state) {
		return raise400('invalid state');
	}

	const access_token = await githubCreateAccessToken({
		client_id: website.github.clientId,
		client_secret: website.github.clientSecret,
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

export const routeAccountTwitter: RouteAction = async (c) => {
	const account = await sessionLoad<TwitterAccount>(c, SESSION_KEY_TWITTER);
	return c.json(
		account ?? {
			id: '',
			username: '',
		},
	);
};

export const routeAccountTwitterAuthorizeURL: RouteAction = async (c) => {
	const website = websiteOptionsFromEnv(c.env, c.req.query('host') ?? 'none');
	const state = randomHex(16);
	const code_challenge = randomHex(16);

	const url = twitterCreateAuthorizeURL({
		client_id: website.twitter.clientId,
		redirect_uri: `${website.url}/oauth/twitter/callback`,
		scope: ['tweet.read', 'users.read', 'follows.read'],
		state,
		code_challenge,
	});

	await sessionSave(c, SESSION_KEY_TWITTER_STATE, { code_challenge, state }, 600);
	return c.json({ url });
};

export const routeAccountTwitterSignIn: RouteAction = async (c) => {
	const data = (await c.req.json()) ?? {};

	// data.host, data.state, data.code, data.redirect_uri

	const website = websiteOptionsFromEnv(c.env, data.host ?? 'none');

	const ss = (await sessionLoad<TwitterState>(c, SESSION_KEY_TWITTER_STATE)) ?? raise400('missing session state');

	if (ss.state !== data.state) {
		return raise400('invalid state');
	}

	if (!ss.code_challenge) {
		return raise400('missing code_challenge');
	}

	const access_token = await twitterCreateAccessToken({
		client_id: website.twitter.clientId,
		client_secret: website.twitter.clientSecret,
		redirect_uri: data.redirect_uri,
		code: data.code,
		code_verifier: ss.code_challenge,
	});

	const user = await twitterGetUser(access_token);

	await sessionSave(c, SESSION_KEY_TWITTER, { id: user.id, username: user.username });

	// twitter is charging damn 100 bucks a month for checking if a user is following another user

	/*
	const is_following = await twitterCheckIsFollowing(access_token, OWNER_TWITTER_USERNAME);

	if (is_following) {
		const nft_id = `twitter_follower_${new Date().getFullYear()}`;

		await airdropMarkEligible(useDatabase(c), nft_id, twitterCreateUserID(user.id));
	}
	*/

	return c.json({ success: true });
};

export const routeAccountTwitterSignOut: RouteAction = async (c) => {
	sessionClear(c, SESSION_KEY_TWITTER);
	return c.json({ success: true });
};

async function collectSignedUserIds(c: Context<{ Bindings: Environment }>) {
	const userIds: string[] = [];

	// load github user id
	{
		const account = await sessionLoad<GitHubAccount>(c, SESSION_KEY_GITHUB);
		if (account && account.id) {
			userIds.push(githubCreateUserID(account.id));
		}
	}

	// load twitter user id
	{
		const account = await sessionLoad<TwitterAccount>(c, SESSION_KEY_TWITTER);
		if (account && account.id) {
			userIds.push(twitterCreateUserID(account.id));
		}
	}

	return userIds;
}

export const routeAirdropClaim: RouteAction = async (c) => {
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

export const routeAirdropList: RouteAction = async (c) => {
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
