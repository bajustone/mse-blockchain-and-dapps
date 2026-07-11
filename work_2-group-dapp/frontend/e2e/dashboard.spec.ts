import { expect, test } from '@playwright/test';

test.describe('BlockFunds dashboard', () => {
  test('renders dashboard, live empty states, and create form without console errors', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Full create-form interaction is covered on desktop; mobile has a focused layout test.');

    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/');

    await expect(page).toHaveTitle('BlockFunds Dashboard');
    await expect(page.getByRole('heading', { name: 'Welcome, Group 8!' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
    await expect(page.getByText('Live Sepolia data')).toBeVisible();
    await expect(page.getByText('No campaigns yet')).toBeVisible();
    await expect(page.getByText('No contract activity yet')).toBeVisible();
    await expect(page.getByText('Solar School Upgrade')).toHaveCount(0);
    await expect(page.getByText('Henry Adams')).toHaveCount(0);

    const shellBackground = await page
      .locator('.page-shell')
      .evaluate((element) => `${getComputedStyle(element).backgroundImage} ${getComputedStyle(element).backgroundColor}`);
    expect(shellBackground).not.toContain('#bff2ca');
    expect(shellBackground).not.toContain('191, 242, 202');
    expect(shellBackground).not.toContain('197, 245, 206');

    await page.getByRole('link', { name: 'Add Campaign' }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await page.getByRole('button', { name: 'Create Campaign' }).click();
    await expect(page.getByRole('heading', { name: 'Create a campaign' })).toBeVisible();

    await page.getByLabel('Campaign title').fill('E2E Test Campaign');
    await page.getByLabel('Target ETH').fill('2.5');
    await page.getByLabel('Duration days').fill('10');
    await page.getByLabel('Metadata URI').fill('ipfs://e2e-test');
    await page.getByLabel('Description').fill('Browser e2e form input test.');

    await expect(page.getByLabel('Campaign title')).toHaveValue('E2E Test Campaign');
    await expect(page.getByLabel('Target ETH')).toHaveValue('2.5');
    await expect(page.getByRole('button', { name: 'Upload to IPFS' })).toBeVisible();

    await page.getByRole('dialog').getByRole('button', { name: 'Create Campaign' }).click();
    await expect(page.getByText('MetaMask or another EIP-1193 wallet is required.')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Open Role Management' })).toHaveAttribute('href', '/roles');

    expect(consoleErrors).toEqual([]);
  });

  test('routes all sidebar menu items to dedicated pages', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop route coverage is enough; mobile has a layout-focused test.');

    await page.goto('/');

    await page.getByRole('link', { name: /Campaigns/ }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Create Campaign' }).click();
    await expect(page.getByRole('heading', { name: 'Create a campaign' })).toBeVisible();
    await page.getByRole('button', { name: '×' }).click();

    await page.getByRole('link', { name: /Activity/ }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();

    await page.getByRole('link', { name: /Roles/ }).click();
    await expect(page).toHaveURL(/\/roles$/);
    await expect(page.getByRole('heading', { name: 'Role Management' })).toBeVisible();
    await page.getByLabel('Wallet address').fill('0x0000000000000000000000000000000000000001');
    await expect(page.getByRole('button', { name: 'Grant Creator Role' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Revoke Creator Role' })).toBeEnabled();

    await page.getByRole('link', { name: /Contract/ }).click();
    await expect(page).toHaveURL(/\/contract$/);
    await expect(page.getByText(/Contract/i).first()).toBeVisible();

    await page.getByRole('link', { name: /Dashboard/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Welcome, Group 8!' })).toBeVisible();
  });

  test('mobile layout keeps core navigation and campaign content accessible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'BlockFunds dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Campaigns/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Roles/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome, Group 8!' })).toBeVisible();
    await expect(page.getByText('No campaigns yet')).toBeVisible();
  });
});
