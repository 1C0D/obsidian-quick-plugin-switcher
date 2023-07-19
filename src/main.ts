// todo add condition to not run electron linked operations on mobiles
// TODO filter by author?
//most switched filter. not saved
import { Plugin } from 'obsidian';
import { QPSModal } from './modal';
import { debug, getLength, isEnabled } from './utils';
import { DEFAULT_SETTINGS, PluginInfo, QPSSettings } from './interfaces';
import QPSSettingTab from './settings';


export default class QuickPluginSwitcher extends Plugin {
    settings: QPSSettings;
    reset: boolean = false
    lengthAll: number = 0
    lengthDisabled: number = 0
    lengthEnabled: number = 0

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new QPSSettingTab(this.app, this));

        const ribbonIconEl = this.addRibbonIcon('toggle-right', 'Quick Plugin Switcher', (evt: MouseEvent) => {
            this.getPluginsInfo()
            getLength(this)
            new QPSModal(this.app, this).open();
            // debug(this, "ext-to-vault", "after QPSModal")
        });
    }

    async getPluginsInfo() {
        const allPluginsList = this.settings.allPluginsList || [];
        const manifests = (this.app as any).plugins.manifests || {};

        // plugin have been deleted from obsidian UI ?
        const stillInstalled = allPluginsList.filter(plugin =>
            Object.keys(manifests).includes(plugin.id)
        );

        for (const key of Object.keys(manifests)) {
            // plugin has been toggled from obsidian UI ?
            const pluginInList = stillInstalled.find(plugin => plugin.id === manifests[key].id);
            if (pluginInList) {
                if (isEnabled(manifests[key].id) !== pluginInList.enabled) {
                    pluginInList.enabled = !pluginInList.enabled;
                }
                continue
            } else {
                const notInListInfo: PluginInfo = {
                    name: manifests[key].name || "",
                    id: manifests[key].id || "",
                    desc: manifests[key].description || "",
                    dir: manifests[key].dir || "",
                    version: manifests[key].version || "",
                    author: manifests[key].author || "",
                    authorUrl: manifests[key].authorUrl || "",
                    enabled: isEnabled(manifests[key].id) || false,
                    switched: 0,
                };
                stillInstalled.push(notInListInfo);
            }
        }
        this.settings.allPluginsList = stillInstalled;
        await this.saveSettings()
        getLength(this);
    }

    async loadSettings() {
        this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}



