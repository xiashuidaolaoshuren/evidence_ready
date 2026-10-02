export async function readSseEvents(response: Response): Promise<unknown[]> {
  const text = await response.text();
  const events: unknown[] = [];
  for (const block of text.split("\n\n")) {
    if (!block.trim()) {
      continue;
    }
    const dataLine = block
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (dataLine) {
      events.push(JSON.parse(dataLine.slice(6)));
    }
  }
  return events;
}
