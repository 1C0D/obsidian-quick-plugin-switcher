import { Platform } from "obsidian";

const disableAnyway = false

let DEBUG = "false";

if (Platform.isDesktopApp) {
    require('dotenv').config();
    DEBUG = process.env.DEBUG ?? "false";
}

const condition = (DEBUG.trim().toLowerCase() === "true" && !disableAnyway);

export const Console = {
    debug: (...args: any[]) => {
        if (condition) {
            console.debug(...args);
        }
    },
    log: (...args: any[]) => {
        if (condition) {
            console.log(...args);
        }
    }
};