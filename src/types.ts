import { YGTOG } from '@yankeguo/ygtog';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { tAirdrops } from './schema';
import { Context, Input } from 'hono';
import { CookieOptions } from 'hono/utils/cookie';

export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
	path: '/',
	maxAge: 3600 * 24 * 3,
	httpOnly: true,
	secure: true,
	partitioned: true,
	sameSite: 'None',
};

export type AirdropDrizzleDatabase = DrizzleD1Database<{ tAirdrops: typeof tAirdrops }>;

export type Bindings = {
	DEBUG_KEY: string;

	SECRET_KEY: string;

	GITHUB_DEV_CLIENT_ID: string;
	GITHUB_DEV_CLIENT_SECRET: string;
	GITHUB_PREVIEW_CLIENT_ID: string;
	GITHUB_PREVIEW_CLIENT_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;

	TWITTER_CLIENT_ID: string;
	TWITTER_CLIENT_SECRET: string;

	MINTER_PRIVATE_KEY: string;

	RPC_ENDPOINT_GNOSIS: string;

	DB_AIRDROP: D1Database;
	QUEUE_AIRDROP_MINT: Queue<{ airdrop_id: string }>;
};

export const BINDINGS_KEYS: (keyof Bindings)[] = [
	'DEBUG_KEY',
	'SECRET_KEY',
	'GITHUB_DEV_CLIENT_ID',
	'GITHUB_DEV_CLIENT_SECRET',
	'GITHUB_PREVIEW_CLIENT_ID',
	'GITHUB_PREVIEW_CLIENT_SECRET',
	'GITHUB_CLIENT_ID',
	'GITHUB_CLIENT_SECRET',
	'TWITTER_CLIENT_ID',
	'TWITTER_CLIENT_SECRET',
	'DB_AIRDROP',
	'MINTER_PRIVATE_KEY',
	'QUEUE_AIRDROP_MINT',
	'RPC_ENDPOINT_GNOSIS',
];

export type Session = {
	now?: number;
	github?: {
		id?: string;
		username?: string;
	};
	github_state?: string;
	twitter?: {
		id?: string;
		username?: string;
	};
	twitter_state?: {
		code_challenge?: string;
		state?: string;
	};
};

export type Variables = {
	db: AirdropDrizzleDatabase;
	session: Session;
};

export type AirdropHonoContext<P extends string = any, I extends Input = {}> = Context<{ Bindings: Bindings; Variables: Variables }, P, I>;

export type AirdropHonoRoute = (c: AirdropHonoContext) => Promise<Response>;

export interface Website {
	url: string;
	host: string;
	keys: {
		GITHUB_CLIENT_ID: keyof Bindings;
		GITHUB_CLIENT_SECRET: keyof Bindings;
		TWITTER_CLIENT_ID: keyof Bindings;
		TWITTER_CLIENT_SECRET: keyof Bindings;
	};
}

export const WEBSITES: Website[] = [
	{
		url: 'http://localhost:3000',
		host: 'localhost:3000',
		keys: {
			GITHUB_CLIENT_ID: 'GITHUB_DEV_CLIENT_ID',
			GITHUB_CLIENT_SECRET: 'GITHUB_DEV_CLIENT_SECRET',
			TWITTER_CLIENT_ID: 'TWITTER_CLIENT_ID',
			TWITTER_CLIENT_SECRET: 'TWITTER_CLIENT_SECRET',
		},
	},
	{
		url: 'https://airdrop-preview.yankeguo.com',
		host: 'airdrop-preview.yankeguo.com',
		keys: {
			GITHUB_CLIENT_ID: 'GITHUB_PREVIEW_CLIENT_ID',
			GITHUB_CLIENT_SECRET: 'GITHUB_PREVIEW_CLIENT_SECRET',
			TWITTER_CLIENT_ID: 'TWITTER_CLIENT_ID',
			TWITTER_CLIENT_SECRET: 'TWITTER_CLIENT_SECRET',
		},
	},
	{
		url: 'https://airdrop.yankeguo.com',
		host: 'airdrop.yankeguo.com',
		keys: {
			GITHUB_CLIENT_ID: 'GITHUB_CLIENT_ID',
			GITHUB_CLIENT_SECRET: 'GITHUB_CLIENT_SECRET',
			TWITTER_CLIENT_ID: 'TWITTER_CLIENT_ID',
			TWITTER_CLIENT_SECRET: 'TWITTER_CLIENT_SECRET',
		},
	},
];

export const OWNER_GITHUB_USERNAME = 'yankeguo';

export const OWNER_TWITTER_USERNAME = 'yankeguo';

export interface NFT {
	// id, a meaningful string (off-chain)
	id: string;
	// chain, the chain name
	chain: string;
	// standard
	standard: string;
	// contract, the contract address, format of '0x...'
	contract: string;
	// token, the token id, decimal string, format of '12345'
	token: string;
	// name, the name of the NFT
	name: string;
	// description, the description of the NFT
	description: string;
	// helper
	helper: string;
	// image, the image url
	image: string;
}

export const NFTS: NFT[] = YGTOG.items
	.filter((item) => !item.hidden)
	.map((item) => {
		return {
			id: item.key,
			chain: YGTOG.contract.chain,
			standard: YGTOG.contract.standard,
			contract: YGTOG.contract.address,
			token: item.id.toString(),
			name: item.metadata.name,
			description: item.metadata.description,
			helper: item.helper,
			image: item.metadata.image,
		};
	});

export const QUEUE_NAME_AIRDROP_MINT = 'airdrop-mint';
