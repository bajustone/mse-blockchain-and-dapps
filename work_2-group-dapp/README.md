# BlockFunds Crowdfunding DApp

BlockFunds is a full-stack blockchain crowdfunding DApp built for Group 8. It includes a Solidity/Hardhat backend, a SvelteKit dashboard frontend, MetaMask integration, Sepolia deployment metadata, Docker production deployment, and Playwright E2E tests.

Live frontend:

```text
http://blockfund.bahatijustin.dev
```

Current Sepolia contract:

```text
0x265c7Ed47C7880f0f0ce2F1Ee44221a46031971f
```

## Features

- Create ETH crowdfunding campaigns.
- Donate to active campaigns.
- Creators can claim funds as soon as the funding target is reached.
- Donors can claim refunds for failed or cancelled campaigns.
- Campaign creators can cancel active campaigns.
- Admin-controlled creator role management.
- Live on-chain campaign/activity loading from contract events.
- IPFS campaign metadata upload support through Pinata.
- No mock/demo campaign data in the production UI.
- Responsive SvelteKit dashboard with routed pages.

## Stack

- Solidity `0.8.28`
- Hardhat 3
- OpenZeppelin Contracts 5
- Hardhat Ignition
- ethers v6
- SvelteKit
- shadcn-style local Svelte components
- Playwright
- Docker Compose

## Project structure

```text
contracts/CrowdfundingPlatform.sol        Main smart contract
ignition/modules/CrowdfundingPlatform.ts  Ignition deployment module
scripts/export-abi.ts                     ABI/deployment export script
scripts/test-local-fullstack.sh           Full local backend/frontend smoke test
scripts/local-smoke-test.ts               Local contract interaction smoke test
test/CrowdfundingPlatform.test.ts         Unit tests
frontend/                                 SvelteKit frontend app
frontend/src/lib/DashboardApp.svelte      Main routed dashboard UI
frontend/src/lib/contract.ts              Frontend contract helpers
frontend/src/routes/roles/+page.svelte    Role management route
docker-compose.yml                        Production frontend container config
```

## System architecture

```mermaid
flowchart TB
  user["User / Creator / Donor / Admin"]
  browser["Browser"]
  frontend["SvelteKit Frontend<br/>BlockFunds Dashboard"]
  ui["Local shadcn-style Svelte Components"]
  helpers["ethers v6 Contract Helpers<br/>frontend/src/lib/contract.ts"]
  metamask["MetaMask Wallet"]
  sepolia[("Sepolia Ethereum Testnet")]
  contract["CrowdfundingPlatform.sol<br/>AccessControl + Pausable"]
  events["Blockchain Events<br/>Campaign, Donation, Claim, Refund, Role"]
  hardhat["Hardhat 3 + Ignition<br/>Tests + ABI Export"]
  docker["Docker Compose<br/>blockfund-frontend"]
  cloudflare["Cloudflare Tunnel"]
  publicHost["blockfund.bahatijustin.dev"]
  github["GitHub Repository"]

  user --> browser
  browser --> frontend
  frontend --> ui
  frontend --> helpers
  helpers --> metamask
  metamask --> sepolia
  sepolia --> contract
  contract --> events
  events --> helpers
  hardhat --> contract
  hardhat --> frontend
  frontend --> docker
  docker --> cloudflare
  cloudflare --> publicHost
  hardhat --> github
  frontend --> github
```

### Architecture flow

1. Users interact with the SvelteKit dashboard in the browser.
2. MetaMask signs transactions and connects the frontend to Sepolia.
3. `frontend/src/lib/contract.ts` uses ethers v6 to read campaign data, send transactions, and query contract events.
4. `CrowdfundingPlatform.sol` manages campaigns, donations, refunds, creator claims, cancellation, pause controls, and RBAC.
5. Contract events populate the Activity page with live blockchain activity.
6. The production frontend runs in Docker and is exposed publicly through Cloudflare Tunnel.

## Frontend routes

- `/` — dashboard overview
- `/campaigns` — campaign list/actions and Create Campaign modal
- `/activity` — live contract event/activity feed
- `/roles` — role management page
- `/contract` — contract/network status

## User manual for app users

This section is for people using the deployed BlockFunds app, not developers setting it up locally.

### 1. Open the app

Visit:

```text
http://blockfund.bahatijustin.dev
```

The dashboard shows live Sepolia campaign totals, recent contract activity, and links to the main app pages.

![BlockFunds dashboard](docs/screenshots/user-manual-dashboard.png)

