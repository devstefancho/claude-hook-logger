import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:7777";

/** Click a sidebar nav button by its label text */
async function clickSidebarNav(page: Page, label: string) {
  await page.locator(`.sidebar-item .sidebar-label:text-is("${label}")`).click();
  await page.waitForTimeout(200); // wait for debounce flush
}

/** Helper to get current URL params */
function getParams(page: Page) {
  return new URL(page.url()).searchParams;
}

test.describe("URL State Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
  });

  test.describe("Default state - clean URL", () => {
    test("should have no query params on initial load", async ({ page }) => {
      expect(new URL(page.url()).search).toBe("");
    });

    test("should keep URL clean when view is the default (agents)", async ({ page }) => {
      expect(getParams(page).has("view")).toBe(false);
    });
  });

  test.describe("View switching updates URL", () => {
    test("switching to events view adds view=events to URL", async ({ page }) => {
      await clickSidebarNav(page, "EVENTS");
      expect(getParams(page).get("view")).toBe("events");
    });

    test("switching to tools view adds view=tools to URL", async ({ page }) => {
      await clickSidebarNav(page, "TOOLS");
      expect(getParams(page).get("view")).toBe("tools");
    });

    test("switching to skills view adds view=skills to URL", async ({ page }) => {
      await clickSidebarNav(page, "SKILLS");
      expect(getParams(page).get("view")).toBe("skills");
    });

    test("switching back to agents (default) removes view from URL", async ({ page }) => {
      await clickSidebarNav(page, "TOOLS");
      expect(getParams(page).get("view")).toBe("tools");

      await clickSidebarNav(page, "AGENTS");
      expect(getParams(page).has("view")).toBe(false);
    });
  });

  test.describe("URL state restoration on reload", () => {
    test("view=events persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=events`);
      await page.waitForLoadState("networkidle");

      // The events view should render its heading
      await expect(page.locator(".view-title:text-is('EVENTS')")).toBeVisible({ timeout: 5000 });
    });

    test("view=tools persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=tools`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator(".view-title:text-is('TOOLS')")).toBeVisible({ timeout: 5000 });
    });

    test("view=skills persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=skills`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator(".view-title:text-is('SKILLS')")).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Events view - filters and search in URL", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}?view=events`);
      await page.waitForLoadState("networkidle");
    });

    test("search text is reflected in URL", async ({ page }) => {
      const searchInput = page.locator(".search-input");
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill("Read");
      await page.waitForTimeout(200);

      expect(getParams(page).get("search")).toBe("Read");
    });

    test("search text persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=events&search=Write`);
      await page.waitForLoadState("networkidle");

      const searchInput = page.locator(".search-input");
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await expect(searchInput).toHaveValue("Write");
    });

    test("time range is reflected in URL", async ({ page }) => {
      const timeBtn = page.locator("button:text-is('1h')");
      if (await timeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await timeBtn.click();
        await page.waitForTimeout(200);
        expect(getParams(page).get("timeRange")).toBe("1h");
      }
    });

    test("clearing search removes it from URL", async ({ page }) => {
      const searchInput = page.locator(".search-input");
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      await searchInput.fill("test");
      await page.waitForTimeout(200);
      expect(getParams(page).has("search")).toBe(true);

      await searchInput.fill("");
      await page.waitForTimeout(200);
      expect(getParams(page).has("search")).toBe(false);
    });
  });

  test.describe("Tools view - sort and search in URL", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}?view=tools`);
      await page.waitForLoadState("networkidle");
    });

    test("toolSort is reflected in URL", async ({ page }) => {
      const sortSelect = page.locator(".sort-select").first();
      await expect(sortSelect).toBeVisible({ timeout: 5000 });
      await sortSelect.selectOption("az");
      await page.waitForTimeout(200);

      expect(getParams(page).get("toolSort")).toBe("az");
    });

    test("toolMin is reflected in URL", async ({ page }) => {
      const minSelect = page.locator(".sort-select").nth(1);
      await expect(minSelect).toBeVisible({ timeout: 5000 });
      await minSelect.selectOption("5");
      await page.waitForTimeout(200);

      expect(getParams(page).get("toolMin")).toBe("5");
    });

    test("toolMin default (1) is not in URL", async ({ page }) => {
      // Change min then change back to default
      const minSelect = page.locator(".sort-select").nth(1);
      await expect(minSelect).toBeVisible({ timeout: 5000 });
      await minSelect.selectOption("5");
      await page.waitForTimeout(200);
      expect(getParams(page).has("toolMin")).toBe(true);

      await minSelect.selectOption("1");
      await page.waitForTimeout(200);
      expect(getParams(page).has("toolMin")).toBe(false);
    });

    test("toolSearch is reflected in URL", async ({ page }) => {
      const searchInput = page.locator(".view-controls input[type='text']").first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill("Bash");
        await page.waitForTimeout(200);
        expect(getParams(page).get("toolSearch")).toBe("Bash");
      }
    });

    test("tools view state persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=tools&toolSort=az`);
      await page.waitForLoadState("networkidle");

      const sortSelect = page.locator(".sort-select").first();
      await expect(sortSelect).toBeVisible({ timeout: 5000 });
      await expect(sortSelect).toHaveValue("az");
    });

    test("toolMin persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=tools&toolMin=5`);
      await page.waitForLoadState("networkidle");

      const minSelect = page.locator(".sort-select").nth(1);
      await expect(minSelect).toBeVisible({ timeout: 5000 });
      await expect(minSelect).toHaveValue("5");
    });

    test("resetting toolSort to default removes param from URL", async ({ page }) => {
      const sortSelect = page.locator(".sort-select").first();
      await expect(sortSelect).toBeVisible({ timeout: 5000 });
      await sortSelect.selectOption("az");
      await page.waitForTimeout(200);
      expect(getParams(page).has("toolSort")).toBe(true);

      await sortSelect.selectOption("count");
      await page.waitForTimeout(200);
      expect(getParams(page).has("toolSort")).toBe(false);
    });
  });

  test.describe("Skills view - sort and search in URL", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}?view=skills`);
      await page.waitForLoadState("networkidle");
    });

    test("skillSort is reflected in URL", async ({ page }) => {
      const sortSelect = page.locator(".sort-select").first();
      await expect(sortSelect).toBeVisible({ timeout: 5000 });
      await sortSelect.selectOption("az");
      await page.waitForTimeout(200);

      expect(getParams(page).get("skillSort")).toBe("az");
    });

    test("skillSearch is reflected in URL", async ({ page }) => {
      const searchInput = page.locator(".view-search").first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill("commit");
        await page.waitForTimeout(200);
        expect(getParams(page).get("skillSearch")).toBe("commit");
      }
    });

    test("skillMin is reflected in URL", async ({ page }) => {
      const minSelect = page.locator(".sort-select").nth(1);
      if (await minSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await minSelect.selectOption("5");
        await page.waitForTimeout(200);
        expect(getParams(page).get("skillMin")).toBe("5");
      }
    });

    test("skillSearch persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=skills&skillSearch=commit`);
      await page.waitForLoadState("networkidle");

      const searchInput = page.locator(".view-search").first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await expect(searchInput).toHaveValue("commit");
    });

    test("skills view state persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?view=skills&skillSort=za`);
      await page.waitForLoadState("networkidle");

      const sortSelect = page.locator(".sort-select").first();
      await expect(sortSelect).toBeVisible({ timeout: 5000 });
      await expect(sortSelect).toHaveValue("za");
    });

    test("resetting skillSort to default removes param from URL", async ({ page }) => {
      const sortSelect = page.locator(".sort-select").first();
      await expect(sortSelect).toBeVisible({ timeout: 5000 });
      await sortSelect.selectOption("az");
      await page.waitForTimeout(200);
      expect(getParams(page).has("skillSort")).toBe(true);

      await sortSelect.selectOption("count");
      await page.waitForTimeout(200);
      expect(getParams(page).has("skillSort")).toBe(false);
    });
  });

  test.describe("Agents view - filters in URL", () => {
    test("agentSearch is reflected in URL", async ({ page }) => {
      const searchInput = page.locator(".view-controls input[type='text']").first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill("test-agent");
        await page.waitForTimeout(200);
        expect(getParams(page).get("agentSearch")).toBe("test-agent");
      }
    });

    test("statusFilter is reflected in URL", async ({ page }) => {
      const activePill = page.locator(".filter-pill:text-is('ACTIVE')");
      if (await activePill.isVisible({ timeout: 3000 }).catch(() => false)) {
        await activePill.click();
        await page.waitForTimeout(200);
        expect(getParams(page).get("status")).toBe("active");
      }
    });

    test("statusFilter default (all) removes param from URL", async ({ page }) => {
      // First set to active
      const activePill = page.locator(".filter-pill:text-is('ACTIVE')");
      if (await activePill.isVisible({ timeout: 3000 }).catch(() => false)) {
        await activePill.click();
        await page.waitForTimeout(200);
        expect(getParams(page).has("status")).toBe(true);

        // Reset to all
        const allPill = page.locator(".filter-pill:text-is('All')");
        await allPill.click();
        await page.waitForTimeout(200);
        expect(getParams(page).has("status")).toBe(false);
      }
    });

    test("statusFilter persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?status=active`);
      await page.waitForLoadState("networkidle");

      const activePill = page.locator(".filter-pill.active:text-is('ACTIVE')");
      if (await activePill.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(activePill).toBeVisible();
      }
      expect(getParams(page).get("status")).toBe("active");
    });

    test("agents view mode compact is reflected in URL", async ({ page }) => {
      const compactBtn = page.locator("button[title='List']");
      if (await compactBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await compactBtn.click();
        await page.waitForTimeout(200);
        expect(getParams(page).get("agentView")).toBe("compact");
      }
    });

    test("agents view mode cards is reflected in URL", async ({ page }) => {
      const gridBtn = page.locator("button[title='Grid']");
      if (await gridBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await gridBtn.click();
        await page.waitForTimeout(200);
        expect(getParams(page).get("agentView")).toBe("cards");
      }
    });

    test("resetting viewMode to default (teams) removes agentView from URL", async ({ page }) => {
      await page.goto(`${BASE}?agentView=cards`);
      await page.waitForLoadState("networkidle");

      const teamsBtn = page.locator("button[title='Team']");
      if (await teamsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await teamsBtn.click();
        await page.waitForTimeout(200);
        expect(getParams(page).has("agentView")).toBe(false);
      }
    });

    test("agents view state persists after reload", async ({ page }) => {
      await page.goto(`${BASE}?agentView=compact&agentSort=name`);
      await page.waitForLoadState("networkidle");

      expect(getParams(page).get("agentView")).toBe("compact");
      expect(getParams(page).get("agentSort")).toBe("name");
    });
  });

  test.describe("Multiple params combined", () => {
    test("multiple URL params are restored correctly", async ({ page }) => {
      await page.goto(`${BASE}?view=events&search=Bash&timeRange=1h`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator(".view-title:text-is('EVENTS')")).toBeVisible({ timeout: 5000 });

      const searchInput = page.locator(".search-input");
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await expect(searchInput).toHaveValue("Bash");
    });

    test("navigating between views preserves their respective states", async ({ page }) => {
      // Set state in tools view
      await page.goto(`${BASE}?view=tools&toolSort=az`);
      await page.waitForLoadState("networkidle");

      // Switch to events via sidebar
      await clickSidebarNav(page, "EVENTS");

      // Switch back to tools
      await clickSidebarNav(page, "TOOLS");

      // toolSort should still be az
      expect(getParams(page).get("toolSort")).toBe("az");
    });
  });

  test.describe("Threshold parameter", () => {
    test("threshold value persists in URL", async ({ page }) => {
      await page.goto(`${BASE}?threshold=60`);
      await page.waitForLoadState("networkidle");

      expect(getParams(page).get("threshold")).toBe("60");
    });
  });

  test.describe("Team URL parameter persistence", () => {
    const TEAM_NAME = "cc-masterclass-research";

    test("team param is preserved on direct URL access", async ({ page }) => {
      await page.goto(`${BASE}?team=${TEAM_NAME}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      expect(getParams(page).get("team")).toBe(TEAM_NAME);
    });

    test("team param persists after page reload", async ({ page }) => {
      await page.goto(`${BASE}?team=${TEAM_NAME}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      // Reload the page
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      expect(getParams(page).get("team")).toBe(TEAM_NAME);
    });

    test("team + agentView combined params persist after reload", async ({ page }) => {
      await page.goto(`${BASE}?team=${TEAM_NAME}&agentView=cards`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      // Verify both params present
      expect(getParams(page).get("team")).toBe(TEAM_NAME);
      expect(getParams(page).get("agentView")).toBe("cards");

      // Reload
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      // Both should persist
      expect(getParams(page).get("team")).toBe(TEAM_NAME);
      expect(getParams(page).get("agentView")).toBe("cards");
    });

    test("ESC key removes team param from URL", async ({ page }) => {
      await page.goto(`${BASE}?team=${TEAM_NAME}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      expect(getParams(page).get("team")).toBe(TEAM_NAME);

      // Press Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      expect(getParams(page).has("team")).toBe(false);
    });

    test("viewMode change removes team param (intended behavior)", async ({ page }) => {
      await page.goto(`${BASE}?team=${TEAM_NAME}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      expect(getParams(page).get("team")).toBe(TEAM_NAME);

      // Switch to compact view mode
      const compactBtn = page.locator("button[title='List']");
      if (await compactBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await compactBtn.click();
        await page.waitForTimeout(300);

        expect(getParams(page).has("team")).toBe(false);
        expect(getParams(page).get("agentView")).toBe("compact");
      }
    });
  });
});
