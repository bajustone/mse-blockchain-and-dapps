# Group 8 Crowdfunding DApp Backend

Hardhat backend implementation for the architecture in `BACKEND_ARCHITECTURE_PLAN.md`.

## Stack

- Solidity `0.8.28`
- Hardhat 3
- OpenZeppelin Contracts 5
- Hardhat Ignition
- Mocha/Chai + ethers tests

## Project structure

```text
contracts/CrowdfundingPlatform.sol        Main smart contract
ignition/modules/CrowdfundingPlatform.ts  Ignition deployment module
scripts/export-abi.ts                     ABI/deployment export script
test/CrowdfundingPlatform.test.ts         Unit tests
hardhat.config.ts                         Hardhat network/compiler config
```

## Install

```bash
npm install
```

## Compile

```bash
npm run compile
```

## Test

```bash
npm test
```

The test suite covers RBAC, campaign creation, donations, deadline checks, successful fund claims, failed/cancelled refunds, duplicate claim/refund prevention, cancellation, and pause controls.

Type-check the TypeScript scripts/tests:

```bash
npm run test:types
```

## Full local stack test before deployment

Run the full local pre-deployment check:

```bash
npm run test:local:fullstack
```

This command:

1. Starts or reuses a local Hardhat JSON-RPC node.
2. Compiles the contracts.
3. Runs the full unit test suite.
4. Performs a fresh localhost Ignition deployment.
5. Exports the frontend ABI/deployment metadata.
6. Uses the frontend ABI against the local deployed contract to smoke-test:
   - role grant
   - campaign creation
   - donation
   - successful fund claim
   - failed campaign refund
   - cancellation refund
   - pause/unpause protection

## Local deployment

In terminal 1:

```bash
npm run node
```

In terminal 2:

```bash
npm run deploy:local
```

## Sepolia deployment

Set environment/config variables before deploying. You can copy `.env.example` for reference, but do not commit real secrets.

```bash
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_PROJECT_ID"
export SEPOLIA_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
npm run deploy:sepolia
```

After deployment, save the contract address and transaction hash for the report.

## Export ABI for frontend

```bash
npm run compile
CONTRACT_ADDRESS="0xDEPLOYED_CONTRACT_ADDRESS" CONTRACT_NETWORK="sepolia" npm run export:abi
```

This writes:

- `frontend/src/contracts/CrowdfundingPlatform.json`
- `frontend/src/contracts/deployment.json`

## SvelteKit frontend

The UI lives in `frontend/` and is inspired by the supplied dark finance dashboard mockup.

Install frontend dependencies:

```bash
cd frontend
npm install
```

Run from the repository root:

```bash
npm run frontend:dev
```

Then open `http://localhost:5173`.

Frontend routes:

- `/` — dashboard overview
- `/campaigns` — campaign list/actions with a Create Campaign modal
- `/activity` — transaction/activity panel
- `/contract` — contract/network status

Useful frontend checks:

```bash
npm run frontend:check
npm run frontend:build
npm run frontend:test:e2e
```

For local contract interaction:

1. Run `npm run test:local:fullstack` or deploy locally with `npm run deploy:local`.
2. Export the local contract address with `CONTRACT_ADDRESS="..." CONTRACT_NETWORK="localhost" npm run export:abi`.
3. Start the frontend and connect MetaMask to `Localhost 8545` / chain `31337`.
