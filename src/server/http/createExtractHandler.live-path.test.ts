import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExtractHandler } from "./createExtractHandler";
import { readSseEvents } from "./test-helpers";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/kettle",
);

describe("createExtractHandler live path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams a dossier from the fake transport without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const extraction = readFileSync(
      join(fixtureDir, "recorded-extraction.json"),
      "utf8",
    );
    const transport = vi.fn(async () => extraction);

    const fileBuffer = readFileSync(
      join(fixtureDir, "ARK-1500_supplier-specification.txt"),
    );
    const form = new FormData();
    form.append(
      "files",
      new File([fileBuffer], "ARK-1500_supplier-specification.txt", {
        type: "text/plain",
      }),
    );

    const handler = createExtractHandler({
      fixtureDir,
      apiKey: "test-key",
      transport,
      publicDemo: false,
    });

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = (await readSseEvents(response)) as Array<{
      type: string;
      result?: {
        mode: string;
        dossier: Array<{ key: string; status: string; normalizedValue: unknown }>;
      };
    }>;

    expect(events.some((event) => event.type === "stage")).toBe(true);
    const resultEvent = events.at(-1);
    expect(resultEvent).toMatchObject({ type: "result" });
    expect(resultEvent?.result?.mode).toBe("live");

    const productName = resultEvent?.result?.dossier.find(
      (field) => field.key === "product-name",
    );
    expect(productName).toMatchObject({
      status: "confirmed",
      normalizedValue: "Acme Rapid Kettle",
    });

    expect(transport).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
