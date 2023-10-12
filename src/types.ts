declare global {
	interface Window {
		electron: any;
	}
}

export const Filters: GroupData = {
	All: "all",
	Enabled: "enabled",
	Disabled: "disabled",
	EnabledFirst: "enabledFirst",
	MostSwitched: "mostSwitched",
	ByGroup: "byGroup",
};

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
};

export const GroupsComm: GroupData = {
	SelectGroup: "All",
};

export interface PluginGroupInfo {
	groupIndices: number[];
	groupWasEnabled: boolean;
}

export interface PluginTaggedGroupInfo {
	groupIndices: number[];
}

export interface QPSSettings {
	savedVersion: string;
	allPluginsList: PluginInfo[];
	pluginsTagged: PluginsTaggedInfo;
	wasEnabled: string[];
	filters: keyof typeof Filters;
	filtersComm: keyof typeof CommFilters;
	selectedGroup: string;
	selectedGroupComm: string;
	search: string;
	numberOfGroups: number;
	numberOfGroupsComm: number;
	groups: Record<
		number,
		{ name: string; delayed: boolean; time: number; applied: boolean }
	>;
	groupsComm: Record<number, { name: string }>;
	showHotKeys: boolean;
}

export const DEFAULT_SETTINGS: QPSSettings = {
	savedVersion: "0.0.0",
	allPluginsList: [],
	pluginsTagged: {},
	wasEnabled: [],
	filters: Filters.All,
	filtersComm: CommFilters.All,
	selectedGroup: "SelectGroup",
	selectedGroupComm: "SelectGroup",
	search: "",
	numberOfGroups: 3,
	numberOfGroupsComm: 4,
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

export type KeyToSettingsMapType = {
	[key: string]: () => Promise<void> | void;
};

// community plugins
export interface PluginCommInfo {
	name: string;
	id: string;
	description: string;
	author: string;
	repo: string;
}

//releases
interface PackageData {
	downloads: number;
	updated: number;
	[version: string]: number;
}

export interface PackageInfoData {
	[packageName: string]: PackageData;
}

//comm plugins tagged
interface GroupKeY {
	groupInfo: PluginTaggedGroupInfo;
}

export interface PluginsTaggedInfo {
	[key: string]: GroupKeY;
}
