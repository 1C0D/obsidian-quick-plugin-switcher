import { around } from "monkey-around";
import { Platform, Plugin } from 'obsidian';
import { QPSModal } from './modal';
import { getLength, isEnabled } from './utils';
import { BaseSettings, DEFAULT_SETTINGS, PluginInfo, QPSSettings } from './types';
import QPSSettingTab from './settings';


export default class QuickPluginSwitcher extends Plugin {
    settings: QPSSettings;
    settingS: BaseSettings // 
    reset: boolean = false
    lengthAll: number = 0
    lengthDisabled: number = 0
    lengthEnabled: number = 0
    toUpdate: boolean = false

    async onload() {
        this.toUpdate = await this.loadSettings();
        this.app.workspace.onLayoutReady(async () => {
            const { settingS } = this
            const allPluginsList = settingS.allPluginsList || [];
            const manifests = (this.app as any).plugins.manifests || {};
            // plugin have been deleted from obsidian UI ?
            let stillInstalled: PluginInfo[] = []


            for (const plugin of allPluginsList) {
                if (Object.keys(manifests).includes(plugin.id))
                    stillInstalled.push(plugin)
            }

            const { wrapper1, wrapper2 } = this.wrapDisableEnablePluginAndSave(
                stillInstalled,
                async () => { await this.saveSettings() }
            )

            this.register(
                wrapper1
            );
            this.register(
                wrapper2
            );

            // plugin has been toggled from obsidian UI ? or if is delayed unabled
            for (const plugin of stillInstalled) {
                if (
                    isEnabled(plugin.id) !== plugin.enabled
                    &&
                    !plugin.delayed //because if delayed isEnabled false 
                ) {
                    plugin.enabled = !plugin.enabled;
                }
            }
            await this.saveSettings()

            //delay at start
            for (const pluginItem of stillInstalled) {
                if (
                    pluginItem.delayed
                    && pluginItem.enabled
                ) {
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

    wrapDisableEnablePluginAndSave(stillInstalled: PluginInfo[], cb: () => {}) {
        const manifests = (this.app as any).plugins.manifests || {}
        const wrapper1 = around((this.app as any).plugins, {
            disablePluginAndSave(oldMethod) {
                return async function (pluginId: string) {
                    if (stillInstalled) {
                        const plugin = stillInstalled.find(plugin => plugin.id === pluginId && !isEnabled(manifests[pluginId].id))
                        if (
                            plugin
                            && plugin.delayed
                            && plugin.time > 0
                        ) {
                            plugin.enabled = false
                            cb()
                        }
                    }
                    return oldMethod.call(this, pluginId);
                }
            },
        })
        const wrapper2 = around((this.app as any).plugins, {
            enablePluginAndSave(oldMethod) {
                return async function (pluginId: string) {
                    let altReturn = false
                    if (stillInstalled) {
                        const plugin = stillInstalled.find(plugin => plugin.id === pluginId && isEnabled(manifests[pluginId].id))
                        if (
                            plugin
                            && plugin.delayed
                            && plugin.time > 0
                        ) {
                            plugin.enabled = true
                            altReturn = true
                            cb()
                        }
                    }
                    if (altReturn) return (this.app as any).plugins.enablePlugin.call(this, pluginId)
                    return oldMethod.call(this, pluginId);
                }
            },
        })

        return { wrapper1, wrapper2 }
    }

    async getPluginsInfo() {
        const { settingS } = this

        const allPluginsList = settingS.allPluginsList || [];
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
                // compatibility with previous versions
                if (pluginInList.desktopOnly === undefined) {
                    pluginInList.desktopOnly = manifests[key].isDesktopOnly || false;
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
                    desktopOnly: manifests[key].isDesktopOnly || false,
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
        settingS.allPluginsList = stillInstalled;
        await this.saveSettings()
        getLength(this);
    }

    conditionalSettings() {
        const isMobile = Platform.isMobileApp
        if (isMobile) this.settingS = this.settings.mobileSettings
        else this.settingS = this.settings
    }

    async loadSettings() {
        const previousSettings = { ...await this.loadData() }
        this.settings = { ...DEFAULT_SETTINGS, ...previousSettings };
        this.conditionalSettings()
        this.settingS.savedVersion = this.manifest.version
        await this.saveSettings()
        return false
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}