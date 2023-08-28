import { Notice, PluginSettingTab, Setting } from "obsidian";
import QuickPluginSwitcher from "./main";

export default class QPSSettingTab extends PluginSettingTab {
    constructor(app: any, public plugin: QuickPluginSwitcher) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        const { plugin } = this
        const { settings } = plugin;

        containerEl.empty();
        containerEl.createEl("h4", { text: "Quick Plugin Switcher" });
        const content = `
        <b>Important:</b><br> you have to click a plugin name before to use a shortcut.<br>
        you can click several names then a shortcut. <br><br>`
        containerEl.createDiv("", (el: HTMLDivElement) => {
            el.innerHTML = content;
        })

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

        new Setting(containerEl)
            .setName("Reset in case of bug. IMPORTANT: After that you need to minimize obsidian window and restore it, to get back the focus to obsidian. Don't ask me why")
            .setDesc("Should not be needed, but could be useful in case of bug.")
            .addButton(btn => {
                btn
                    .setIcon("alert-octagon")
                    .setTooltip("Reset all values")
                    .onClick(async () => {
                        const confirmReset = window.confirm('Do you want to reset all values?');
                        if (confirmReset) {
                            if (plugin.settings.hasOwnProperty('allPluginsList')) {
                                plugin.settings.allPluginsList = [];
                            }
                            if (plugin.settings.hasOwnProperty('groups')) {
                                plugin.settings.groups = {};
                            }
                            await plugin.saveSettings();
                        } else { new Notice("Operation cancelled."); }
                    });
            });

        new Setting(containerEl)
            .setName("Show hotkeys line reminder")
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.showHotKeys)
                    .onChange((value) => {
                        this.plugin.settings.showHotKeys = value;
                        this.plugin.saveSettings();
                    })
            });
    }


}