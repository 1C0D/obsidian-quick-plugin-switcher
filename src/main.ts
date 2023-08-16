import { Plugin } from 'obsidian';
import { QPSModal } from './modal';
import { getLength, isEnabled } from './utils';
import { DEFAULT_SETTINGS, PluginInfo, QPSSettings } from './types';
import QPSSettingTab from './settings';


export default class QuickPluginSwitcher extends Plugin {
    settings: QPSSettings;
    reset: boolean = false
    lengthAll: number = 0
    lengthDisabled: number = 0
    lengthEnabled: number = 0
    toUpdate: boolean = false

    async onload() {
        this.toUpdate = await this.loadSettings();
        this.app.workspace.onLayoutReady(async () => {
            const { settings } = this
            const allPluginsList = settings.allPluginsList || [];
            const manifests = (this.app as any).plugins.manifests || {};
            // plugin have been deleted from obsidian UI ?
            let stillInstalled: PluginInfo[] = []

            for (const plugin of allPluginsList) {
                if (Object.keys(manifests).includes(plugin.id))
                    stillInstalled.push(plugin)
            }
            // plugin has been toggled from obsidian UI ? or if is delayed unabled
            for (const plugin of stillInstalled) {
                if (
                    isEnabled(plugin.id) !== plugin.enabled
                    &&
                    !plugin.delayed
                ) {
                    plugin.enabled = !plugin.enabled;
                }// when deactivated from UI, if delayed, won't be updated until modal opened. hard to fix
            }

            for (const pluginItem of this.settings.allPluginsList) {
                if (pluginItem.delayed
                    && pluginItem.enabled !== isEnabled(pluginItem.id)
                    && pluginItem.enabled) {
                    const time = pluginItem.time * 1000 || 0
                    setTimeout(async () => await (this.app as any).plugins.enablePlugin(pluginItem.id), time)
                }
            }
        })
        this.addSettingTab(new QPSSettingTab(this.app, this));

        this.addRibbonIcon('toggle-right', 'Quick Plugin Switcher', (evt: MouseEvent) => {
            this.getPluginsInfo()
            getLength(this)
            new QPSModal(this.app, this).open();
            // debug(this, "ext-to-vault", "after QPSModal") //could be useful later
        });

        this.addCommand({
            id: 'quick-plugin-switcher-modal',
            name: 'open modal',
            callback: () => {
                this.getPluginsInfo()
                getLength(this)
                new QPSModal(this.app, this).open();
            }
        });
    }

    async getPluginsInfo() {
        const { settings } = this

        const allPluginsList = settings.allPluginsList || [];
        const manifests = (this.app as any).plugins.manifests || {};

        // plugin have been deleted from obsidian UI ?
        let stillInstalled: PluginInfo[] = []
        let uninstalled: PluginInfo[] = []

        for (const plugin of allPluginsList) {
            if (Object.keys(manifests).includes(plugin.id))
                stillInstalled.push(plugin)
            else {
                uninstalled.push(plugin)
            }
        }

        for (const key of Object.keys(manifests)) {
            // plugin has been toggled from obsidian UI ? or if is delayed unabled
            const pluginInList = stillInstalled.find(plugin => plugin.id === manifests[key].id);

            if (pluginInList) {
                if (
                    isEnabled(manifests[key].id) !== pluginInList.enabled
                    &&
                    !pluginInList.delayed
                ) {
                    pluginInList.enabled = !pluginInList.enabled;
                }
                else if (pluginInList.delayed && isEnabled(manifests[key].id) !==
                    pluginInList.enabled) {
                    if (isEnabled(manifests[key].id)) {
                        pluginInList.enabled = true;
                        await (this.app as any).plugins.disablePluginAndSave(pluginInList.id)
                        await (this.app as any).plugins.enablePlugin(pluginInList.id)
                        pluginInList.switched++;
                    }
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
                    groupInfo: {
                        groupIndices: [],
                        groupWasEnabled: false
                    },
                    delayed: false,
                    time: 0,
                };

                stillInstalled.push(notInListInfo);
            }
        }
        settings.allPluginsList = stillInstalled;
        await this.saveSettings()
        getLength(this);
    }

    // async updateInfo() { // could be usefull later
    //     if (
    //         // !(this.settings.savedVersion === "0.0.0")
    //         // && this.settings.savedVersion < "1.9.0"
    //         // &&
    //         this.toUpdate
    //     ) {
    //         new NewVersion(this.app, this).open();
    //         console.log("ici")
    //         // this.settings = { ...DEFAULT_SETTINGS }     
    //     } else {
    //         this.settings.savedVersion = this.manifest.version
    //         await this.saveSettings()
    //     }
    // }

    async loadSettings() {
        const previousSettings = { ...await this.loadData() }
        if ("groups" in previousSettings) {
            this.settings = { ...DEFAULT_SETTINGS, ...previousSettings };
            this.settings.savedVersion = this.manifest.version
            await this.saveSettings()
            return false
        }
        else {
            this.settings = { ...DEFAULT_SETTINGS }
            this.settings.savedVersion = this.manifest.version
            await this.saveSettings()
            if (Object.keys(previousSettings).length === 0) { // new installation don't run modal
                return false
            } else return true
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}