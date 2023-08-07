import { Notice, PluginSettingTab, Setting } from "obsidian";
import QuickPluginSwitcher from "./main";

export default class QPSSettingTab extends PluginSettingTab {
    constructor(app: any, public plugin: QuickPluginSwitcher) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        const {plugin} =this
        const { settings } = plugin;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Quick Plugin Switcher" });

        new Setting(containerEl)
            .setName("In case of bug reset all values")
            .setDesc("Should not be needed, but could be useful in case of bug. It's askings for confirmation")
            .addButton(btn => {
                btn
                    .setIcon("alert-octagon")
                    .setTooltip("Reset all values")
                    .onClick(async () => {
                        const confirmReset = window.confirm('Do you want to reset all values?');
                        if (confirmReset) {
                            settings.allPluginsList = []
                            await plugin.saveSettings();
                            new Notice("All values have been reset.");
                        } else { new Notice("Operation cancelled."); }
                    });
            });
        
        let saveSettingsTimeout: ReturnType<typeof setTimeout>;
        const { numberOfGroups } = settings;
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
                                const confirmReset = window.confirm(
                                    'reducing number of groups, higher groups info will be lost');
                                if (confirmReset) {
                                    settings.allPluginsList.forEach((plugin) => {
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
                                    settings.numberOfGroups = value;
                                    await plugin.saveSettings();
                                } else { slider.setValue(numberOfGroups) }
                            }, 700);
                        } else {
                            clearTimeout(saveSettingsTimeout);
                            settings.numberOfGroups = value;
                            await plugin.saveSettings();
                        }
                    });
            })
    }


}