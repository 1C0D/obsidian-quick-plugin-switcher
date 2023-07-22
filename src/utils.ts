import { Groups } from "./interfaces";
import Plugin from "./main";


export function isEnabled(name: string): boolean {
    return (this.app as any).plugins.enabledPlugins.has(name)
}

export const getEmojiForGroup = (groupNumber: number): string => {
    const emojis = ["🟡", "🟢", "🔵", "🟣", "🟤", "⚪️", "🔴"];
    return emojis[groupNumber - 1];
    // return emojis[groupNumber % emojis.length]
};

// if (_this.settings.allPluginsList.filter((plugin) => plugin.group === i).length) {
export const getNumberOfGroupsSettings = (_this: Plugin) => {
    const numberOfGroups = _this.settings.numberOfGroups;
    const currentGroupKeys = Object.keys(Groups);

    // delete groups if new value < previous value
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

export const getLength = (_this: Plugin) => {
    const { settings } = _this
    const allPluginsList = settings.allPluginsList || [];
    _this.lengthAll = allPluginsList.length
    _this.lengthEnabled = settings.allPluginsList.
        filter((plugin) => plugin.enabled).length
    _this.lengthDisabled = settings.allPluginsList.
        filter((plugin) => !plugin.enabled).length
}

// used for debug
export const debug = (_this: Plugin, pluginName = "", where = "") => {
    const manifestsKeys = Object.keys((_this.app as any).plugins.manifests);
    // const manifestsValues = Object.values(_this.app.plugins.manifests);
    // if (manifestsValues) console.log("manifestsValues", manifestsValues);
    if (manifestsKeys) {
        console.log("manifestsKeys", manifestsKeys);
        if (pluginName) {
            const isIn = manifestsKeys.includes(pluginName);
            const isEn = isEnabled(pluginName);
            console.log("From " + where + " ", "isInManifests", isIn, "enabled", isEn);
        }
    }
}
