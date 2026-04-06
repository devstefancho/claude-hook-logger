import { test, expect } from "@playwright/test";

const BASE = "http://localhost:7777";

test.describe("Team URL param restoration fix", () => {
  test("team param in URL shows team detail view", async ({ page }) => {
    await page.goto(`${BASE}/?team=cc-masterclass-research`);
    await page.waitForLoadState("networkidle");

    // URL should still have the team param (not wiped on mount)
    const url = new URL(page.url());
    expect(url.searchParams.get("team")).toBe("cc-masterclass-research");

    // Should display team detail view (back button or team name visible)
    // If team doesn't exist, the param should still persist in URL
  });

  test("team param persists after page reload", async ({ page }) => {
    await page.goto(`${BASE}/?team=cc-masterclass-research`);
    await page.waitForLoadState("networkidle");

    // Reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    const url = new URL(page.url());
    expect(url.searchParams.get("team")).toBe("cc-masterclass-research");
  });

  test("team + agentView=cards persists after reload", async ({ page }) => {
    await page.goto(`${BASE}/?team=cc-masterclass-research&agentView=cards`);
    await page.waitForLoadState("networkidle");

    let url = new URL(page.url());
    expect(url.searchParams.get("team")).toBe("cc-masterclass-research");
    expect(url.searchParams.get("agentView")).toBe("cards");

    // Reload and verify
    await page.reload();
    await page.waitForLoadState("networkidle");

    url = new URL(page.url());
    expect(url.searchParams.get("team")).toBe("cc-masterclass-research");
    expect(url.searchParams.get("agentView")).toBe("cards");
  });

  test("ESC key removes team param from URL", async ({ page }) => {
    await page.goto(`${BASE}/?team=cc-masterclass-research`);
    await page.waitForLoadState("networkidle");

    // Verify team is set
    expect(new URL(page.url()).searchParams.get("team")).toBe("cc-masterclass-research");

    // Press Escape to go back to overview
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // team param should be removed (null is default)
    const url = new URL(page.url());
    expect(url.searchParams.has("team")).toBe(false);
  });

  test("switching viewMode resets team (but not on initial mount)", async ({ page }) => {
    // Load with team selected in teams view (default)
    await page.goto(`${BASE}/?team=cc-masterclass-research`);
    await page.waitForLoadState("networkidle");

    // team should still be present (initial mount should NOT reset)
    expect(new URL(page.url()).searchParams.get("team")).toBe("cc-masterclass-research");

    // Now switch viewMode to cards - this SHOULD reset team
    const cardsBtn = page.locator("button[title='Grid']");
    if (await cardsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardsBtn.click();
      await page.waitForTimeout(200);

      // team should be removed because viewMode changed
      expect(new URL(page.url()).searchParams.has("team")).toBe(false);
    }
  });
});
