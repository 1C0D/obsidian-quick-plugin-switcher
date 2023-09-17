import { Notice, PluginSettingTab, Setting } from "obsidian";
import QuickPluginSwitcher from "./main";
import { confirm } from "./secondary_modals";

export default class QPSSettingTab extends PluginSettingTab {
    constructor(app: any, public plugin: QuickPluginSwitcher) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        const { plugin } = this
        const { settingS } = plugin;

        containerEl.empty();
        containerEl.createEl("h4", { text: "Quick Plugin Switcher" });

        let saveSettingsTimeout: ReturnType<typeof setTimeout>;
        const { numberOfGroups } = settingS;
        new Setting(containerEl)
            .setName("Number of plugins groups")
            .setDesc("To treat plugins by groups")
            .addSlider((slider) => {
                slider
                    .setLimits(1, 7, 1)
                    .setValue(numberOfGroups)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        if (value < numberOfGroups) {
                            clearTimeout(saveSettingsTimeout);
                            saveSettingsTimeout = setTimeout(async () => {
                                const confirmReset = await confirm(
                                    'reducing number of groups, higher groups info will be lost',350);
                                if (confirmReset) {
                                    settingS.allPluginsList.forEach((plugin) => {
                                        let hasValueGreaterThanValue = false;
                                        for (const groupIndex of plugin.groupInfo.groupIndices) {
                                            if (groupIndex > value) {
                                                hasValueGreaterThanValue = true;
                                                break;
                                            }
                                        }
                                        if (hasValueGreaterThanValue) {
                                            plugin.groupInfo.groupIndices = [];
                                        }
                                    });
                                    settingS.numberOfGroups = value;
                                    await plugin.saveSettings();
                                } else { slider.setValue(numberOfGroups) }
                            }, 700);
                        } else {
                            clearTimeout(saveSettingsTimeout);
                            settingS.numberOfGroups = value;
                            await plugin.saveSettings();
                        }
                    });
            })

        new Setting(containerEl)
            .setName("Reset all values")
            .setDesc("Don't do this, unless you really need to")
            .addButton(btn => {
                btn
                    .setIcon("alert-octagon")
                    .setTooltip("Reset all values")
                    .onClick(async () => {
                        const confirmReset = await confirm('Do you want to reset all values?',300);
                        if (confirmReset) {
                            if (plugin.settingS.hasOwnProperty('allPluginsList')) {
                                plugin.settingS.allPluginsList = [];
                            }
                            if (plugin.settingS.hasOwnProperty('groups')) {
                                plugin.settingS.groups = {};
                            }
                            await plugin.saveSettings();
                            new Notice("Reset done", 1300)
                            // (this.app as any).commands.executeCommandById('app:reload')
                        } else { new Notice("Operation cancelled",1000); }
                    });
            });

        new Setting(containerEl)
            .setName("Show hotkeys line reminder")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settingS.showHotKeys)
                    .onChange((value) => {
                        this.plugin.settingS.showHotKeys = value;
                        this.plugin.saveSettings();
                    })
            });
    }


}