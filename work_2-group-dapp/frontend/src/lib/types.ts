export type Campaign = {
  id: bigint;
  creator: string;
  title: string;
  description: string;
  metadataURI: string;
  targetAmount: bigint;
  deadline: bigint;
  amountRaised: bigint;
  cancelled: boolean;
  fundsClaimed: boolean;
};

export type CampaignView = Campaign & {
  status: string;
  progress: number;
  targetEth: string;
  raisedEth: string;
  deadlineLabel: string;
};

export type TransactionItem = {
  type: string;
  name: string;
  date: string;
  amount: string;
  positive: boolean;
  tone: 'blue' | 'green' | 'purple' | 'dark';
};

export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
