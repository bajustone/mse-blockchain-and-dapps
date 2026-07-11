import { expect } from "chai";
import { network } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";

const { ethers, networkHelpers } = await network.create();

const TARGET = ethers.parseEther("2");
const ONE_ETH = ethers.parseEther("1");

async function deployPlatformFixture() {
  const [admin, creator, contributor, otherContributor, stranger] =
    await ethers.getSigners();
  const platform = await ethers.deployContract("CrowdfundingPlatform");
  const DEFAULT_ADMIN_ROLE = await platform.DEFAULT_ADMIN_ROLE();
  const CREATOR_ROLE = await platform.CREATOR_ROLE();

  return {
    platform,
    admin,
    creator,
    contributor,
    otherContributor,
    stranger,
    DEFAULT_ADMIN_ROLE,
    CREATOR_ROLE,
  };
}

async function deployWithCreatorFixture() {
  const fixture = await deployPlatformFixture();
  await fixture.platform.grantCreatorRole(fixture.creator.address);
  return fixture;
}

async function deployWithCampaignFixture() {
  const fixture = await deployWithCreatorFixture();
  await fixture.platform.connect(fixture.creator).createCampaign(
    "Solar School",
    "Install solar panels for a local school",
    "ipfs://solar-school",
    TARGET,
    7,
  );

  return { ...fixture, campaignId: 1n };
}

