import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const artifactPath = join(
  process.cwd(),
  "artifacts/contracts/CrowdfundingPlatform.sol/CrowdfundingPlatform.json",
);

if (!existsSync(artifactPath)) {
  throw new Error("Missing artifact. Run `npm run compile` before exporting the ABI.");
}

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
  abi: unknown;
};

const address = process.env.CONTRACT_ADDRESS ?? null;
const network = process.env.CONTRACT_NETWORK ?? null;
const fromBlock = process.env.CONTRACT_FROM_BLOCK ? Number(process.env.CONTRACT_FROM_BLOCK) : null;

const frontendContractPath = join(
  process.cwd(),
  "frontend/src/contracts/CrowdfundingPlatform.json",
);
const deploymentPath = join(process.cwd(), "frontend/src/contracts/deployment.json");

mkdirSync(dirname(frontendContractPath), { recursive: true });

writeFileSync(
  frontendContractPath,
  `${JSON.stringify(
    {
      contractName: "CrowdfundingPlatform",
      abi: artifact.abi,
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  deploymentPath,
  `${JSON.stringify(
    {
      contractName: "CrowdfundingPlatform",
      address,
      network,
      ...(fromBlock !== null && Number.isFinite(fromBlock) ? { fromBlock } : {}),
    },
    null,
    2,
  )}\n`,
);

console.log(`ABI exported to ${frontendContractPath}`);
console.log(`Deployment metadata exported to ${deploymentPath}`);
