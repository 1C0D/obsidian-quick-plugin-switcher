import 'obsidian'

declare module "obsidian" {
    interface App {
        setting: Setting
    }
    interface Setting extends Modal { openTabById: (id: string) => Record<string, any>; }
    interface DataAdapter {
        getFullPath: (normalizedPath: string) => string;
    }
}