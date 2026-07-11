// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CrowdfundingPlatform
/// @notice ETH crowdfunding platform with role-gated campaign creation, donations,
/// creator fund claims, contributor refunds, pause controls, and event logs.
contract CrowdfundingPlatform is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");

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

    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

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

    modifier campaignExists(uint256 campaignId) {
        require(campaignId > 0 && campaignId <= campaignCount, "Campaign does not exist");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function grantCreatorRole(address creator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(creator != address(0), "Creator is zero address");
        grantRole(CREATOR_ROLE, creator);
        emit CreatorRoleGranted(creator);
    }

    function revokeCreatorRole(address creator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(CREATOR_ROLE, creator);
        emit CreatorRoleRevoked(creator);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function createCampaign(
        string calldata title,
        string calldata description,
        string calldata metadataURI,
        uint256 targetAmount,
        uint256 durationInDays
    ) external onlyRole(CREATOR_ROLE) whenNotPaused returns (uint256 campaignId) {
        require(bytes(title).length > 0, "Title is required");
        require(targetAmount > 0, "Target amount must be greater than zero");
        require(durationInDays > 0, "Duration must be greater than zero");

        campaignId = ++campaignCount;
        uint256 deadline = block.timestamp + (durationInDays * 1 days);

        campaigns[campaignId] = Campaign({
            id: campaignId,
            creator: payable(msg.sender),
            title: title,
            description: description,
            metadataURI: metadataURI,
            targetAmount: targetAmount,
            deadline: deadline,
            amountRaised: 0,
            cancelled: false,
            fundsClaimed: false
        });

        emit CampaignCreated(campaignId, msg.sender, title, targetAmount, deadline);
    }

    function cancelCampaign(uint256 campaignId)
        external
        whenNotPaused
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];

        require(
            msg.sender == campaign.creator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only creator or admin can cancel"
        );
        require(!campaign.cancelled, "Campaign already cancelled");
        require(!campaign.fundsClaimed, "Funds already claimed");

        campaign.cancelled = true;

        emit CampaignCancelled(campaignId);
    }

    function donate(uint256 campaignId)
        external
        payable
        nonReentrant
        whenNotPaused
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];

        require(!campaign.cancelled, "Campaign is cancelled");
        require(block.timestamp < campaign.deadline, "Campaign deadline has passed");
        require(msg.value > 0, "Donation must be greater than zero");

        campaign.amountRaised += msg.value;
        contributions[campaignId][msg.sender] += msg.value;

        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function claimFunds(uint256 campaignId)
        external
        nonReentrant
        whenNotPaused
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];

        require(msg.sender == campaign.creator, "Only creator can claim funds");
        require(!campaign.cancelled, "Campaign is cancelled");
        require(!campaign.fundsClaimed, "Funds already claimed");
        require(isCampaignExpired(campaignId), "Campaign deadline has not passed");
        require(isCampaignSuccessful(campaignId), "Funding target not reached");

        uint256 amount = campaign.amountRaised;
        campaign.fundsClaimed = true;

        (bool sent, ) = campaign.creator.call{value: amount}("");
        require(sent, "Fund transfer failed");

        emit FundsClaimed(campaignId, campaign.creator, amount);
    }

    function claimRefund(uint256 campaignId)
        external
        nonReentrant
        whenNotPaused
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];

        require(!campaign.fundsClaimed, "Funds already claimed");
        require(
            campaign.cancelled || (isCampaignExpired(campaignId) && !isCampaignSuccessful(campaignId)),
            "Refund is not available"
        );

        uint256 refundAmount = contributions[campaignId][msg.sender];
        require(refundAmount > 0, "No contribution to refund");

        contributions[campaignId][msg.sender] = 0;
        campaign.amountRaised -= refundAmount;

        (bool sent, ) = payable(msg.sender).call{value: refundAmount}("");
        require(sent, "Refund transfer failed");

        emit RefundClaimed(campaignId, msg.sender, refundAmount);
    }

    function getCampaign(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (Campaign memory)
    {
        return campaigns[campaignId];
    }

    function getContribution(uint256 campaignId, address contributor)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        return contributions[campaignId][contributor];
    }

    function isCampaignSuccessful(uint256 campaignId)
        public
        view
        campaignExists(campaignId)
        returns (bool)
    {
        return campaigns[campaignId].amountRaised >= campaigns[campaignId].targetAmount;
    }

    function isCampaignExpired(uint256 campaignId)
        public
        view
        campaignExists(campaignId)
        returns (bool)
    {
        return block.timestamp >= campaigns[campaignId].deadline;
    }

    function getCampaignStatus(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (string memory)
    {
        Campaign storage campaign = campaigns[campaignId];

        if (campaign.cancelled) {
            return "Cancelled";
        }

        if (campaign.fundsClaimed) {
            return "Claimed";
        }

        if (!isCampaignExpired(campaignId)) {
            return "Active";
        }

        if (isCampaignSuccessful(campaignId)) {
            return "Successful";
        }

        return "Failed";
    }
}
