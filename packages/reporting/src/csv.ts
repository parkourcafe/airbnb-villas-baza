/**
 * CSV export helpers with spreadsheet formula-injection protection
 * (06_ACCEPTANCE_TESTS IMP-06). Any cell beginning with a formula trigger
 * character is prefixed with a single quote so spreadsheet apps treat it as
 * text, and standard CSV quoting is applied for delimiters/quotes/newlines.
 */
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function escapeCsvCell(value: unknown): string {
  let cell = value === null || value === undefined ? "" : String(value);

  const first = cell[0];
  if (first !== undefined && FORMULA_TRIGGERS.has(first)) {
    cell = `'${cell}`;
  }

  if (/[",\n\r]/.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }

  return cell;
}

export function toCsvRow(cells: readonly unknown[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export function toCsv(
  rows: readonly (readonly unknown[])[],
  header?: readonly string[],
): string {
  const lines: string[] = [];
  if (header) {
    lines.push(toCsvRow(header));
  }
  for (const row of rows) {
    lines.push(toCsvRow(row));
  }
  return lines.join("\r\n");
}
