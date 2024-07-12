CREATE TABLE `airdrops` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nft_id` text NOT NULL,
	`is_eligible` integer DEFAULT 0 NOT NULL,
	`eligible_at` integer,
	`is_claimed` integer DEFAULT 0 NOT NULL,
	`claimed_at` integer,
	`claim_address` text,
	`is_minted` integer DEFAULT 0 NOT NULL,
	`minted_at` integer,
	`mint_tx` text
);
--> statement-breakpoint
CREATE INDEX `idx_airdrops_user_id` ON `airdrops` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_airdrops_nft_id` ON `airdrops` (`nft_id`);--> statement-breakpoint
CREATE INDEX `idx_airdrops_is_eligible` ON `airdrops` (`is_eligible`);--> statement-breakpoint
CREATE INDEX `idx_airdrops_eligible_at` ON `airdrops` (`eligible_at`);--> statement-breakpoint
CREATE INDEX `idx_airdrops_is_claimed` ON `airdrops` (`is_claimed`);--> statement-breakpoint
CREATE INDEX `idx_airdrops_claimed_at` ON `airdrops` (`claimed_at`);--> statement-breakpoint
CREATE INDEX `idx_airdrops_is_minted` ON `airdrops` (`is_minted`);--> statement-breakpoint
CREATE INDEX `idx_airdrops_minted_at` ON `airdrops` (`minted_at`);