import { execSync } from 'child_process';

const currentEvent = process.env.npm_lifecycle_event;

// console.log('- Installed dependencies\n');

console.log(`Starting the ${currentEvent} process...\n`);

execSync('git fetch');
console.log('- Fetched git changes');

execSync('git pull');
console.log('- Pulled git changes');

execSync('npm install', { stdio: 'inherit' });
console.log('- Installed dependencies');

//@ts-ignore
execSync("start /B code .", { stdio: "ignore", shell: true });
console.log('- Opened current folder in VSCode');
console.log("- Running 'npm run dev'");

execSync('npm run dev', { stdio: 'inherit' });
