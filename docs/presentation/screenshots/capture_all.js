console.log("IronBridge Screenshot Capture Script");
console.log("=============================\n");

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// Start the Vite dev server and wait for it to be ready
async function startDevServer() {
    const webDir = path.resolve(__dirname, '../../../ironbridge-web');
    console.log(`Starting Vite dev server from ${webDir} (demo mode)...`);

    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';

    const server = spawn(npmCmd, ['run', 'dev'], {
        cwd: webDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWindows,
        detached: !isWindows,
        env: { ...process.env, VITE_ENABLE_DEMO_MODE: 'true' }, // Enable demo mode for mock data
    });

    server.stdout.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Local:')) {
            console.log('  Server started: ' + msg.match(/http:\/\/localhost:\d+/)?.[0]);
        }
    });

    server.stderr.on('data', (data) => {
        // Vite logs to stderr for some things
    });

    // Wait for server to be ready by polling
    await waitForServer('http://localhost:5173', 30000);
    console.log('  Vite server is ready!');
    return server;
}

// Start the Expo web server for the mobile app
async function startExpoServer() {
    const appDir = path.resolve(__dirname, '../../../ironbridge-app');
    console.log(`Starting Expo web server from ${appDir}...`);

    const isWindows = process.platform === 'win32';
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';

    const server = spawn(npxCmd, ['expo', 'start', '--web', '--port', '8081'], {
        cwd: appDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWindows,
        detached: !isWindows,
        env: { ...process.env, BROWSER: 'none' }, // Don't auto-open browser
    });

    server.stdout.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Web is waiting')) {
            console.log('  Expo web server started');
        }
    });

    server.stderr.on('data', (data) => {
        // Expo logs to stderr for some things
    });

    // Wait for server to be ready by polling
    await waitForServer('http://localhost:8081', 60000);
    console.log('  Expo server is ready!');
    return server;
}

// Wait for a server to be ready
async function waitForServer(url, maxWait) {
    const start = Date.now();

    while (Date.now() - start < maxWait) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(url, (res) => {
                    resolve(res.statusCode);
                });
                req.on('error', reject);
                req.setTimeout(1000, () => {
                    req.destroy();
                    reject(new Error('timeout'));
                });
            });
            return true;
        } catch (e) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    throw new Error(`Server at ${url} failed to start within ${maxWait / 1000} seconds`);
}

// Helper to wait for page to be ready for screenshot
async function waitForPageReady(page, routeName) {
    // Wait for DOM to load
    await page.waitForLoadState('domcontentloaded');

    // Wait for loading indicators to disappear first
    const loadingSelectors = [
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="skeleton"]',
        '.animate-pulse',
        '.animate-spin',
        'text=Loading',
    ];

    for (const selector of loadingSelectors) {
        try {
            await page.waitForSelector(selector, { state: 'hidden', timeout: 5000 });
        } catch (e) {
            // Selector not found or already hidden, continue
        }
    }

    // Wait for data content to appear based on route
    const contentSelectors = {
        'home': '[class*="card"], [class*="stat"]',
        'workspaces': 'table tbody tr, [class*="workspace"]',
        'sessions': 'table tbody tr, [class*="session"]',
        'providers': '[class*="provider"], [class*="card"]',
        'harvest': '[class*="harvest"], table',
        'agents': '[class*="agent"], [class*="card"]',
        'agents_inbox': '[class*="inbox"], [class*="message"]',
        'comparison': '[class*="comparison"], [class*="model"]',
        'accounts': '[class*="account"], [class*="card"]',
        'developer': '[class*="developer"], pre, code',
        'research': '[class*="research"], [class*="paper"]',
        'chat': '[class*="chat"], [class*="message"]',
    };

    const contentSelector = contentSelectors[routeName];
    if (contentSelector) {
        try {
            await page.waitForSelector(contentSelector, { state: 'visible', timeout: 8000 });
        } catch (e) {
            // Content might not exist yet, that's ok
        }
    }

    // Final wait for any remaining animations and React hydration
    await page.waitForTimeout(1500);
}

