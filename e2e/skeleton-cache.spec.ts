import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:7777";

/** Click a sidebar nav button by its label text */
async function clickSidebarNav(page: Page, label: string) {
  await page.locator(`.sidebar-item .sidebar-label:text-is("${label}")`).click();
  await page.waitForTimeout(200);
}

test.describe.configure({ mode: "serial" });

test.describe("Skeleton Loading & Cache", () => {
  test("should show skeleton cards when loading agents with no cache", async ({ page }) => {
    // Intercept both APIs with delay BEFORE any navigation
    await page.route("**/api/agents*", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.route("**/api/teams*", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // Navigate fresh with cleared storage
    await page.addInitScript(() => sessionStorage.clear());
    await page.goto(BASE + "/?view=agents");

    // Skeleton cards should appear while APIs are delayed
    const skeletons = page.locator(".skeleton-card");
    await expect(skeletons.first()).toBeVisible({ timeout: 5000 });

    // Wait for delayed APIs to respond
    await page.waitForTimeout(2500);

    // Skeletons should be gone after data loads
    await expect(skeletons).toHaveCount(0, { timeout: 5000 });
  });

  test("should display agent data after loading completes", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // Should be on agents view by default
    // Wait for actual agent cards to appear
    const agentCards = page.locator(".agent-card");
    const emptyState = page.locator(".empty-state");

    // Either agent cards or empty state should be visible (not skeleton)
    await expect(agentCards.first().or(emptyState)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".skeleton-card")).toHaveCount(0);
  });

  test("should cache agents data in sessionStorage", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500); // wait for cache write

    // Check that sessionStorage has the cache
    const cacheKey = await page.evaluate(() => {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("agents-cache-")) return key;
      }
      return null;
    });

    expect(cacheKey).not.toBeNull();
  });

  test("should use stale cache on reload (no skeleton flash)", async ({ page }) => {
    // First load: populate cache
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Slow down API on reload
    await page.route("**/api/agents*", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    // Reload page
    await page.reload();
    await page.waitForTimeout(300);

    // Should NOT show skeleton (cache is used)
    const skeletons = page.locator(".skeleton-card");
    await expect(skeletons).toHaveCount(0);

    // Should show content from cache immediately
    const agentCards = page.locator(".agent-card");
    const emptyState = page.locator(".empty-state");
    await expect(agentCards.first().or(emptyState)).toBeVisible({ timeout: 2000 });
  });

  test("should use different cache per threshold", async ({ page }) => {
    // Load with default threshold
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Check default threshold cache exists
    const hasDefaultCache = await page.evaluate(() => {
      return sessionStorage.getItem("agents-cache-5") !== null;
    });
    expect(hasDefaultCache).toBe(true);

    // Change threshold via URL
    await page.goto(BASE + "/?threshold=10");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Check that threshold-10 cache now exists
    const hasNewCache = await page.evaluate(() => {
      return sessionStorage.getItem("agents-cache-10") !== null;
    });
    expect(hasNewCache).toBe(true);
  });

  test("existing E2E tests still pass - default view is agents", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // URL should have no params by default
    expect(new URL(page.url()).search).toBe("");
  });

  test("existing E2E - view switching works", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // Switch to events view
    await clickSidebarNav(page, "EVENTS");
    expect(new URL(page.url()).searchParams.get("view")).toBe("events");

    // Switch back to agents
    await clickSidebarNav(page, "AGENTS");
    await page.waitForTimeout(200);
    // Default view should clear the param
    expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  });
});
