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
    savedVersion: string;
    allPluginsList: PluginInfo[];
    wasEnabled: string[];
    filters: keyof typeof Filters;
    selectedGroup: keyof typeof Groups;
    search: string;
    numberOfGroups: number
}

export const DEFAULT_SETTINGS: QPSSettings = {
    savedVersion: "0.0.0",
    allPluginsList: [],
    wasEnabled: [],
    filters: Filters.All,
    selectedGroup: "SelectGroup",
    search: "",
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