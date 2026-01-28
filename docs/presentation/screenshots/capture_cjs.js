console.log("Test script running...");

const { chromium } = require('playwright');

async function main() {
    console.log("Starting browser...");
    try {
        const browser = await chromium.launch({ headless: true });
        console.log("Browser launched!");

        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        console.log("Page created!");

        // Capture home page
        await page.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 15000 });
        console.log("Page loaded!");

        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'chasm_web_home.png' });
        console.log("✓ chasm_web_home.png captured");

        // Try additional routes
        const routes = ['overview', 'chat', 'sessions', 'workspaces', 'agents', 'settings'];
        for (const route of routes) {
            try {
                await page.goto(`http://localhost:5174/${route}`, { waitUntil: 'networkidle', timeout: 5000 });
                await page.waitForTimeout(500);
                await page.screenshot({ path: `chasm_web_${route}.png` });
                console.log(`✓ chasm_web_${route}.png captured`);
            } catch (e) {
                console.log(`- /${route} not available: ${e.message}`);
            }
        }

        await page.close();

        // Mobile viewport
        console.log("\nCapturing mobile screenshots...");
        const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });

        await mobilePage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 15000 });
        await mobilePage.waitForTimeout(1000);
        await mobilePage.screenshot({ path: 'chasm_app_home.png' });
        console.log("✓ chasm_app_home.png captured");

        for (const route of routes) {
            try {
                await mobilePage.goto(`http://localhost:5174/${route}`, { waitUntil: 'networkidle', timeout: 5000 });
                await mobilePage.waitForTimeout(500);
                await mobilePage.screenshot({ path: `chasm_app_${route}.png` });
                console.log(`✓ chasm_app_${route}.png captured`);
            } catch (e) {
                console.log(`- mobile /${route} not available`);
            }
        }

        await mobilePage.close();

        // Desktop viewport
        console.log("\nCapturing desktop screenshots...");
        const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });

        await desktopPage.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 15000 });
        await desktopPage.waitForTimeout(1000);
        await desktopPage.screenshot({ path: 'chasm_desktop_home.png' });
        console.log("✓ chasm_desktop_home.png captured");

        for (const route of routes) {
            try {
                await desktopPage.goto(`http://localhost:5174/${route}`, { waitUntil: 'networkidle', timeout: 5000 });
                await desktopPage.waitForTimeout(500);
                await desktopPage.screenshot({ path: `chasm_desktop_${route}.png` });
                console.log(`✓ chasm_desktop_${route}.png captured`);
            } catch (e) {
                console.log(`- desktop /${route} not available`);
            }
        }

        await desktopPage.close();
        await browser.close();

        console.log("\nScreenshot capture complete!");
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
