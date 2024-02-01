import * as readline from 'readline';
import { execSync } from 'child_process';
import { readFile, writeFile } from "fs/promises";
import dedent from 'dedent';
import * as semver from 'semver';

function updateVersion() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(dedent`
    kind of update:
        patch(1.0.1) -> type 1 or p
        minor(1.1.0) -> type 2 or min
        major(2.0.0) -> type 3 or maj
        or version number (e.g. 2.0.0)
    \n`, async (updateType) => {
        rl.close();

        // Increment version for chosen type
        const currentVersion = process.env.npm_package_version || '1.0.0';
        let targetVersion;

        switch (updateType.trim()) {
            case 'p':
            case '1':
                targetVersion = semver.inc(currentVersion, 'patch');
                break;
            case 'min':
            case '2':
                targetVersion = semver.inc(currentVersion, 'minor');
                break;
            case 'maj':
            case '3':
                targetVersion = semver.inc(currentVersion, 'major');
                break;
            default:
                if (semver.valid(updateType.trim())) {
                    targetVersion = updateType.trim();
                } else {
                    console.log("Invalid version");
                    process.exit(1);
                }
        }

        await updateManifestVersions(targetVersion!);

        // Git add, commit et push
        execSync(`git add -A && git commit -m "Updated to version ${targetVersion}" && git push`);
        console.log(`version updated to ${targetVersion}`);
        process.exit();
    });
}

async function updateManifestVersions(targetVersion: string) {
    // Read minAppVersion from manifest.json and bump version to target version
    let manifest = JSON.parse(await readFile("manifest.json", "utf8"));
    const { minAppVersion } = manifest;
    manifest.version = targetVersion;
    await writeFile("manifest.json", JSON.stringify(manifest, null, "\t"));

    // Update versions.json with target version and minAppVersion from manifest.json
    let versions = JSON.parse(await readFile("versions.json", "utf8"));
    versions[targetVersion] = minAppVersion;
    await writeFile("versions.json", JSON.stringify(versions, null, "\t"));

    // Update package.json
    let packageJsn = JSON.parse(await readFile("package.json", "utf8"));
    packageJsn.version = targetVersion;
    await writeFile("package.json", JSON.stringify(packageJsn, null, "\t"));

    // Update package-lock.json
    let packageLockJsn = JSON.parse(await readFile("package-lock.json", "utf8"));
    packageLockJsn.version = targetVersion;
    await writeFile("package-lock.json", JSON.stringify(packageLockJsn, null, "\t"));
}

updateVersion();