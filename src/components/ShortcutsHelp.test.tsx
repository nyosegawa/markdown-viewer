import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShortcutsHelp } from "./ShortcutsHelp";

describe("ShortcutsHelp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<ShortcutsHelp open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the keyboard shortcut table when open", () => {
    render(<ShortcutsHelp open={true} onClose={() => {}} />);
    expect(screen.getByTestId("shortcut-dialog")).toBeInTheDocument();
    expect(screen.getByText("Open file (new tab)")).toBeInTheDocument();
    expect(screen.getByText("Close current tab")).toBeInTheDocument();
    expect(screen.getByText("Reopen closed tab")).toBeInTheDocument();
    expect(screen.getByText("Next tab")).toBeInTheDocument();
  });

  it("clicking the close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp open={true} onClose={onClose} />);
    await userEvent.click(screen.getByTestId("shortcut-dialog-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking the overlay (not the dialog) calls onClose", async () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp open={true} onClose={onClose} />);
    await userEvent.click(screen.getByTestId("shortcut-overlay"));
    expect(onClose).toHaveBeenCalled();
  });

  it("Esc triggers onClose", async () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp open={true} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
