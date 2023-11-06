import { execSync } from 'child_process';
// import fs from 'fs';

let openFolder = false;
if (process.argv.includes('-f')) {
    openFolder = true;
}

if (openFolder) {
    execSync('start /B code src', { stdio: 'ignore', shell: true });
} else {
    execSync("start /B code .", { stdio: "ignore", shell: true });
}

execSync('npm install', { stdio: 'inherit' });
execSync('npm run dev', { stdio: 'inherit' });

