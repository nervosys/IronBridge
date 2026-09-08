console.log("IronBridge CLI Screenshot Capture Script");
console.log("===================================\n");

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI to HTML color mapping
const ansiColors = {
    '30': '#1a1a1a', '31': '#ff5f5f', '32': '#5fff5f', '33': '#ffff5f',
    '34': '#5f87ff', '35': '#ff5fff', '36': '#5fffff', '37': '#d0d0d0',
    '90': '#808080', '91': '#ff8787', '92': '#87ff87', '93': '#ffff87',
    '94': '#87afff', '95': '#ff87ff', '96': '#87ffff', '97': '#ffffff',
    '40': '#1a1a1a', '41': '#af0000', '42': '#00af00', '43': '#afaf00',
    '44': '#0000af', '45': '#af00af', '46': '#00afaf', '47': '#a8a8a8',
};

function ansiToHtml(text) {
    // Remove Windows line endings and escape HTML
    let html = text
        .replace(/\r\n/g, '\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Convert ANSI escape codes to HTML spans
    // Match \x1b[...m patterns
    html = html.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
        const codeList = codes.split(';');
        let style = [];
        let closeSpan = false;

        for (const code of codeList) {
            if (code === '0') {
                return '</span>';
            } else if (code === '1') {
                style.push('font-weight:bold');
            } else if (code === '3') {
                style.push('font-style:italic');
            } else if (code === '4') {
                style.push('text-decoration:underline');
            } else if (ansiColors[code]) {
                if (parseInt(code) >= 40) {
                    style.push(`background-color:${ansiColors[code]}`);
                } else {
                    style.push(`color:${ansiColors[code]}`);
                }
            }
        }

        if (style.length > 0) {
            return `<span style="${style.join(';')}">`;
        }
        return '';
    });

    // Remove any remaining escape sequences
    html = html.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

    return html;
}

function createTerminalHtml(title, output, width = 900, height = 500) {
    const htmlOutput = ansiToHtml(output);

    return `<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0d0d0d;
            padding: 0;
            font-family: 'Consolas', 'Monaco', 'Menlo', monospace;
        }
        .terminal {
            background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            width: ${width}px;
            margin: 20px auto;
        }
        .titlebar {
            background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
            padding: 8px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .buttons {
            display: flex;
            gap: 6px;
        }
        .btn {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .btn-red { background: #ff5f57; }
        .btn-yellow { background: #febc2e; }
        .btn-green { background: #28c840; }
        .title {
            color: #a0a0a0;
            font-size: 12px;
            flex: 1;
            text-align: center;
            margin-right: 50px;
        }
        .content {
            padding: 16px 20px;
            color: #e0e0e0;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            min-height: ${height - 60}px;
        }
        .prompt { color: #5fff5f; }
        .cmd { color: #5fffff; }
    </style>
</head>
<body>
    <div class="terminal">
        <div class="titlebar">
            <div class="buttons">
                <div class="btn btn-red"></div>
                <div class="btn btn-yellow"></div>
                <div class="btn btn-green"></div>
            </div>
            <div class="title">${title}</div>
        </div>
        <div class="content">${htmlOutput}</div>
    </div>
</body>
</html>`;
}

async function main() {
    const cliPath = path.resolve(__dirname, '../../../ironbridge-rust/target/release/ironbridge.exe');
    const capturedFiles = [];

    // Check if CLI exists
    if (!fs.existsSync(cliPath)) {
        console.log('Building CLI...');
        execSync('cargo build --release', {
            cwd: path.resolve(__dirname, '../../../ironbridge-rust'),
            stdio: 'inherit'
        });
    }

    console.log('Starting browser...');
    const browser = await chromium.launch({ headless: true });

    // CLI commands to capture
    const cliCommands = [
        {
            name: 'cli_list',
            title: 'ironbridge — List Workspaces',
            cmd: 'list workspaces',
            width: 1100,
            height: 600,
        },
        {
            name: 'cli_agency',
            title: 'ironbridge — Agency ADK',
            cmd: 'agency list',
            width: 800,
            height: 450,
        },
    ];

    console.log('\n=== CLI SCREENSHOTS ===');

    for (const command of cliCommands) {
        try {
            // Run command with forced color output
            const env = { ...process.env, FORCE_COLOR: '1', CLICOLOR_FORCE: '1' };
            let output;
            try {
                output = execSync(`"${cliPath}" ${command.cmd}`, {
                    encoding: 'utf-8',
                    env,
                    maxBuffer: 1024 * 1024
                });
            } catch (e) {
                output = e.stdout || e.message;
            }

            // Add prompt line at the top
            const fullOutput = `<span class="prompt">$</span> <span class="cmd">ironbridge ${command.cmd}</span>\n\n${output}`;

            // Create HTML
            const html = createTerminalHtml(command.title, fullOutput, command.width, command.height);

            // Write temp HTML file
            const tempHtml = path.join(__dirname, `temp_${command.name}.html`);
            fs.writeFileSync(tempHtml, html);

            // Capture screenshot
            const page = await browser.newPage({
                viewport: { width: command.width + 40, height: command.height + 60 }
            });
            await page.goto(`file://${tempHtml}`);
            await page.waitForTimeout(500);

            const filename = `ironbridge_${command.name}.png`;
            await page.screenshot({ path: filename, fullPage: false });
            console.log(`✓ ${filename}`);
            capturedFiles.push(filename);

            await page.close();
            fs.unlinkSync(tempHtml);
        } catch (e) {
            console.log(`✗ ironbridge_${command.name}.png - ${e.message}`);
        }
    }

    await browser.close();

    console.log('\n===================================');
    console.log('CLI screenshot capture complete!');
    console.log(`Total screenshots captured: ${capturedFiles.length}`);
}

main().catch(console.error);
