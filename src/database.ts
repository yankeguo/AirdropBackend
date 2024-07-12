import { drizzle } from 'drizzle-orm/d1';
import { Bindings } from './config';
import { tAirdrops } from './schema';
import { Context } from 'hono';

export function useDatabase(c: Context<{ Bindings: Bindings }>) {
	return drizzle(c.env.DB_AIRDROP, { schema: { tAirdrops } });
}

export async function airdropMarkEligible(db: ReturnType<typeof useDatabase>, nftId: string, userId: string) {
	const id = `${nftId}::${userId}`;

	await db
		.insert(tAirdrops)
		.values({
			id,
			nft_id: nftId,
			user_id: userId,
			is_eligible: 1,
			eligible_at: Date.now() / 1000,
		})
		.onConflictDoNothing();
}
