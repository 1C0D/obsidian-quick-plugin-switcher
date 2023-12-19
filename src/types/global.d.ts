import 'obsidian'
import { CommFilters, Filters } from './variables';

declare module "obsidian" {
    interface App {
        setting: Setting,
        plugins: Plugins
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

    interface Setting extends Modal { openTabById: (id: string) => Record<string, any>; }
    interface DataAdapter {
        getFullPath: (normalizedPath: string) => string;
    }

    export interface PluginInfo {
        name: string;
        id: string;
        desc: string;
        dir: string;
        repo: PackageData;
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

    export interface PluginGroupInfo {
        groupIndices: number[];
        groupWasEnabled: boolean;
    }

    export interface PluginTaggedGroupInfo {
        groupIndices: number[];
    }

    export interface QPSSettings {
        lastFetchExe: number;
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
        showReset:boolean;
        // commnunity plugins
        pluginStats: PackageInfoData;
        pluginsTagged: PluginsTaggedInfo;
        commPlugins: PluginCommInfo[];
        filtersComm: keyof typeof CommFilters;
        selectedGroupComm: string;
        numberOfGroupsComm: number;
        groupsComm: Record<number, { name: string }>;
    }

    export interface GroupData {
        [key: string]: string;
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
}