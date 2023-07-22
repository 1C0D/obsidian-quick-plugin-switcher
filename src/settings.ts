import { Notice, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./interfaces";
import QuickPluginSwitcher from "./main";

export default class QPSSettingTab extends PluginSettingTab {
    constructor(app: any, public plugin: QuickPluginSwitcher) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Quick Plugin Switcher" });

        new Setting(containerEl)
            .setName("Open Plugin Folder")
            .setDesc("Add a button to open the plugin folder")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.openPluginFolder);
                toggle.onChange(async (value) => {
                    this.plugin.settings.openPluginFolder = value;
                    await this.plugin.saveSettings();
                });
            });

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
                            this.plugin.settings.allPluginsList = []
                            // this.plugin.settings.wasEnabled = []
                            await this.plugin.saveSettings();
                            new Notice("All values have been reset.");
                        } else { new Notice("Operation cancelled."); }
                    });
            });
        let saveSettingsTimeout: ReturnType<typeof setTimeout>;
        new Setting(containerEl)
            .setName("Number of plugins groups")
            .setDesc("To treat plugins by groups")
            .addSlider((slider) => {
                slider
                    .setLimits(1, 7, 1)
                    .setValue(this.plugin.settings.numberOfGroups)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        if (value < this.plugin.settings.numberOfGroups) {
                            clearTimeout(saveSettingsTimeout);
                            saveSettingsTimeout = setTimeout(async () => {
                                const confirmReset = window.confirm(
                                    'reducing number of groups, higher groups info will be lost');
                                if (confirmReset) {
                                    this.plugin.settings.allPluginsList.forEach((plugin) => {
                                        if (plugin.group > value) plugin.group = 0;
                                    });
                                    this.plugin.settings.numberOfGroups = value;
                                    await this.plugin.saveSettings();
                                } else { slider.setValue(this.plugin.settings.numberOfGroups) }
                            }, 550); // Définir un délai de 500 ms (ajustez selon vos besoins)
                        } else {
                            this.plugin.settings.numberOfGroups = value;
                            await this.plugin.saveSettings();
                        }
                    });
            })
            .addExtraButton(btn => {
                btn
                    .setIcon("reset")
                    .setTooltip("Reset to default")
                    .onClick(async () => {
                        this.plugin.settings.numberOfGroups = DEFAULT_SETTINGS.numberOfGroups;
                        await this.plugin.saveSettings();
                        this.display()
                    });
            });
    }


}