// Screenshot capture script for Chasm platforms
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function captureScreenshots() {
    const browser = await chromium.launch({ headless: true });

    // Viewport sizes
    const webViewport = { width: 1920, height: 1080 };
    const mobileViewport = { width: 390, height: 844 }; // iPhone 14 Pro

    console.log('Capturing chasm-web screenshots...');

    // Capture chasm-web
    const webPage = await browser.newPage({ viewport: webViewport });

    try {
        await webPage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 10000 });
        await webPage.waitForTimeout(1000);
        await webPage.screenshot({
            path: join(__dirname, 'chasm_web_home.png'),
            fullPage: false
        });
        console.log('  ✓ chasm_web_home.png');

        // Try to navigate to different views if they exist
        const links = await webPage.$$('nav a, aside a, [role="navigation"] a');

        // Check for overview/dashboard
        try {
            await webPage.goto('http://localhost:5174/overview', { waitUntil: 'networkidle', timeout: 5000 });
            await webPage.waitForTimeout(500);
            await webPage.screenshot({ path: join(__dirname, 'chasm_web_overview_new.png') });
            console.log('  ✓ chasm_web_overview_new.png');
        } catch (e) {
            console.log('  - /overview not available');
        }

        // Check for chat view
        try {
            await webPage.goto('http://localhost:5174/chat', { waitUntil: 'networkidle', timeout: 5000 });
            await webPage.waitForTimeout(500);
            await webPage.screenshot({ path: join(__dirname, 'chasm_web_chat_new.png') });
            console.log('  ✓ chasm_web_chat_new.png');
        } catch (e) {
            console.log('  - /chat not available');
        }

        // Check for sessions
        try {
            await webPage.goto('http://localhost:5174/sessions', { waitUntil: 'networkidle', timeout: 5000 });
            await webPage.waitForTimeout(500);
            await webPage.screenshot({ path: join(__dirname, 'chasm_web_sessions.png') });
            console.log('  ✓ chasm_web_sessions.png');
        } catch (e) {
            console.log('  - /sessions not available');
        }

        // Check for workspaces
        try {
            await webPage.goto('http://localhost:5174/workspaces', { waitUntil: 'networkidle', timeout: 5000 });
            await webPage.waitForTimeout(500);
            await webPage.screenshot({ path: join(__dirname, 'chasm_web_workspaces.png') });
            console.log('  ✓ chasm_web_workspaces.png');
        } catch (e) {
            console.log('  - /workspaces not available');
        }

        // Check for agents
        try {
            await webPage.goto('http://localhost:5174/agents', { waitUntil: 'networkidle', timeout: 5000 });
            await webPage.waitForTimeout(500);
            await webPage.screenshot({ path: join(__dirname, 'chasm_web_agents.png') });
            console.log('  ✓ chasm_web_agents.png');
        } catch (e) {
            console.log('  - /agents not available');
        }

        // Check for settings
        try {
            await webPage.goto('http://localhost:5174/settings', { waitUntil: 'networkidle', timeout: 5000 });
            await webPage.waitForTimeout(500);
            await webPage.screenshot({ path: join(__dirname, 'chasm_web_settings.png') });
            console.log('  ✓ chasm_web_settings.png');
        } catch (e) {
            console.log('  - /settings not available');
        }

    } catch (e) {
        console.log('  ✗ Error capturing chasm-web:', e.message);
    }

    await webPage.close();

    // Capture chasm-app (mobile) simulation
    console.log('\nCapturing chasm-app (mobile) screenshots...');
    const mobilePage = await browser.newPage({ viewport: mobileViewport });

    try {
        // Use the same web app but in mobile viewport to simulate React Native views
        await mobilePage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 10000 });
        await mobilePage.waitForTimeout(1000);
        await mobilePage.screenshot({
            path: join(__dirname, 'chasm_app_home.png'),
            fullPage: false
        });
        console.log('  ✓ chasm_app_home.png');

        // Try mobile routes
        const mobileRoutes = ['workspaces', 'sessions', 'search', 'chat', 'settings'];
        for (const route of mobileRoutes) {
            try {
                await mobilePage.goto(`http://localhost:5174/${route}`, { waitUntil: 'networkidle', timeout: 5000 });
                await mobilePage.waitForTimeout(500);
                await mobilePage.screenshot({ path: join(__dirname, `chasm_app_${route}.png`) });
                console.log(`  ✓ chasm_app_${route}.png`);
            } catch (e) {
                console.log(`  - /${route} not available on mobile`);
            }
        }

    } catch (e) {
        console.log('  ✗ Error capturing chasm-app:', e.message);
    }

    await mobilePage.close();

    // For desktop, we'd need to run the Tauri app, but we can capture the web version
    // at desktop resolution as a stand-in since it shares the same UI
    console.log('\nCapturing chasm-desktop screenshots (via web at desktop resolution)...');
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
        await desktopPage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 10000 });
        await desktopPage.waitForTimeout(1000);
        await desktopPage.screenshot({
            path: join(__dirname, 'chasm_desktop_home.png'),
            fullPage: false
        });
        console.log('  ✓ chasm_desktop_home.png');

        // Capture at different routes
        const desktopRoutes = ['overview', 'sessions', 'workspaces', 'agents', 'chat', 'settings'];
        for (const route of desktopRoutes) {
            try {
                await desktopPage.goto(`http://localhost:5174/${route}`, { waitUntil: 'networkidle', timeout: 5000 });
                await desktopPage.waitForTimeout(500);
                await desktopPage.screenshot({ path: join(__dirname, `chasm_desktop_${route}.png`) });
                console.log(`  ✓ chasm_desktop_${route}.png`);
            } catch (e) {
                console.log(`  - /${route} not available`);
            }
        }

    } catch (e) {
        console.log('  ✗ Error capturing chasm-desktop:', e.message);
    }

    await desktopPage.close();
    await browser.close();

    console.log('\nScreenshot capture complete!');
}

captureScreenshots().catch(console.error);
