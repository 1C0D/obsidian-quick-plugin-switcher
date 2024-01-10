import readline from 'readline';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from "fs";
import dedent from 'dedent';

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
    \n`, (updateType) => {
            rl.close();

        // Increment version for chosen type
        const currentVersion = process.env.npm_package_version;
        let [major, minor, patch] = currentVersion.split('.').map(Number);
        updateType = updateType.trim()

        if (updateType === 'p' || updateType === '1') {
            patch++;
        } else if (updateType === 'min' || updateType === '2') {
            minor++;
            patch = 0;
        } else if (updateType === 'maj' || updateType === '3') {
            major++;
            minor = 0;
            patch = 0;
        } else {
            console.log("wrong type")
            process.exit(1);
        }

        const targetVersion = `${major}.${minor}.${patch}`;

        updateManifestVersions(targetVersion)

        // Git add, commit et push
        execSync(`git add -A && git commit -m "Updated to version ${targetVersion}" && git push`);
        console.log(`version update to ${targetVersion}`);
    });
}

function updateManifestVersions(targetVersion) {
    // read minAppVersion from manifest.json and bump version to target version
    let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    const { minAppVersion } = manifest;
    manifest.version = targetVersion;
    writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

    // update versions.json with target version and minAppVersion from manifest.json
    let versions = JSON.parse(readFileSync("versions.json", "utf8"));
    versions[targetVersion] = minAppVersion;
    writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
    
    // update package.json
    let packageJsn = JSON.parse(readFileSync("package.json", "utf8"));
    packageJsn.version = targetVersion;
    writeFileSync("package.json", JSON.stringify(packageJsn, null, "\t"));

    // this is doing a bug
    // let packageLockJsn = JSON.parse(readFileSync("package-lock.json", "utf8"));
    // packageLockJsn.version = targetVersion;
    // writeFileSync("package.json", JSON.stringify(packageLockJsn, null, "\t"));
}

updateVersion()
