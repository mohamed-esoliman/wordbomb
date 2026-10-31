import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const words = readFileSync('apps/server/data/enable1.txt', 'utf8').split('\n');

function wordFor(prompt: string, used: Set<string>): string {
  const word = words.find((w) => w.length >= 3 && w.includes(prompt) && !used.has(w));
  if (!word) throw new Error(`no word for ${prompt}`);
  used.add(word);
  return word;
}

const wordInput = (page: Page) => page.getByRole('textbox', { name: 'Your word' });

async function currentHolder(ana: Page, ben: Page): Promise<[Page, Page]> {
  const holder = await Promise.race([
    wordInput(ana)
      .waitFor({ state: 'visible' })
      .then(() => ana)
      .catch(() => null),
    wordInput(ben)
      .waitFor({ state: 'visible' })
      .then(() => ben)
      .catch(() => null),
  ]);
  if (!holder) throw new Error('nobody holds the bomb');
  return holder === ana ? [ana, ben] : [ben, ana];
}

test('two players create, join, play a few turns and survive a refresh', async ({ browser }) => {
  const ana = await browser.newPage();
  await ana.goto('/');
  await ana.getByRole('textbox', { name: 'Your name' }).fill('Ana');
  await ana.getByRole('button', { name: 'Create a room' }).click();
  await expect(ana).toHaveURL(/\/room\/[A-Z2-9]{6}$/);
  await expect(ana.getByText('1 of 8 seats filled')).toBeVisible();

  const ben = await browser.newPage();
  await ben.goto(ana.url());
  await ben.getByRole('textbox', { name: 'Your name' }).fill('Ben');
  await ben.getByRole('button', { name: 'Join room' }).click();
  await expect(ben.getByText('Waiting for the host to start')).toBeVisible();
  await expect(ana.getByText('2 of 8 seats filled')).toBeVisible();

  await ben.getByRole('textbox', { name: 'Chat message' }).fill('hello');
  await ben.keyboard.press('Enter');
  await expect(ana.getByText('hello', { exact: true })).toBeVisible();

  await ana.getByRole('button', { name: 'Start game' }).click();
  await expect(ana.getByTestId('prompt')).toBeVisible();
  await expect(ben.getByTestId('prompt')).toBeVisible();

  const used = new Set<string>();
  for (let turn = 0; turn < 3; turn++) {
    const [holder, other] = await currentHolder(ana, ben);
    const prompt = (await holder.getByTestId('prompt').textContent())!.trim().toLowerCase();
    expect(prompt.length).toBeGreaterThanOrEqual(2);

    await wordInput(holder).fill('zzzz');
    await holder.keyboard.press('Enter');
    await expect(holder.getByRole('status')).toContainText(/prompt|dictionary/);

    const word = wordFor(prompt, used);
    await wordInput(holder).fill(word);
    await holder.keyboard.press('Enter');
    await expect(wordInput(other)).toBeVisible();
    await expect(other.getByRole('listitem').filter({ hasText: word }).first()).toBeVisible();
  }

  const [, other] = await currentHolder(ana, ben);
  await other.reload();
  await expect(other.getByTestId('prompt')).toBeVisible();
  await expect(other.getByText(/\(you\)/)).toBeVisible();

  await ana.close();
  await ben.close();
});

test('an unknown room code shows a friendly error', async ({ page }) => {
  await page.goto('/room/ZZZZZZ');
  await page.getByRole('textbox', { name: 'Your name' }).fill('Cleo');
  await page.getByRole('button', { name: 'Join room' }).click();
  await expect(page.getByText('Room not found')).toBeVisible();
  await page.getByRole('button', { name: 'Back home' }).click();
  await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
});
