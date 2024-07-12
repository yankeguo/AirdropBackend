import { Bindings } from './config';
import { createDatabase } from './database';

export async function scheduleMintAirdrops(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
	const db = createDatabase(env.DB_AIRDROP);

	const records = await db.query.tAirdrops.findMany({
		where: (airdrops, { eq, and }) => and(eq(airdrops.is_minted, 0), eq(airdrops.is_claimed, 1)),
	});

	for (const record of records) {
		console.log('Minting airdrop', record.id);
	}
}
