export interface QPSSettings {
    allPluginsList: PluginInfo[]
    wasEnabled: string[],
    filters: "all" | "enabled" | "disabled" | "enabledFirst" |"mostSwitched",
    search: string,
    openPluginFolder: boolean
}

export const DEFAULT_SETTINGS: QPSSettings = {
    allPluginsList: [],
    wasEnabled: [],
    filters: "all",
    search: "",
    openPluginFolder: false
}

export interface PluginInfo {
    name: string;
    id: string;
    desc: string;
    dir: string;
    author: string;
    authorUrl?: string;
    version: string;
    enabled: boolean;
    switched: number;
}