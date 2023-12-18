import readline from 'readline';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from "fs";
import dedent from 'dedent';
import semver from 'semver';

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
                console.log("wrong type");
                process.exit(1);
        }

        updateManifestVersions(targetVersion);

        // Git add, commit et push
        execSync(`git add -A && git commit -m "Updated to version ${targetVersion}" && git push`);
        console.log(`version updated to ${targetVersion}`);
        process.exit();
    });
}

function updateManifestVersions(targetVersion) {
    // Read minAppVersion from manifest.json and bump version to target version
    let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    const { minAppVersion } = manifest;
    manifest.version = targetVersion;
    writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

    // Update versions.json with target version and minAppVersion from manifest.json
    let versions = JSON.parse(readFileSync("versions.json", "utf8"));
    versions[targetVersion] = minAppVersion;
    writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));

    // Update package.json
    let packageJsn = JSON.parse(readFileSync("package.json", "utf8"));
    packageJsn.version = targetVersion;
    writeFileSync("package.json", JSON.stringify(packageJsn, null, "\t"));

    // Update package-lock.json
    let packageLockJsn = JSON.parse(readFileSync("package-lock.json", "utf8"));
    packageLockJsn.version = targetVersion;
    writeFileSync("package-lock.json", JSON.stringify(packageLockJsn, null, "\t"));
}

updateVersion();
