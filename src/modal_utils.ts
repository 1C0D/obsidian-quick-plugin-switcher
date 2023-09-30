import { GroupData, Groups, PluginInfo } from "./types"
import Plugin from "./main"
import { QPSModal } from "./modal";
import { Notice } from "obsidian";
import { confirm } from "./secondary_modals";


/**
 * Reset most switched values.
 */
export const reset = async (modal: QPSModal) => {
    const { plugin } = modal
    const confirmed = await confirm("Reset most switched values?", 250);
    if (confirmed) {
        plugin.reset = true //if true, reset done in modal>addItems()
        plugin.getLength();
        modal.onOpen()
        new Notice("Done", 1000)
    } else {
        new Notice("Operation cancelled",1000)
    }
}

export const sortByName = (listItems: PluginInfo[]) => {
    listItems.sort((a, b) => a.name.localeCompare(b.name))
}

export const sortSwitched = (listItems: PluginInfo[]) => {
    listItems.sort((a, b) => b.switched - a.switched)
}


export const getGroupTitle = (plugin: Plugin, Groups: GroupData) => {
    const {settings} = plugin
	const numberOfGroups = settings.numberOfGroups;
	const currentGroupKeys = Object.keys(Groups);

	// delete groups if new value < previous value (when moving slider in prefs)
	for (let i = 1; i < currentGroupKeys.length; i++) {
		const key = currentGroupKeys[i];
		delete Groups[key];
	}

	for (let i = 1; i <= numberOfGroups; i++) {
		if (settings.groups[i]?.name === undefined)
			settings.groups[i] = {
				name: "",
				delayed: false,
				time: 0,
				applied: false,
			};

		const groupKey =
			plugin.settings.groups[i]?.name !== ""
				? plugin.settings.groups[i]?.name
				: `Group${i}`;
		Groups[`Group${i}`] = `${groupKey}`;
	}
};

export const getEmojiForGroup = (groupNumber: number) => {
    const emojis = ["🟡", "🔵", "🔴", "⚪️", "🟤", "🟢", "🟣"];
    const colors = ["#FFD700", "#0000FF", "#FF0000", "#FFFFFF", "#A52A2A", "#00FF00", "#800080"];
    return { emoji: emojis[groupNumber - 1], color: colors[groupNumber - 1] };
};

export const getCirclesItem = (pluginItem: PluginInfo, indices: number[]) => { //move this to modal utilities
    const len = indices.length
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
            `
    return content
}

export const togglePlugin = async (modal: QPSModal, pluginItem: PluginInfo) => {
    const { plugin } = modal

    pluginItem.enabled = !pluginItem.enabled;
    pluginItem.enabled
        ? await conditionalEnable(modal, pluginItem)
        : await (modal.app as any).plugins.disablePluginAndSave(pluginItem.id);
    plugin.getLength();
    await plugin.saveSettings();
    modal.onOpen();
}

//desktop only
export async function openDirectoryInFileManager(shell: any, modal: QPSModal, pluginItem: PluginInfo) {
    const filePath = (modal.app as any).vault.adapter.getFullPath(pluginItem.dir)
    try {
        await shell.openExternal(filePath);
    } catch (err) {
        const plugins = (app as any).vault.adapter.getFullPath(".obsidian/plugins")
        await shell.openExternal(plugins)
    }
}

export const delayedReEnable = async (_this: QPSModal, pluginItem: PluginInfo) => {
    await (_this.app as any).plugins.disablePluginAndSave(pluginItem.id)
    await (_this.app as any).plugins.enablePlugin(pluginItem.id).then(pluginItem.enabled = true)
}

export const conditionalEnable = async (_this: any, pluginItem: PluginInfo) => {
    if (pluginItem.delayed && pluginItem.time > 0) {
        await (_this.app as any).plugins.enablePlugin(pluginItem.id)
        await _this.plugin.saveSettings()
    } else {
        pluginItem.switched++;// besoin que là?
        await (_this.app as any).plugins.enablePluginAndSave(pluginItem.id)
    }
}

export const selectValue = (input: HTMLInputElement | null) => {
    input?.setSelectionRange(0, input?.value.length);
}

export function groupNotEmpty(groupIndex: number, modal: QPSModal) {
	const { plugin } = modal;
	const { settings } = plugin;

	return settings.allPluginsList.some(
		(plugin) => plugin.groupInfo.groupIndices?.indexOf(groupIndex) !== -1
	);
}


export function getIndexFromSelectedGroup(str:string) {
	return parseInt(str.slice(-1));
}


// removing groups ---------------
export function rmvAllGroupsFromPlugin(
	modal: QPSModal,
	pluginItem: PluginInfo,
	groupIndices:number[]
) {
	const { settings } = modal.plugin;
	let isEmpty = false;
	pluginItem.groupInfo.groupIndices = [];
	for (const groupIndex of groupIndices) {
		if (
			!groupNotEmpty(groupIndex, modal) &&
			getIndexFromSelectedGroup(settings.selectedGroup) === groupIndex
		) {
			isEmpty = true;
			break;
		}
	}
	if (isEmpty) {
		settings.selectedGroup = "SelectGroup";
	}
	modal.onOpen();
}