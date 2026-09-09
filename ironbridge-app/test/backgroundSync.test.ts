// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// The sync gates decide whether the app talks to the network at all, so a wrong
// answer here is either a flat battery or a feature that silently never runs.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backgroundSync } from '../src/services/backgroundSync';
import * as battery from './mocks/expo-battery';
import * as netinfo from './mocks/netinfo';
import storage from './mocks/async-storage';

// Restores the defaults every test starts from. `enabled: false` at teardown
// stops saveConfig from leaving a live timer behind.
const baseConfig = {
  enabled: true,
  intervalMinutes: 15,
  wifiOnly: false,
  chargingOnly: false,
  minBatteryLevel: 20,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  maxRetries: 3,
  retryBackoffMs: 5000,
};

beforeEach(async () => {
  storage.__reset();
  battery.__reset();
  netinfo.__reset();
  await backgroundSync.saveConfig(baseConfig);
});

afterEach(async () => {
  await backgroundSync.saveConfig({ enabled: false });
  vi.useRealTimers();
});

describe('checkSyncConditions', () => {
  it('allows a sync on wifi with a healthy battery', async () => {
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(true);
    expect(conditions.reason).toBeUndefined();
    expect(conditions.battery).toEqual({ level: 75, isCharging: false, available: true });
    expect(conditions.network.type).toBe('wifi');
  });

  it('refuses when sync is disabled', async () => {
    await backgroundSync.saveConfig({ enabled: false });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(false);
    expect(conditions.reason).toBe('Sync disabled');
  });

  it('refuses with no network', async () => {
    netinfo.__set({ isConnected: false, type: 'none' });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(false);
    expect(conditions.reason).toBe('No network connection');
  });

  it('refuses on cellular when wifiOnly is set', async () => {
    await backgroundSync.saveConfig({ wifiOnly: true });
    netinfo.__set({ type: 'cellular', details: { isConnectionExpensive: true } });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(false);
    expect(conditions.reason).toBe('WiFi-only sync enabled');
    expect(conditions.network.isMetered).toBe(true);
  });

  it('refuses below the battery floor', async () => {
    battery.__set({ level: 0.1 });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(false);
    expect(conditions.reason).toBe('Battery level too low (10%)');
  });

  it('allows a low battery that is charging', async () => {
    battery.__set({ level: 0.1, state: battery.BatteryState.CHARGING });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(true);
    expect(conditions.battery.isCharging).toBe(true);
  });

  it('treats a full battery as charging', async () => {
    await backgroundSync.saveConfig({ chargingOnly: true });
    battery.__set({ level: 1, state: battery.BatteryState.FULL });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(true);
    expect(conditions.battery.level).toBe(100);
  });

  it('refuses when chargingOnly is set and the device is unplugged', async () => {
    await backgroundSync.saveConfig({ chargingOnly: true });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(false);
    expect(conditions.reason).toBe('Charging-only sync enabled');
  });
});

describe('platforms that cannot report battery state', () => {
  // This is the case the old mock got wrong: it claimed 80% and unplugged, so
  // chargingOnly blocked every sync on a device that has no battery at all, and
  // the level gate silently passed anything under 80.

  it('skips the charging gate when battery state is unavailable', async () => {
    await backgroundSync.saveConfig({ chargingOnly: true });
    battery.__set({ available: false });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.battery.available).toBe(false);
    expect(conditions.canSync).toBe(true);
  });

  it('skips the level gate when battery state is unavailable', async () => {
    await backgroundSync.saveConfig({ minBatteryLevel: 90 });
    battery.__set({ available: false });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.canSync).toBe(true);
  });

  it('treats a -1 level as unavailable rather than as empty', async () => {
    // expo-battery answers -1 when it cannot read the level. Taken at face
    // value that is below every floor, so sync would never run again.
    battery.__set({ level: -1 });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.battery.available).toBe(false);
    expect(conditions.canSync).toBe(true);
  });

  it('survives the battery module throwing', async () => {
    battery.__set({ throws: true });
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.battery.available).toBe(false);
    expect(conditions.canSync).toBe(true);
  });
});

describe('quiet hours', () => {
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, h, m, 0));
  };

  it('is off unless enabled, even inside the window', async () => {
    at('23:30');
    const conditions = await backgroundSync.checkSyncConditions();

    expect(conditions.isQuietHours).toBe(false);
    expect(conditions.canSync).toBe(true);
  });

  it('blocks inside an overnight window, on both sides of midnight', async () => {
    await backgroundSync.saveConfig({ quietHoursEnabled: true });

    for (const time of ['22:00', '23:30', '03:00', '06:59']) {
      at(time);
      const conditions = await backgroundSync.checkSyncConditions();
      expect(conditions.isQuietHours, `expected ${time} to be quiet`).toBe(true);
      expect(conditions.reason).toBe('Quiet hours active');
    }
  });

  it('allows outside an overnight window, including its exact end', async () => {
    await backgroundSync.saveConfig({ quietHoursEnabled: true });

    for (const time of ['07:00', '12:00', '21:59']) {
      at(time);
      const conditions = await backgroundSync.checkSyncConditions();
      expect(conditions.isQuietHours, `expected ${time} to be loud`).toBe(false);
      expect(conditions.canSync).toBe(true);
    }
  });

  it('handles a same-day window too', async () => {
    await backgroundSync.saveConfig({
      quietHoursEnabled: true,
      quietHoursStart: '09:00',
      quietHoursEnd: '17:00',
    });

    at('12:00');
    expect((await backgroundSync.checkSyncConditions()).isQuietHours).toBe(true);

    at('08:59');
    expect((await backgroundSync.checkSyncConditions()).isQuietHours).toBe(false);

    at('17:00');
    expect((await backgroundSync.checkSyncConditions()).isQuietHours).toBe(false);
  });
});

describe('config persistence', () => {
  it('merges partial updates and writes them through', async () => {
    await backgroundSync.saveConfig({ intervalMinutes: 45 });

    const stored = JSON.parse((await storage.getItem('@ironbridge_sync_config'))!);
    expect(stored.intervalMinutes).toBe(45);
    // The rest of the config survives a partial write.
    expect(stored.minBatteryLevel).toBe(20);
    expect(stored.quietHoursStart).toBe('22:00');
  });
});
