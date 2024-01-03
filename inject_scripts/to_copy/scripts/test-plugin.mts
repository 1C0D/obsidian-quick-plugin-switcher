import * as readline from 'readline';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { checkManifest, createPathandCopy, getEnv, isVaultPathValid, promptNewPath } from './test-plugin-utils.mjs';

const currentEvent = process.env.npm_lifecycle_event;
console.log(`Starting the ${currentEvent} process...\n`);

console.log("npm run build...");
execSync('npm run build', { stdio: 'inherit' });
console.log("npm run build successful.\n");

// Load .env file
dotenv.config()

// Default target path
let vaultPath = getEnv("TARGET_PATH")
let targetPath = path.join(vaultPath, '.obsidian', 'plugins', '$ID');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

if (!checkManifest()) {
    console.error("No manifest in plugin directory.");
    process.exit(1);
}

if (vaultPath.includes(".obsidian")) {
    vaultPath = vaultPath.split(".obsidian")[0].slice(0, -1);
}

if (await isVaultPathValid(vaultPath)) {
    targetPath = path.join(vaultPath, '.obsidian', 'plugins', '$ID');
    rl.question(`Current vault path: ${vaultPath}\nDo you want to enter a different vault path? (Yes/No): `, async (answer) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
            createPathandCopy(rl, targetPath);
            console.log("plugin installed in dest vault")

        } else {
            await promptNewPath(rl, targetPath);
        }
    });
} else {
    createPathandCopy(rl, targetPath);
    console.log("plugin installed in dest vault")
}


