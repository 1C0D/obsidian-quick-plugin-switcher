import { execSync } from 'child_process';

const currentEvent = process.env.npm_lifecycle_event;

console.log(`Starting the ${currentEvent} process...\n`);

execSync('npm install', { stdio: 'inherit' });
console.log('- Installed dependencies');

execSync("start /B code .", { stdio: "ignore", shell: true });
console.log('- Opened current folder in VSCode');
console.log("- Running 'npm run dev'");

execSync('npm run dev', { stdio: 'inherit' });
