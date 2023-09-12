import { execSync } from 'child_process';
import fs from 'fs';

let openFolder = false;
if (process.argv.includes('-f')) {
    openFolder = true;
}

if (openFolder) {
    execSync('start /B code src', { stdio: 'ignore', shell: true });
} else {
    if (fs.existsSync('src/main.ts')) {
        execSync('start /B code src/main.ts', { stdio: 'ignore', shell: true });
    } else {
        // quite useless now but I let it...
        execSync('start /B code main.ts', { stdio: 'ignore', shell: true });
    }
}

execSync('npm install', { stdio: 'inherit' });
execSync('npm run dev', { stdio: 'inherit' });

