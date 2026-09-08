// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// IronBridge Browser Extension - Popup Script
// Copyright 2025-2026 Nervosys LLC

const API_BASE = 'http://localhost:8787';

// Provider detection patterns
const PROVIDERS = {
    'chat.openai.com': { name: 'ChatGPT', icon: '🤖', type: 'chatgpt' },
    'chatgpt.com': { name: 'ChatGPT', icon: '🤖', type: 'chatgpt' },
    'claude.ai': { name: 'Claude', icon: '🧠', type: 'claude' },
    'gemini.google.com': { name: 'Gemini', icon: '✨', type: 'gemini' },
    'copilot.microsoft.com': { name: 'Copilot', icon: '🔷', type: 'copilot' },
    'poe.com': { name: 'Poe', icon: '💬', type: 'poe' },
    'perplexity.ai': { name: 'Perplexity', icon: '🔍', type: 'perplexity' },
};

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const providerInfo = document.getElementById('providerInfo');
const harvestBtn = document.getElementById('harvestBtn');
const exportBtn = document.getElementById('exportBtn');
const totalSessions = document.getElementById('totalSessions');
const totalMessages = document.getElementById('totalMessages');
const providersCount = document.getElementById('providers');
const openDashboard = document.getElementById('openDashboard');
const openSettings = document.getElementById('openSettings');

// Initialize popup
async function init() {
    await checkConnection();
    await detectCurrentPage();
    await loadStats();
    setupEventListeners();
}

// Check API connection
async function checkConnection() {
    const statusDot = connectionStatus.querySelector('.status-dot');
    const statusText = connectionStatus.querySelector('.status-text');

    try {
        const response = await fetch(`${API_BASE}/api/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
            statusDot.classList.add('connected');
            statusDot.classList.remove('disconnected');
            statusText.textContent = 'Connected to IronBridge';
            harvestBtn.disabled = false;
        } else {
            throw new Error('API not healthy');
        }
    } catch {
        statusDot.classList.add('disconnected');
        statusDot.classList.remove('connected');
        statusText.textContent = 'Not connected - Start IronBridge API';
        harvestBtn.disabled = true;
    }
}

// Detect current page provider
async function detectCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = new URL(tab.url);
        const hostname = url.hostname.replace('www.', '');

        const provider = PROVIDERS[hostname];
        const providerIcon = providerInfo.querySelector('.provider-icon');
        const providerName = providerInfo.querySelector('.provider-name');

        if (provider) {
            providerIcon.textContent = provider.icon;
            providerName.textContent = provider.name;
            exportBtn.disabled = false;
        } else {
            providerIcon.textContent = '🌐';
            providerName.textContent = 'Not a supported AI chat';
            exportBtn.disabled = true;
        }
    } catch (error) {
        console.error('Failed to detect page:', error);
    }
}

// Load statistics from API
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
            const stats = await response.json();
            totalSessions.textContent = stats.total_sessions || 0;
            totalMessages.textContent = stats.total_messages || 0;
            providersCount.textContent = stats.providers || 0;
        } else {
            // Default values if API fails
            totalSessions.textContent = '-';
            totalMessages.textContent = '-';
            providersCount.textContent = '-';
        }
    } catch {
        totalSessions.textContent = '-';
        totalMessages.textContent = '-';
        providersCount.textContent = '-';
    }
}

// Setup event listeners
function setupEventListeners() {
    harvestBtn.addEventListener('click', handleHarvest);
    exportBtn.addEventListener('click', handleExport);
    openDashboard.addEventListener('click', handleOpenDashboard);
    openSettings.addEventListener('click', handleOpenSettings);
}

// Handle harvest button click
async function handleHarvest() {
    harvestBtn.disabled = true;
    harvestBtn.classList.add('loading');

    try {
        const response = await fetch(`${API_BASE}/api/harvest`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ all: true }),
        });

        if (response.ok) {
            const result = await response.json();
            showToast(`Harvested ${result.sessions_count || 0} sessions`, 'success');
            await loadStats();
        } else {
            throw new Error('Harvest failed');
        }
    } catch {
        showToast('Harvest failed - check API connection', 'error');
    } finally {
        harvestBtn.disabled = false;
        harvestBtn.classList.remove('loading');
    }
}

// Handle export button click
async function handleExport() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Send message to content script to extract session
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractSession' });

        if (response && response.session) {
            // Send to API
            const apiResponse = await fetch(`${API_BASE}/api/sessions`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(response.session),
            });

            if (apiResponse.ok) {
                showToast('Session exported successfully', 'success');
                await loadStats();
            } else {
                throw new Error('Export failed');
            }
        } else {
            showToast('No session found on this page', 'error');
        }
    } catch {
        showToast('Export failed - try refreshing the page', 'error');
    }
}

// Open dashboard
function handleOpenDashboard(e) {
    e.preventDefault();
    chrome.tabs.create({ url: `${API_BASE}` });
}

// Open settings
function handleOpenSettings(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
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
