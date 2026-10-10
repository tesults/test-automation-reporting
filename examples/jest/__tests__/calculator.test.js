const { add, subtract } = require('../calculator');

describe('calculator', () => {
  test('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('subtracts two numbers', () => {
    expect(subtract(7, 4)).toBe(3);
  });
});