async function main() {
    let devServer = null;
    let expoServer = null;

    try {
        // Start both servers
        devServer = await startDevServer();
        expoServer = await startExpoServer();

        console.log("\nStarting browser...");
        const browser = await chromium.launch({ headless: true });
        console.log("Browser launched!");

        const capturedFiles = [];

        // Web viewport (1920x1080)
        console.log("\n=== WEB SCREENSHOTS (1920x1080) ===");
        const webPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

        // Set dark mode for web app
        await webPage.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
        await webPage.evaluate(() => {
            localStorage.setItem('theme', 'dark');
        });
        await webPage.reload({ waitUntil: 'domcontentloaded' });
        await webPage.waitForTimeout(1000);

        // Routes to capture for web app
        const routes = [
            { path: '/', name: 'home' },
            { path: '/chat', name: 'chat' },
            { path: '/agents', name: 'agents' },
            { path: '/agents/inbox', name: 'agents_inbox' },
            { path: '/workspaces', name: 'workspaces' },
            { path: '/sessions', name: 'sessions' },
            { path: '/providers', name: 'providers' },
            { path: '/harvest', name: 'harvest' },
            { path: '/comparison', name: 'comparison' },
            { path: '/accounts', name: 'accounts' },
            { path: '/developer', name: 'developer' },
            { path: '/research', name: 'research' },
        ];

        for (const route of routes) {
            try {
                await webPage.goto(`http://localhost:5173${route.path}`, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
                // Ensure dark mode is set on every page
                await webPage.evaluate(() => {
                    localStorage.setItem('theme', 'dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                });
                await webPage.waitForTimeout(300);
                // Wait for page to be fully ready
                await waitForPageReady(webPage, route.name);
                const filename = `ironbridge_web_${route.name}.png`;
                await webPage.screenshot({ path: filename, fullPage: false });
                console.log(`✓ ${filename}`);
                capturedFiles.push(filename);
            } catch (e) {
                console.log(`✗ ironbridge_web_${route.name}.png - ${e.message}`);
            }
        }
        await webPage.close();

        // Mobile app screenshots from Expo web (390x844 - iPhone 14 Pro)
        console.log("\n=== MOBILE APP SCREENSHOTS (Expo Web - 390x844) ===");
        const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });

        // Navigate to Expo web app and set dark mode
        await mobilePage.goto('http://localhost:8081', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await mobilePage.waitForTimeout(3000);

        // Set dark mode for Expo app (uses AsyncStorage key)
        await mobilePage.evaluate(() => {
            localStorage.setItem('ironbridge_theme_mode', 'dark');
        });
        await mobilePage.reload({ waitUntil: 'domcontentloaded' });
        await mobilePage.waitForTimeout(5000); // Wait for app to fully load

        // Expo app tabs to capture (the 4 shown in the presentation)
        const mobileTabs = [
            { tabLabel: 'Home', name: 'home' },
            { tabLabel: 'More', name: 'workspaces' },  // More tab shows grid of options
            { tabLabel: 'Search', name: 'sessions' },  // Search tab 
            { tabLabel: 'Chat', name: 'chat' },
        ];

        for (const tab of mobileTabs) {
            try {
                // Click the tab in the bottom navigation bar using force click
                const tabButton = await mobilePage.$(`text=${tab.tabLabel}`);
                if (tabButton) {
                    await tabButton.click({ force: true });
                    await mobilePage.waitForTimeout(2000); // Wait for navigation
                }

                const filename = `ironbridge_app_${tab.name}.png`;
                await mobilePage.screenshot({ path: filename, fullPage: false });
                console.log(`✓ ${filename}`);
                capturedFiles.push(filename);
            } catch (e) {
                console.log(`✗ ironbridge_app_${tab.name}.png - ${e.message}`);
            }
        }
        await mobilePage.close();

        // Desktop viewport (1440x900)
        console.log("\n=== DESKTOP SCREENSHOTS (1440x900) ===");
        const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });

        // Set dark mode for desktop (shares localStorage with web)
        await desktopPage.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
        await desktopPage.evaluate(() => {
            localStorage.setItem('theme', 'dark');
        });
        await desktopPage.reload({ waitUntil: 'domcontentloaded' });
        await desktopPage.waitForTimeout(1000);

        for (const route of routes) {
            try {
                await desktopPage.goto(`http://localhost:5173${route.path}`, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
                // Ensure dark mode is set on every page
                await desktopPage.evaluate(() => {
                    localStorage.setItem('theme', 'dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                });
                await desktopPage.waitForTimeout(300);
                await waitForPageReady(desktopPage, route.name);
                const filename = `ironbridge_desktop_${route.name}.png`;
                await desktopPage.screenshot({ path: filename, fullPage: false });
                console.log(`✓ ${filename}`);
                capturedFiles.push(filename);
            } catch (e) {
                console.log(`✗ ironbridge_desktop_${route.name}.png - ${e.message}`);
            }
        }
        await desktopPage.close();

        await browser.close();

        console.log("\n=============================");
        console.log("Screenshot capture complete!");
        console.log(`Total screenshots captured: ${capturedFiles.length}`);
        console.log("\nCaptured files:");
        capturedFiles.forEach(f => console.log(`  - ${f}`));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        // Kill the servers
        const killServer = (server, name) => {
            if (server) {
                console.log(`Stopping ${name}...`);
                if (process.platform === 'win32') {
                    spawn('taskkill', ['/pid', server.pid, '/f', '/t'], { shell: true });
                } else {
                    process.kill(-server.pid);
                }
            }
        };

        killServer(devServer, 'Vite dev server');
        killServer(expoServer, 'Expo server');
    }
}

main();
