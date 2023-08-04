import { Groups, PluginInfo } from "./types"
import Plugin from "./main"
import { QPSModal } from "./modal";
import { getLength } from "./utils";
import { Notice } from "obsidian";   
let shell: any = null;
try {
    const electron = require("electron");
    shell = electron.shell;
} catch {
    console.debug("electron not found");
}


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
        const groupKey = `Group${i}`;
        const groupEmoji = getEmojiForGroup(i);
        Groups[groupKey] = `${groupEmoji}${groupKey}`;
    }
}

export const getEmojiForGroup = (groupNumber: number): string => {
    const emojis = ["🟡", "🟢", "🔵", "🟣", "🟤", "⚪️", "🔴"];
    return emojis[groupNumber - 1];
    // return emojis[groupNumber % emojis.length]
};


export const togglePluginAndSave = async (modal: QPSModal,pluginItem: PluginInfo) =>{
    const { plugin } = modal

    pluginItem.enabled = !pluginItem.enabled;
    pluginItem.enabled
        ? await (modal.app as any).plugins.enablePluginAndSave(pluginItem.id) //AndSave
        : await (modal.app as any).plugins.disablePluginAndSave(pluginItem.id);
    pluginItem.switched++;
    getLength(plugin)
    modal.onOpen();
    await plugin.saveSettings();
}

//desktop only
export async function openDirectoryInFileManager(plugin: Plugin, pluginItem: PluginInfo) {
    const filePath = (plugin.app as any).vault.adapter.getFullPath(pluginItem.dir);
    try {
        await shell.openExternal(filePath);
    } catch (err) {
        console.error(`Error opening the directory: ${err.message}`);
    }
}