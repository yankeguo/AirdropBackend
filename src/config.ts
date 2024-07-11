import { CookieOptions } from 'hono/utils/cookie';

export type Bindings = {
	SECRET_KEY: string;

	GITHUB_DEV_CLIENT_ID: string;
	GITHUB_DEV_CLIENT_SECRET: string;
	GITHUB_PREVIEW_CLIENT_ID: string;
	GITHUB_PREVIEW_CLIENT_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;

	DB_AIRDROP: D1Database;
};

type BindingsKey = keyof Bindings;

export const BINDING_KEYS: BindingsKey[] = [
	'SECRET_KEY',
	'GITHUB_DEV_CLIENT_ID',
	'GITHUB_DEV_CLIENT_SECRET',
	'GITHUB_PREVIEW_CLIENT_ID',
	'GITHUB_PREVIEW_CLIENT_SECRET',
	'GITHUB_CLIENT_ID',
	'GITHUB_CLIENT_SECRET',
	'DB_AIRDROP',
];

export interface Website {
	url: string;
	host: string;
	keys: {
		GITHUB_CLIENT_ID: BindingsKey;
		GITHUB_CLIENT_SECRET: BindingsKey;
	};
}

export const WEBSITES: Website[] = [
	{
		url: 'http://localhost:3000',
		host: 'localhost:3000',
		keys: {
			GITHUB_CLIENT_ID: 'GITHUB_DEV_CLIENT_ID',
			GITHUB_CLIENT_SECRET: 'GITHUB_DEV_CLIENT_SECRET',
		},
	},
	{
		url: 'https://airdrop-preview.yankeguo.com',
		host: 'airdrop-preview.yankeguo.com',
		keys: {
			GITHUB_CLIENT_ID: 'GITHUB_PREVIEW_CLIENT_ID',
			GITHUB_CLIENT_SECRET: 'GITHUB_PREVIEW_CLIENT_SECRET',
		},
	},
	{
		url: 'https://airdrop.yankeguo.com',
		host: 'airdrop.yankeguo.com',
		keys: {
			GITHUB_CLIENT_ID: 'GITHUB_CLIENT_ID',
			GITHUB_CLIENT_SECRET: 'GITHUB_CLIENT_SECRET',
		},
	},
];

export const DEFAULT_SESSION_AGE = 3600 * 24 * 3;

export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
	path: '/',
	maxAge: DEFAULT_SESSION_AGE,
	httpOnly: true,
	secure: true,
	partitioned: true,
	sameSite: 'None',
};
