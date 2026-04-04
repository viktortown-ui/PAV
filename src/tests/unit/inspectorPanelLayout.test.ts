import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('inspector panel layout contract', () => {
  it('keeps line cards readable with overflow-safe typography', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(css).toContain('.issue-list-detailed .issue-card, .segment-card { width: 100%; text-align: left; display: grid; gap: 6px; padding: 12px; color: inherit; min-width: 0; overflow: hidden; }');
    expect(css).toContain('overflow-wrap: anywhere; word-break: break-word;');
  });
});
