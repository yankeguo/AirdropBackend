import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';

export const tFollowers = sqliteTable(
	'followers',
	{
		// id format: vendor::owner_id::follower_id
		id: text('id').primaryKey(),
		vendor: text('vendor').notNull(),
		owner_id: text('owner_id').notNull(),
		follower_id: text('follower_id').notNull(),
		created_at: integer('created_at').notNull(),
	},
	(table) => {
		return {
			vendor_idx: index('idx_followers_vendor').on(table.vendor),
			owner_id_idx: index('idx_followers_owner_id').on(table.owner_id),
			follower_id_idx: index('idx_followers_follower_id').on(table.follower_id),
			created_at_idx: index('idx_followers_created_at').on(table.created_at),
		};
	},
);
