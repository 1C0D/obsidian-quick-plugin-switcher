import { GroupData, QPSSettings } from "obsidian";

export const commPlugins =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";

export const commPluginStats =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json";


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


export const Groups: GroupData = {
	SelectGroup: "All",
};

export const GroupsComm: GroupData = {
	SelectGroup: "All",
};

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


