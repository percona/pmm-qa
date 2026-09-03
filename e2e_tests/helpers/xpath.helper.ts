// An XPath 1.0 string literal has no escape syntax and cannot mix quote
// styles, so a value containing an apostrophe has to be assembled with
// concat() rather than wrapped in quotes.
export const xpathLiteral = (value: string) => {
  if (!value.includes("'")) {
    return `'${value}'`;
  }

  return `concat(${value
    .split("'")
    .map((part) => `'${part}'`)
    .join(`, "'", `)})`;
};
