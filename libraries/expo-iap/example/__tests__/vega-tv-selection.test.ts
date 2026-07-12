import {getVegaTvNavigationStep} from '../src/hooks/useVegaTvSelection';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {expoConfig: {extra: {}}},
}));

describe('Vega TV selection', () => {
  beforeEach(() => {
    (
      globalThis as {EXPO_IAP_ENABLE_TV_SHORTCUTS?: boolean}
    ).EXPO_IAP_ENABLE_TV_SHORTCUTS = true;
  });

  afterEach(() => {
    delete (globalThis as {EXPO_IAP_ENABLE_TV_SHORTCUTS?: boolean})
      .EXPO_IAP_ENABLE_TV_SHORTCUTS;
  });

  it('maps only direction keys to selection movement', () => {
    expect(
      getVegaTvNavigationStep({eventKeyAction: 1, eventType: 'right'}),
    ).toBe(1);
    expect(
      getVegaTvNavigationStep({eventKeyAction: 1, eventType: 'left'}),
    ).toBe(-1);
    expect(
      getVegaTvNavigationStep({eventKeyAction: 1, eventType: 'select'}),
    ).toBe(0);
    expect(
      getVegaTvNavigationStep({eventKeyAction: 1, eventType: 'enter'}),
    ).toBe(0);
  });
});
