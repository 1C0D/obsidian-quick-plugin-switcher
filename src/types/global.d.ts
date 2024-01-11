import 'obsidian'
import { CommFilters, Filters, SortBy } from './variables';
import { PluginManifest } from 'obsidian';

declare module "obsidian" {
    interface App {
        setting: Setting,
        plugins: Plugins,
        commands: Commands;
    }

    interface Plugins {
        manifests: Record<string, PluginManifest>
        plugins: Record<string, Plugin>;
        installPlugin: (repo: string, version: string, manifest: PluginManifest) => Promise<void>;
        enabledPlugins: Set<string>;
        disablePlugin: (id: string) => Promise<void>;
        disablePluginAndSave: (id: string) => Promise<void>;
        enablePlugin: (id: string) => Promise<void>;
        enablePluginAndSave: (id: string) => Promise<void>;
    }

    interface Commands { executeCommandById: (commandId: string) => boolean; }

    interface Setting extends Modal { openTabById: (id: string) => Record<string, any>; }

    interface DataAdapter {
        getFullPath: (normalizedPath: string) => string;
    }

}

interface StringString {
    [key: string]: string;
}

interface PluginInstalled extends PluginManifest {
    enabled: boolean;
    switched: number;
    groupInfo: PluginGroupInfo;
    delayed: boolean;
    time: number
}



interface PluginGroupInfo {
    hidden: boolean;
    groupIndices: number[];
    groupWasEnabled: boolean;
}

interface PluginCommGroupInfo {
    hidden: boolean;
    groupIndices: number[];
}


interface QPSSettings {
    lastFetchExe: number;
    savedVersion: string;
    installed: Record<string, PluginInstalled>;
    wasEnabled: string[];
    sortBy: keyof typeof SortBy;
    filters: keyof typeof Filters;
    selectedGroup: string;
    search: string;
    numberOfGroups: number;
    groups: Record<
        number,
        { name: string; delayed: boolean; time: number; applied: boolean, hidden: boolean }
    >;
    showHotKeys: boolean;
    showReset: boolean;
    // commnunity plugins
    pluginStats: PackageInfoData; 
    commPlugins: Record<string, PluginCommInfo>;
    filtersComm: keyof typeof CommFilters;
    selectedGroupComm: string;
    numberOfGroupsComm: number;
    groupsComm: Record<number, { name: string, hidden: boolean }>;
    byAuthor: boolean;
    invertFiltersComm: boolean;
}

type KeyToSettingsMapType = {
    [key: string]: () => Promise<void> | void;
};

interface CommPlugin {
    name: string;
    id: string;
    description: string;
    author: string;
    repo: string;
}

// community plugins
interface PluginCommInfo extends CommPlugin {
    hidden: boolean;
    groupCommInfo: PluginCommGroupInfo;
    downloads: number;
    updated: number;
}

//releases
interface PackageInfoData {
    [packageName: string]: PackageData;
}

interface PackageData {
    downloads: number;
    updated: number;
    [version: string]: number;
}