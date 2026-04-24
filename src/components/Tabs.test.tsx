import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tab } from "@/hooks/useTabs";
import { Tabs } from "./Tabs";

function makeTab(path: string, id = path): Tab {
  return {
    id,
    path,
    source: "",
    status: "ready",
    error: null,
    mode: "view",
  };
}

function baseProps() {
  return {
    onActivate: vi.fn(),
    onClose: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseRight: vi.fn(),
    onCloseAll: vi.fn(),
    onCopyPath: vi.fn(),
    onRevealInFileManager: vi.fn(),
    onReorder: vi.fn(),
  };
}

describe("Tabs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when tab list is empty", () => {
    const { container } = render(<Tabs tabs={[]} activeId={null} {...baseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the active tab and fires onActivate on click", async () => {
    const props = baseProps();
    render(<Tabs tabs={[makeTab("/a.md", "a"), makeTab("/b.md", "b")]} activeId="a" {...props} />);
    expect(screen.getByTestId("tab-0")).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByTestId("tab-1"));
    expect(props.onActivate).toHaveBeenCalledWith("b");
  });

  it("clicking × calls onClose and stops propagation", async () => {
    const props = baseProps();
    render(<Tabs tabs={[makeTab("/a.md", "a")]} activeId="a" {...props} />);
    await userEvent.click(screen.getByTestId("tab-close-0"));
    expect(props.onClose).toHaveBeenCalledWith("a");
    expect(props.onActivate).not.toHaveBeenCalled();
  });

  it("right-click opens the context menu; items fire the right callbacks", async () => {
    const props = baseProps();
    render(
      <Tabs
        tabs={[makeTab("/a.md", "a"), makeTab("/b.md", "b"), makeTab("/c.md", "c")]}
        activeId="b"
        {...props}
      />,
    );

    const middle = screen.getByTestId("tab-1");
    await userEvent.pointer({ keys: "[MouseRight]", target: middle });
    const menu = await screen.findByTestId("tab-context-menu");

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Close tab" }));
    expect(props.onClose).toHaveBeenCalledWith("b");
  });

  it("context menu disables 'Close tabs to the right' on the last tab", async () => {
    const props = baseProps();
    render(<Tabs tabs={[makeTab("/a.md", "a"), makeTab("/b.md", "b")]} activeId="b" {...props} />);
    const last = screen.getByTestId("tab-1");
    await userEvent.pointer({ keys: "[MouseRight]", target: last });
    const menu = await screen.findByTestId("tab-context-menu");
    expect(within(menu).getByRole("menuitem", { name: "Close tabs to the right" })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Close other tabs" })).not.toBeDisabled();
  });

  it("Copy path / Show in file manager fire with the tab's path", async () => {
    const props = baseProps();
    render(<Tabs tabs={[makeTab("/path/to/a.md", "a")]} activeId="a" {...props} />);
    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByTestId("tab-0") });
    const menu = await screen.findByTestId("tab-context-menu");

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Copy path" }));
    expect(props.onCopyPath).toHaveBeenCalledWith("/path/to/a.md");

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByTestId("tab-0") });
    const menu2 = await screen.findByTestId("tab-context-menu");
    await userEvent.click(within(menu2).getByRole("menuitem", { name: "Show in file manager" }));
    expect(props.onRevealInFileManager).toHaveBeenCalledWith("/path/to/a.md");
  });
});
