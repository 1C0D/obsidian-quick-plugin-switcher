import { Groups, PluginInfo, QPSSettings } from "./types"
import Plugin from "./main"
import { QPSModal } from "./modal";
import { getLength } from "./utils";
import { Notice } from "obsidian";


export const reset = (modal: QPSModal) => {
    const { plugin } = modal
    const confirm = window.confirm("Reset most switched values?");
    if (confirm) {
        plugin.reset = true //if true reset done in modals addItems()
        getLength(plugin)
        modal.onOpen()
    } else {
        new Notice("operation cancelled")
    }
}

export const sortByName = (listItems: PluginInfo[]) => {
    listItems.sort((a, b) => a.name.localeCompare(b.name))
}

export const sortSwitched = (listItems: PluginInfo[]) => {
    listItems.sort((a, b) => b.switched - a.switched)
}

export const getGroupTitle = (_this: Plugin) => { // 🟡Group1....
    const numberOfGroups = _this.settings.numberOfGroups;
    const currentGroupKeys = Object.keys(Groups);

    // delete groups if new value < previous value (when moving slider in prefs)
    for (let i = 1; i < currentGroupKeys.length; i++) {
        const key = currentGroupKeys[i];
        delete Groups[key];
    }

    for (let i = 1; i <= numberOfGroups; i++) {
        if (_this.settings.groups[i]?.name === undefined)
            _this.settings.groups[i] = {
                name: "",
                delayed: false,
                time: 0
            };

        const groupKey = (_this.settings.groups[i]?.name !== "") ?
            _this.settings.groups[i]?.name : `Group${i}`;
        const { emoji } = getEmojiForGroup(i);
        // Groups[`Group${i}`] = `${emoji}${groupKey}`;
        Groups[`Group${i}`] = `${groupKey}`;
    }
}

export const getEmojiForGroup = (groupNumber: number) => {
    const emojis = ["🟡", "🔵", "🔴", "⚪️", "🟤", "🟢", "🟣"];
    const colors = ["#FFD700", "#0000FF", "#FF0000", "#FFFFFF", "#A52A2A", "#00FF00", "#800080"];
    return { emoji: emojis[groupNumber - 1], color: colors[groupNumber - 1] };
};

// export const getCircleGroup=(groupIndex: number) => {
//     const { color } = getEmojiForGroup(groupIndex);
//     const background = `background: ${color};`;

//     const content = `<div
//             style="${background}"
//             class="qps-item-line-group"
//             >
//             &nbsp;
//             </div>
//             `
//     return content
// }


export const togglePlugin = async (modal: QPSModal, pluginItem: PluginInfo) => {
    const { plugin } = modal
    const { settings } = plugin

    pluginItem.enabled = !pluginItem.enabled;
    pluginItem.enabled
        ? await conditionalEnable(modal, pluginItem)
        : await (modal.app as any).plugins.disablePluginAndSave(pluginItem.id);
    getLength(plugin)
    await plugin.saveSettings();
    modal.onOpen();
}

//desktop only
export async function openDirectoryInFileManager(shell: any, modal: QPSModal, pluginItem: PluginInfo) {
    const filePath = (modal.app as any).vault.adapter.getFullPath(pluginItem.dir);
    try {
        await shell.openExternal(filePath);
    } catch (err) {
        console.error(`Error opening the directory: ${err.message}`);
    }
}

export const delayedReEnable = async (_this: QPSModal, pluginItem: PluginInfo) => {
    const { settings } = _this.plugin
    if (pluginItem.enabled) {
        await (_this.app as any).plugins.disablePluginAndSave(pluginItem.id)
        await (_this.app as any).plugins.enablePlugin(pluginItem.id)
    }
}

export const conditionalEnable = async (_this:any, pluginItem: PluginInfo) => {
    if (pluginItem.delayed) {
        await (_this.app as any).plugins.enablePlugin(pluginItem.id)
    } else {
        pluginItem.switched++;// besoin que là?
        await (_this.app as any).plugins.enablePluginAndSave(pluginItem.id)
    }
}

export const selectValue = (input:HTMLInputElement | null)=> {
    input?.setSelectionRange(0, input?.value.length);
}