export const Filters: GroupData = {
    All: "all",
    Enabled: "enabled",
    Disabled: "disabled",
    EnabledFirst: "enabledFirst",
    MostSwitched: "mostSwitched",
    ByGroup: "byGroup",
}

export const CommFilters: GroupData = {
	All: "all",
	NotInstalled: "not installed",
	Installed: "installed",
	ByGroup: "by group",
};

export interface GroupData {
    [key: string]: string;
}

export const Groups: GroupData = {
    SelectGroup: "All",
}

export const GroupsComm: GroupData = {
    SelectGroup: "All",
}

export interface PluginGroupInfo {
    groupIndices: number[];
    groupWasEnabled: boolean;
}

export interface PluginCommGroupInfo {
    groupIndices: number[];
    groupWasEnabled: boolean;
}

export interface QPSSettings {
	savedVersion: string;
	allPluginsList: PluginInfo[];
	wasEnabled: string[];
	filters: keyof typeof Filters;
	communityFilters: keyof typeof CommFilters;
	selectedGroup: string;
	search: string;
	numberOfGroups: number;
	numberOfGroupsComm: number;
	groups: Record<
		number,
		{ name: string; delayed: boolean; time: number; applied: boolean }
	>;
	groupsComm: Record<
		number,
		{ name: string}
	>;
	showHotKeys: boolean;
}

export const DEFAULT_SETTINGS: QPSSettings = {
	savedVersion: "0.0.0",
	allPluginsList: [],
	wasEnabled: [],
	filters: Filters.All,
	communityFilters: CommFilters.All,
	selectedGroup: "SelectGroup",
	search: "",
	numberOfGroups: 3,
	numberOfGroupsComm: 3,
	groups: {},
	groupsComm: {},
	showHotKeys: true,
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

export interface PluginCommInfo {
	name: string;
	id: string;
	description: string;
	author: string;
	repo: string;
	version:string;
	groupInfo: PluginCommGroupInfo;
}