import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('inspector panel layout contract', () => {
  it('keeps line cards readable with overflow-safe typography', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(css).toContain('.issue-list-detailed .issue-card, .segment-card { width: 100%; text-align: left; display: grid; gap: 6px; padding: 12px; color: inherit; min-width: 0; overflow: hidden; }');
    expect(css).toContain('overflow-wrap: anywhere; word-break: break-word;');
    expect(css).toContain('-webkit-line-clamp: 2;');
  });

  it('keeps diagnostics counters from collapsing into each other', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(css).toContain('.diagnostics-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; min-width: 0; align-items: stretch; }');
    expect(css).toContain('.diagnostics-summary span { border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.03); border-radius: 12px; padding: 8px 10px; color: #9bb0ca; min-width: 0; display: grid; gap: 2px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; }');
  });
});