describe("CrowdfundingPlatform", function () {
  describe("Deployment and RBAC", function () {
    it("grants DEFAULT_ADMIN_ROLE to the deployer", async function () {
      const { platform, admin, DEFAULT_ADMIN_ROLE } = await networkHelpers.loadFixture(
        deployPlatformFixture,
      );

      expect(await platform.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("allows admin to grant CREATOR_ROLE and emits CreatorRoleGranted", async function () {
      const { platform, creator, CREATOR_ROLE } = await networkHelpers.loadFixture(
        deployPlatformFixture,
      );

      await expect(platform.grantCreatorRole(creator.address))
        .to.emit(platform, "CreatorRoleGranted")
        .withArgs(creator.address);

      expect(await platform.hasRole(CREATOR_ROLE, creator.address)).to.equal(true);
    });

    it("allows admin to revoke CREATOR_ROLE and emits CreatorRoleRevoked", async function () {
      const { platform, creator, CREATOR_ROLE } = await networkHelpers.loadFixture(
        deployWithCreatorFixture,
      );

      await expect(platform.revokeCreatorRole(creator.address))
        .to.emit(platform, "CreatorRoleRevoked")
        .withArgs(creator.address);

      expect(await platform.hasRole(CREATOR_ROLE, creator.address)).to.equal(false);
    });

    it("rejects creator role grants from non-admin accounts", async function () {
      const { platform, creator, stranger, DEFAULT_ADMIN_ROLE } =
        await networkHelpers.loadFixture(deployPlatformFixture);

      await expect(platform.connect(stranger).grantCreatorRole(creator.address))
        .to.be.revertedWithCustomError(platform, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("Campaign creation and reads", function () {
    it("rejects campaign creation by non-creators", async function () {
      const { platform, stranger, CREATOR_ROLE } = await networkHelpers.loadFixture(
        deployPlatformFixture,
      );

      await expect(
        platform.connect(stranger).createCampaign("Title", "Description", "", TARGET, 7),
      )
        .to.be.revertedWithCustomError(platform, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, CREATOR_ROLE);
    });

    it("allows a creator to create a campaign", async function () {
      const { platform, creator } = await networkHelpers.loadFixture(
        deployWithCreatorFixture,
      );

      await expect(
        platform.connect(creator).createCampaign(
          "Solar School",
          "Install solar panels for a local school",
          "ipfs://solar-school",
          TARGET,
          7,
        ),
      )
        .to.emit(platform, "CampaignCreated")
        .withArgs(1n, creator.address, "Solar School", TARGET, anyValue);

      const campaign = await platform.getCampaign(1n);
      expect(campaign.id).to.equal(1n);
      expect(campaign.creator).to.equal(creator.address);
      expect(campaign.title).to.equal("Solar School");
      expect(campaign.targetAmount).to.equal(TARGET);
      expect(campaign.amountRaised).to.equal(0n);
      expect(await platform.campaignCount()).to.equal(1n);
      expect(await platform.getCampaignStatus(1n)).to.equal("Active");
    });

    it("rejects a zero funding target", async function () {
      const { platform, creator } = await networkHelpers.loadFixture(
        deployWithCreatorFixture,
      );

      await expect(
        platform.connect(creator).createCampaign("Title", "Description", "", 0, 7),
      ).to.be.revertedWith("Target amount must be greater than zero");
    });

    it("rejects an invalid zero-day duration", async function () {
      const { platform, creator } = await networkHelpers.loadFixture(
        deployWithCreatorFixture,
      );

      await expect(
        platform.connect(creator).createCampaign("Title", "Description", "", TARGET, 0),
      ).to.be.revertedWith("Duration must be greater than zero");
    });

    it("rejects reads for unknown campaign ids", async function () {
      const { platform } = await networkHelpers.loadFixture(deployPlatformFixture);

      await expect(platform.getCampaign(1n)).to.be.revertedWith(
        "Campaign does not exist",
      );
    });
  });

  describe("Donations", function () {
    it("allows users to donate before the deadline", async function () {
      const { platform, contributor, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );

      await expect(platform.connect(contributor).donate(campaignId, { value: ONE_ETH }))
        .to.emit(platform, "DonationReceived")
        .withArgs(campaignId, contributor.address, ONE_ETH);

      const campaign = await platform.getCampaign(campaignId);
      expect(campaign.amountRaised).to.equal(ONE_ETH);
      expect(await platform.getContribution(campaignId, contributor.address)).to.equal(
        ONE_ETH,
      );
    });

    it("rejects zero-value donations", async function () {
      const { platform, contributor, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );

      await expect(
        platform.connect(contributor).donate(campaignId, { value: 0 }),
      ).to.be.revertedWith("Donation must be greater than zero");
    });

    it("rejects donations after the deadline", async function () {
      const { platform, contributor, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);

      await expect(
        platform.connect(contributor).donate(campaignId, { value: ONE_ETH }),
      ).to.be.revertedWith("Campaign deadline has passed");
    });

    it("rejects donations to cancelled campaigns", async function () {
      const { platform, creator, contributor, campaignId } =
        await networkHelpers.loadFixture(deployWithCampaignFixture);

      await platform.connect(creator).cancelCampaign(campaignId);

      await expect(
        platform.connect(contributor).donate(campaignId, { value: ONE_ETH }),
      ).to.be.revertedWith("Campaign is cancelled");
    });
  });

  describe("Fund claims", function () {
    it("rejects creator fund claims before the deadline", async function () {
      const { platform, creator, contributor, campaignId } =
        await networkHelpers.loadFixture(deployWithCampaignFixture);
      await platform.connect(contributor).donate(campaignId, { value: TARGET });

      await expect(platform.connect(creator).claimFunds(campaignId)).to.be.revertedWith(
        "Campaign deadline has not passed",
      );
    });

    it("allows the creator to claim funds after a successful campaign", async function () {
      const { platform, creator, contributor, campaignId } =
        await networkHelpers.loadFixture(deployWithCampaignFixture);
      await platform.connect(contributor).donate(campaignId, { value: TARGET });
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);

      await expect(platform.connect(creator).claimFunds(campaignId))
        .to.emit(platform, "FundsClaimed")
        .withArgs(campaignId, creator.address, TARGET);

      expect((await platform.getCampaign(campaignId)).fundsClaimed).to.equal(true);
      expect(await ethers.provider.getBalance(await platform.getAddress())).to.equal(0n);
      expect(await platform.getCampaignStatus(campaignId)).to.equal("Claimed");
    });

    it("rejects duplicate fund claims", async function () {
      const { platform, creator, contributor, campaignId } =
        await networkHelpers.loadFixture(deployWithCampaignFixture);
      await platform.connect(contributor).donate(campaignId, { value: TARGET });
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);
      await platform.connect(creator).claimFunds(campaignId);

      await expect(platform.connect(creator).claimFunds(campaignId)).to.be.revertedWith(
        "Funds already claimed",
      );
    });

    it("rejects claims by non-creators", async function () {
      const { platform, contributor, stranger, campaignId } =
        await networkHelpers.loadFixture(deployWithCampaignFixture);
      await platform.connect(contributor).donate(campaignId, { value: TARGET });
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);

      await expect(platform.connect(stranger).claimFunds(campaignId)).to.be.revertedWith(
        "Only creator can claim funds",
      );
    });
  });

  describe("Refunds and cancellation", function () {
    it("allows a contributor to claim a refund after a failed campaign", async function () {
      const { platform, contributor, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );
      await platform.connect(contributor).donate(campaignId, { value: ONE_ETH });
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);

      await expect(platform.connect(contributor).claimRefund(campaignId))
        .to.emit(platform, "RefundClaimed")
        .withArgs(campaignId, contributor.address, ONE_ETH);

      expect(await platform.getContribution(campaignId, contributor.address)).to.equal(0n);
      expect((await platform.getCampaign(campaignId)).amountRaised).to.equal(0n);
      expect(await platform.getCampaignStatus(campaignId)).to.equal("Failed");
    });

    it("rejects duplicate refunds", async function () {
      const { platform, contributor, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );
      await platform.connect(contributor).donate(campaignId, { value: ONE_ETH });
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);
      await platform.connect(contributor).claimRefund(campaignId);

      await expect(
        platform.connect(contributor).claimRefund(campaignId),
      ).to.be.revertedWith("No contribution to refund");
    });

    it("rejects refunds after a successful campaign", async function () {
      const { platform, contributor, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );
      await platform.connect(contributor).donate(campaignId, { value: TARGET });
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);

      await expect(
        platform.connect(contributor).claimRefund(campaignId),
      ).to.be.revertedWith("Refund is not available");
    });

    it("allows the creator to cancel a campaign", async function () {
      const { platform, creator, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );

      await expect(platform.connect(creator).cancelCampaign(campaignId))
        .to.emit(platform, "CampaignCancelled")
        .withArgs(campaignId);

      expect((await platform.getCampaign(campaignId)).cancelled).to.equal(true);
      expect(await platform.getCampaignStatus(campaignId)).to.equal("Cancelled");
    });

    it("allows the admin to cancel a campaign", async function () {
      const { platform, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );

      await expect(platform.cancelCampaign(campaignId))
        .to.emit(platform, "CampaignCancelled")
        .withArgs(campaignId);
    });

    it("rejects cancellation by unrelated accounts", async function () {
      const { platform, stranger, campaignId } = await networkHelpers.loadFixture(
        deployWithCampaignFixture,
      );

      await expect(platform.connect(stranger).cancelCampaign(campaignId)).to.be.revertedWith(
        "Only creator or admin can cancel",
      );
    });

    it("allows contributors to refund after campaign cancellation", async function () {
      const { platform, creator, contributor, campaignId } =
        await networkHelpers.loadFixture(deployWithCampaignFixture);
      await platform.connect(contributor).donate(campaignId, { value: ONE_ETH });
      await platform.connect(creator).cancelCampaign(campaignId);

      await expect(platform.connect(contributor).claimRefund(campaignId))
        .to.emit(platform, "RefundClaimed")
        .withArgs(campaignId, contributor.address, ONE_ETH);

      expect(await ethers.provider.getBalance(await platform.getAddress())).to.equal(0n);
    });
  });

  describe("Pause controls", function () {
    it("lets admin pause and unpause", async function () {
      const { platform } = await networkHelpers.loadFixture(deployPlatformFixture);

      await platform.pause();
      expect(await platform.paused()).to.equal(true);

      await platform.unpause();
      expect(await platform.paused()).to.equal(false);
    });

    it("blocks campaign creation, donation, and claim actions while paused", async function () {
      const { platform, creator, contributor, campaignId } =
        await networkHelpers.loadFixture(deployWithCampaignFixture);
      await platform.connect(contributor).donate(campaignId, { value: ONE_ETH });
      const campaign = await platform.getCampaign(campaignId);
      await networkHelpers.time.increaseTo(campaign.deadline);
      await platform.pause();

      await expect(
        platform.connect(creator).createCampaign("Paused", "Paused", "", TARGET, 1),
      ).to.be.revertedWithCustomError(platform, "EnforcedPause");

      await expect(
        platform.connect(contributor).donate(campaignId, { value: ONE_ETH }),
      ).to.be.revertedWithCustomError(platform, "EnforcedPause");

      await expect(
        platform.connect(contributor).claimRefund(campaignId),
      ).to.be.revertedWithCustomError(platform, "EnforcedPause");
    });
  });
});
