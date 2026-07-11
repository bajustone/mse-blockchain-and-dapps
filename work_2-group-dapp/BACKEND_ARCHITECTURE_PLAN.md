# Backend Architecture Plan — Group 8 Blockchain Crowdfunding Platform

## 1. Project Context

Group 8 will build a decentralized crowdfunding platform where project creators raise funds transparently on Ethereum Sepolia. Contributors donate ETH to campaigns, and the smart contract enforces whether funds are released to the creator or refunded to contributors based on campaign deadline and funding target.

Required backend features from the assignment:

- Campaign creation
- Campaign management
- Donations
- Funding target and deadline
- Automatic fund release or refund logic
- Role-Based Access Control (RBAC)
- Blockchain event logging
- Sepolia Testnet deployment

---

## 2. Recommended Backend Stack

Final selected stack:

```text
Solidity + Hardhat + OpenZeppelin Contracts + Hardhat Ignition + Sepolia Testnet
```

### Why this stack?

This stack gives the best balance of:

- security
- testability
- GitHub-friendly project structure
- frontend compatibility
- MetaMask/Sepolia support
- maintainability for a student full-stack DApp

---

## 3. Alternative Stack Comparison

| Stack | Advantages | Disadvantages | Decision |
|---|---|---|---|
| Hardhat + OpenZeppelin | Strong JavaScript/TypeScript ecosystem, good testing tools, Sepolia deployment support, easy frontend ABI integration | Requires local setup | Selected |
| Foundry + OpenZeppelin | Very fast, excellent Solidity-native tests, professional-grade | More CLI-heavy, less beginner-friendly for full-stack frontend integration | Good alternative |
| Remix IDE | No setup, easy browser-based development, good for quick testing | Weak for automated testing, team collaboration, GitHub structure, repeatable deployments | Use only for experiments |
| thirdweb | Easy deployment dashboard, SDKs, supports many EVM chains | Platform-dependent, abstracts away backend learning/control | Optional later |
| Truffle + Ganache | Historically popular | Sunset/deprecated by Consensys | Avoid |

---

## 4. Backend Folder Structure

Recommended structure:

```text
backend/
  contracts/
    CrowdfundingPlatform.sol
  test/
    CrowdfundingPlatform.test.ts
  ignition/
    modules/
      CrowdfundingPlatform.ts
  scripts/
    export-abi.ts
  artifacts/
  hardhat.config.ts
  package.json
  .gitignore
  README.md
```

If the project remains in the current root directory, use the same folders directly without the `backend/` wrapper.

---

## 5. Smart Contract Architecture

Main contract:

```text
CrowdfundingPlatform.sol
```

The contract will manage all campaigns, contributions, refunds, and fund release logic.

### Main inherited contracts/libraries

Use OpenZeppelin:

```solidity
AccessControl
ReentrancyGuard
Pausable
```

Purpose:

- `AccessControl`: implements RBAC.
- `ReentrancyGuard`: protects functions that send or receive ETH.
- `Pausable`: allows emergency pause by admin.

---

## 6. Roles and Permissions

### Roles

```solidity
DEFAULT_ADMIN_ROLE
CREATOR_ROLE
```

### Permissions

| Role/User | Permissions |
|---|---|
| Admin | Grant/revoke creator role, pause/unpause contract |
| Creator | Create campaigns, cancel own campaigns, claim funds if campaign succeeds |
| Contributor/Public User | Donate, claim refund if campaign fails, view campaign data |

---

## 7. Campaign Data Model

Suggested campaign struct:

```solidity
struct Campaign {
    uint256 id;
    address payable creator;
    string title;
    string description;
    string metadataURI;
    uint256 targetAmount;
    uint256 deadline;
    uint256 amountRaised;
    bool cancelled;
    bool fundsClaimed;
}
```

Storage mappings:

```solidity
uint256 public campaignCount;
mapping(uint256 => Campaign) public campaigns;
mapping(uint256 => mapping(address => uint256)) public contributions;
```

`metadataURI` can store an optional IPFS CID or URL for campaign image/documents.

---

## 8. Core Contract Functions

### Admin functions

```solidity
function grantCreatorRole(address creator) external onlyRole(DEFAULT_ADMIN_ROLE);
function revokeCreatorRole(address creator) external onlyRole(DEFAULT_ADMIN_ROLE);
function pause() external onlyRole(DEFAULT_ADMIN_ROLE);
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);
```

### Campaign functions

```solidity
function createCampaign(
    string calldata title,
    string calldata description,
    string calldata metadataURI,
    uint256 targetAmount,
    uint256 durationInDays
) external onlyRole(CREATOR_ROLE) whenNotPaused;
```

```solidity
function cancelCampaign(uint256 campaignId) external whenNotPaused;
```

Rules:

- only campaign creator or admin can cancel
- cannot cancel after funds are claimed

### Donation function

```solidity
function donate(uint256 campaignId) external payable nonReentrant whenNotPaused;
```

Rules:

- campaign must exist
- campaign must not be cancelled
- deadline must not have passed
- donation amount must be greater than zero

### Fund claim function

```solidity
function claimFunds(uint256 campaignId) external nonReentrant whenNotPaused;
```

Rules:

- caller must be campaign creator
- deadline must have passed
- target amount must have been reached
- funds must not already be claimed
- campaign must not be cancelled

### Refund function

```solidity
function claimRefund(uint256 campaignId) external nonReentrant whenNotPaused;
```

Rules:

- campaign deadline passed and target was not reached, OR campaign was cancelled
- caller must have contributed
- funds must not have been claimed
- refund amount is set to zero before ETH transfer

### View/helper functions

