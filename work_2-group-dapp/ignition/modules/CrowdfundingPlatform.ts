import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CrowdfundingPlatformModule = buildModule("CrowdfundingPlatformModule", (m) => {
  const crowdfundingPlatform = m.contract("CrowdfundingPlatform");

  return { crowdfundingPlatform };
});

export default CrowdfundingPlatformModule;
