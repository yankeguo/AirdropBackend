import { YGTOG } from '@yankeguo/ygtog';

export type Environment = {
	SECRET_KEY: string;

	GITHUB_DEV_CLIENT_ID: string;
	GITHUB_DEV_CLIENT_SECRET: string;
	GITHUB_PREVIEW_CLIENT_ID: string;
	GITHUB_PREVIEW_CLIENT_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;

	MINTER_PRIVATE_KEY: string;

	DB_AIRDROP: D1Database;
	QUEUE_AIRDROP_MINT: Queue<{ airdrop_id: string }>;
};

type EnvironmentKey = keyof Environment;

export const ENVIRONMENT_KEYS: EnvironmentKey[] = [
	'SECRET_KEY',
	'GITHUB_DEV_CLIENT_ID',
	'GITHUB_DEV_CLIENT_SECRET',
	'GITHUB_PREVIEW_CLIENT_ID',
	'GITHUB_PREVIEW_CLIENT_SECRET',
	'GITHUB_CLIENT_ID',
	'GITHUB_CLIENT_SECRET',
	'DB_AIRDROP',
	'MINTER_PRIVATE_KEY',
	'QUEUE_AIRDROP_MINT',
];

export interface Website {
	url: string;
	host: string;
	keys: {
		GITHUB_CLIENT_ID: EnvironmentKey;
		GITHUB_CLIENT_SECRET: EnvironmentKey;
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

export const OWNER_GITHUB_USERNAME = 'yankeguo';

export interface NFT {
	// id, a meaningful string (off-chain)
	id: string;
	// chain, the chain name
	chain: string;
	// standard
	standard: string;
	// contract, the contract address, format of '0x...'
	contract: string;
	// token, the token id, decimal string, format of '12345'
	token: string;
	// name, the name of the NFT
	name: string;
	// description, the description of the NFT
	description: string;
	// helper
	helper: string;
	// image, the image url
	image: string;
}

export const NFTS: NFT[] = YGTOG.items.map((item) => {
	return {
		id: item.key,
		chain: YGTOG.contract.chain,
		standard: YGTOG.contract.standard,
		contract: YGTOG.contract.address,
		token: item.id.toString(),
		name: item.metadata.name,
		description: item.metadata.description,
		helper: item.helper,
		image: item.metadata.image,
	};
});

export const RPC_ENDPOINTS: Record<string, string> = {
	gnosis: 'https://rpc.gnosischain.com',
};

export const QUEUE_NAME_AIRDROP_MINT = 'airdrop-mint';
