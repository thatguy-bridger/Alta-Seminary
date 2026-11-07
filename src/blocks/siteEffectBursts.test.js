import { describe, it, expect } from 'vitest';
import { BLOCK_REGISTRY } from './registry.js';

describe('Site Effect: the bursts switch', () => {
  const block = BLOCK_REGISTRY['site-effect'];

  it('is on by default, so existing sites look exactly as before', () => {
    expect(block.defaultProps.bursts).toBe(true);
  });

  it('is a toggle in the editor, next to the other effect options', () => {
    const field = block.fields.find((f) => f.key === 'bursts');
    expect(field).toBeTruthy();
    expect(field.kind).toBe('toggle');
  });
});
