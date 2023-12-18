import readline from "readline";
import { execSync } from "child_process";

export function acp() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter commit message: ', (input) => {
        rl.close();
        let cleanedInput = input.replace(/^['"`]|['"`]$/g, '');
        try {
            execSync('git add .');
            execSync(`git commit -am "${cleanedInput}"`);
            execSync('git push');
            console.log('Commit and push successful.');
        } catch (error) {
            console.error('Error:', error.message);
        }
        process.exit()
    });
}

acp();