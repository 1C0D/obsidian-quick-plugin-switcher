export enum Filters {
    All = "all",
    Enabled = "enabled",
    Disabled = "disabled",
    EnabledFirst = "enabledFirst",
    MostSwitched = "mostSwitched",
    ByGroup = "byGroup",
}

interface GroupData {
    [key: string]: string;
}

export const Groups: GroupData = {
    SelectGroup : "Select Group",
}

export interface PluginGroupInfo {
    groupIndex: number;
    // plugins: PluginInfo[];
    wasEnabled: string[];
}

export const defaultPluginGroup: PluginGroupInfo = {
    groupIndex: -1,
    // plugins: [],
    wasEnabled: [],
};

export interface QPSSettings {
    allPluginsList: PluginInfo[];
    wasEnabled: string[];
    filters: Filters;
    groups: keyof typeof Groups;
    search: string;
    openPluginFolder: boolean;
    pluginGroups: PluginGroupInfo[]
    numberOfGroups: number
}

export const DEFAULT_SETTINGS: QPSSettings = {
    allPluginsList: [],
    wasEnabled: [],
    filters: Filters.All,
    groups: "SelectGroup",
    search: "",
    openPluginFolder: false,
    pluginGroups: [],
    numberOfGroups: 3
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