import { execSync } from 'child_process';
import dedent from 'dedent';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (input) => {
            resolve(input.trim());
        });
    });
}

async function createTag() {
    try {
        const currentVersion = process.env.npm_package_version;
        const tag = `${currentVersion}`;

        const exists = execSync(`git tag -l ${tag}`).toString().includes(tag);
        if (exists) {
            execSync(`git tag -d ${tag}`);
        }

        const message = await askQuestion(`Enter the commit message for version ${currentVersion}: `);
        let tagMessage = `${message}`;
        const messages = tagMessage.split('\\n');
        const toShow = tagMessage.replace(/\\n/g, '\n');
        tagMessage = messages.map(message => `-m "${message}"`).join(' ');
        execSync(`git tag -a ${tag} ${tagMessage}`);
        execSync(`git push origin ${tag}`);
        console.log(`Release ${tag} pushed to repo.`);
        console.log(dedent`
        with message: 
        ${ toShow }
        `)
    } catch (error) {
        console.error('An error occurred:', error.message);
        process.exit(1);
    } finally {
        rl.close();
        process.exit()
    }
}

createTag();
