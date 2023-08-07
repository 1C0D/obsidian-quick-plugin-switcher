export const Filters: GroupData = {
    All : "all",
    Enabled : "enabled",
    Disabled : "disabled",
    EnabledFirst : "enabledFirst",
    MostSwitched : "mostSwitched",
    ByGroup : "byGroup",
}

interface GroupData {
    [key: string]: string;
}

export const Groups: GroupData = {
    SelectGroup : "All groups",
}

export interface PluginGroupInfo {
    groupIndices: number[];
    wasEnabled: boolean;
}

export interface QPSSettings {
    allPluginsList: PluginInfo[];
    wasEnabled: string[];
    filters: keyof typeof Filters;
    selectedGroup: keyof typeof Groups;
    search: string;
    openPluginFolder: boolean;
    numberOfGroups: number
}

export const DEFAULT_SETTINGS: QPSSettings = {
    allPluginsList: [],
    wasEnabled: [],
    filters: Filters.All,
    selectedGroup: "SelectGroup",
    search: "",
    openPluginFolder: false,
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
    groupInfo: PluginGroupInfo;
}