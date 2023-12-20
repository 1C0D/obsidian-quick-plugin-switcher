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
		const { plugin } = this;
		const { settings } = plugin;

		containerEl.empty();
		containerEl.createEl("h4", { text: "Quick Plugin Switcher" });

		let saveSettingsTimeout: ReturnType<typeof setTimeout>;
		const { numberOfGroups, numberOfGroupsComm } = settings;
		new Setting(containerEl)
			.setName("Number of plugins groups")
			.setDesc("To treat plugins by groups")
			.addSlider((slider) => {
				slider
					.setLimits(1, 6, 1)
					.setValue(numberOfGroups)
					.setDynamicTooltip()
					.onChange(async (value) => {
						if (value < numberOfGroups) {
							clearTimeout(saveSettingsTimeout);
							saveSettingsTimeout = setTimeout(async () => {
								const confirmReset = await confirm(
									"reducing number of groups, higher groups info will be lost",
									350
								);
								if (confirmReset) {
									settings.allPluginsList.forEach(
										(plugin) => {
											let hasValueGreaterThanValue =
												false;
											for (const groupIndex of plugin
												.groupInfo.groupIndices) {
												if (groupIndex > value) {
													hasValueGreaterThanValue =
														true;
													break;
												}
											}
											if (hasValueGreaterThanValue) {
												plugin.groupInfo.groupIndices =
													[];
											}
										}
									);
									settings.numberOfGroups = value;
									await plugin.saveSettings();
								} else {
									slider.setValue(numberOfGroups);
								}
							}, 700);
						} else {
							clearTimeout(saveSettingsTimeout);
							settings.numberOfGroups = value;
							await plugin.saveSettings();
						}
					});
			});

		new Setting(containerEl)
			.setName("Number of community plugins groups")
			.setDesc("To treat plugins by groups")
			.addSlider((slider) => {
				slider
					.setLimits(1, 6, 1)
					.setValue(numberOfGroupsComm)
					.setDynamicTooltip()
					.onChange(async (value) => {
						if (value < numberOfGroupsComm) {
							clearTimeout(saveSettingsTimeout);
							saveSettingsTimeout = setTimeout(async () => {
								const confirmReset = await confirm(
									"reducing number of groups, higher groups info will be lost",
									350
								);
								if (confirmReset) {
									const { commPlugins, pluginsTagged } =
										settings;

									commPlugins.forEach((plugin) => {
										let hasValueGreaterThanValue = false;
										const taggedItem =
											pluginsTagged[plugin.id];
										if (!taggedItem) return;
										const { groupInfo } = taggedItem;
										let { groupIndices } = groupInfo;
										for (const groupIndex of groupIndices) {
											if (groupIndex > value) {
												hasValueGreaterThanValue = true;
												break;
											}
										}
										if (hasValueGreaterThanValue) {
											groupIndices = [];
										}
									});
									settings.numberOfGroupsComm = value;
									await plugin.saveSettings();
								} else {
									slider.setValue(numberOfGroupsComm);
								}
							}, 700);
						} else {
							clearTimeout(saveSettingsTimeout);
							settings.numberOfGroupsComm = value;
							await plugin.saveSettings();
						}
					});
			});

		addButton(containerEl, plugin)

		new Setting(containerEl)
			.setName("Show hotkeys line reminder")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showHotKeys)
					.onChange((value) => {
						this.plugin.settings.showHotKeys = value;
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Show reset in main modal (for dev)")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showReset)
					.onChange(async (value) => {
						this.plugin.settings.showReset = value;
						await this.plugin.saveSettings();
					});
			});
	}

	
}

export function addButton(containerEl: HTMLElement, plugin: QuickPluginSwitcher) {
	return new Setting(containerEl)
		.setName("Reset all values")
		.setDesc("Don't do this, unless you really need to")
		.addButton((btn) => {
			btn.setIcon("alert-octagon")
				.setTooltip("Reset all values")
				.onClick(async () => {
					const confirmReset = await confirm(
						"Do you want to reset all values?",
						300
					);
					if (confirmReset) {
						if (
							plugin.settings.hasOwnProperty("allPluginsList")
						) {
							plugin.settings.allPluginsList = [];
						}
						if (plugin.settings.hasOwnProperty("groups")) {
							plugin.settings.groups = {};
						}
						await plugin.saveSettings();
						// new Notice("Reset done", 2500);
						(this.app as any).commands.executeCommandById('app:reload')
					} else {
						new Notice("Operation cancelled", 2500);
					}
				});
		});

}