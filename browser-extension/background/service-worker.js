// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Chasm Browser Extension - Service Worker
// Copyright 2025-2026 Nervosys LLC

const API_BASE = 'http://localhost:8787';

// Install event
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Chasm extension installed');
    await createContextMenus();
    const defaults = {
        apiUrl: API_BASE,
        autoHarvest: false,
        harvestInterval: 30,
        notifications: true,
        lastHarvestTime: null,
        harvestStats: { total: 0, lastCount: 0 },
    };
    await chrome.storage.local.set(defaults);
    await initAutoHarvest();
});

// Startup event - reinitialize alarms after browser restart
chrome.runtime.onStartup.addListener(async () => {
    console.log('Chasm extension started');
    await initAutoHarvest();
});

// Initialize auto-harvest based on settings
async function initAutoHarvest() {
    const settings = await chrome.storage.local.get(['autoHarvest', 'harvestInterval']);
    await chrome.alarms.clear('auto-harvest');
    if (settings.autoHarvest) {
        const intervalMinutes = settings.harvestInterval || 30;
        chrome.alarms.create('auto-harvest', {
            delayInMinutes: 1,
            periodInMinutes: intervalMinutes,
        });
        console.log('Auto-harvest enabled: every ' + intervalMinutes + ' minutes');
    } else {
        console.log('Auto-harvest disabled');
    }
}

// Create context menus
async function createContextMenus() {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
        id: 'chasm-export',
        title: 'Export to Chasm',
        contexts: ['page'],
        documentUrlPatterns: [
            '*://chat.openai.com/*', '*://chatgpt.com/*', '*://claude.ai/*',
            '*://gemini.google.com/*', '*://copilot.microsoft.com/*',
            '*://poe.com/*', '*://www.perplexity.ai/*',
        ],
    });
    chrome.contextMenus.create({
        id: 'chasm-export-selection',
        title: 'Save selection to Chasm',
        contexts: ['selection'],
        documentUrlPatterns: [
            '*://chat.openai.com/*', '*://chatgpt.com/*', '*://claude.ai/*',
            '*://gemini.google.com/*', '*://copilot.microsoft.com/*',
            '*://poe.com/*', '*://www.perplexity.ai/*',
        ],
    });
    chrome.contextMenus.create({
        id: 'chasm-copy-markdown',
        title: 'Copy as Markdown',
        contexts: ['selection'],
        documentUrlPatterns: [
            '*://chat.openai.com/*', '*://chatgpt.com/*', '*://claude.ai/*',
            '*://gemini.google.com/*',
        ],
    });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case 'chasm-export': await handleExportSession(tab); break;
        case 'chasm-export-selection': await handleExportSelection(info, tab); break;
        case 'chasm-copy-markdown': await handleCopyMarkdown(info, tab); break;
    }
});

// Handle export session
async function handleExportSession(tab) {
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractSession' });
        if (response && response.session) {
            const apiResponse = await fetch(API_BASE + '/api/sessions', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(response.session),
            });
            if (apiResponse.ok) {
                showNotification('Session Exported', 'Session saved to Chasm successfully');
            } else {
                showNotification('Export Failed', 'Failed to save session to Chasm');
            }
        }
    } catch (error) {
        showNotification('Export Failed', error.message);
    }
}

// Handle export selection
async function handleExportSelection(info, tab) {
    try {
        const url = new URL(tab.url);
        const note = {
            type: 'note',
            content: info.selectionText,
            source: url.hostname,
            url: tab.url,
            timestamp: new Date().toISOString(),
        };
        const apiResponse = await fetch(API_BASE + '/api/notes', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(note),
        });
        if (apiResponse.ok) {
            showNotification('Note Saved', 'Selection saved to Chasm');
        } else {
            showNotification('Save Failed', 'Failed to save selection');
        }
    } catch (error) {
        showNotification('Save Failed', error.message);
    }
}

// Handle copy as markdown
async function handleCopyMarkdown(info, tab) {
    try {
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'getSelectionAsMarkdown',
            text: info.selectionText,
        });
        if (response && response.markdown) {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'copyToClipboard',
                text: response.markdown,
            });
            showNotification('Copied', 'Markdown copied to clipboard');
        }
    } catch (error) {
        console.error('Copy failed:', error);
    }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'getSettings':
            chrome.storage.local.get(null).then(sendResponse);
            return true;
        case 'harvest':
            handleHarvest().then(sendResponse);
            return true;
        case 'checkConnection':
            checkApiConnection().then(sendResponse);
            return true;
    }
});

// Harvest all sessions
async function handleHarvest() {
    try {
        const response = await fetch(API_BASE + '/api/harvest', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
        });
        if (response.ok) {
            const result = await response.json();
            showNotification('Harvest Complete', 'Found ' + (result.sessions_count || 0) + ' sessions');
            return { success: true, ...result };
        }
        return { success: false, error: 'API error' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Check API connection
async function checkApiConnection() {
    try {
        const response = await fetch(API_BASE + '/api/health');
        return { connected: response.ok };
    } catch {
        return { connected: false };
    }
}

// Show notification
async function showNotification(title, message) {
    const settings = await chrome.storage.local.get('notifications');
    if (settings.notifications === false) return;
    chrome.notifications.create({
        type: 'basic',
        iconUrl: '../icons/icon128.png',
        title: 'Chasm: ' + title,
        message: message,
    });
}

// Auto-harvest alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'auto-harvest') {
        console.log('Auto-harvest triggered');
        const result = await handleHarvest();
        if (result.success) {
            const stats = await chrome.storage.local.get('harvestStats');
            const newStats = {
                total: (stats.harvestStats?.total || 0) + (result.sessions_count || 0),
                lastCount: result.sessions_count || 0,
            };
            await chrome.storage.local.set({
                harvestStats: newStats,
                lastHarvestTime: new Date().toISOString(),
            });
        }
    }
});

// Settings change handler
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.autoHarvest || changes.harvestInterval) {
        await initAutoHarvest();
    }
    if (changes.apiUrl) {
        console.log('API URL changed to:', changes.apiUrl.newValue);
    }
});
