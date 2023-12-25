import { GroupData, QPSSettings } from "obsidian";

export const commPlugins =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";

export const commPluginStats =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json";


export const Filters = {
	All: "all",
	Enabled: "enabled",
	Disabled: "disabled",
	EnabledFirst: "enabledFirst",
	MostSwitched: "mostSwitched",
	ByGroup: "byGroup",
};

export const CommFilters = {
	All: "all",
	NotInstalled: "not installed",
	Installed: "installed",
	ByGroup: "byGroup",
};

export const SortBy = {
	Downloads: "by downloads",
	Alpha: "by alphanum",
	Updated: "by update"
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
	sortBy: "Downloads",
	filters: "All",
	selectedGroup: "SelectGroup",
	search: "",
	numberOfGroups: 4,
	groups: {},
	showHotKeys: true,
	showReset: false,
	// commnunity plugins
	pluginStats: {},
	commPlugins: [],
	filtersComm: "All",
	selectedGroupComm: "SelectGroup",
	numberOfGroupsComm: 4,
	groupsComm: {},
};


