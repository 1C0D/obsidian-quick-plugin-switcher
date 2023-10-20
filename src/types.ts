export const commPlugins =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";

export const commPluginStats =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json";

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
	ByGroup: "byGroup",
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
	lastFetchExe:number;
	savedVersion: string;
	allPluginsList: PluginInfo[];
	wasEnabled: string[];
	filters: keyof typeof Filters;
	selectedGroup: string;
	search: string;
	numberOfGroups: number;
	groups: Record<
		number,
		{ name: string; delayed: boolean; time: number; applied: boolean }
	>;
	showHotKeys: boolean;
	// commnunity plugins
	pluginStats: PackageInfoData;
	pluginsTagged: PluginsTaggedInfo;
	commPlugins: PluginCommInfo[];
	filtersComm: keyof typeof CommFilters;
	selectedGroupComm: string;
	numberOfGroupsComm: number;
	groupsComm: Record<number, { name: string }>;
}

export const DEFAULT_SETTINGS: QPSSettings = {
	lastFetchExe: 0,
	savedVersion: "0.0.0",
	allPluginsList: [],
	wasEnabled: [],
	filters: Filters.All,
	selectedGroup: "SelectGroup",
	search: "",
	numberOfGroups: 4,
	groups: {},
	showHotKeys: true,
	// commnunity plugins
	pluginStats: {},
	pluginsTagged: {},
	commPlugins: [],
	filtersComm: CommFilters.All,
	selectedGroupComm: "SelectGroup",
	numberOfGroupsComm: 4,
	groupsComm: {},
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
	groupInfo?: PluginTaggedGroupInfo;
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
