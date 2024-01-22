import { PluginSettingTab, Setting } from "obsidian";
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
									const { installed } = settings
									for (const key in installed) {
										let hasValueGreaterThanValue =
											false;
										for (const groupIndex of installed[key].groupInfo.groupIndices) {
											if (groupIndex > value) {
												hasValueGreaterThanValue =
													true;
												break;
											}
										}
										if (hasValueGreaterThanValue) {
											installed[key].groupInfo.groupIndices =
												[];
										}
									}

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
						settings.numberOfGroups = value;
						await plugin.saveSettings();
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
									const { commPlugins } =
										settings;
									for (const key in commPlugins) {
										let hasValueGreaterThanValue = false;
										let groupIndices = commPlugins[key].groupCommInfo.groupIndices;
										if (groupIndices) {
											for (const groupIndex of groupIndices) {
												if (groupIndex > value) {
													hasValueGreaterThanValue = true;
													break;
												}
											}
										}
										if (hasValueGreaterThanValue) {
											groupIndices = [];
										}
									};
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
	}
}