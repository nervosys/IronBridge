const { chromium } = require('playwright');
const path = require('path');

(async () => {
    console.log('Starting screenshot capture...');

    const browser = await chromium.launch({ headless: true });
    const dir = __dirname;

    // Web screenshots (1920x1080)
    console.log('\\nCapturing ironbridge-web...');
    const webPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    try {
        await webPage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 15000 });
        await webPage.waitForTimeout(2000);
        await webPage.screenshot({ path: path.join(dir, 'ironbridge_web_home.png') });
        console.log('  saved: ironbridge_web_home.png');
    } catch (e) {
        console.log('  error:', e.message);
    }

    // Try different routes
    for (const route of ['overview', 'chat', 'sessions', 'workspaces', 'agents', 'settings']) {
        try {
            await webPage.goto('http://localhost:5174/' + route, { waitUntil: 'networkidle', timeout: 5000 });
            await webPage.waitForTimeout(500);
            await webPage.screenshot({ path: path.join(dir, 'ironbridge_web_' + route + '.png') });
            console.log('  saved: ironbridge_web_' + route + '.png');
        } catch (e) {
            // Route doesn't exist, skip
        }
    }
    await webPage.close();

    // Mobile screenshots (390x844)
    console.log('\\nCapturing ironbridge-app (mobile)...');
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });

    try {
        await mobilePage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 15000 });
        await mobilePage.waitForTimeout(2000);
        await mobilePage.screenshot({ path: path.join(dir, 'ironbridge_app_home.png') });
        console.log('  saved: ironbridge_app_home.png');
    } catch (e) {
        console.log('  error:', e.message);
    }

    for (const route of ['workspaces', 'sessions', 'chat', 'search', 'settings']) {
        try {
            await mobilePage.goto('http://localhost:5174/' + route, { waitUntil: 'networkidle', timeout: 5000 });
            await mobilePage.waitForTimeout(500);
            await mobilePage.screenshot({ path: path.join(dir, 'ironbridge_app_' + route + '.png') });
            console.log('  saved: ironbridge_app_' + route + '.png');
        } catch (e) {
            // skip
        }
    }
    await mobilePage.close();

    // Desktop screenshots (1440x900)
    console.log('\\nCapturing ironbridge-desktop...');
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
        await desktopPage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 15000 });
        await desktopPage.waitForTimeout(2000);
        await desktopPage.screenshot({ path: path.join(dir, 'ironbridge_desktop_home.png') });
        console.log('  saved: ironbridge_desktop_home.png');
    } catch (e) {
        console.log('  error:', e.message);
    }

    for (const route of ['overview', 'sessions', 'workspaces', 'agents', 'chat', 'settings']) {
        try {
            await desktopPage.goto('http://localhost:5174/' + route, { waitUntil: 'networkidle', timeout: 5000 });
            await desktopPage.waitForTimeout(500);
            await desktopPage.screenshot({ path: path.join(dir, 'ironbridge_desktop_' + route + '.png') });
            console.log('  saved: ironbridge_desktop_' + route + '.png');
        } catch (e) {
            // skip
        }
    }
    await desktopPage.close();

    await browser.close();
    console.log('\\nDone!');
})();
