import { mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { SESSION_STORAGE_KEY } from "../src/state/session";
import type { StoredSession } from "../src/state/session";

const OUT_DIR = join(process.cwd(), "docs/design/quality-baseline");
const WIDTHS = [1280, 800] as const;
const phases: Array<"before" | "after"> =
  (process.env.QB_PHASE ?? "both") === "both"
    ? ["before", "after"]
    : (process.env.QB_PHASE ?? "before").split(",") as Array<
        "before" | "after"
      >;

type SessionKey =
  | "insufficient"
  | "interviewConflict"
  | "interviewMissing"
  | "interviewUnverified"
  | "interviewBudget"
  | "report";

function loadSessions(): Record<SessionKey, StoredSession> {
  return JSON.parse(
    readFileSync(join(OUT_DIR, "sessions.json"), "utf8"),
  ) as Record<SessionKey, StoredSession>;
}

async function capture(
  page: Page,
  screenId: string,
  phase: "before" | "after",
): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({
      path: join(OUT_DIR, `${screenId}-${width}-${phase}.png`),
      fullPage: true,
    });
  }
}

async function restoreSession(page: Page, session: StoredSession): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: SESSION_STORAGE_KEY, value: session },
  );
  await page.reload();
}

test.describe.configure({ mode: "serial" });

for (const phase of phases) {
  test(`quality baseline screenshots (${phase})`, async ({ page }) => {
    test.setTimeout(300_000);
    mkdirSync(OUT_DIR, { recursive: true });
    const sessions = loadSessions();

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await capture(page, "intake", phase);

    await page.getByRole("button", { name: /load the bundled example/i }).click();
    await expect(page).toHaveURL(/\/extract/);
    await capture(page, "extraction-working", phase);

    await expect(
      page.getByRole("button", { name: /open the interview/i }),
    ).toBeVisible({ timeout: 30_000 });
    await capture(page, "extraction-succeeded", phase);

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.route("**/api/extract", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const body = `data: ${JSON.stringify({
        type: "error",
        error: {
          code: "rate-limited",
          message: "The model is rate limited. Try again shortly.",
          retryAfterSeconds: 30,
        },
      })}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body,
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: /load the bundled example/i }).click();
    await expect(page).toHaveURL(/\/extract/);
    await expect(page.getByText(/rate limited/i)).toBeVisible({ timeout: 15_000 });
    await capture(page, "extraction-failed", phase);
    await page.unroute("**/api/extract");

    await restoreSession(page, sessions.insufficient);
    await expect(page).toHaveURL(/\/insufficient/);
    await capture(page, "insufficient", phase);

    await restoreSession(page, sessions.interviewConflict);
    await expect(page).toHaveURL(/\/interview/);
    await expect(
      page.getByRole("heading", { name: /which capacity is correct/i }),
    ).toBeVisible({ timeout: 15_000 });
    await capture(page, "interview-conflict", phase);
    await page.getByRole("button", { name: /view source/i }).first().click();
    await capture(page, "overlay-drawer", phase);
    await page.getByRole("button", { name: /close/i }).click();

    await restoreSession(page, sessions.interviewMissing);
    await expect(page).toHaveURL(/\/interview/);
    await capture(page, "interview-missing", phase);

    await restoreSession(page, sessions.interviewUnverified);
    await expect(page).toHaveURL(/\/interview/);
    await capture(page, "interview-unverified", phase);

    await restoreSession(page, sessions.interviewBudget);
    await expect(page).toHaveURL(/\/interview/);
    await expect(page.getByText(/five questions asked/i)).toBeVisible();
    await capture(page, "overlay-budget", phase);

    await restoreSession(page, sessions.interviewMissing);
    await expect(page).toHaveURL(/\/interview/);
    const interpretAnswer =
      "Acme Imports GmbH — rated power should be 2200 W";
    await page.route("**/api/interpret", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          proposals: [
            {
              fieldKey: "importer-contact",
              proposedValue: "Acme Imports GmbH",
              answerText: interpretAnswer,
            },
            {
              fieldKey: "rated-power",
              proposedValue: "2200 W",
              answerText: interpretAnswer,
            },
          ],
        }),
      });
    });
    await page.evaluate(() => {
      localStorage.setItem("evidenceready.e2e-force-interpret", "1");
    });
    await page.getByRole("textbox", { name: /your answer/i }).fill(interpretAnswer);
    await page.getByRole("button", { name: /submit answer/i }).click();
    await expect(
      page.getByRole("dialog", {
        name: /the model interpreted your answer into proposed updates/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await capture(page, "overlay-proposals", phase);
    await page.unroute("**/api/interpret");
    await page.evaluate(() => {
      localStorage.removeItem("evidenceready.e2e-force-interpret");
    });

    await restoreSession(page, sessions.report);
    await expect(page).toHaveURL(/\/report/);
    await capture(page, "report", phase);
  });
}
