import { describe, expect, test } from 'vitest';
import { add, subtract } from '../calculator.js';

describe('calculator', () => {
  test('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('subtracts two numbers', () => {
    expect(subtract(7, 4)).toBe(3);
  });
});
