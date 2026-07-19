import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv, toCsvRow } from "./index";

describe("csv injection safety", () => {
  it("neutralizes formula-trigger cells", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
  });

  it("quotes cells containing delimiters or quotes", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("renders empty for nullish values", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("builds rows and a full document", () => {
    expect(toCsvRow(["a", "=b", 1])).toBe("a,'=b,1");
    expect(toCsv([["1", "2"]], ["x", "y"])).toBe("x,y\r\n1,2");
  });
});
