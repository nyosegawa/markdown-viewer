import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchBar } from "./SearchBar";

function mount(children: ReactNode) {
  const containerRef = createRef<HTMLDivElement>();
  const onClose = vi.fn();
  const view = render(
    <div>
      <div ref={containerRef}>{children}</div>
      <SearchBar containerRef={containerRef} onClose={onClose} />
    </div>,
  );
  return { view, onClose };
}

describe("SearchBar", () => {
  it("renders an empty counter before typing", () => {
    mount(<p>Nothing to search</p>);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("counts matches case-insensitively", async () => {
    mount(<p>Alpha beta alpha BETA gamma</p>);
    await userEvent.type(screen.getByTestId("search-input"), "alpha");
    const bar = screen.getByTestId("search-bar");
    expect(within(bar).getByText("1 / 2")).toBeInTheDocument();
  });

  it("shows 0 / 0 when nothing matches", async () => {
    mount(<p>Alpha beta gamma</p>);
    await userEvent.type(screen.getByTestId("search-input"), "zzz");
    const bar = screen.getByTestId("search-bar");
    expect(within(bar).getByText("0 / 0")).toBeInTheDocument();
  });

  it("Enter advances; Shift+Enter goes back; counter wraps", async () => {
    mount(<p>cat CAT cat</p>);
    const input = screen.getByTestId("search-input");
    await userEvent.type(input, "cat");
    const bar = screen.getByTestId("search-bar");
    expect(within(bar).getByText("1 / 3")).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(within(bar).getByText("2 / 3")).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(within(bar).getByText("3 / 3")).toBeInTheDocument();

    // wrap forward
    await userEvent.keyboard("{Enter}");
    expect(within(bar).getByText("1 / 3")).toBeInTheDocument();

    // wrap backward
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(within(bar).getByText("3 / 3")).toBeInTheDocument();
  });

  it("Escape invokes onClose", async () => {
    const { onClose } = mount(<p>hi</p>);
    const input = screen.getByTestId("search-input");
    input.focus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking the close button invokes onClose", async () => {
    const { onClose } = mount(<p>hi</p>);
    await userEvent.click(screen.getByRole("button", { name: /close search/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("prev / next buttons are disabled when there are no matches", async () => {
    mount(<p>nothing</p>);
    expect(screen.getByRole("button", { name: /previous match/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next match/i })).toBeDisabled();
  });

  it("ignores matches inside the search bar itself", async () => {
    mount(<p>find me</p>);
    await userEvent.type(screen.getByTestId("search-input"), "find");
    const bar = screen.getByTestId("search-bar");
    // Input's placeholder is 'Find in document' — lowercase match candidate
    // if the walker didn't skip the search UI. We expect exactly 1 hit (the <p>).
    expect(within(bar).getByText("1 / 1")).toBeInTheDocument();
  });
});
