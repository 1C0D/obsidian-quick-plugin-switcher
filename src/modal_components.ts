import { Filters, Groups, PluginInfo } from "./types";
import Plugin from "./main";
import { QPSModal } from "./modal";
import { Menu, Notice, ToggleComponent } from "obsidian"
// import { shell } from 'electron';    
let shell: any = null;
try {
    const electron = require("electron");
    shell = electron.shell;
} catch {
    console.debug("electron not found");
}
import { DescriptionModal } from "./secondary_modals";
import { sortByName, sortSwitched } from "./modal_utils";


export const doSearch = (_this: Plugin, value: string) => {
    const listItems = []
    // search process
    for (const i of _this.settings.allPluginsList) {
        if (i.name.toLowerCase().includes(value.toLowerCase()) ||
            value.length > 1 && value[value.length - 1] == " " &&
            i.name.toLowerCase().startsWith(value.trim().toLowerCase())) {
            listItems.push(i)
        }
    }
    return listItems
}


export const modeSort = (_this: Plugin, listItems: PluginInfo[]) => {
    const { settings } = _this
    // after reset MostSwitched
    if (_this.reset) {
        const allPluginsList = settings.allPluginsList
        allPluginsList.forEach(i => {
            i.switched = 0
        })
        _this.reset = false
    }
    // EnabledFirst
    if (settings.filters === Filters.EnabledFirst) {
        const enabledItems = listItems.filter(i => i.enabled)
        const disabledItems = listItems.filter(i => !i.enabled)
        sortByName(enabledItems)
        sortByName(disabledItems)
        listItems = [...enabledItems, ...disabledItems]
    }
    // ByGroup
    else if (settings.filters === Filters.ByGroup) {
        const groupsIndex = Object.keys(Groups).indexOf(settings.selectedGroup as string);
        if (groupsIndex !== 0) {
            const groupedItems = listItems.filter(i => i.groupInfo.groupIndex === groupsIndex);
            listItems = groupedItems;
            sortByName(listItems);
        }
    }
    // MostSwitched
    else if (settings.filters === Filters.MostSwitched) { // && !plugin.reset
        sortByName(listItems)
        sortSwitched(listItems)

    }
    // All
    else {
        sortByName(listItems)
    }

    return listItems
}


// un param inutilisé
export const handleContextMenu = (evt: MouseEvent, modal: QPSModal, plugin: Plugin, pluginItem: PluginInfo) => {
    evt.preventDefault();
    const menu = new Menu();
    if (shell) {
        menu.addItem((item) =>
            item
                .setTitle("Open plugin folder")
                .setIcon("folder-open")
                .onClick(() => {
                    openDirectoryInFileManager(plugin, pluginItem)
                })
        );
    }
    menu.addItem((item) =>
        item
            .setTitle("Plugin description")
            .setIcon("text")
            .onClick(() => {
                new DescriptionModal(plugin.app, plugin, pluginItem).open();
            })
    )
    if (pluginItem.id !== "quick-plugin-switcher") {
        menu.addSeparator()
        menu.addItem((item) => {
            item
                .setTitle("Add to group")
                .setIcon("user")
            const submenu = (item as any).setSubmenu() as Menu;
            addToGroupMenuItems(submenu, pluginItem, modal);
        })
        menu.addItem((item) =>
            item
                .setTitle("Remove from group")
                .setIcon("user-minus")
                .onClick(() => {
                    pluginItem.groupInfo.groupIndex = 0
                    modal.onOpen()
                })
        ).addSeparator();
        menu.addItem((item) => {
            item
                .setTitle("Clear groups")
                .setIcon("user-minus")

            const submenu = (item as any).setSubmenu() as Menu;
            submenu.addItem((subitem) => {
                subitem
                    .setTitle("All groups")
                    .onClick(async () => {
                        const confirmReset = window.confirm('Do you want to reset all groups?');
                        if (confirmReset) {
                            for (const i of plugin.settings.allPluginsList) {
                                i.groupInfo.groupIndex = 0;
                            }
                            modal.onOpen();
                            new Notice("All groups have been reset.");
                        } else { new Notice("Operation cancelled."); }
                    });
            });
            addRemoveGroupMenuItems(modal, submenu, plugin);
        })
    }
    menu.showAtMouseEvent(evt);

}

export const togglePluginButton = (modal: QPSModal, pluginItem: PluginInfo, itemContainer: HTMLDivElement) => {
    let disable = (pluginItem.id === "quick-plugin-switcher")
    new ToggleComponent(itemContainer)
        .setValue(pluginItem.enabled)
        .setDisabled(disable) //quick-plugin-switcher disabled
        .onChange(async () => {
            await modal.togglePluginAndSave(pluginItem)
        })
}

function addRemoveGroupMenuItems(modal: QPSModal, submenu: Menu, plugin: Plugin) {
    const { settings } = plugin
    Object.keys(Groups).forEach((groupKey) => {
        const groupIndex = Object.keys(Groups).indexOf(groupKey);
        const lengthGroup = settings.allPluginsList.
            filter((i) => i.groupInfo.groupIndex === groupIndex).length
        if (groupKey !== "SelectGroup" && lengthGroup) {
            const groupValue = Groups[groupKey as keyof typeof Groups];
            const groupIndex = Object.keys(Groups).indexOf(groupKey);
            submenu.addItem((subitem) => {
                subitem
                    .setTitle(`Clear ${groupValue}`)
                    .onClick(async () => {
                        let pluginsRemoved = false;
                        for (const i of settings.allPluginsList) {
                            if (i.groupInfo.groupIndex === groupIndex) {
                                i.groupInfo.groupIndex = 0;
                                pluginsRemoved = true;
                            }
                        }
                        modal.onOpen();
                        if (pluginsRemoved) {
                            new Notice(`All plugins removed from ${groupValue}.`);
                        } else {
                            new Notice(`No plugins found in ${groupValue} group.`);
                        }
                    });
            });
        }
    });
}

const addToGroupMenuItems = (submenu: Menu, pluginItem: PluginInfo, modal: QPSModal) => {
    Object.entries(Groups).forEach(([key, value]) => {
        if (key !== "SelectGroup") {
            submenu.addItem((item) =>
                item
                    .setTitle(value)
                    .onClick(() => {
                        const groupIndex = Object.keys(Groups).indexOf(key);
                        pluginItem.groupInfo.groupIndex = groupIndex;
                        modal.onOpen();
                    })
            );
        }
    });
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