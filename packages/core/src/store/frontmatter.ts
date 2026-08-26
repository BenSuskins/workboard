/**
 * Frontmatter for the markdown store: one `key: value` per line between `---`
 * fences, where every value is JSON. JSON gives exact round-tripping and no
 * quoting ambiguity, and stays readable enough to edit by hand — which is the
 * point of storing the board as markdown at all.
 */

export type Fields = Record<string, unknown>;

export interface Document {
  fields: Fields;
  body: string;
}

const FENCE = "---";

export function serialize({ fields, body }: Document): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `${FENCE}\n${lines.join("\n")}\n${FENCE}\n\n${body.replace(/\s+$/, "")}\n`;
}

/** Throws on a malformed document — a corrupt file should be loud, not silently empty. */
export function parse(text: string, source = "<memory>"): Document {
  if (!text.startsWith(`${FENCE}\n`)) throw new Error(`${source}: missing opening frontmatter fence`);
  const end = text.indexOf(`\n${FENCE}`, FENCE.length);
  if (end === -1) throw new Error(`${source}: unterminated frontmatter`);

  const fields: Fields = {};
  for (const line of text.slice(FENCE.length + 1, end + 1).split("\n")) {
    if (!line.trim()) continue;
    const split = line.indexOf(": ");
    if (split === -1) throw new Error(`${source}: malformed frontmatter line: ${line}`);
    const key = line.slice(0, split);
    try {
      fields[key] = JSON.parse(line.slice(split + 2));
    } catch {
      throw new Error(`${source}: frontmatter value for "${key}" is not valid JSON`);
    }
  }

  const bodyStart = text.indexOf("\n", end + 1 + FENCE.length);
  return { fields, body: bodyStart === -1 ? "" : text.slice(bodyStart + 1).replace(/^\n+/, "").replace(/\s+$/, "") };
}
