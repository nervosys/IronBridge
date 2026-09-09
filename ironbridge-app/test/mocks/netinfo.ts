// NetInfo stand-in whose answer the tests set directly.
export const __state = {
  isConnected: true as boolean | null,
  type: 'wifi' as string,
  details: { isConnectionExpensive: false } as Record<string, unknown> | null,
};

export function __set(next: Partial<typeof __state>) {
  Object.assign(__state, next);
}

export function __reset() {
  __state.isConnected = true;
  __state.type = 'wifi';
  __state.details = { isConnectionExpensive: false };
}

const NetInfo = {
  async fetch() {
    return { ...__state };
  },
  addEventListener: () => () => {},
};

export default NetInfo;
