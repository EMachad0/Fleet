import { readFileSync, writeFileSync } from 'node:fs';

type Line = { kind: 'entry'; key: string; value: string } | { kind: 'other'; raw: string };

function parse(content: string): Line[] {
  return content.split('\n').map((raw) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return { kind: 'other', raw };
    const eq = raw.indexOf('=');
    if (eq === -1) return { kind: 'other', raw };
    return { kind: 'entry', key: raw.slice(0, eq), value: raw.slice(eq + 1) };
  });
}

function serialize(lines: Line[]): string {
  const out = lines.map((l) => (l.kind === 'entry' ? `${l.key}=${l.value}` : l.raw));
  if (out.at(-1) !== '') out.push('');
  return out.join('\n');
}

export function read(filePath: string): Record<string, string> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return {};
  }
  const result: Record<string, string> = {};
  for (const line of parse(content)) {
    if (line.kind === 'entry') result[line.key] = line.value;
  }
  return result;
}

export function merge(filePath: string, entries: Record<string, string>): void {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    content = '';
  }

  const lines = parse(content);
  const pending = new Map(Object.entries(entries));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.kind !== 'entry') continue;
    const update = pending.get(line.key);
    if (update !== undefined) {
      lines[i] = { kind: 'entry', key: line.key, value: update };
      pending.delete(line.key);
    }
  }

  for (const [key, value] of pending) {
    lines.push({ kind: 'entry', key, value });
  }

  writeFileSync(filePath, serialize(lines));
}
