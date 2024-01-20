import Plugin from "./main";
import { QPSModal } from "./main_modal";
import { Notice } from "obsidian";
import { confirm } from "./secondary_modals";
import { CPModal } from "./community-plugins_modal";
import { getHkeyCondition } from "./modal_components";
import { compareVersions } from "./utils";
import { Filters } from "./types/variables";
import { getIndexFromSelectedGroup } from "./groups";
import { PluginCommInfo, PluginInstalled } from "./types/global";
import { Console } from "./Console";

/**
 * Reset most switched values.
 */
export const reset = async (modal: QPSModal) => {
	const { plugin } = modal;
	const confirmed = await confirm("Reset most switched values?", 250);
	if (confirmed) {
		plugin.reset = true; //if true, reset done in modal>addItems()
		plugin.getLength();
		await reOpenModal(modal);
		new Notice("Done", 2500);
	} else {
		new Notice("Operation cancelled", 2500);
	}
};

export const sortByName = (plugin: Plugin, listItems: string[]) => {
	const { settings } = plugin;
	const { installed } = settings;
	listItems.sort((a, b) => installed[a].name.localeCompare(installed[b].name));
};

export const sortSwitched = (plugin: Plugin, listItems: string[]) => {
	const { settings } = plugin;
	const { installed } = settings;
	listItems.sort((a, b) => installed[b].switched - installed[a].switched);
};

export const getCommandCondition = async function (
	modal: QPSModal | CPModal,
	item: PluginInstalled | PluginCommInfo
	// | StringString
) {
	const pluginCommands = await modal.app.setting.openTabById(
		item.id
	)?.app?.commands.commands;
	return pluginCommands;
};

export const togglePlugin = async (modal: QPSModal, pluginItem: PluginInstalled) => {
	const { plugin } = modal;
	pluginItem.enabled = !pluginItem.enabled;
	pluginItem.enabled
		? await conditionalEnable(modal, pluginItem.id)
		: await modal.app.plugins.disablePluginAndSave(pluginItem.id);
	plugin.getLength();
	await reOpenModal(modal);
};

//desktop only
export async function openDirectoryInFileManager(
	modal: QPSModal,
	pluginItem: PluginInstalled
) {
	let shell = window.electron.remote.shell;
	const filePath = modal.app.vault.adapter.getFullPath(
		pluginItem.dir!
	);
	try {
		await shell.openPath(filePath);
	} catch (err) {
		const plugins = modal.app.vault.adapter.getFullPath(
			".obsidian/plugins"
		);
		await shell.openPath(plugins);
	}
}

export const delayedReEnable = async (
	modal: QPSModal,
	id: string
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const { installed } = settings;
	await modal.app.plugins.disablePluginAndSave(id);
	await modal.app.plugins
		.enablePlugin(id)
	installed[id].enabled = true
};

export const conditionalEnable = async (
	modal: QPSModal,
	id: string
) => {
	const { installed } = modal.plugin.settings;
	if (installed[id].delayed && installed[id].time > 0) {
		await modal.app.plugins.enablePlugin(id);
		await modal.plugin.saveSettings();
	} else {
		installed[id].switched++; // besoin que là?
		await modal.app.plugins.enablePluginAndSave(id);
	}
};

export const selectValue = (input: HTMLInputElement | null) => {
	input?.setSelectionRange(0, input?.value.length);
};

export const modeSort = (plugin: Plugin, listItems: string[]) => {
	const { settings } = plugin;
	const { installed } = settings;
	// after reset MostSwitched
	if (plugin.reset) {
		listItems.forEach((id) => {
			installed[id].switched = 0;
		});
		plugin.reset = false;
	}
	// EnabledFirst
	if (settings.filters === Filters.EnabledFirst) {
		const enabledItems = listItems.filter((id) => installed[id].enabled);
		const disabledItems = listItems.filter((id) => !installed[id].enabled);
		sortByName(plugin, enabledItems);
		sortByName(plugin, disabledItems);
		listItems = [...enabledItems, ...disabledItems];
	}
	// ByGroup
	else if (settings.filters === Filters.ByGroup) {
		const groupIndex = getIndexFromSelectedGroup(
			settings.selectedGroup
		);
		if (groupIndex !== 0) {
			const groupedItems = listItems.filter((i) => {
				return installed[i].groupInfo.groupIndices.indexOf(groupIndex) !== -1;
			});
			listItems = groupedItems;
			sortByName(plugin, listItems);
		} else {
			sortByName(plugin, listItems);
		}
	}
	// MostSwitched
	else if (settings.filters === Filters.MostSwitched) {
		// && !plugin.reset
		sortByName(plugin, listItems);
		sortSwitched(plugin, listItems);
	}
	// All
	else {
		sortByName(plugin, listItems);
	}

	return listItems;
};

