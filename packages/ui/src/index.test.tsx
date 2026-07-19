import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, Button, cn } from "./index";

describe("@bai/ui", () => {
  it("merges conflicting tailwind classes deterministically", () => {
    const hidden = false;
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", hidden && "hidden", "font-medium")).toBe(
      "text-sm font-medium",
    );
  });

  it("renders a Button to static markup", () => {
    const html = renderToStaticMarkup(<Button>Import CSV</Button>);
    expect(html).toContain("Import CSV");
    expect(html).toContain("<button");
  });

  it("renders a Badge with the demo variant", () => {
    const html = renderToStaticMarkup(<Badge variant="warning">Demo</Badge>);
    expect(html).toContain("Demo");
  });
});
