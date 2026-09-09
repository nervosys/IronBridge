// expo-battery stand-in. `available: false` reproduces web and the simulators
// that report nothing, which is the case the production code has to skip
// rather than guess at.
export enum BatteryState {
  UNKNOWN = 0,
  UNPLUGGED = 1,
  CHARGING = 2,
  FULL = 3,
}

export const __state = {
  available: true,
  level: 0.75,
  state: BatteryState.UNPLUGGED as BatteryState,
  throws: false,
};

export function __set(next: Partial<typeof __state>) {
  Object.assign(__state, next);
}

export function __reset() {
  __state.available = true;
  __state.level = 0.75;
  __state.state = BatteryState.UNPLUGGED;
  __state.throws = false;
}

export async function isAvailableAsync() {
  if (__state.throws) throw new Error('battery module unavailable');
  return __state.available;
}

export async function getBatteryLevelAsync() {
  if (__state.throws) throw new Error('battery module unavailable');
  return __state.level;
}

export async function getBatteryStateAsync() {
  if (__state.throws) throw new Error('battery module unavailable');
  return __state.state;
}
