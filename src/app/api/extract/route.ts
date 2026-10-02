import { join } from "node:path";
import { createExtractHandler } from "@/server/http/createExtractHandler";
export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const extract = createExtractHandler({
  fixtureDir: join(process.cwd(), "fixtures/kettle"),
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(request: Request) {
  return extract(request);
}
