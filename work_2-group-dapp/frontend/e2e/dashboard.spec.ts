import { expect, test } from '@playwright/test';

test.describe('FundMaaser dashboard', () => {
  test('renders dashboard, demo data, and create form without console errors', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Full create-form interaction is covered on desktop; mobile has a focused layout test.');

    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/');

    await expect(page).toHaveTitle('FundMaaser Dashboard');
    await expect(page.getByRole('heading', { name: 'Welcome, Group 8!' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
    await expect(page.locator('.campaign-card')).toHaveCount(3);
    await expect(page.getByText('Demo view')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Donate' }).first()).toBeDisabled();

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

    await page.getByRole('dialog').getByRole('button', { name: 'Create Campaign' }).click();
    await expect(page.getByText('MetaMask or another EIP-1193 wallet is required.')).toBeVisible();

    await page.getByLabel('Grant creator role').fill('0x0000000000000000000000000000000000000001');
    await expect(page.getByRole('button', { name: 'Grant Role' })).toBeEnabled();

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

    await page.getByRole('link', { name: /Contract/ }).click();
    await expect(page).toHaveURL(/\/contract$/);
    await expect(page.getByRole('heading', { name: 'localhost' })).toBeVisible();

    await page.getByRole('link', { name: /Dashboard/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Welcome, Group 8!' })).toBeVisible();
  });

  test('mobile layout keeps core navigation and campaign content accessible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'FundMaaser dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Campaigns/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome, Group 8!' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Solar School Upgrade' })).toBeVisible();
  });
});
