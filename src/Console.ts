import { Platform } from "obsidian";

const disableAnyway = false

let DEBUG = "false";

if (Platform.isDesktopApp) {
    require('dotenv').config();
    DEBUG = process.env.DEBUG ?? "true";
}

export const Console = {
    debug: (...args: any[]) => {
        if (DEBUG.trim().toLowerCase() === "true" && !disableAnyway) {
            console.debug(...args);
        }
    },
    log: (...args: any[]) => {
        if (DEBUG.trim().toLowerCase() === "true" && !disableAnyway) {
            console.log(...args);
        }
    }
};