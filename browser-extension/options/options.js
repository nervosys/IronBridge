// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// IronBridge Browser Extension - Options Page Script
// Copyright 2025-2026 Nervosys LLC

const DEFAULT_SETTINGS = {
    apiUrl: 'http://localhost:8787',
    apiKey: '',
    autoHarvest: false,
    harvestInterval: 30,
    notifications: true,
    soundEnabled: false,
    providers: ['chatgpt', 'claude', 'gemini'],
    exportFormat: 'json',
    includeMetadata: true,
};

// DOM Elements
const elements = {
    apiUrl: document.getElementById('apiUrl'),
    apiKey: document.getElementById('apiKey'),
    testConnection: document.getElementById('testConnection'),
    connectionStatus: document.getElementById('connectionStatus'),
    autoHarvest: document.getElementById('autoHarvest'),
    harvestInterval: document.getElementById('harvestInterval'),
    notifications: document.getElementById('notifications'),
    soundEnabled: document.getElementById('soundEnabled'),
    exportFormat: document.getElementById('exportFormat'),
    includeMetadata: document.getElementById('includeMetadata'),
    exportSettings: document.getElementById('exportSettings'),
    importSettings: document.getElementById('importSettings'),
    importFile: document.getElementById('importFile'),
    clearCache: document.getElementById('clearCache'),
    saveSettings: document.getElementById('saveSettings'),
    resetSettings: document.getElementById('resetSettings'),
};

// Initialize
async function init() {
    await loadSettings();
    setupEventListeners();
}

// Load settings from storage
async function loadSettings() {
    const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);

    elements.apiUrl.value = settings.apiUrl || DEFAULT_SETTINGS.apiUrl;
    elements.apiKey.value = settings.apiKey || '';
    elements.autoHarvest.checked = settings.autoHarvest;
    elements.harvestInterval.value = settings.harvestInterval;
    elements.notifications.checked = settings.notifications;
    elements.soundEnabled.checked = settings.soundEnabled;
    elements.exportFormat.value = settings.exportFormat;
    elements.includeMetadata.checked = settings.includeMetadata;

    // Set provider checkboxes
    const providers = settings.providers || DEFAULT_SETTINGS.providers;
    document.querySelectorAll('input[name="provider"]').forEach(checkbox => {
        checkbox.checked = providers.includes(checkbox.value);
    });
}

// Setup event listeners
function setupEventListeners() {
    elements.testConnection.addEventListener('click', testConnection);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.resetSettings.addEventListener('click', resetSettings);
    elements.exportSettings.addEventListener('click', exportSettingsFile);
    elements.importSettings.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importSettingsFile);
    elements.clearCache.addEventListener('click', clearCache);
}

// Test API connection
async function testConnection() {
    elements.testConnection.disabled = true;
    elements.connectionStatus.textContent = 'Testing...';
    elements.connectionStatus.className = 'status';

    try {
        const apiUrl = elements.apiUrl.value || DEFAULT_SETTINGS.apiUrl;
        const response = await fetch(`${apiUrl}/api/health`, {
            method: 'GET',
            headers: elements.apiKey.value ? {
                'Authorization': `Bearer ${elements.apiKey.value}`,
            } : {},
        });

        if (response.ok) {
            elements.connectionStatus.textContent = 'Connected!';
            elements.connectionStatus.className = 'status success';
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        elements.connectionStatus.textContent = 'Failed to connect';
        elements.connectionStatus.className = 'status error';
    } finally {
        elements.testConnection.disabled = false;
    }
}

// Save settings
async function saveSettings() {
    const providers = [];
    document.querySelectorAll('input[name="provider"]:checked').forEach(checkbox => {
        providers.push(checkbox.value);
    });

    const settings = {
        apiUrl: elements.apiUrl.value || DEFAULT_SETTINGS.apiUrl,
        apiKey: elements.apiKey.value,
        autoHarvest: elements.autoHarvest.checked,
        harvestInterval: parseInt(elements.harvestInterval.value, 10),
        notifications: elements.notifications.checked,
        soundEnabled: elements.soundEnabled.checked,
        providers: providers,
        exportFormat: elements.exportFormat.value,
        includeMetadata: elements.includeMetadata.checked,
    };

    await chrome.storage.local.set(settings);
    showToast('Settings saved!', 'success');
}

// Reset to defaults
async function resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
        await chrome.storage.local.set(DEFAULT_SETTINGS);
        await loadSettings();
        showToast('Settings reset to defaults', 'success');
    }
}

// Export settings to file
function exportSettingsFile() {
    chrome.storage.local.get(DEFAULT_SETTINGS).then(settings => {
        // Export only the known settings keys, and never the apiKey. Excluding
        // runtime state (cachedSessions/lastHarvest/stats) keeps export/import
        // symmetric with the import allowlist, so a round-trip neither leaks
        // that data into a shared file nor silently drops it on re-import.
        const exportData = {};
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (key === 'apiKey') continue;
            exportData[key] = settings[key];
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ironbridge-settings.json';
        a.click();
        URL.revokeObjectURL(url);

        showToast('Settings exported', 'success');
    });
}

// Import settings from file
function importSettingsFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            // Apply only the known settings keys, and only when the value's type
            // matches the default. This keeps an imported file from injecting
            // unknown storage entries (e.g. a forged `cachedSessions` blob) and
            // from writing a wrong-typed value -- e.g. `providers` as a number,
            // which would throw in loadSettings() and break the page on reload.
            const settings = {};
            for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
                if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
                const value = parsed[key];
                const typeOk = Array.isArray(def)
                    ? Array.isArray(value) && value.every((v) => typeof v === 'string')
                    : typeof value === typeof def;
                if (typeOk) settings[key] = value;
            }
            if (Object.keys(settings).length === 0) {
                showToast('No valid settings found in file', 'error');
                return;
            }
            await chrome.storage.local.set(settings);
            await loadSettings();
            showToast('Settings imported', 'success');
        } catch (error) {
            showToast('Invalid settings file', 'error');
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

// Clear local cache
async function clearCache() {
    if (confirm('Clear all locally cached session data? This will not affect data stored on the server.')) {
        await chrome.storage.local.remove(['cachedSessions', 'lastHarvest', 'stats']);
        showToast('Cache cleared', 'success');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
