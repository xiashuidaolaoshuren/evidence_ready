import { join } from "node:path";
import { createInterpretHandler } from "@/server/http/createInterpretHandler";
export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const interpret = createInterpretHandler({
  fixtureDir: join(process.cwd(), "fixtures/kettle"),
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(request: Request) {
  return interpret(request);
}
