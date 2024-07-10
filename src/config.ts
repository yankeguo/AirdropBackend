import { CookieOptions } from 'hono/utils/cookie';

export type Bindings = {
	SECRET_KEY: string;
	KV_NONCE_DEDUP: KVNamespace;
};

/*
 * CORS origins
 */
export const CORS_ORIGINS = ['http://localhost:3000', 'https://drop.yankeguo.com', 'https://drop-preview.yankeguo.com'];

/**
 * default cookie options for cross-origin requests
 */
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
	path: '/',
	maxAge: 3600 * 24 * 3,
	httpOnly: true,
	secure: true,
	partitioned: true,
	sameSite: 'None',
};
