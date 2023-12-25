import Plugin from "./main";
import { QPSModal } from "./main_modal";
import { Notice, PluginCommInfo, PluginInfo } from "obsidian";
import { confirm } from "./secondary_modals";
import { CPModal } from "./community-plugins_modal";
import { getHkeyCondition } from "./modal_components";
import { compareVersions } from "./utils";
import { Filters } from "./types/variables";
import { getIndexFromSelectedGroup } from "./groups";

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

export const sortByName = (listItems: PluginInfo[]) => {
	listItems.sort((a, b) => a.name.localeCompare(b.name));
};

export const sortSwitched = (listItems: PluginInfo[]) => {
	listItems.sort((a, b) => b.switched - a.switched);
};

export const getCommandCondition = async function (
	modal: QPSModal | CPModal,
	pluginItem: PluginInfo | PluginCommInfo | Record<string, string>
) {
	const pluginCommands = await (modal.app as any).setting.openTabById(
		pluginItem.id
	)?.app?.commands.commands;
	return pluginCommands;
};

export const togglePlugin = async (modal: QPSModal, pluginItem: PluginInfo) => {
	const { plugin } = modal;

	pluginItem.enabled = !pluginItem.enabled;
	pluginItem.enabled
		? await conditionalEnable(modal, pluginItem)
		: await (modal.app as any).plugins.disablePluginAndSave(pluginItem.id);
	plugin.getLength();
	await plugin.saveSettings();
	await reOpenModal(modal);
};

//desktop only
export async function openDirectoryInFileManager(
	modal: QPSModal,
	pluginItem: PluginInfo
) {
	let shell = window.electron.remote.shell;
	const filePath = (modal.app as any).vault.adapter.getFullPath(
		pluginItem.dir
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
	_this: QPSModal,
	pluginItem: PluginInfo
) => {
	await (_this.app as any).plugins.disablePluginAndSave(pluginItem.id);
	await (_this.app as any).plugins
		.enablePlugin(pluginItem.id)
		.then((pluginItem.enabled = true));
};

export const conditionalEnable = async (
	modal: QPSModal,
	pluginItem: PluginInfo
) => {
	if (pluginItem.delayed && pluginItem.time > 0) {
		await (modal.app as any).plugins.enablePlugin(pluginItem.id);
		await modal.plugin.saveSettings();
	} else {
		pluginItem.switched++; // besoin que là?
		await (modal.app as any).plugins.enablePluginAndSave(pluginItem.id);
	}
};

export const selectValue = (input: HTMLInputElement | null) => {
	input?.setSelectionRange(0, input?.value.length);
};

export const modeSort = (plugin: Plugin, listItems: PluginInfo[]) => {
	const { settings } = plugin;
	// after reset MostSwitched
	if (plugin.reset) {
		const allPluginsList = settings.allPluginsList;
		allPluginsList.forEach((i) => {
			i.switched = 0;
		});
		plugin.reset = false;
	}
	// EnabledFirst
	if (settings.filters === Filters.EnabledFirst) {
		const enabledItems = listItems.filter((i) => i.enabled);
		const disabledItems = listItems.filter((i) => !i.enabled);
		sortByName(enabledItems);
		sortByName(disabledItems);
		listItems = [...enabledItems, ...disabledItems];
	}
	// ByGroup
	else if (settings.filters === Filters.ByGroup) {
		const groupIndex = getIndexFromSelectedGroup(
			settings.selectedGroup as string
		);
		if (groupIndex !== 0) {
			const groupedItems = listItems.filter((i) => {
				return i.groupInfo.groupIndices.indexOf(groupIndex) !== -1;
			});
			listItems = groupedItems;
			sortByName(listItems);
		} else {
			sortByName(listItems);
		}
	}
	// MostSwitched
	else if (settings.filters === Filters.MostSwitched) {
		// && !plugin.reset
		sortByName(listItems);
		sortSwitched(listItems);
	}
	// All
	else {
		sortByName(listItems);
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

export function isInstalled(item: any) {
	return getInstalled().includes(item.id);
}

export async function reOpenModal(modal: QPSModal | CPModal) {
	modal.searchInit = false;
	await modal.onOpen();
}

export async function openPluginSettings(
	modal: QPSModal | CPModal,
	pluginItem: PluginInfo | PluginCommInfo
) {
	const pluginSettings = (modal.app as any).setting.openTabById(
		pluginItem.id
	);
	if (!pluginSettings) {
		new Notice("No settings on this plugin", 2500);
		return;
	}
	await (modal.app as any).setting.open();
	await pluginSettings?.display();
}

export const showHotkeysFor = async function (
	modal: QPSModal | CPModal,
	pluginItem: PluginInfo | PluginCommInfo
) {
	const condition = await getHkeyCondition(modal, pluginItem);
	if (!condition) {
		new Notice("No HotKeys on this plugin", 2500);
		return;
	}
	await (this.app as any).setting.open();
	await (this.app as any).setting.openTabById("hotkeys");
	const tab = await (this.app as any).setting.activeTab;
	tab.searchComponent.inputEl.value = pluginItem.name + ":";
	tab.updateHotkeyVisibility();
	tab.searchComponent.inputEl.blur();
};

export async function getLatestPluginVersion(
	modal: CPModal | QPSModal,
	plugin: PluginCommInfo | PluginInfo
) {
	const pluginInfo = modal.plugin.settings.pluginStats[plugin.id];
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
		console.debug("no last version?"); // shouldn't happen
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
	evt: MouseEvent | KeyboardEvent,
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