import Plugin from "./main";
import { QPSModal } from "./main_modal";
import { GroupData, Notice, PluginCommInfo, PluginInfo } from "obsidian";
import { confirm } from "./secondary_modals";
import { CPModal } from "./community-plugins_modal";
import { getHkeyCondition } from "./modal_components";
import { compareVersions } from "./utils";

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

export const setGroupTitle = (
	modal: QPSModal | CPModal,
	plugin: Plugin,
	Groups: GroupData,
	numberOfGroups: number
) => {
	const { settings } = plugin;
	const currentGroupKeys = Object.keys(Groups);

	// delete groups if new value < previous value (when moving slider in prefs)
	for (let i = 1; i < currentGroupKeys.length; i++) {
		const key = currentGroupKeys[i];
		delete Groups[key];
	}

	for (let i = 1; i <= numberOfGroups; i++) {
		if (modal instanceof CPModal) {
			if (settings.groupsComm[i]?.name === undefined) {
				settings.groupsComm[i] = {
					name: "",
				};
			}
			const groupKey =
				plugin.settings.groupsComm[i]?.name !== ""
					? plugin.settings.groupsComm[i]?.name
					: `Group${i}`;
			Groups[`Group${i}`] = `${groupKey}`;
		} else {
			if (settings.groups[i]?.name === undefined) {
				settings.groups[i] = {
					name: "",
					delayed: false,
					time: 0,
					applied: false,
				};
			}
			const groupKey =
				plugin.settings.groups[i]?.name !== ""
					? plugin.settings.groups[i]?.name
					: `Group${i}`;
			Groups[`Group${i}`] = `${groupKey}`;
		}
	}
};

export const getEmojiForGroup = (groupNumber: number) => {
	const emojis = ["🟡", "🔵", "🔴", "⚪️", "🟤", "🟢", "🟣"];
	const colors = [
		"#FFD700",
		"#0000FF",
		"#FF0000",
		"#FFFFFF",
		"#A52A2A",
		"#00FF00",
		"#800080",
	];
	return { emoji: emojis[groupNumber - 1], color: colors[groupNumber - 1] };
};

export const getCirclesItem = (indices: number[]) => {
	//move this to modal utilities
	const len = indices.length;
	let background = "";
	if (len === 1) {
		const { color } = getEmojiForGroup(indices[len - 1]);
		background = `background: ${color};`;
	} else if (len === 2) {
		const { color: color1 } = getEmojiForGroup(indices[len - 2]);
		const { color: color2 } = getEmojiForGroup(indices[len - 1]);
		background = `background: linear-gradient(90deg, ${color1} 50%, ${color2} 50%);`;
	}

	const content = `<div
            style="${background}"
            class="qps-item-line-group"
            >
            &nbsp;
            </div>
            `;
	return content;
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

export function groupNotEmpty(groupIndex: number, modal: QPSModal | CPModal) {
	const { plugin } = modal;
	const { settings } = plugin;
	if (modal instanceof QPSModal) {
		return settings.allPluginsList.some(
			(plugin) =>
				plugin.groupInfo.groupIndices?.indexOf(groupIndex) !== -1
		);
	} else {
		for (const pluginKey in settings.pluginsTagged) {
			const plugin = settings.pluginsTagged[pluginKey];
			const groupIndices = plugin.groupInfo.groupIndices || [];

			if (groupIndices.includes(groupIndex)) {
				return true;
			}
		}

		return false;
	}
}

export const getPluginsInGroup = (
	modal: QPSModal | CPModal,
	groupNumber: number
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	if (modal instanceof QPSModal)
		return settings.allPluginsList.filter(
			(i: PluginInfo) =>
				i.groupInfo.groupIndices?.indexOf(groupNumber) !== -1
		);
	else {
		const pluginsWithGroup: PluginCommInfo[] = [];

		Object.keys(settings.pluginsTagged).forEach((pluginKey) => {
			const plugin = settings.pluginsTagged[pluginKey];
			const groupIndices = plugin.groupInfo.groupIndices || [];

			if (groupIndices.includes(groupNumber)) {
				const matchingPlugin = settings.commPlugins.find(
					(plugin) => plugin.id === pluginKey
				);
				if (matchingPlugin) {
					pluginsWithGroup.push(matchingPlugin);
				}
			}
		});

		return pluginsWithGroup;
	}
};

// const getPluginsWithGroup = (modal: CPModal, groupNumber: number) => {
// 	const { plugin } = modal;
// 	const { settings } = plugin;
// 	const pluginsWithGroup: PluginCommInfo[] = [];

// 	Object.keys(settings.pluginsTagged).forEach((pluginKey) => {
// 		const plugin = settings.pluginsTagged[pluginKey];
// 		const groupIndices = plugin.groupInfo.groupIndices || [];

// 		if (groupIndices.includes(groupNumber)) {
// 			const matchingPlugin = modal.pluginsList.find(
// 				(plugin) => plugin.id === pluginKey
// 			);
// 			if (matchingPlugin) {
// 				pluginsWithGroup.push(matchingPlugin);
// 			}
// 		}
// 	});

// 	return pluginsWithGroup;
// };

export function getIndexFromSelectedGroup(str: string) {
	if (str === "SelectGroup") return 0;
	else return parseInt(str.slice(-1));
}

export function groupNameFromIndex(groups: GroupData, index: number) {
	for (let key in groups) {
		if (key.endsWith(index.toString())) {
			return key;
		}
	}
	return null;
}


// removing groups ---------------
export async function rmvAllGroupsFromPlugin(
	modal: QPSModal | CPModal,
	pluginItem: PluginInfo | PluginCommInfo
) {
	const { plugin } = modal;
	const { settings } = plugin;

	if ("repo" in pluginItem) {
		const itemID = pluginItem.id;
		const { pluginsTagged } = settings;
		const taggedItem = pluginsTagged[itemID];
		if (!taggedItem) return;
		delete pluginsTagged[itemID];
		await plugin.saveSettings();
		if (modal instanceof CPModal) {
			await plugin.saveSettings();
			await reOpenModal(modal);
		}
	} else {
		if (pluginItem.groupInfo) {
			pluginItem.groupInfo.groupIndices = [];
			await plugin.saveSettings();
			await reOpenModal(modal);
		}
	}
}

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
				// .map(Number)
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
