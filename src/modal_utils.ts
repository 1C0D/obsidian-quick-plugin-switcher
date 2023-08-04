import { Groups, PluginInfo } from "./types"
import Plugin from "./main"


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