### 2. Connect MetaMask

1. Install MetaMask if it is not already installed.
2. Switch MetaMask to the **Sepolia** test network.
3. Make sure the wallet has Sepolia ETH for gas fees.
4. Click **Connect Wallet** in the top-right corner of the app.
5. Approve the connection request in MetaMask.

If MetaMask is on the wrong network, the app will ask you to switch networks before sending transactions.

### 3. View and use campaigns

Open `/campaigns` or click **Campaigns** in the sidebar.

![Campaign management page](docs/screenshots/user-manual-campaigns.png)

On the campaign page, users can:

- View all recent live campaigns.
- Donate ETH to active campaigns.
- Claim funds if they are the creator and the target has been reached.
- Claim refunds for failed or cancelled campaigns where they donated.
- Cancel a campaign if they are the campaign creator.

### 4. Create a campaign

Campaign creation requires `CREATOR_ROLE`.

To create a campaign:

![Create campaign IPFS metadata upload](docs/screenshots/user-manual-ipfs-upload.png)

1. Go to `/campaigns`.
2. Click **Create Campaign**.
3. Enter the campaign title, target ETH, duration, metadata URI, and description.
4. Optional: choose a campaign image/document and click **Upload Metadata to IPFS**. This fills the Metadata URI field with an `ipfs://...` link.
5. Click **Create Campaign**.
6. Confirm the transaction in MetaMask.
7. Wait for confirmation, then refresh the campaign list if needed.

If the app says the wallet does not have creator role, ask the admin to grant creator access from `/roles`.

If IPFS upload is not configured on the server, creators can still paste an existing `ipfs://...` URI manually into the Metadata URI field.

### 5. Manage creator roles

Open `/roles` or click **Roles** in the sidebar.

![Role management page](docs/screenshots/user-manual-roles.png)

On the role management page, users can:

- Check the connected wallet roles.
- Check any wallet address.
- Grant creator role.
- Revoke creator role.

Only the admin wallet can grant or revoke creator roles. Non-admin users can still check role status, but grant/revoke transactions will fail.

### 6. View blockchain activity

Open `/activity` or click **Activity** in the sidebar.

![Activity page](docs/screenshots/user-manual-activity.png)

The Activity page reads live blockchain events from the deployed contract, including:

- Campaign creation
- Donations
- Creator fund claims
- Refunds
- Campaign cancellations
- Creator role grants/revokes

### 7. Confirm transactions

Every write action opens MetaMask for confirmation. After confirming:

1. Wait for the transaction to be mined.
2. Watch the status message in the app.
3. Refresh campaigns/activity if the latest state is not visible immediately.
4. Optionally verify the transaction on Sepolia Etherscan.

## Role management

Campaign creation is protected by `CREATOR_ROLE`. A wallet must have creator role before it can create campaigns.

Open the role management page:

```text
http://blockfund.bahatijustin.dev/roles
```

From `/roles`, you can:

- Connect/reconnect MetaMask.
- Check your own roles.
- Check any wallet address.
- Grant creator role.
- Revoke creator role.

Only the contract admin wallet can grant or revoke roles:

```text
0xA386432BbEC580A02561ec3Eb5a5c34905Bd9a60
```

If a non-admin wallet tries to grant/revoke roles, the frontend shows a clear admin-only error.

## Install

From this project directory:

```bash
npm install
npm --prefix frontend install
```

## Compile contracts

```bash
npm run compile
```

## Run backend tests

```bash
npm test
```

The test suite covers RBAC, campaign creation, donations, creator claims once target is reached, failed/cancelled refunds, duplicate claim/refund prevention, cancellation, and pause controls.

Type-check TypeScript scripts/tests:

```bash
npm run test:types
```

## Full local stack test

Run the full local pre-deployment check:

```bash
npm run test:local:fullstack
```

This command:

1. Starts or reuses a local Hardhat JSON-RPC node.
2. Compiles the contracts.
3. Runs the full unit test suite.
4. Performs a fresh localhost Ignition deployment.
5. Exports frontend ABI/deployment metadata.
6. Uses the frontend ABI against the local deployed contract to smoke-test:
   - creator role grant
   - campaign creation
   - donation
   - successful fund claim
   - failed campaign refund
   - cancellation refund
   - pause/unpause protection

## Local development

In terminal 1:

```bash
npm run node
```

In terminal 2:

```bash
npm run deploy:local
```

Export the local contract to the frontend:

```bash
CONTRACT_ADDRESS="0xLOCAL_CONTRACT_ADDRESS" CONTRACT_NETWORK="localhost" npm run export:abi
```

