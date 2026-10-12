import { expect, test, type Locator, type Page } from "@playwright/test";

function attachLiveHostGuard(page: Page): void {
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("generativelanguage.googleapis.com")) {
      throw new Error(`Live Gemini host must not be called: ${url}`);
    }
    if (url.includes("openrouter.ai")) {
      throw new Error(`Live OpenRouter host must not be called: ${url}`);
    }
  });
}

function trackExtractMode(page: Page): { getMode: () => string | null } {
  let extractMode: string | null = null;

  page.on("response", async (response) => {
    if (
      response.url().includes("/api/extract") &&
      response.request().method() === "POST" &&
      response.ok()
    ) {
      const text = await response.text();
      for (const block of text.split("\n\n")) {
        const dataLine = block
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) {
          continue;
        }
        const event = JSON.parse(dataLine.slice(6)) as {
          type?: string;
          result?: { mode?: string };
        };
        if (event.type === "result") {
          extractMode = event.result?.mode ?? null;
        }
      }
    }
  });

  return { getMode: () => extractMode };
}

async function freshIntake(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page).toHaveURL("/");
}

async function tabUntilFocused(
  page: Page,
  locator: Locator,
  maxTabs = 100,
): Promise<void> {
  await expect(locator).toBeVisible();
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    const focused = await locator.evaluate(
      (element) => element === document.activeElement,
    );
    if (focused) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not reach the target control with Tab");
}

async function activateByKeyboard(page: Page, locator: Locator): Promise<void> {
  await tabUntilFocused(page, locator);
  await page.keyboard.press("Enter");
}

async function reachReportWithClicks(page: Page): Promise<void> {
  await page.getByRole("button", { name: /load the bundled example/i }).click();
  await page
    .getByRole("button", { name: /open the interview/i })
    .click({ timeout: 30_000 });
  await expect(page).toHaveURL("/interview");
  await page.getByRole("button", { name: /use 1\.5 l/i }).click();
  await page.getByRole("textbox", { name: /your answer/i }).fill("Acme Imports Ltd");
  await page.getByRole("button", { name: /submit answer/i }).click();
  await page
    .getByRole("button", { name: /confirm 2200 w as user-provided/i })
    .click();
  await expect(page).toHaveURL("/report");
}

test.describe.configure({ mode: "serial" });

test("keyboard only: intake through report on the recorded kettle path", async ({
  page,
}) => {
  attachLiveHostGuard(page);
  const { getMode } = trackExtractMode(page);

  await freshIntake(page);

  await activateByKeyboard(
    page,
    page.getByRole("button", { name: /load the bundled example/i }),
  );

  const openInterview = page.getByRole("button", { name: /open the interview/i });
  await expect(openInterview).toBeVisible({ timeout: 30_000 });
  await activateByKeyboard(page, openInterview);

  await expect(page).toHaveURL("/interview");
  await expect(
    page.getByRole("heading", { name: /which capacity is correct for the ark-1500/i }),
  ).toBeVisible();

  await activateByKeyboard(page, page.getByRole("button", { name: /use 1\.5 l/i }));

  const answerField = page.getByRole("textbox", { name: /your answer/i });
  await tabUntilFocused(page, answerField);
  await page.keyboard.type("Acme Imports Ltd");

  await activateByKeyboard(
    page,
    page.getByRole("button", { name: /submit answer/i }),
  );

  await activateByKeyboard(
    page,
    page.getByRole("button", { name: /confirm 2200 w as user-provided/i }),
  );

  await expect(page).toHaveURL("/report");
  await expect(
    page.getByRole("heading", { name: /ready for manual authoring/i }),
  ).toBeVisible({ timeout: 20_000 });
  expect(getMode()).toBe("recorded");
});

test("history: back from report keeps applied answers, forward returns to report", async ({
  page,
}) => {
  attachLiveHostGuard(page);

  await freshIntake(page);
  await reachReportWithClicks(page);

  await page.goBack();
  await expect(page).toHaveURL("/interview");
  await expect(page.getByText(/Acme Imports Ltd/i)).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL("/report");
  await expect(
    page.getByRole("heading", { name: /ready for manual authoring/i }),
  ).toBeVisible();
});

test("restart session returns to intake and survives reload", async ({ page }) => {
  attachLiveHostGuard(page);

  await freshIntake(page);
  await page.getByRole("button", { name: /load the bundled example/i }).click();
  await expect(page).toHaveURL(/\/extract/);

  await activateByKeyboard(
    page,
    page.getByRole("button", { name: /restart session/i }),
  );

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", {
      name: /know what your documents can prove before authoring begins/i,
    }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", {
      name: /know what your documents can prove before authoring begins/i,
    }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/interview/);
});
