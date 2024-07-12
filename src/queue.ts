import { Web3 } from 'web3';
import { Bindings, GNOSIS_ENDPOINT, NFTS } from './config';
import { createDatabase } from './database';
import { YGTOG } from '@yankeguo/ygtog';
import { tAirdrops } from './schema';
import { eq } from 'drizzle-orm/sqlite-core/expressions';

export async function queueAirdropMint(env: Bindings, ctx: ExecutionContext, args: { airdrop_id: string }): Promise<void> {
	const web3 = new Web3(GNOSIS_ENDPOINT);
	const minter = web3.eth.accounts.wallet.add(env.MINTER_PRIVATE_KEY).at(0)!;

	const contract = new web3.eth.Contract(YGTOG.contract.abi, YGTOG.contract.address, web3);

	const db = createDatabase(env.DB_AIRDROP);

	const record = await db.query.tAirdrops.findFirst({ where: eq(tAirdrops.id, args.airdrop_id) });

	if (!record) {
		console.log('Airdrop not found', args.airdrop_id);
		return;
	}

	if (record.is_minted) {
		console.log('Airdrop already minted', args.airdrop_id);
		return;
	}

	if (!record.is_claimed) {
		console.log('Airdrop not claimed', args.airdrop_id);
		return;
	}

	if (!record.claim_address) {
		console.log('Airdrop missing claim address', args.airdrop_id);
		return;
	}

	const nft = NFTS.find((item) => item.id == record.nft_id);

	if (!nft) {
		console.log('NFT not found', record.nft_id);
		return;
	}

	const tx = await contract.methods.mint(record.claim_address, BigInt(nft.token), 1, '0x').send({ from: minter.address });

	await db
		.update(tAirdrops)
		.set({
			is_minted: 1,
			minted_at: Date.now() / 1000,
			mint_tx: tx.transactionHash,
		})
		.where(eq(tAirdrops.id, record.id));

	console.log('Minted airdrop', record.id);

	return;
}
