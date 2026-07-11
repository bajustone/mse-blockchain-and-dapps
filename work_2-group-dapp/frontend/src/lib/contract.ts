import { BrowserProvider, Contract, JsonRpcProvider, ethers } from 'ethers';
import { browser } from '$app/environment';
import artifact from '../contracts/CrowdfundingPlatform.json';
import deployment from '../contracts/deployment.json';
import type { Campaign, CampaignView, EthereumProvider, TransactionItem } from './types';

const LOCAL_RPC_URL = 'http://127.0.0.1:8545';
const LOCAL_CHAIN_ID = 31337n;
const SEPOLIA_CHAIN_ID = 11155111n;

function expectedChainId() {
  return CONTRACT_NETWORK === 'sepolia' ? SEPOLIA_CHAIN_ID : LOCAL_CHAIN_ID;
}

function expectedNetworkLabel() {
  return CONTRACT_NETWORK === 'sepolia' ? 'Sepolia' : 'Localhost 8545 / chain 31337';
}

export const CONTRACT_ADDRESS = deployment.address ?? '';
export const CONTRACT_NETWORK = deployment.network ?? 'localhost';
export const CONTRACT_ABI = artifact.abi;

export function hasContractAddress() {
  return typeof CONTRACT_ADDRESS === 'string' && ethers.isAddress(CONTRACT_ADDRESS);
}

export function shortAddress(address: string) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatEth(value: bigint | string | number) {
  const formatted = ethers.formatEther(value);
  const [whole, fraction = ''] = formatted.split('.');
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export function formatCurrencyEth(value: bigint) {
  return `${formatEth(value)} ETH`;
}

export function getDeadlineLabel(deadline: bigint) {
  const date = new Date(Number(deadline) * 1000);
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
}

export function toCampaignView(campaign: Campaign, status: string): CampaignView {
  const progress = campaign.targetAmount === 0n
    ? 0
    : Math.min(100, Number((campaign.amountRaised * 10000n) / campaign.targetAmount) / 100);

  return {
    ...campaign,
    status,
    progress,
    targetEth: formatCurrencyEth(campaign.targetAmount),
    raisedEth: formatCurrencyEth(campaign.amountRaised),
    deadlineLabel: getDeadlineLabel(campaign.deadline)
  };
}

function normalizeCampaign(raw: readonly unknown[]): Campaign {
  return {
    id: BigInt(raw[0] as bigint),
    creator: String(raw[1]),
    title: String(raw[2]),
    description: String(raw[3]),
    metadataURI: String(raw[4]),
    targetAmount: BigInt(raw[5] as bigint),
    deadline: BigInt(raw[6] as bigint),
    amountRaised: BigInt(raw[7] as bigint),
    cancelled: Boolean(raw[8]),
    fundsClaimed: Boolean(raw[9])
  };
}

export async function getReadOnlyContract() {
  if (!hasContractAddress()) return null;

  if (browser) {
    if (!window.ethereum) {
      throw new Error('No browser wallet detected. Showing demo data until MetaMask is connected.');
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const expected = expectedChainId();

    if (network.chainId !== expected) {
      throw new Error(
        `Wallet is on chain ${network.chainId}, but this frontend is configured for ${expectedNetworkLabel()}. ` +
          'Switch MetaMask networks, then refresh campaigns.'
      );
    }

    return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }

  const provider = new JsonRpcProvider(LOCAL_RPC_URL);
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export async function getWritableContract() {
  if (!browser || !window.ethereum) {
    throw new Error('MetaMask or another EIP-1193 wallet is required.');
  }

  if (!hasContractAddress()) {
    throw new Error('Contract address is missing. Run the local full-stack test or deploy first.');
  }

  const provider = new BrowserProvider(window.ethereum as EthereumProvider);
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

export async function connectWallet() {
  if (!browser || !window.ethereum) {
    throw new Error('MetaMask was not detected. Install MetaMask and connect to localhost or Sepolia.');
  }

  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();

  return {
    address: await signer.getAddress(),
    chainId: network.chainId,
    networkName: network.name
  };
}

export async function ensureExpectedNetwork() {
  if (!browser || !window.ethereum) return;

  const chainId = expectedChainId();
  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  if (network.chainId === chainId) return;

  const hexChainId = `0x${chainId.toString(16)}`;
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: hexChainId }]
  });
}

export async function loadCampaigns(limit = 6): Promise<CampaignView[]> {
  const contract = await getReadOnlyContract();
  if (!contract) return [];

  const count = BigInt(await contract.campaignCount());
  const campaigns: CampaignView[] = [];
  const start = count > BigInt(limit) ? count - BigInt(limit) + 1n : 1n;

  for (let id = count; id >= start && id > 0n; id -= 1n) {
    const [rawCampaign, status] = await Promise.all([
      contract.getCampaign(id),
      contract.getCampaignStatus(id)
    ]);
    campaigns.push(toCampaignView(normalizeCampaign(rawCampaign), String(status)));
  }

  return campaigns;
}

type ChainEvent = {
  blockNumber: number;
  eventName?: string;
  args?: readonly unknown[];
};

function formatActivityDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(
    new Date(timestamp * 1000)
  );
}

