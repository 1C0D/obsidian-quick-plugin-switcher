import fs from 'fs-extra';
import path from 'path';
import stringify from 'json-stringify-pretty-compact';
import dotenv from 'dotenv';

// Path to the current directory and root directory
const currentDir = process.cwd();
const rootDir = path.resolve(currentDir, '../');

// Function to copy the 'scripts' folder to the root directory
function copyFolderToRoot(itemName) {
    const relativePath = itemName.split("/").slice(-1)[0]
    const sourceDir = path.join(currentDir, "to_copy", relativePath);
    const destinationDir = path.join(rootDir, itemName);
    const destinationExists = fs.existsSync(destinationDir);

    if (destinationExists) {
        fs.removeSync(destinationDir);
    }

    fs.copySync(sourceDir, destinationDir, { overwrite: true });
    console.log(`Successfully copied the "${itemName}" folder to the root directory.`);

}

function copyScriptsToRoot() {
    copyFolderToRoot('scripts');
    copyFolderToRoot('.github');
    copyFolderToRoot('esbuild.config.mjs');
    copyFolderToRoot('src/Console.ts');


    if (fs.existsSync('../.env')) {
        updateEnvVariable("TARGET_PATH", "")
        console.log(".env file updated successfully");
    } else {
        console.log(".env file not found");
        copyFolderToRoot('.env');
    }
}

async function updateEnvVariable(variableName, newValue) {
    try {
        // Load environment variables from the .env file
        const envConfig = dotenv.parse(await fs.readFile('../.env'));

        // Modify the value of the specified variable
        if ((variableName in envConfig)) return
        envConfig[variableName] = newValue;

        // Generate a new string with the updated variables
        const updatedEnv = Object.keys(envConfig)
            .map(key => `${key}=${envConfig[key]}`)
            .join('\n');

        // Write the new string to the .env file
        await fs.writeFile('../.env', updatedEnv);

        console.log(`${variableName} updated to ${newValue !== "" ? newValue : '""'}`);
    } catch (error) {
        console.error(`error updating value ${variableName}:`, error);
    }
}

// Function to update or create 'scripts' in package.json
function updatePackageJsonScripts() {
    const packageJsonPath = path.join(rootDir, 'package.json');

    const scriptsToAdd = {
        dev: 'tsx esbuild.config.mjs',
        build: 'tsc -noEmit -skipLibCheck && tsx esbuild.config.mjs production',
        start: 'npm i && tsx scripts/start.mjs',
        version: 'tsx scripts/update-version.mts',
        acp: 'tsx scripts/acp.mts',
        bacp: "tsx scripts/acp.mts -b",
        release: "tsx scripts/release.mts",
        test: 'tsx scripts/test-plugin.mts',
    };

    let packageJson = {};
    if (fs.existsSync(packageJsonPath)) {
        try {
            const fileContent = fs.readFileSync(packageJsonPath, 'utf-8');
            packageJson = JSON.parse(fileContent);
        } catch (error) {
            console.error('Error reading package.json file:', error);
            process.exit(1);
        }
    }

    packageJson.scripts = { ...packageJson.scripts, ...scriptsToAdd };

    try {
        fs.writeFileSync(packageJsonPath, stringify(packageJson, { maxLength: 60 }));
        console.log('Successfully added/updated scripts in package.json.');
    } catch (error) {
        console.error('Error writing to package.json file:', error);
    }
}

function addInjectScriptsExclusionToGitignore() {
    const gitignorePath = path.join(rootDir, '.gitignore');
    const exclusionRule = 'inject_scripts/';

    // is exclusion rule already in .gitignore?
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes(exclusionRule)) {
        fs.appendFileSync(gitignorePath, `\n${exclusionRule}\n`);
        console.log(`"${exclusionRule}" added to .gitignore.`);
    }
}

addInjectScriptsExclusionToGitignore();
copyScriptsToRoot();
updatePackageJsonScripts();