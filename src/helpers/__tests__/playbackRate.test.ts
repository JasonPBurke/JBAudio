import {
  RATE_MIN,
  RATE_MAX,
  RATE_STEP,
  RATE_PRESETS,
  quantizeRate,
  formatRate,
  resolveSpeedTap,
} from '../playbackRate';

describe('quantizeRate', () => {
  it('returns on-grid values unchanged', () => {
    expect(quantizeRate(1.0)).toBe(1.0);
    expect(quantizeRate(1.25)).toBe(1.25);
    expect(quantizeRate(0.5)).toBe(0.5);
    expect(quantizeRate(2.5)).toBe(2.5);
  });

  it('rounds off-grid values to the nearest 0.05', () => {
    expect(quantizeRate(1.333)).toBe(1.35);
    expect(quantizeRate(1.32)).toBe(1.3);
    expect(quantizeRate(1.025)).toBe(1.05); // ties round up
  });

  it('clamps below RATE_MIN and above RATE_MAX', () => {
    expect(quantizeRate(0.2)).toBe(RATE_MIN);
    expect(quantizeRate(-1)).toBe(RATE_MIN);
    expect(quantizeRate(3.7)).toBe(RATE_MAX);
  });

  it('kills floating-point drift from repeated ±0.05 stepping', () => {
    // 1.05 + 0.05 + 0.05 + 0.05 === 1.2000000000000002 in IEEE 754
    let rate = 1.05;
    for (let i = 0; i < 3; i++) {
      rate = quantizeRate(rate + RATE_STEP);
    }
    expect(rate).toBe(1.2);
  });
});

describe('formatRate', () => {
  it('trims trailing zeros and the decimal point', () => {
    expect(formatRate(1)).toBe('1x');
    expect(formatRate(2)).toBe('2x');
    expect(formatRate(1.5)).toBe('1.5x');
    expect(formatRate(0.75)).toBe('0.75x');
    expect(formatRate(1.35)).toBe('1.35x');
    expect(formatRate(2.5)).toBe('2.5x');
  });

  it('renders drifted values as their on-grid display', () => {
    expect(formatRate(1.2000000000000002)).toBe('1.2x');
  });
});

describe('resolveSpeedTap', () => {
  it('deactivates to 1x when a custom speed is active', () => {
    expect(resolveSpeedTap(1.5, 1.5)).toEqual({ kind: 'set', rate: 1 });
    expect(resolveSpeedTap(0.75, null)).toEqual({ kind: 'set', rate: 1 });
  });

  it('restores the saved speed when at 1x with a memory', () => {
    expect(resolveSpeedTap(1, 1.5)).toEqual({ kind: 'set', rate: 1.5 });
    expect(resolveSpeedTap(1, 2.25)).toEqual({ kind: 'set', rate: 2.25 });
  });

  it('opens the sheet when at 1x with nothing saved', () => {
    expect(resolveSpeedTap(1, null)).toEqual({ kind: 'openSheet' });
  });

  it('opens the sheet if the saved speed is somehow 1x itself', () => {
    expect(resolveSpeedTap(1, 1)).toEqual({ kind: 'openSheet' });
  });
});

describe('constants', () => {
  it('presets sit inside the range on the 0.05 grid', () => {
    for (const preset of RATE_PRESETS) {
      expect(preset).toBeGreaterThanOrEqual(RATE_MIN);
      expect(preset).toBeLessThanOrEqual(RATE_MAX);
      expect(quantizeRate(preset)).toBe(preset);
    }
  });
});
