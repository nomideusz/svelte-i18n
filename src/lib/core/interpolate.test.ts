import { describe, it, expect } from 'vitest';
import { interpolate } from './interpolate.js';

describe('interpolate', () => {
  it('replaces single placeholder', () => {
    expect(interpolate('Hello {name}', { name: 'Jan' })).toBe('Hello Jan');
  });

  it('replaces multiple placeholders', () => {
    expect(
      interpolate('{name} has {count} items', { name: 'Jan', count: 3 }),
    ).toBe('Jan has 3 items');
  });

  it('leaves unknown placeholders intact', () => {
    expect(interpolate('Hello {name}', { other: 'val' })).toBe('Hello {name}');
  });

  it('returns template unchanged when no params', () => {
    expect(interpolate('Hello {name}')).toBe('Hello {name}');
  });

  it('returns template unchanged for empty params', () => {
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
  });

  it('handles string with no placeholders', () => {
    expect(interpolate('Hello world', { name: 'Jan' })).toBe('Hello world');
  });

  it('handles empty string', () => {
    expect(interpolate('', { name: 'Jan' })).toBe('');
  });

  it('handles numeric values', () => {
    expect(interpolate('Page {page} of {total}', { page: 1, total: 10 })).toBe(
      'Page 1 of 10',
    );
  });

  it('handles zero as a valid value', () => {
    expect(interpolate('{count} items', { count: 0 })).toBe('0 items');
  });

  it('handles repeated placeholders', () => {
    expect(interpolate('{x} + {x} = {y}', { x: 2, y: 4 })).toBe('2 + 2 = 4');
  });
});
