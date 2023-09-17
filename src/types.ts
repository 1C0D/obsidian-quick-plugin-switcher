export const Filters: GroupData = {
    All: "all",
    Enabled: "enabled",
    Disabled: "disabled",
    EnabledFirst: "enabledFirst",
    MostSwitched: "mostSwitched",
    ByGroup: "byGroup",
}

interface GroupData {
    [key: string]: string;
}

export const Groups: GroupData = {
    SelectGroup: "All",
}

export interface PluginGroupInfo {
    groupIndices: number[];
    groupWasEnabled: boolean;
}

export interface BaseSettings {
    savedVersion: string;
    allPluginsList: PluginInfo[];
    wasEnabled: string[];
    filters: keyof typeof Filters;
    selectedGroup: keyof typeof Groups;
    search: string;
    numberOfGroups: number;
    groups: Record<number, { name: string; delayed: boolean; time: number, applied: boolean }>;
    showHotKeys: boolean;
    }

export interface QPSSettings extends BaseSettings {
    mobileSettings: BaseSettings;
}

// export const DEFAULT_BASE_SETTINGS: BaseSettings = {
//     savedVersion: "0.0.0",
//     allPluginsList: [],
//     wasEnabled: [],
//     filters: Filters.All,
//     selectedGroup: "SelectGroup",
//     search: "",
//     numberOfGroups: 3,
//     groups: {},
//     showHotKeys: true,
// }

// export const DEFAULT_SETTINGS: QPSSettings = {
//     savedVersion: "0.0.0",
//     allPluginsList: [],
//     wasEnabled: [],
//     filters: Filters.All,
//     selectedGroup: "SelectGroup",
//     search: "",
//     numberOfGroups: 3,
//     groups: {},
//     showHotKeys: true,
//     mobileSettings: DEFAULT_BASE_SETTINGS,
// };

export const DEFAULT_SETTINGS: QPSSettings = {
    savedVersion: "0.0.0",
    allPluginsList: [],
    wasEnabled: [],
    filters: Filters.All,
    selectedGroup: "SelectGroup",
    search: "",
    numberOfGroups: 3,
    groups: {},
    showHotKeys: true,
    mobileSettings: {
        savedVersion: "0.0.0",
        allPluginsList: [],
        wasEnabled: [],
        filters: Filters.All,
        selectedGroup: "SelectGroup",
        search: "",
        numberOfGroups: 3,
        groups: {},
        showHotKeys: true,
    }
};

export interface PluginInfo {
    name: string;
    id: string;
    desc: string;
    dir: string;
    author: string;
    authorUrl?: string;
    desktopOnly: boolean;
    version: string;
    enabled: boolean;
    switched: number;
    groupInfo: PluginGroupInfo;
    delayed: boolean;
    time: number;
}