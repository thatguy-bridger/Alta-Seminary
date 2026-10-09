import { describe, it, expect } from 'vitest';
import { defaultEventBlocks } from './eventPage.js';
import { BLOCK_REGISTRY, BLOCK_TYPES } from './registry.js';

describe('defaultEventBlocks (what every event page starts as)', () => {
  it('is the live details followed by the live photos, both bound to this event', () => {
    const blocks = defaultEventBlocks('evt-1');
    expect(blocks.map((b) => b.type)).toEqual(['event-details', 'event-photos']);
    expect(blocks.every((b) => b.props.eventId === 'evt-1')).toBe(true);
  });

  it('gives every block its own id and a layout', () => {
    const [a, b] = defaultEventBlocks('evt-1');
    expect(a.id).not.toBe(b.id);
    expect(a.layout).toBeDefined();
  });

  it('builds a fresh set each time, so editing one event page cannot touch another', () => {
    const one = defaultEventBlocks('a');
    const two = defaultEventBlocks('b');
    expect(one[0].props).not.toBe(two[0].props);
    expect(two[0].props.eventId).toBe('b');
  });
});

describe('event-bound blocks', () => {
  it('are exactly Event Details and Event Photos, flagged so pickers can hide them elsewhere', () => {
    const bound = BLOCK_TYPES.filter((t) => BLOCK_REGISTRY[t].eventBound).sort();
    expect(bound).toEqual(['event-details', 'event-photos']);
  });

  it('keep the event id out of the settings panel (the editor fills it in)', () => {
    for (const type of ['event-details', 'event-photos']) {
      expect(BLOCK_REGISTRY[type].fields.map((f) => f.key)).not.toContain('eventId');
    }
  });
});
