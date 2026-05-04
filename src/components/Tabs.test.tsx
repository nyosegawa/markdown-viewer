import { fireEvent, render, screen, within } from "@testing-library/react";
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
    onRename: vi.fn().mockResolvedValue(undefined),
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

  it("clamps the context menu inside the viewport when opened near the right/bottom edge", () => {
    const props = baseProps();
    const originalGetRect = HTMLElement.prototype.getBoundingClientRect;
    // jsdom returns 0×0 for layout, which would defeat the clamp; pretend the
    // menu has a real size so the math has something to bite on.
    const menuWidth = 240;
    const menuHeight = 220;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains("tab-context-menu")) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: menuWidth,
          bottom: menuHeight,
          width: menuWidth,
          height: menuHeight,
          toJSON() {},
        } as DOMRect;
      }
      return originalGetRect.call(this);
    };
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

    try {
      render(<Tabs tabs={[makeTab("/a.md", "a")]} activeId="a" {...props} />);
      const tab = screen.getByTestId("tab-0");
      // Click near the bottom-right corner — without clamping this would
      // place the menu past 1000×800.
      fireEvent.contextMenu(tab, { clientX: 980, clientY: 780 });

      const menu = screen.getByTestId("tab-context-menu") as HTMLElement;
      const left = Number.parseFloat(menu.style.left);
      const top = Number.parseFloat(menu.style.top);
      const margin = 8;
      expect(left + menuWidth).toBeLessThanOrEqual(window.innerWidth - margin);
      expect(top + menuHeight).toBeLessThanOrEqual(window.innerHeight - margin);
      expect(left).toBeGreaterThanOrEqual(margin);
      expect(top).toBeGreaterThanOrEqual(margin);
      expect(menu.style.visibility).toBe("visible");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetRect;
    }
  });

  it("context menu items show platform-aware shortcut hints next to their label", async () => {
    const props = baseProps();
    // Force the mac branch so the assertions are deterministic regardless of
    // the host running the test.
    const platformSpy = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    try {
      render(<Tabs tabs={[makeTab("/a.md", "a")]} activeId="a" {...props} />);
      await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByTestId("tab-0") });
      const menu = await screen.findByTestId("tab-context-menu");
      const closeItem = within(menu).getByRole("menuitem", { name: "Close tab" });
      // Shortcut hint lives in a span so the accessible name stays clean,
      // but the visible text should still contain the keycap.
      expect(closeItem).toHaveTextContent("⌘W");
      expect(within(menu).getByRole("menuitem", { name: "Close other tabs" })).toHaveTextContent(
        "⌘⌥W",
      );
      expect(within(menu).getByRole("menuitem", { name: "Close all tabs" })).toHaveTextContent(
        "⌘⇧W",
      );
      expect(within(menu).getByRole("menuitem", { name: "Copy path" })).toHaveTextContent("⌘⇧C");
      expect(
        within(menu).getByRole("menuitem", { name: "Show in file manager" }),
      ).toHaveTextContent("⌘⇧R");
    } finally {
      platformSpy.mockRestore();
    }
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

  it("double-clicking a tab renames only the filename stem", async () => {
    const props = baseProps();
    render(<Tabs tabs={[makeTab("/path/to/01-system-design.md", "a")]} activeId="a" {...props} />);

    await userEvent.dblClick(screen.getByTestId("tab-0"));
    const input = screen.getByRole("textbox", { name: "Rename file" });
    expect(input).toHaveValue("01-system-design");
    expect(screen.getByText(".md")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "02-system-design" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("a", "02-system-design");
  });

  it("strips the preserved extension if the user types it during tab rename", async () => {
    const props = baseProps();
    render(<Tabs tabs={[makeTab("/path/to/a.md", "a")]} activeId="a" {...props} />);

    await userEvent.dblClick(screen.getByTestId("tab-0"));
    const input = screen.getByRole("textbox", { name: "Rename file" });
    fireEvent.change(input, { target: { value: "b.md" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("a", "b");
  });
});
