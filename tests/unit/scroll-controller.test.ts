import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScrollController } from "~/dom/scroll-controller";
import type { ScrollContainerConfig } from "~/dom/types";

function createMockElement(overrides: Partial<HTMLElement> = {}): HTMLElement {
  return {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 2000,
    scrollWidth: 2000,
    clientHeight: 500,
    clientWidth: 400,
    style: {} as CSSStyleDeclaration,
    ...overrides,
  } as unknown as HTMLElement;
}

describe("ScrollController", () => {
  let element: HTMLElement;

  beforeEach(() => {
    vi.stubGlobal("performance", { now: vi.fn(() => 1000) });
    element = createMockElement();
  });

  describe("y-axis", () => {
    const config: ScrollContainerConfig = {
      axis: "y",
      overscrollBehavior: "contain",
    };

    it("getOffset reads scrollTop", () => {
      element.scrollTop = 150;
      const sc = new ScrollController(element, config);
      expect(sc.getOffset()).toBe(150);
    });

    it("setOffset writes scrollTop directly", () => {
      const sc = new ScrollController(element, config);
      sc.setOffset(300);
      expect(element.scrollTop).toBe(300);
    });

    it("setOffset does not use scrollTo", () => {
      const scrollToSpy = vi.fn();
      element.scrollTo = scrollToSpy;
      const sc = new ScrollController(element, config);
      sc.setOffset(100);
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("getContentSize returns scrollHeight", () => {
      const sc = new ScrollController(element, config);
      expect(sc.getContentSize()).toBe(2000);
    });

    it("getViewportSize returns clientHeight", () => {
      const sc = new ScrollController(element, config);
      expect(sc.getViewportSize()).toBe(500);
    });
  });

  describe("x-axis", () => {
    const config: ScrollContainerConfig = {
      axis: "x",
      overscrollBehavior: "none",
    };

    it("getOffset reads scrollLeft", () => {
      element.scrollLeft = 200;
      const sc = new ScrollController(element, config);
      expect(sc.getOffset()).toBe(200);
    });

    it("setOffset writes scrollLeft directly", () => {
      const sc = new ScrollController(element, config);
      sc.setOffset(250);
      expect(element.scrollLeft).toBe(250);
    });

    it("getContentSize returns scrollWidth", () => {
      const sc = new ScrollController(element, config);
      expect(sc.getContentSize()).toBe(2000);
    });

    it("getViewportSize returns clientWidth", () => {
      const sc = new ScrollController(element, config);
      expect(sc.getViewportSize()).toBe(400);
    });
  });

  describe("measure", () => {
    it("returns correct sizes and caches result", () => {
      const config: ScrollContainerConfig = {
        axis: "y",
        overscrollBehavior: "contain",
      };
      const sc = new ScrollController(element, config);
      const cache = sc.measure();

      expect(cache.viewportSize).toBe(500);
      expect(cache.contentSize).toBe(2000);
      expect(cache.lastMeasureTime).toBe(1000);
    });

    it("returns the same object reference (pre-allocated)", () => {
      const config: ScrollContainerConfig = {
        axis: "y",
        overscrollBehavior: "contain",
      };
      const sc = new ScrollController(element, config);
      const cache1 = sc.measure();
      const cache2 = sc.measure();
      expect(cache1).toBe(cache2);
    });
  });

  describe("applyStyles / removeStyles", () => {
    it("sets CSS for y-axis", () => {
      const style = {} as CSSStyleDeclaration;
      element = createMockElement({ style } as Partial<HTMLElement>);
      const sc = new ScrollController(element, {
        axis: "y",
        overscrollBehavior: "contain",
      });

      sc.applyStyles();

      expect(style.overscrollBehavior).toBe("contain");
      expect(style.overflowY).toBe("auto");
      expect(style.touchAction).toBe("pan-y");
    });

    it("sets CSS for x-axis", () => {
      const style = {} as CSSStyleDeclaration;
      element = createMockElement({ style } as Partial<HTMLElement>);
      const sc = new ScrollController(element, {
        axis: "x",
        overscrollBehavior: "none",
      });

      sc.applyStyles();

      expect(style.overscrollBehavior).toBe("none");
      expect(style.overflowX).toBe("auto");
      expect(style.touchAction).toBe("pan-x");
    });

    it("removeStyles clears applied CSS", () => {
      const style = {
        overscrollBehavior: "contain",
        overflowY: "auto",
        overflowX: "",
        touchAction: "pan-y",
      } as unknown as CSSStyleDeclaration;
      element = createMockElement({ style } as Partial<HTMLElement>);
      const sc = new ScrollController(element, {
        axis: "y",
        overscrollBehavior: "contain",
      });

      sc.removeStyles();

      expect(style.overscrollBehavior).toBe("");
      expect(style.overflowY).toBe("");
      expect(style.touchAction).toBe("");
    });
  });

  describe("updateElement", () => {
    it("swaps the underlying element", () => {
      const config: ScrollContainerConfig = {
        axis: "y",
        overscrollBehavior: "contain",
      };
      const sc = new ScrollController(element, config);

      const newElement = createMockElement();
      newElement.scrollTop = 999;
      sc.updateElement(newElement);

      expect(sc.getOffset()).toBe(999);
    });
  });

  describe("destroy", () => {
    it("nullifies element, returns 0 for reads", () => {
      const config: ScrollContainerConfig = {
        axis: "y",
        overscrollBehavior: "contain",
      };
      const sc = new ScrollController(element, config);
      sc.destroy();

      expect(sc.getOffset()).toBe(0);
      expect(sc.getViewportSize()).toBe(0);
      expect(sc.getContentSize()).toBe(0);
    });
  });
});
