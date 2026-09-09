// Minimal stand-ins for the React Native modules the units under test import.
// These tests cover logic, not rendering, so nothing here needs a real bridge.
export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  select: <T,>(spec: Record<string, T>): T | undefined => spec.ios ?? spec.default,
};

export const AppState = {
  currentState: 'active' as string,
  addEventListener: () => ({ remove: () => {} }),
};

export const Alert = { alert: () => {} };

export const Share = { share: async () => ({ action: 'sharedAction' as const }) };

export default { Platform, AppState, Alert, Share };
