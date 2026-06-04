// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Test Suite Entry Point for VS Code Extension Tests

import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '.');

    // Find all test files
    const files = await glob('**/**.test.js', { cwd: testsRoot });

    // Add files to the test suite
    for (const file of files) {
        mocha.addFile(path.resolve(testsRoot, file));
    }

    // Run the mocha test
    return new Promise((resolve, reject) => {
        try {
            mocha.run((failures) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}
