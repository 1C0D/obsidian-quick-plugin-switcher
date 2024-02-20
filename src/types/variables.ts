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

export const Filters: StringString = {
	All: "all",
	Enabled: "enabled",
	Disabled: "disabled",
	EnabledFirst: "enabledFirst",
	MostSwitched: "mostSwitched",
	ByGroup: "byGroup",
	Hidden: "hidden",
};

export const CommFilters: StringString = {
	All: "all",
	NotInstalled: "not installed",
	Installed: "installed",
	ByGroup: "byGroup",
	Hidden: "hidden",
};

export enum TargetPlatform {
	Desktop,
	Mobile,
	Both,
}

export const SortBy: StringString = {
	Downloads: "by downloads",
	Alpha: "by alphanum",
	Updated: "by (recent) update",
	Released: "by (recent) release",
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
	// commnunity plugins
	pluginStats: {},
	plugins: [],
	commPlugins: {},
	filtersComm: "All",
	selectedGroupComm: "SelectGroup",
	numberOfGroupsComm: 4,
	groupsComm: {},
	byAuthor: false,
	invertFiltersComm: false
};

