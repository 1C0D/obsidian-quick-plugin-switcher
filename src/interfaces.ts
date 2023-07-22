export enum Filters {
    All = "all",
    Enabled = "enabled",
    Disabled = "disabled",
    EnabledFirst = "enabledFirst",
    MostSwitched = "mostSwitched",
    ByGroup = "byGroup",
}

export const defaultPluginGroup: PluginGroupInfo = {
    groupIndex: -1, 
    // plugins: [],
    wasEnabled: [], 
};

export enum Groups {
    SelectGroup = "Select Group",
    Group1 = "🟡 Group1",
    Group2 = "🟢 Group2",
    Group3 = "🔵 Group3",
    Group4 = "🟣 Group4",
}

export interface PluginGroupInfo {
    groupIndex: number;
    // plugins: PluginInfo[];
    wasEnabled: string[];
}

export interface QPSSettings {
    allPluginsList: PluginInfo[];
    wasEnabled: string[];
    filters: Filters;
    groups: keyof typeof Groups;
    search: string;
    openPluginFolder: boolean;
    pluginGroups: PluginGroupInfo[]
}

export const DEFAULT_SETTINGS: QPSSettings = {
    allPluginsList: [],
    wasEnabled: [],
    filters: Filters.All,
    groups: "SelectGroup",
    search: "",
    openPluginFolder: false,
    pluginGroups: []
};

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
    group: number;
}