function eventAmount(value: unknown, positive: boolean) {
  if (typeof value !== 'bigint') return '';
  return `${positive ? '+' : '-'}${formatCurrencyEth(value)}`;
}

function eventName(event: ChainEvent) {
  return event.eventName ?? 'Contract Event';
}

function eventArg(event: ChainEvent, index: number) {
  return event.args?.[index];
}

export async function loadActivity(limit = 20): Promise<TransactionItem[]> {
  const contract = await getReadOnlyContract();
  if (!contract) return [];

  const runner = contract.runner as { provider?: BrowserProvider | JsonRpcProvider } | null;
  const provider = runner?.provider;
  if (!provider) return [];

  const queryable = contract as unknown as {
    filters: Record<string, () => unknown>;
    queryFilter(filter: unknown, fromBlock: number, toBlock: 'latest'): Promise<ChainEvent[]>;
  };

  const filterNames = [
    'CampaignCreated',
    'DonationReceived',
    'FundsClaimed',
    'RefundClaimed',
    'CampaignCancelled',
    'CreatorRoleGranted',
    'CreatorRoleRevoked'
  ];

  const eventGroups = await Promise.all(
    filterNames.map(async (name) => {
      const filterFactory = queryable.filters[name];
      if (!filterFactory) return [];
      try {
        return await queryable.queryFilter(filterFactory(), 0, 'latest');
      } catch {
        return [];
      }
    })
  );

  const events = eventGroups.flat().sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
  const blockTimestampCache = new Map<number, number>();

  const getTimestamp = async (blockNumber: number) => {
    const cached = blockTimestampCache.get(blockNumber);
    if (cached !== undefined) return cached;
    const block = await provider.getBlock(blockNumber);
    const timestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);
    blockTimestampCache.set(blockNumber, timestamp);
    return timestamp;
  };

  return Promise.all(
    events.map(async (event) => {
      const name = eventName(event);
      const date = formatActivityDate(await getTimestamp(event.blockNumber));

      if (name === 'CampaignCreated') {
        return {
          type: 'Campaign Created',
          name: String(eventArg(event, 2) ?? `Campaign #${String(eventArg(event, 0) ?? '')}`),
          date,
          amount: eventAmount(eventArg(event, 3), true),
          positive: true,
          tone: 'blue'
        };
      }

      if (name === 'DonationReceived') {
        return {
          type: 'Donation',
          name: shortAddress(String(eventArg(event, 1) ?? '')),
          date,
          amount: eventAmount(eventArg(event, 2), true),
          positive: true,
          tone: 'green'
        };
      }

      if (name === 'FundsClaimed') {
        return {
          type: 'Funds Claimed',
          name: shortAddress(String(eventArg(event, 1) ?? '')),
          date,
          amount: eventAmount(eventArg(event, 2), false),
          positive: false,
          tone: 'blue'
        };
      }

      if (name === 'RefundClaimed') {
        return {
          type: 'Refund Claimed',
          name: shortAddress(String(eventArg(event, 1) ?? '')),
          date,
          amount: eventAmount(eventArg(event, 2), false),
          positive: false,
          tone: 'purple'
        };
      }

      if (name === 'CampaignCancelled') {
        return {
          type: 'Campaign Cancelled',
          name: `Campaign #${String(eventArg(event, 0) ?? '')}`,
          date,
          amount: '',
          positive: false,
          tone: 'purple'
        };
      }

      return {
        type: name.replace(/([A-Z])/g, ' $1').trim(),
        name: shortAddress(String(eventArg(event, 0) ?? '')),
        date,
        amount: '',
        positive: true,
        tone: 'dark'
      };
    })
  );
}

export async function createCampaign(title: string, description: string, metadataURI: string, targetEth: string, durationDays: string) {
  await ensureExpectedNetwork();
  const contract = await getWritableContract();
  const targetAmount = ethers.parseEther(targetEth || '0');
  const durationInDays = BigInt(durationDays || '0');
  const tx = await contract.createCampaign(title, description, metadataURI, targetAmount, durationInDays);
  return tx.wait();
}

export async function donateToCampaign(campaignId: bigint, amountEth: string) {
  await ensureExpectedNetwork();
  const contract = await getWritableContract();
  const tx = await contract.donate(campaignId, { value: ethers.parseEther(amountEth || '0') });
  return tx.wait();
}

export async function claimFunds(campaignId: bigint) {
  await ensureExpectedNetwork();
  const contract = await getWritableContract();
  const tx = await contract.claimFunds(campaignId);
  return tx.wait();
}

export async function claimRefund(campaignId: bigint) {
  await ensureExpectedNetwork();
  const contract = await getWritableContract();
  const tx = await contract.claimRefund(campaignId);
  return tx.wait();
}

export async function cancelCampaign(campaignId: bigint) {
  await ensureExpectedNetwork();
  const contract = await getWritableContract();
  const tx = await contract.cancelCampaign(campaignId);
  return tx.wait();
}

export async function grantCreatorRole(address: string) {
  await ensureExpectedNetwork();
  const contract = await getWritableContract();
  const tx = await contract.grantCreatorRole(address);
  return tx.wait();
}
