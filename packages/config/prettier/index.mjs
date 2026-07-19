/**
 * Shared Prettier configuration for the BAI monorepo.
 *
 * @type {import("prettier").Config}
 */
export const prettierConfig = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  arrowParens: "always",
  endOfLine: "lf",
};

export default prettierConfig;
