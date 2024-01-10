import { QPSSettings, StringString } from "./global";

export const COMMPLUGINS =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";

export const COMMPLUGINSTATS =
	"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json";


declare global {
	interface Window {
		electron: any;
	}
}	

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

export const Groups: StringString = {
	SelectGroup: "All",
};

export const GroupsComm: StringString = {
	SelectGroup: "All",
};

export const DEFAULT_SETTINGS: QPSSettings = {
	lastFetchExe: 0,
	savedVersion: "0.0.0",
	installed: {},
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
	commPlugins: {},
	filtersComm: "All",
	selectedGroupComm: "SelectGroup",
	numberOfGroupsComm: 4,
	groupsComm: {},
};

