import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('top toolbar mode switch smoke', () => {
  it('keeps only one schematic/simulation mode switch in top toolbar', () => {
    const source = readFileSync('src/features/editor/TopToolbar.tsx', 'utf8');

    expect((source.match(/role="tablist"/g) ?? []).length).toBe(1);
    expect(source).toContain('Схема');
    expect(source).toContain('Симуляция');
    expect(source).not.toContain('Режим схемы');
    expect(source).not.toContain("'Выйти из режима схемы'");
  });
});
