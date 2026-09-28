// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Intake } from "./Intake";

describe("Intake", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows ARK-1500 bundled example with matching fixture filenames", () => {
    render(
      <Intake
        onStartBundled={vi.fn()}
        onStartUpload={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /bundled example · ark-1500 electric kettle/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ARK-1500_supplier-specification.pdf"),
    ).toBeInTheDocument();
    expect(screen.getByText("ARK-1500_draft-manual.pdf")).toBeInTheDocument();
    expect(screen.getByText(/PDF · 3 pages/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF · 4 pages/i)).toBeInTheDocument();
  });

  it("defaults to recorded mode and shows privacy sentence", () => {
    render(
      <Intake
        onStartBundled={vi.fn()}
        onStartUpload={vi.fn()}
      />,
    );

    const modeGroup = screen.getByRole("radiogroup", { name: /extraction mode/i });
    const recorded = within(modeGroup).getByRole("radio", { name: /recorded extraction/i });
    const live = within(modeGroup).getByRole("radio", { name: /live extraction/i });

    expect(recorded).toBeChecked();
    expect(live).not.toBeChecked();
    expect(
      screen.getByText(/Image-only PDFs are unsupported/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sent to the extraction model/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sent to Gemini/i)).not.toBeInTheDocument();
  });

  it("describes live extraction as DeepSeek via OpenRouter", async () => {
    const user = userEvent.setup();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={vi.fn()} />,
    );

    const modeGroup = screen.getByRole("radiogroup", { name: /extraction mode/i });
    await user.click(within(modeGroup).getByRole("radio", { name: /live extraction/i }));

    expect(
      screen.getByText(/Sends the same two documents to DeepSeek via OpenRouter/i),
    ).toBeInTheDocument();
  });

  it("switches bundled mode to live when live radio is selected", async () => {
    const user = userEvent.setup();
    render(
      <Intake
        onStartBundled={vi.fn()}
        onStartUpload={vi.fn()}
      />,
    );

    const modeGroup = screen.getByRole("radiogroup", { name: /extraction mode/i });
    await user.click(within(modeGroup).getByRole("radio", { name: /live extraction/i }));

    expect(within(modeGroup).getByRole("radio", { name: /live extraction/i })).toBeChecked();
    expect(within(modeGroup).getByRole("radio", { name: /recorded extraction/i })).not.toBeChecked();
  });

  it("calls onStartBundled with selected mode", async () => {
    const user = userEvent.setup();
    const onStartBundled = vi.fn();
    render(
      <Intake onStartBundled={onStartBundled} onStartUpload={vi.fn()} />,
    );

    const modeGroup = screen.getByRole("radiogroup", { name: /extraction mode/i });
    await user.click(within(modeGroup).getByRole("radio", { name: /live extraction/i }));
    await user.click(screen.getByRole("button", { name: /load the bundled example/i }));

    expect(onStartBundled).toHaveBeenCalledWith("live");
  });

  it("validates uploads before calling onStartUpload and shows inline error", async () => {
    const user = userEvent.setup();
    const onStartUpload = vi.fn();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={onStartUpload} />,
    );

    await user.click(
      screen.getByRole("button", { name: /start from uploaded documents/i }),
    );

    expect(onStartUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one file is required/i)).toBeInTheDocument();
  });

  it("reveals the coverage-gate note when the help link is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={vi.fn()} />,
    );

    const helpLink = screen.getByRole("button", {
      name: /don't carry enough product information/i,
    });
    expect(helpLink).toHaveAttribute("aria-expanded", "false");

    await user.click(helpLink);

    expect(helpLink).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        /too few essential fields produce any candidate, the interview does not open/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/declared constant, not a model judgement/i),
    ).toBeInTheDocument();
  });

  it("hides the coverage-gate note when the help link is clicked again", async () => {
    const user = userEvent.setup();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={vi.fn()} />,
    );

    const helpLink = screen.getByRole("button", {
      name: /don't carry enough product information/i,
    });

    await user.click(helpLink);
    await user.click(helpLink);

    expect(helpLink).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText(/declared constant, not a model judgement/i),
    ).not.toBeInTheDocument();
  });

  it("calls onStartUpload with staged files when valid", async () => {
    const user = userEvent.setup();
    const onStartUpload = vi.fn();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={onStartUpload} />,
    );

    const input = screen.getByLabelText(/choose pdf or txt files/i);
    const file = new File(["x"], "spec.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await user.click(
      screen.getByRole("button", { name: /start from uploaded documents/i }),
    );

    expect(onStartUpload).toHaveBeenCalledOnce();
    expect(onStartUpload.mock.calls[0]?.[0]).toEqual([file]);
  });

  it("appends files from a second upload instead of replacing the staged list", async () => {
    const user = userEvent.setup();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={vi.fn()} />,
    );

    const input = screen.getByLabelText(/choose pdf or txt files/i);
    const spec = new File(["a"], "spec.pdf", { type: "application/pdf" });
    const manual = new File(["b"], "manual.txt", { type: "text/plain" });

    await user.upload(input, spec);
    await user.upload(input, manual);

    expect(screen.getByText("spec.pdf")).toBeInTheDocument();
    expect(screen.getByText("manual.txt")).toBeInTheDocument();
  });

  it("does not stage the same file twice when uploaded again", async () => {
    const user = userEvent.setup();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={vi.fn()} />,
    );

    const input = screen.getByLabelText(/choose pdf or txt files/i);
    const spec = new File(["a"], "spec.pdf", { type: "application/pdf" });

    await user.upload(input, spec);
    await user.upload(input, spec);

    expect(screen.getAllByText("spec.pdf")).toHaveLength(1);
  });

  it("caps the staged list at three files", async () => {
    const user = userEvent.setup();
    render(
      <Intake onStartBundled={vi.fn()} onStartUpload={vi.fn()} />,
    );

    const input = screen.getByLabelText(/choose pdf or txt files/i);
    const files = [
      new File(["1"], "one.pdf", { type: "application/pdf" }),
      new File(["2"], "two.pdf", { type: "application/pdf" }),
      new File(["3"], "three.pdf", { type: "application/pdf" }),
      new File(["4"], "four.pdf", { type: "application/pdf" }),
    ];

    for (const file of files) {
      await user.upload(input, file);
    }

    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(screen.getByText("two.pdf")).toBeInTheDocument();
    expect(screen.getByText("three.pdf")).toBeInTheDocument();
    expect(screen.queryByText("four.pdf")).not.toBeInTheDocument();
  });
});
