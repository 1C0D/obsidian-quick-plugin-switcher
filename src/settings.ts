import { PluginSettingTab, Setting } from "obsidian";
import { PluginInfo } from "./main";

export interface QPSSettings {
    allPluginsList: PluginInfo[]
    filters: "all" | "enabled" | "disabled" | "mostSwitched",
    search: string,
    openPluginFolder: boolean
}

export const DEFAULT_SETTINGS: QPSSettings = {
    allPluginsList: [],
    filters: "all",
    search: "",
    openPluginFolder: false
}

export default class QPSSettingTab extends PluginSettingTab {
    constructor(app: any, public plugin: any) {
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

    }


}