Start the frontend:

```bash
npm run frontend:dev
```

Open:

```text
http://localhost:5173
```

For MetaMask local testing, use:

```text
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
```

## Sepolia deployment

Copy `.env.example` and provide real values locally. Do not commit secrets.

```bash
export SEPOLIA_RPC_URL="https://sepolia.drpc.org"
export SEPOLIA_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
npm run deploy:sepolia
```

After deploying, export ABI/deployment metadata for the frontend:

```bash
CONTRACT_ADDRESS="0xDEPLOYED_CONTRACT_ADDRESS" \
CONTRACT_NETWORK="sepolia" \
CONTRACT_FROM_BLOCK="DEPLOYMENT_BLOCK" \
npm run export:abi
```

This writes:

- `frontend/src/contracts/CrowdfundingPlatform.json`
- `frontend/src/contracts/deployment.json`

Current checked-in deployment metadata points to Sepolia contract:

```text
Address: 0x265c7Ed47C7880f0f0ce2F1Ee44221a46031971f
From block: 11249668
```

## Frontend checks

```bash
npm run frontend:check
npm run frontend:test:e2e
npm run frontend:build
```

## IPFS metadata upload

The campaign form supports uploading campaign metadata to IPFS through the SvelteKit server endpoint:

```text
POST /api/ipfs/upload
```

The endpoint uses Pinata and requires a server-side JWT:

```bash
PINATA_JWT="YOUR_PINATA_JWT"
```

When configured, the frontend can:

1. Upload an optional campaign image/document to IPFS.
2. Create a campaign metadata JSON object.
3. Pin the metadata JSON to IPFS.
4. Fill the campaign `metadataURI` field with the resulting `ipfs://...` URI.
5. Store that URI on-chain when the campaign is created.

If `PINATA_JWT` is not configured, users can still paste an existing `ipfs://...` URI manually.

## Docker production frontend

Build and run the production frontend locally with Docker Compose:

```bash
docker compose up -d --build
```

The production container exposes the SvelteKit Node server on:

```text
127.0.0.1:8088 -> 3000
```

The deployed public hostname is served through Cloudflare Tunnel:

```text
http://blockfund.bahatijustin.dev
```

## Deliverables self-evaluation

Based on **“Deliverables (Applicable to All Groups)”** from `Activity 1#dApp Projects_DEADLINE_11_07_2026.docx`:

| Deliverable | Status | Evidence / Notes |
| --- | --- | --- |
| Deployed DApp on Sepolia Ethereum Test Network | ✅ Complete | Frontend: `http://blockfund.bahatijustin.dev`; contract: `0x265c7Ed47C7880f0f0ce2F1Ee44221a46031971f`. |
| Solidity smart contract(s) | ✅ Complete | `contracts/CrowdfundingPlatform.sol`. |
| Responsive frontend integrated with MetaMask | ✅ Complete | SvelteKit frontend with wallet connect, network checks, and responsive routed dashboard. |
| Evidence of RBAC implementation | ✅ Complete | OpenZeppelin `AccessControl`, `DEFAULT_ADMIN_ROLE`, `CREATOR_ROLE`, and `/roles` management page. |
| Blockchain event logging | ✅ Complete | Contract emits campaign, donation, claim, refund, cancellation, and role events; `/activity` reads live events. |
| IPFS integration, where applicable | ✅ Complete when `PINATA_JWT` is configured | Campaign form supports direct IPFS metadata upload through Pinata and stores the resulting `ipfs://...` URI on-chain; manual `ipfs://...` entry remains available. |
| NFT integration, where applicable | N/A | NFT functionality is not required for this crowdfunding DApp workflow. |
| GitHub repository containing all source code | ✅ Complete | `git@github.com:bajustone/mse-blockchain-and-dapps.git`, project directory `work_2-group-dapp/`. |
| System architecture diagram | ✅ Complete | Added Mermaid diagram in this README. |
| User manual | ✅ Complete | README includes an app-user manual with screenshots for dashboard, campaigns, roles, and activity. |
| Technical report, 15–20 pages | ⚠️ Pending | Source code and README are ready; formal report still needs to be written/exported. |
| 15–20 minute live demonstration | ✅ Demo-ready | Full workflow is supported: connect wallet, grant creator role, create campaign, donate, claim funds, view events. |

Overall readiness: **strong implementation readiness**, with the main remaining non-code deliverables being the formal technical report and, if required, a separate polished user manual.
