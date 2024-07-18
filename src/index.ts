import { Bindings } from './types';
import { app } from './fetch';
import { QUEUES } from './queue';

export default {
	fetch: app.fetch,

	scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {},

	async queue(batch: MessageBatch, env: Bindings, ctx: ExecutionContext): Promise<void> {
		const fn = QUEUES[batch.queue];

		if (!fn) {
			throw new Error(`queue ${batch.queue} not found`);
		}

		for (const msg of batch.messages) {
			try {
				await fn(env, ctx, msg.body);
				msg.ack();
			} catch (e) {
				console.error(e);
				msg.retry();
			}
		}
	},
};
