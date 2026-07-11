<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Progress } from '$lib/components/ui/progress/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Avatar } from '$lib/components/ui/avatar/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import {
    CONTRACT_ADDRESS,
    CONTRACT_NETWORK,
    cancelCampaign,
    claimFunds,
    claimRefund,
    connectWallet,
    createCampaign,
    donateToCampaign,
    formatCurrencyEth,
    grantCreatorRole,
    loadActivity,
    loadCampaigns,
    shortAddress
  } from '$lib/contract';
  import type { CampaignView, TransactionItem } from '$lib/types';

  export let page: 'dashboard' | 'campaigns' | 'activity' | 'contract' = 'dashboard';

  let campaigns: CampaignView[] = [];
  let transactions: TransactionItem[] = [];
  let usingDemoData = false;
  let loading = true;
  let busy = false;
  let statusMessage = 'Loading live contract data from Sepolia...';
  let walletAddress = '';
  let chainId = '';
  let selectedCampaign: CampaignView | null = null;
  let createDialogOpen = false;
  let donateDialogOpen = false;
  let donateAmount = '0.1';
  let creatorAddress = '';

  const emptyForm = () => ({
    title: '',
    description: '',
    metadataURI: '',
    targetEth: '',
    durationDays: '7'
  });

  let form = emptyForm();

  $: visibleCampaigns = campaigns;
  $: visibleTransactions = transactions;
  $: totalRaised = visibleCampaigns.reduce((sum, campaign) => sum + campaign.amountRaised, 0n);
  $: totalTarget = visibleCampaigns.reduce((sum, campaign) => sum + campaign.targetAmount, 0n);
  $: activeCampaigns = visibleCampaigns.filter((campaign) => campaign.status === 'Active').length;
  $: successRate = visibleCampaigns.length
    ? Math.round((visibleCampaigns.filter((campaign) => ['Successful', 'Claimed'].includes(campaign.status)).length / visibleCampaigns.length) * 100)
    : 0;
  $: raisedProgress = totalTarget === 0n ? 0 : Math.min(100, Number((totalRaised * 10000n) / totalTarget) / 100);
  $: pageTitle = {
    dashboard: 'Dashboard',
    campaigns: 'Campaigns',
    activity: 'Activity',
    contract: 'Contract'
  }[page];

  onMount(() => {
    void restoreConnectedWallet();
    void refreshCampaigns();

    const handleAccountsChanged = (accounts: unknown) => {
      const addresses = Array.isArray(accounts) ? accounts.map(String) : [];
      walletAddress = addresses[0] ?? '';
      creatorAddress = walletAddress;
    };

    const handleChainChanged = (chain: unknown) => {
      chainId = typeof chain === 'string' ? BigInt(chain).toString() : '';
      void refreshCampaigns();
    };

    window.ethereum?.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum?.on?.('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
  });

  async function restoreConnectedWallet() {
    if (!window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const addresses = Array.isArray(accounts) ? accounts.map(String) : [];
      if (addresses[0]) {
        walletAddress = addresses[0];
        creatorAddress = addresses[0];
      }

      const chain = await window.ethereum.request({ method: 'eth_chainId' });
      if (typeof chain === 'string') chainId = BigInt(chain).toString();
    } catch {
      // Explicit Connect Wallet still reports errors.
    }
  }

  async function runTask(task: () => Promise<void>, success: string) {
    busy = true;
    statusMessage = 'Waiting for transaction confirmation...';
    try {
      await task();
      statusMessage = success;
      await refreshCampaigns();
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Transaction failed.';
    } finally {
      busy = false;
    }
  }

  async function refreshCampaigns() {
    loading = true;
    try {
      const [liveCampaigns, liveTransactions] = await Promise.all([loadCampaigns(8), loadActivity(20)]);
      campaigns = liveCampaigns;
      transactions = liveTransactions;
      usingDemoData = false;
      statusMessage = liveCampaigns.length
        ? `Loaded ${liveCampaigns.length} campaign${liveCampaigns.length === 1 ? '' : 's'} from ${CONTRACT_NETWORK}.`
        : `No live campaigns found on ${CONTRACT_NETWORK}.`;
    } catch (error) {
      usingDemoData = false;
      campaigns = [];
      transactions = [];
      statusMessage = error instanceof Error
        ? `Could not load live campaigns: ${error.message}`
        : 'Could not load live campaigns.';
    } finally {
      loading = false;
    }
  }

  async function connect() {
    busy = true;
    try {
      const wallet = await connectWallet();
      walletAddress = wallet.address;
      chainId = wallet.chainId.toString();
      creatorAddress = wallet.address;
      statusMessage = `Connected ${shortAddress(wallet.address)} on chain ${wallet.chainId}.`;
      await refreshCampaigns();
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Wallet connection failed.';
    } finally {
      busy = false;
    }
  }

  function openDonation(campaign: CampaignView) {
    selectedCampaign = campaign;
    donateAmount = '0.1';
    donateDialogOpen = true;
  }

  function closeDonation() {
    selectedCampaign = null;
    donateDialogOpen = false;
  }
</script>

<svelte:head>
  <title>BlockFunds {pageTitle}</title>
  <meta name="description" content="SvelteKit dashboard for the BlockFunds blockchain crowdfunding platform." />
</svelte:head>

{#snippet campaignCards()}
  <div class="campaign-list">
    {#each visibleCampaigns as campaign (campaign.id)}
      <Card.Root class="campaign-card">
        <div class="campaign-topline">
          <Avatar class="campaign-icon">{campaign.status === 'Active' ? '🌱' : campaign.status === 'Cancelled' ? '⚠️' : '✨'}</Avatar>
          <Badge class={`status ${campaign.status.toLowerCase()}`}>{campaign.status}</Badge>
        </div>
        <h3>{campaign.title}</h3>
        <p>{campaign.description}</p>

        <div class="campaign-progress">
          <Progress class="progress-track" value={campaign.progress} />
          <span>{campaign.progress.toFixed(1)}%</span>
        </div>

        <dl>
          <div><dt>Raised</dt><dd>{campaign.raisedEth}</dd></div>
          <div><dt>Target</dt><dd>{campaign.targetEth}</dd></div>
          <div><dt>Deadline</dt><dd>{campaign.deadlineLabel}</dd></div>
          <div><dt>Creator</dt><dd>{shortAddress(campaign.creator)}</dd></div>
        </dl>

        <div class="campaign-actions">
          <Button class="primary-button compact" onclick={() => openDonation(campaign)} disabled={usingDemoData || campaign.status !== 'Active'}>Donate</Button>
          <Button variant="ghost" class="ghost-button compact" title={campaign.status === 'Active' ? 'Claim is available after the deadline if the target is reached.' : undefined} onclick={() => runTask(() => claimFunds(campaign.id), 'Funds claimed successfully.')} disabled={usingDemoData || busy || campaign.status !== 'Successful'}>Claim</Button>
          <Button variant="ghost" class="ghost-button compact" title={campaign.status === 'Active' ? 'Refund is available after a failed or cancelled campaign.' : undefined} onclick={() => runTask(() => claimRefund(campaign.id), 'Refund claimed successfully.')} disabled={usingDemoData || busy || !['Failed', 'Cancelled'].includes(campaign.status)}>Refund</Button>
          <Button variant="ghost" class="ghost-button compact" onclick={() => runTask(() => cancelCampaign(campaign.id), 'Campaign cancelled successfully.')} disabled={usingDemoData || busy || campaign.status !== 'Active'}>Cancel</Button>
        </div>
      </Card.Root>
    {/each}

    {#if visibleCampaigns.length === 0}
      <article class="empty-state campaign-empty">
        <strong>{loading ? 'Loading live campaigns...' : 'No campaigns yet'}</strong>
        <span>{loading ? 'Reading campaign data from the deployed contract.' : 'Create the first campaign to populate this dashboard.'}</span>
      </article>
    {/if}
  </div>
{/snippet}

{#snippet transactionsPanel()}
  <div class="transactions-header">
    <h2>Transactions</h2>
    <span>•••</span>
  </div>

  <div class="transaction-list">
    {#each visibleTransactions as transaction}
      <article class={`transaction-card ${transaction.tone}`}>
        <div class="tx-avatar">{transaction.positive ? '🟢' : '🟣'}</div>
        <div>
          <strong>{transaction.type}</strong>
          <span>{transaction.name}</span>
        </div>
        <div class="tx-amount" class:positive={transaction.positive}>
          <strong>{transaction.amount}</strong>
          <span>{transaction.date}</span>
        </div>
      </article>
    {/each}

    {#if visibleTransactions.length === 0}
      <article class="empty-state">
        <strong>No contract activity yet</strong>
        <span>Create a campaign, donate, claim, refund, or cancel to see blockchain events here.</span>
      </article>
    {/if}
  </div>
{/snippet}

{#snippet contractPanel()}
  <Card.Root class="contract-card route-card">
    <p class="eyebrow">Contract</p>
    <h3>{CONTRACT_NETWORK}</h3>
    <p>{CONTRACT_ADDRESS || 'Run npm run export:abi after local deployment.'}</p>
    <small>{statusMessage}</small>
  </Card.Root>
{/snippet}

{#snippet createForm()}
  <form class="create-form" on:submit|preventDefault={() => runTask(async () => {
    await createCampaign(form.title, form.description, form.metadataURI, form.targetEth, form.durationDays);
    form = emptyForm();
    createDialogOpen = false;
  }, 'Campaign created successfully.')}>
    <label>
      Campaign title
      <Input bind:value={form.title} placeholder="e.g. Community Solar Campaign" required />
    </label>
    <label>
      Target ETH
      <Input bind:value={form.targetEth} inputmode="decimal" placeholder="e.g. 0.5" required />
    </label>
    <label>
      Duration days
      <Input bind:value={form.durationDays} inputmode="numeric" required />
    </label>
    <label>
      Metadata URI
      <Input bind:value={form.metadataURI} placeholder="ipfs://... or https://..." />
    </label>
    <label class="wide">
      Description
      <Textarea bind:value={form.description} rows={3} placeholder="Describe the cause and how funds will be used." required />
    </label>
    <Button class="primary-button wide" type="submit" disabled={busy}>Create Campaign</Button>
  </form>

  <Separator />

  <div class="role-panel">
    <label>
      Grant creator role
      <Input bind:value={creatorAddress} placeholder="0x..." />
    </label>
    <Button variant="ghost" class="ghost-button" onclick={() => runTask(() => grantCreatorRole(creatorAddress), 'Creator role granted.')} disabled={busy || !creatorAddress}>Grant Role</Button>
  </div>

  <p class="form-status" role="status">{statusMessage}</p>
{/snippet}

<main class="page-shell">
  <section class="dashboard-frame">
    <aside class="sidebar">
      <a class="brand" href="/" aria-label="BlockFunds dashboard">
        <span class="brand-mark">✦</span>
        <span>BlockFunds</span>
      </a>

      <nav class="nav-list" aria-label="Dashboard navigation">
        <a class:active={page === 'dashboard'} class="nav-item" href="/"><span>▦</span> Dashboard</a>
        <a class:active={page === 'campaigns'} class="nav-item" href="/campaigns"><span>◉</span> Campaigns</a>
        <a class:active={page === 'activity'} class="nav-item" href="/activity"><span>↔</span> Activity</a>
        <a class:active={page === 'contract'} class="nav-item" href="/contract"><span>◈</span> Contract</a>
      </nav>

      <div class="profile-card">
        <div class="avatar">🧑🏽‍🚀</div>
        <strong>{walletAddress ? shortAddress(walletAddress) : 'BlockFunds'}</strong>
        <span>{walletAddress ? `Chain ${chainId}` : '@blockfunds'}</span>
      </div>
    </aside>

    <section class="main-panel">
      <header class="topbar">
        <div class="metric-row" aria-label="Platform summary">
          <span><i class="dot blue"></i> Raised <strong>{formatCurrencyEth(totalRaised)}</strong></span>
          <span><i class="dot green"></i> Target <strong>{formatCurrencyEth(totalTarget)}</strong></span>
          <span><i class="dot purple"></i> Active <strong>{activeCampaigns}</strong></span>
        </div>

        <div class="actions">
          <Button variant="outline" size="icon" class="round-button" onclick={refreshCampaigns} disabled={loading} aria-label="Refresh campaigns">↻</Button>
          <Button class="primary-button" onclick={connect} disabled={busy}>
            {walletAddress ? shortAddress(walletAddress) : 'Connect Wallet'}
          </Button>
        </div>
      </header>

      {#if page === 'dashboard'}
        <div class="content-grid">
          <section class="hero-column">
            <div class="welcome-row">
              <div>
                <p class="eyebrow">Sepolia-ready crowdfunding</p>
                <h1>Welcome, Group 8!</h1>
              </div>
              <Badge class="network-pill live-pill">
                Live Sepolia data
              </Badge>
            </div>

            <div class="summary-grid">
              <Card.Root class="balance-card glass-card">
                <span>Your Contributions</span>
                <strong>{formatCurrencyEth(totalRaised)}</strong>
                <Progress class="progress-track segmented" label="Raised progress" value={raisedProgress} />
                <div class="scale"><span>0%</span><span>50%</span><span>100%</span></div>
              </Card.Root>

              <Card.Root class="spotlight-card">
                <span>Your Charity Fund</span>
                <strong>{formatCurrencyEth(totalTarget)}</strong>
                <a class="primary-button large" href="/campaigns">Add Campaign</a>
              </Card.Root>

              <Card.Root class="balance-card glass-card required-card">
                <span>Success Rate</span>
                <strong>{successRate}<small>%</small></strong>
                <Progress class="progress-track segmented lime" label="Success progress" value={successRate} />
                <Badge class="floating-badge">+{Math.max(0, successRate)}%</Badge>
              </Card.Root>
            </div>

            <section class="statistics-card">
              <div class="section-heading">
                <div><p class="eyebrow">Statistics</p><h2>Campaigns</h2></div>
                <a class="ghost-button" href="/campaigns">View all</a>
              </div>
              {@render campaignCards()}
            </section>
          </section>

          <aside class="right-column">
            {@render transactionsPanel()}
            {@render contractPanel()}
          </aside>
        </div>
      {:else if page === 'campaigns'}
        <section class="statistics-card page-card">
          <div class="section-heading">
            <div><p class="eyebrow">Campaign management</p><h1>Campaigns</h1></div>
            <div class="actions">
              <Button variant="ghost" class="ghost-button" onclick={refreshCampaigns} disabled={loading}>Refresh</Button>
              <Dialog.Root bind:open={createDialogOpen}>
                <Button class="primary-button" onclick={() => (createDialogOpen = true)}>Create Campaign</Button>
                <Dialog.Content class="create-dialog">
                  <Dialog.Header>
                    <p class="eyebrow">Creator tools</p>
                    <Dialog.Title>Create a campaign</Dialog.Title>
                    <Dialog.Description>Launch a new ETH crowdfunding campaign on the connected contract.</Dialog.Description>
                  </Dialog.Header>
                  {@render createForm()}
                </Dialog.Content>
              </Dialog.Root>
            </div>
          </div>
          {@render campaignCards()}
        </section>
      {:else if page === 'activity'}
        <section class="page-card activity-page">
          {@render transactionsPanel()}
        </section>
      {:else if page === 'contract'}
        <section class="contract-page-grid">
          {@render contractPanel()}
          <Card.Root class="contract-card route-card">
            <p class="eyebrow">Network status</p>
            <h3>{walletAddress ? shortAddress(walletAddress) : 'Wallet not connected'}</h3>
            <p>Configured network: {CONTRACT_NETWORK}</p>
            <small>Chain: {chainId || 'unknown'} · Refresh after switching MetaMask networks.</small>
          </Card.Root>
        </section>
      {/if}
    </section>
  </section>

  <Dialog.Root bind:open={donateDialogOpen}>
    {#if selectedCampaign}
      <Dialog.Content>
        <Dialog.Header>
          <p class="eyebrow">Donate ETH</p>
          <Dialog.Title>{selectedCampaign.title}</Dialog.Title>
          <Dialog.Description>{selectedCampaign.description}</Dialog.Description>
        </Dialog.Header>
        <label>
          Amount in ETH
          <Input bind:value={donateAmount} inputmode="decimal" />
        </label>
        <Button
          class="primary-button wide"
          disabled={busy}
          onclick={() => runTask(async () => {
            await donateToCampaign(selectedCampaign!.id, donateAmount);
            closeDonation();
          }, 'Donation confirmed.')}
        >
          Donate {donateAmount || '0'} ETH
        </Button>
      </Dialog.Content>
    {/if}
  </Dialog.Root>
</main>
