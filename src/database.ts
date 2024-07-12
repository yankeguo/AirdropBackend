import { drizzle } from 'drizzle-orm/d1';
import { Bindings } from './config';
import { tAirdrops } from './schema';
import { Context } from 'hono';

export function useDatabase(c: Context<{ Bindings: Bindings }>) {
	return drizzle(c.env.DB_AIRDROP, { schema: { tAirdrops } });
}
