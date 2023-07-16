import { Plugin} from 'obsidian';
import { QuickPluginSwitcherModal } from './modal';
import { debug } from './utils';

export interface QuickPluginSwitcherSettings {
    allPluginsList: PluginInfo[]
    filters: "all" | "enabled" | "disabled" | "mostSwitched",
    search: string
}

export const DEFAULT_SETTINGS: QuickPluginSwitcherSettings = {
    allPluginsList: [],
    filters: "all",
    search: ""
}

export interface PluginInfo {
    name: string;
    id: string;
    desc: string;
    enabled: boolean;
    switched: number
}

export default class QuickPluginSwitcher extends Plugin {
    settings: QuickPluginSwitcherSettings;
    reset: boolean = false
    lengthAll: number = 0
    lengthDisabled: number = 0
    lengthEnabled: number = 0

    async onload() {
        await this.loadSettings();
        const ribbonIconEl = this.addRibbonIcon('toggle-right', 'Quick Plugin Switcher', (evt: MouseEvent) => {
            // this.settings.allPluginsList = []; console.log("reset allPluginsList ON !") //to reset All
            this.getPluginsInfo()
            this.getLength()
            new QuickPluginSwitcherModal(this.app, this).open();
            // debug(this,"after QuickPluginSwitcherModal")
        });
    }

    isEnabled(name: string): boolean {
        return (this.app as any).plugins.enabledPlugins.has(name)
    }

    getLength() {
        this.lengthAll = this.settings.allPluginsList.length
        this.lengthEnabled = this.settings.allPluginsList.
            filter(plugin => plugin.enabled).length
        this.lengthDisabled = this.settings.allPluginsList.
            filter(plugin => !plugin.enabled).length
    }

    async getPluginsInfo() {
        const allPluginsList = this.settings.allPluginsList;
        const manifests = (this.app as any).plugins.manifests;

        // if plugins have been deleted
        const stillInstalled = allPluginsList.filter(plugin =>
            Object.keys(manifests).includes(plugin.id)
        );

        for (const key of Object.keys(manifests)) {
            // if plugin has been toggled from obsidian settings
            const pluginInList = stillInstalled.find(plugin => plugin.id === manifests[key]?.id);
            if (pluginInList) {
                if (this.isEnabled(manifests[key]?.id) !== pluginInList.enabled) {
                    pluginInList.enabled = !pluginInList.enabled;
                }
                continue
            } else {
                const notInListInfo: PluginInfo = {
                    name: manifests[key]?.name,
                    id: manifests[key]?.id,
                    desc: manifests[key]?.description,
                    enabled: this.isEnabled(manifests[key]?.id),
                    switched: 0
                };
                stillInstalled.push(notInListInfo);
            }
        }
        this.settings.allPluginsList = stillInstalled;
        await this.saveSettings()
        this.getLength();
    }

    async loadSettings() {
        this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}