```solidity
function getCampaign(uint256 campaignId) external view returns (Campaign memory);
function getContribution(uint256 campaignId, address contributor) external view returns (uint256);
function isCampaignSuccessful(uint256 campaignId) public view returns (bool);
function isCampaignExpired(uint256 campaignId) public view returns (bool);
function getCampaignStatus(uint256 campaignId) external view returns (string memory);
```

---

## 9. Automatic Release/Refund Design Note

Ethereum smart contracts cannot run by themselves. A transaction must call the contract.

Therefore, the platform will implement automatic rule enforcement, not autonomous execution:

- if campaign succeeds, creator calls `claimFunds()`
- if campaign fails, contributors call `claimRefund()`
- the contract automatically checks deadline and target before allowing either action

Optional advanced improvement:

- use Chainlink Automation later to trigger finalization automatically

For this assignment, manual transaction triggering with smart-contract-enforced logic is acceptable and easier to demonstrate.

---

## 10. Blockchain Event Logging

Events will be emitted for important actions so the frontend can show transaction history and notifications.

```solidity
event CreatorRoleGranted(address indexed creator);
event CreatorRoleRevoked(address indexed creator);

event CampaignCreated(
    uint256 indexed campaignId,
    address indexed creator,
    string title,
    uint256 targetAmount,
    uint256 deadline
);

event DonationReceived(
    uint256 indexed campaignId,
    address indexed contributor,
    uint256 amount
);

event CampaignCancelled(uint256 indexed campaignId);

event FundsClaimed(
    uint256 indexed campaignId,
    address indexed creator,
    uint256 amount
);

event RefundClaimed(
    uint256 indexed campaignId,
    address indexed contributor,
    uint256 amount
);
```

---

## 11. Security Plan

Security practices:

1. Use OpenZeppelin contracts instead of writing custom access/security code.
2. Use `nonReentrant` for ETH transfer functions.
3. Use checks-effects-interactions pattern.
4. Never loop through all contributors for refunds.
5. Contributors claim refunds individually.
6. Use `msg.sender`, never `tx.origin`, for authorization.
7. Validate all user inputs.
8. Add emergency pause/unpause.
9. Avoid unbounded state-changing loops.
10. Test all failure cases, not only success cases.

---

## 12. Testing Plan

Unit tests should cover:

1. Admin receives `DEFAULT_ADMIN_ROLE` on deployment.
2. Admin can grant creator role.
3. Admin can revoke creator role.
4. Non-creator cannot create campaign.
5. Creator can create campaign.
6. Campaign creation rejects zero target.
7. Campaign creation rejects invalid duration.
8. User can donate before deadline.
9. Donation emits `DonationReceived`.
10. User cannot donate zero ETH.
11. User cannot donate after deadline.
12. Creator cannot claim funds before deadline.
13. Creator can claim funds after successful campaign.
14. Creator cannot claim funds twice.
15. Contributor can claim refund after failed campaign.
16. Contributor cannot claim refund twice.
17. Contributor cannot claim refund if campaign succeeds.
18. Creator/admin can cancel campaign.
19. Contributor can refund after campaign cancellation.
20. Paused contract blocks campaign creation/donation/claim actions.

---

## 13. Deployment Plan

### Local development

1. Initialize Hardhat project.
2. Install OpenZeppelin.
3. Write contract.
4. Write tests.
5. Run local tests.

### Sepolia deployment

1. Configure Sepolia RPC URL.
2. Configure deployer wallet private key securely.
3. Deploy with Hardhat Ignition.
4. Verify deployment transaction.
5. Save deployed contract address.
6. Export ABI for frontend.

Deployment output needed for final report:

```text
Contract address
Sepolia transaction hash
Deployment wallet address
ABI file
Screenshots from Etherscan/Sepolia explorer
```

---

## 14. Frontend Integration Contract Interface

The frontend will need:

- contract address
- contract ABI
- Sepolia network configuration
- MetaMask connection

Frontend pages will call:

```text
createCampaign()
donate()
claimFunds()
claimRefund()
cancelCampaign()
getCampaign()
getContribution()
getCampaignStatus()
```

Frontend will listen to:

```text
CampaignCreated
DonationReceived
FundsClaimed
RefundClaimed
CampaignCancelled
```

---

## 15. Suggested Implementation Order

1. Create Hardhat backend project.
2. Install OpenZeppelin.
3. Implement `CrowdfundingPlatform.sol`.
4. Write unit tests.
5. Run and fix all tests.
6. Create Hardhat Ignition deployment module.
7. Deploy to local Hardhat network.
8. Deploy to Sepolia.
9. Export ABI/address to frontend.
10. Document backend in technical report.

---

## 16. References

- Hardhat 3 Getting Started: https://hardhat.org/docs/getting-started
- Hardhat Deployment Guide: https://hardhat.org/docs/guides/deployment
- OpenZeppelin Access Control: https://docs.openzeppelin.com/contracts/5.x/access-control
- OpenZeppelin Utilities: https://docs.openzeppelin.com/contracts/5.x/api/utils
- Solidity Security Considerations: https://docs.soliditylang.org/en/latest/security-considerations.html
- Foundry: https://getfoundry.sh/
- Remix IDE: https://remix-ide.readthedocs.io/
- thirdweb Deploy: https://thirdweb.com/learn/guides/thirdweb-deploy-smart-contract-deployment-tool-explained
- Consensys Truffle/Ganache Sunset: https://consensys.io/blog/consensys-announces-the-sunset-of-truffle-and-ganache-and-new-hardhat
- Chainlink Event-Driven Smart Contract Execution: https://chain.link/article/event-driven-smart-contract-execution
