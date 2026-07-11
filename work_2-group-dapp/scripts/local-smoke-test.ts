import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Contract, JsonRpcProvider, ethers } from "ethers";
import type { InterfaceAbi } from "ethers";

const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545";
const EXPECTED_CHAIN_ID = 31337n;

type FrontendContractArtifact = {
  contractName: string;
  abi: InterfaceAbi;
};

type DeploymentMetadata = {
  address?: string | null;
  network?: string | null;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRevert(action: () => Promise<unknown>, label: string) {
  try {
    await action();
  } catch (_error) {
    console.log(`✓ ${label}`);
    return;
  }

  throw new Error(`Expected revert: ${label}`);
}

async function wait(txPromise: Promise<{ wait(): Promise<unknown> }>) {
  const tx = await txPromise;
  await tx.wait();
}

async function latestCampaignId(contract: Contract): Promise<bigint> {
  return BigInt(await contract.campaignCount());
}

async function increaseTo(provider: JsonRpcProvider, timestamp: bigint) {
  const latestBlock = await provider.getBlock("latest");
  assert(latestBlock !== null, "Could not read latest block");

  const delta = Number(timestamp - BigInt(latestBlock.timestamp));
  if (delta > 0) {
    await provider.send("evm_increaseTime", [delta]);
  }
  await provider.send("evm_mine", []);
}

const artifactPath = join(process.cwd(), "frontend/src/contracts/CrowdfundingPlatform.json");
const deploymentPath = join(process.cwd(), "frontend/src/contracts/deployment.json");
const frontendArtifact = readJson<FrontendContractArtifact>(artifactPath);
const deployment = readJson<DeploymentMetadata>(deploymentPath);
const contractAddress = process.env.CONTRACT_ADDRESS ?? deployment.address;

assert(frontendArtifact.contractName === "CrowdfundingPlatform", "Wrong frontend contract artifact");
assert(Array.isArray(frontendArtifact.abi), "Frontend contract ABI is missing");
assert(contractAddress !== undefined && contractAddress !== null, "Missing contract address");
assert(ethers.isAddress(contractAddress), `Invalid contract address: ${contractAddress}`);

const provider = new JsonRpcProvider(LOCAL_RPC_URL);
const network = await provider.getNetwork();
assert(network.chainId === EXPECTED_CHAIN_ID, `Expected chain ${EXPECTED_CHAIN_ID}, got ${network.chainId}`);

const deployedCode = await provider.getCode(contractAddress);
assert(deployedCode !== "0x", `No contract code found at ${contractAddress}`);

const admin = await provider.getSigner(0);
const creator = await provider.getSigner(1);
const contributor = await provider.getSigner(2);
const otherContributor = await provider.getSigner(3);

const adminAddress = await admin.getAddress();
const creatorAddress = await creator.getAddress();
const contributorAddress = await contributor.getAddress();
const otherContributorAddress = await otherContributor.getAddress();

const platform = new Contract(contractAddress, frontendArtifact.abi, admin);
const creatorPlatform = platform.connect(creator) as Contract;
const contributorPlatform = platform.connect(contributor) as Contract;
const otherContributorPlatform = platform.connect(otherContributor) as Contract;

console.log(`Local RPC: ${LOCAL_RPC_URL}`);
console.log(`Contract:  ${contractAddress}`);
console.log(`Network:   ${network.name} (${network.chainId})`);

const defaultAdminRole = await platform.DEFAULT_ADMIN_ROLE();
const creatorRole = await platform.CREATOR_ROLE();
assert(await platform.hasRole(defaultAdminRole, adminAddress), "Admin lacks DEFAULT_ADMIN_ROLE");
console.log("✓ deployment and frontend ABI are usable");

await wait(platform.grantCreatorRole(creatorAddress));
assert(await platform.hasRole(creatorRole, creatorAddress), "Creator role grant failed");
console.log("✓ admin can grant creator role");

// Successful campaign: create, donate target, expire, creator claims.
await wait(
  creatorPlatform.createCampaign(
    "Local full-stack success",
    "E2E success path from frontend ABI",
    "ipfs://local-success",
    ethers.parseEther("2"),
    1,
  ),
);
const successCampaignId = await latestCampaignId(platform);
await wait(contributorPlatform.donate(successCampaignId, { value: ethers.parseEther("2") }));
let campaign = await platform.getCampaign(successCampaignId);
assert(campaign.amountRaised === ethers.parseEther("2"), "Successful campaign amount mismatch");
await increaseTo(provider, BigInt(campaign.deadline));
await wait(creatorPlatform.claimFunds(successCampaignId));
assert(await platform.getCampaignStatus(successCampaignId) === "Claimed", "Successful campaign was not claimed");
console.log("✓ success path: create → donate → expire → claim funds");

// Failed campaign: create, donate below target, expire, contributor refunds.
await wait(
  creatorPlatform.createCampaign(
    "Local full-stack refund",
    "E2E refund path from frontend ABI",
    "ipfs://local-refund",
    ethers.parseEther("5"),
    1,
  ),
);
const failedCampaignId = await latestCampaignId(platform);
await wait(contributorPlatform.donate(failedCampaignId, { value: ethers.parseEther("1") }));
campaign = await platform.getCampaign(failedCampaignId);
await increaseTo(provider, BigInt(campaign.deadline));
await wait(contributorPlatform.claimRefund(failedCampaignId));
assert(await platform.getContribution(failedCampaignId, contributorAddress) === 0n, "Refund did not clear contribution");
assert(await platform.getCampaignStatus(failedCampaignId) === "Failed", "Failed campaign status mismatch");
console.log("✓ failure path: create → donate below target → expire → refund");

// Cancelled campaign: create, donate, cancel, refund.
await wait(
  creatorPlatform.createCampaign(
    "Local full-stack cancel",
    "E2E cancellation path from frontend ABI",
    "ipfs://local-cancel",
    ethers.parseEther("1"),
    1,
  ),
);
const cancelledCampaignId = await latestCampaignId(platform);
await wait(otherContributorPlatform.donate(cancelledCampaignId, { value: ethers.parseEther("0.5") }));
await wait(creatorPlatform.cancelCampaign(cancelledCampaignId));
await wait(otherContributorPlatform.claimRefund(cancelledCampaignId));
assert(await platform.getCampaignStatus(cancelledCampaignId) === "Cancelled", "Cancelled campaign status mismatch");
console.log("✓ cancellation path: donate → cancel → refund");

// Pause protection: state-changing frontend actions revert while paused.
await wait(platform.pause());
await expectRevert(
  () => creatorPlatform.createCampaign("Paused", "Paused", "", ethers.parseEther("1"), 1),
  "paused contract blocks campaign creation",
);
await wait(platform.unpause());
console.log("✓ pause and unpause controls work locally");

console.log("\nLocal full-stack smoke test passed.");
