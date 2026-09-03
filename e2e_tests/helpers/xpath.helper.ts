// XPath 1.0 literals have no escape syntax, so an apostrophe needs concat().
export const xpathLiteral = (value: string) => {
  if (!value.includes("'")) {
    return `'${value}'`;
  }

  return `concat(${value
    .split("'")
    .map((part) => `'${part}'`)
    .join(`, "'", `)})`;
};