export function createInput(el: HTMLElement | null, currentValue: string) {
	if (el) {
		const input = document.createElement("input");
		input.type = "text";
		input.value = currentValue;
		el.replaceWith(input);
		input.focus();
		selectValue(input);
		return input;
	} else {
		return undefined;
	}
}

export const pressDelay = (modal: CPModal | QPSModal) => {
	modal.pressed = true;
	setTimeout(() => {
		modal.pressed = false;
	}, 1);
};

export function getInstalled() {
	return Object.keys(this.app.plugins.manifests);
}

export function isInstalled(id: string) {
	return getInstalled().includes(id);
}

export async function reOpenModal(modal: QPSModal | CPModal, searchInit = false) {
	await modal.plugin.saveSettings();
	modal.searchInit = searchInit;
	await modal.onOpen();
}

export async function openPluginSettings(
	modal: QPSModal | CPModal,
	pluginItem: PluginInstalled | PluginCommInfo
) {
	if (!(pluginItem as PluginInstalled).enabled) {
		new Notice("Plugin disabled, no Settings to show", 3500);
		return;
	}

	const pluginSettings = modal.app.setting.openTabById(
		pluginItem.id
	);
	if (!pluginSettings) {
		new Notice("No Settings on this plugin", 2500);
		return;
	}
	await modal.app.setting.open();
	await pluginSettings?.display();
}

export const showHotkeysFor = async function (
	modal: QPSModal | CPModal,
	pluginItem: PluginInstalled | PluginCommInfo
) {

	if (!(pluginItem as PluginInstalled).enabled) {
		new Notice("Plugin disabled, no HotKeys to show", 3500);
		return;
	}

	const condition = await getHkeyCondition(modal, pluginItem);
	if (!condition) {
		new Notice("No HotKeys on this plugin", 2500);
		return;
	}
	await this.app.setting.open();
	await this.app.setting.openTabById("hotkeys");
	const tab = await this.app.setting.activeTab;
	tab.searchComponent.inputEl.value = pluginItem.name + ":";
	tab.updateHotkeyVisibility();
	tab.searchComponent.inputEl.blur();
};

export async function getLatestPluginVersion(
	modal: CPModal | QPSModal,
	id: string
) {
	const pluginInfo = modal.plugin.settings.pluginStats[id];
	let latestVersion: string | null = null;

	for (const version in pluginInfo) {
		if (/^(v?\d+\.\d+\.\d+)$/.test(version)) {
			const numericVersion = version
				.replace(/^v/, '')
				.split('.')
				.join(".")

			if (!latestVersion || compareVersions(numericVersion, latestVersion) > 0) {
				latestVersion = numericVersion;
			}
		}
	}

	if (!latestVersion) {
		Console.debug("not published plugin?");
		return;
	}
	return latestVersion
}

export function modifyGitHubLinks(content: string, pluginItem: PluginCommInfo) {
	const regex = /!\[([^\]]*)\]\(([^)]*)\)/g;
	return content
		.replace(/\/blob\//g, "/raw/")
		.replace(regex, (match, alt, url) => {
			if (!url.startsWith("http")) {
				if (url.startsWith(".")) {
					url = `https://github.com/${pluginItem.repo
						}/raw/HEAD${url.substr(1)}`;
				} else {
					url = `https://github.com/${pluginItem.repo}/raw/HEAD/${url}`;
				}
			}
			return `![${alt}](${url})`;
		});
}

export function getElementFromMousePosition(
	modal: QPSModal | CPModal
) {
	if (modal.mousePosition) {
		const elementFromPoint = document.elementFromPoint(
			modal.mousePosition.x,
			modal.mousePosition.y
		);
		return elementFromPoint;
	}
	return null;
}