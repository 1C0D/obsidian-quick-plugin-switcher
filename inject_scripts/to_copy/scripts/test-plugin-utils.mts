import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra'
import * as readline from 'readline';
import * as path from 'path';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';



export function createPathandCopy(rl: readline.Interface, targetPath: string) {
    const secondPrompt = () => {
        rl.question('Please enter the new vault path: ', async (newPath) => {
            if (await isVault(newPath)) {
                // no \ or \\ no last \
                let formattedPath = newPath.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
                formattedPath = path.join(formattedPath, '.obsidian', 'plugins', '$ID')
                await updateEnvVariable("TARGET_PATH", formattedPath);
                targetPath = formattedPath;
                await copyFilesToTargetPath(targetPath);
                console.log('Copy successful!');
                rl.close();
            } else {
                console.log('The specified path is not a valid vault path. Please try again.');
                secondPrompt(); // Call secondPrompt recursively
            }
        })
    }
    secondPrompt();
};

// Update the target path in the .env file
export async function updateTargetPathInEnv(newPath: string) {
    await fs.writeFile('.env', `TARGET_PATH=${newPath}`);
}

export async function updateEnvVariable(variableName:string, newValue:any) {
    try {
        // Charger les variables d'environnement depuis le fichier .env
        const envConfig = dotenv.parse(await fs.readFile('.env'));

        // Modifier la valeur de la variable spécifiée
        envConfig[variableName] = newValue;

        // Générer une nouvelle chaîne de caractères avec les variables mises à jour
        const updatedEnv = Object.keys(envConfig)
            .map(key => `${key}=${envConfig[key]}`)
            .join('\n');

        // Écrire la nouvelle chaîne de caractères dans le fichier .env
        await fs.writeFile('.env', updatedEnv);

        console.log(`${variableName} updated to ${newValue}`);
    } catch (error) {
        console.error(`error updating value ${variableName}:`, error);
    }
}

export function getEnv(name: string) {
    let val = process.env[name];
    return val?.trim() ?? "";
}

async function isVault(_path: string) {
    if (_path.includes(".obsidian")) {
        _path = _path.split(".obsidian")[0].slice(0, -1)
    }
    const obsidianDir = path.join(_path.trim(), '.obsidian');
    if (!await isValidPath(obsidianDir)) return false;
    const pluginsDir = path.join(obsidianDir, 'plugins');
    await fsExtra.ensureDir(pluginsDir);
    return true;
}

export async function isVaultPathValid(vaultPath: string) {
    if (vaultPath.includes(".obsidian")) {
        vaultPath = vaultPath.split(".obsidian")[0];
    }
    return vaultPath && (await isValidPath(vaultPath)) && (await isVault(vaultPath));
}

async function isValidPath(path: string) {
    try {
        await fs.access(path.trim());
        return true;
    } catch (error) {
        return false;
    }
}

export async function checkManifest() {
    const manifest = path.join(process.cwd(), 'manifest.json')
    return isValidPath(manifest)
}

// Copy the main.js and manifest.json files to the target path
async function copyFilesToTargetPath(targetPath: string) {
    console.log("Copying files to the target path...");
    const cwd = process.cwd();
    const idMatch = (await fs.readFile(path.join(cwd, 'manifest.json'), 'utf8')).match(/"id":\s*"(.*?)"/);
    const id = idMatch ? idMatch[1] : '';

    const targetDir = path.join(targetPath.replace('$ID', id));

    await createDirOrRmvFiles(targetDir)

    const mainJSPath = path.join(cwd, 'main.js');

    await copyMainJs(mainJSPath, targetDir);

    await fs.copyFile(path.join(cwd, 'manifest.json'), path.join(targetDir, 'manifest.json'));

    const stylesPath = path.join(cwd, 'styles.css');
    if (await isValidPath(stylesPath)) {
        await fs.copyFile(stylesPath, path.join(targetDir, 'styles.css'));
    }
}

async function createDirOrRmvFiles(targetDir: string) {
    if (!await isValidPath(targetDir)) {
        await fs.mkdir(targetDir, { recursive: true });
    } else {
        const filesToRemove = ['main.js', 'manifest.json', 'styles.css'];

        for (const file of filesToRemove) {
            const filePath = path.join(targetDir, file);
            if (await isValidPath(filePath)) {
                await fs.rm(filePath, { recursive: true, force: true });
            }
        }
    }
}

async function copyMainJs(mainJSPath: string, targetDir: string) {
    if (await isValidPath(mainJSPath)) {
        await fs.copyFile(mainJSPath, path.join(targetDir, 'main.js'));
    } else {
        try {
            console.log("main.js is absent.generating main.js in src folder...");
            await buildMainJS();
            await fs.copyFile(path.join(process.cwd(), 'main.js'), path.join(targetDir, 'main.js'));
            console.log("main.js generated");
        } catch (error) {
            console.error('Error trying to generate main.js:', error);
            console.error('Exiting...');
            process.exit(1);
        }
    }
}

async function buildMainJS() {
    return new Promise<void>((resolve, reject) => {
        exec('npm run build', (error, stdout, stderr) => {
            if (error) {
                console.error('Error trying to generate main.js:', error);
                reject();
            } else {
                resolve();
            }
        });
    });
}

export async function promptNewPath(rl: readline.Interface, targetPath: string) {
    await copyFilesToTargetPath(targetPath);
    console.log('Copy successful!');
    rl.close();
}
