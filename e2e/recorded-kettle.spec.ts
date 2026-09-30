import { expect, test } from "@playwright/test";

test("recorded kettle: intake through conflict, gap, power, and report", async ({
  page,
}) => {
  let extractMode: string | null = null;

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("generativelanguage.googleapis.com")) {
      throw new Error(`Live Gemini host must not be called: ${url}`);
    }
    if (url.includes("openrouter.ai")) {
      throw new Error(`Live OpenRouter host must not be called: ${url}`);
    }
  });

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

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: /load the bundled example/i }).click();

  await page
    .getByRole("button", { name: /open the interview/i })
    .click({ timeout: 30_000 });
  await expect(page).toHaveURL("/interview");
  await expect(
    page.getByRole("heading", { name: /which capacity is correct for the ark-1500/i }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL("/interview");
  await expect(
    page.getByRole("heading", { name: /which capacity is correct for the ark-1500/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /use 1\.5 l/i })).toBeVisible();

  await page.getByRole("button", { name: /use 1\.5 l/i }).click();

  await page.getByRole("textbox", { name: /your answer/i }).fill("Acme Imports Ltd");
  await page.getByRole("button", { name: /submit answer/i }).click();

  await page
    .getByRole("button", { name: /confirm 2200 w as user-provided/i })
    .click();

  await expect(page).toHaveURL("/report");
  await expect(page.getByText(/readiness report · ark-1500 kettle/i)).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: /ready for manual authoring/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/this session used recorded extraction/i),
  ).toBeVisible();
  await expect(page.getByText(/eu-compliant|compliance score/i)).not.toBeVisible();

  expect(extractMode).toBe("recorded");
});
