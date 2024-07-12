import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';

export const tAirdrops = sqliteTable(
	'airdrops',
	{
		// id format: 'nft_id::user_id', e.g. 'github_follower_2024::github::123456'
		id: text('id').primaryKey(),
		// user id format: 'account_vendor::account_id', e.g. 'github::123456'
		user_id: text('user_id').notNull(),
		// nft_id is the id of the NFT, e.g. 'github_follower_2024'
		nft_id: text('nft_id').notNull(),
		// eligible stage
		is_eligible: integer('is_eligible').default(0).notNull(),
		eligible_at: integer('eligible_at'),
		// claim stage
		is_claimed: integer('is_claimed').default(0).notNull(),
		claimed_at: integer('claimed_at'),
		claim_address: text('claim_address'),
		// mint stage
		is_minted: integer('is_minted').default(0).notNull(),
		minted_at: integer('minted_at'),
		mint_tx: text('mint_tx'),
	},
	(table) => {
		return {
			idx_user_id: index('idx_airdrops_user_id').on(table.user_id),
			idx_nft_id: index('idx_airdrops_nft_id').on(table.nft_id),
			idx_is_eligible: index('idx_airdrops_is_eligible').on(table.is_eligible),
			idx_eligible_at: index('idx_airdrops_eligible_at').on(table.eligible_at),
			idx_is_claimed: index('idx_airdrops_is_claimed').on(table.is_claimed),
			idx_claimed_at: index('idx_airdrops_claimed_at').on(table.claimed_at),
			idx_is_minted: index('idx_airdrops_is_minted').on(table.is_minted),
			idx_minted_at: index('idx_airdrops_minted_at').on(table.minted_at),
		};
	},
);
