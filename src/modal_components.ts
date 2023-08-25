import { Filters, Groups, PluginInfo, QPSSettings } from "./types";
import Plugin from "./main";
import { QPSModal } from "./modal";
import {
    ButtonComponent, DropdownComponent, ExtraButtonComponent,
    Menu, Notice, TextComponent, ToggleComponent
} from "obsidian"
import { DescriptionModal } from "./secondary_modals";
import {
    conditionalEnable,
    getEmojiForGroup,
    openDirectoryInFileManager,
    reset, sortByName, sortSwitched, togglePlugin
} from "./modal_utils";
import { getLength, removeItem } from "./utils";
let shell: any = null;
try {
    const electron = require("electron");
    shell = electron.shell;
} catch {
    console.debug("electron not found");
}

//addHeader /////////////////////////////////

export const mostSwitchedResetButton = (modal: QPSModal, contentEl: HTMLElement) => {
    const { settings } = modal.plugin
    if (settings.filters === Filters.MostSwitched &&
        settings.allPluginsList.some(
            plugin => plugin.switched !== 0)) {
        new ExtraButtonComponent(contentEl).setIcon("reset").setTooltip("Reset mostSwitched values")
            .onClick(async () => {
                reset(modal)
                modal.onOpen()
            })
    }
}

export const filterByGroup = (modal: QPSModal, contentEl: HTMLElement) => {
    const { plugin } = modal
    const { settings } = plugin
    if (settings.filters === Filters.ByGroup) {
        const dropdownOptions: { [key: string]: string } = {};
        // set dropdownOptions
        for (const groupKey in Groups) {
            const groupIndex = parseInt(groupKey.replace("Group", ""));
            if (groupKey === "SelectGroup"
            ) {
                dropdownOptions[groupKey] = Groups[groupKey]+`(${ plugin.lengthAll })`;
            } else if (settings.allPluginsList.
                some(plugin => plugin.groupInfo.groupIndices?.indexOf(groupIndex) !== -1)) {
                dropdownOptions[groupKey] = getEmojiForGroup(groupIndex).emoji + Groups[groupKey]
            }
        }
        // if a group is empty get back dropdown to SelectGroup
        const notEmpty = (settings.selectedGroup === "SelectGroup" ||
            settings.allPluginsList.some(plugin => {
                const groupIndex = parseInt((settings.selectedGroup as string).replace("Group", ""));
                return plugin.groupInfo.groupIndices?.indexOf(groupIndex) !== -1;
            })
        );
        
        new DropdownComponent(contentEl)
            .addOptions(dropdownOptions)
            .setValue(settings.selectedGroup as string)
            .onChange(async (value: QPSSettings['selectedGroup']) => {
                settings.selectedGroup = value;
                await plugin.saveSettings();
                modal.onOpen();
            });
    }
}

//addSearch /////////////////////////////////

export const doSearch = (_this: Plugin, value: string) => {
    const listItems: PluginInfo[] = []
    // search process
    for (const i of _this.settings.allPluginsList) {
        if (i.name.toLowerCase().includes(value.toLowerCase()) ||
            value.length > 1 && value[value.length - 1] === " " &&
            i.name.toLowerCase().startsWith(value.trim().toLowerCase())) {
            listItems.push(i)
        }
    }
    return listItems
}

export const powerButton = (modal: QPSModal, el: HTMLSpanElement) => {
    const { plugin } = modal
    const { settings } = plugin
    new ButtonComponent(el)
        .setIcon("power")
        .setCta()
        .setTooltip("toggle plugins options").buttonEl
        .addEventListener("click", (evt: MouseEvent) => {
            const menu = new Menu();
            if (plugin.lengthEnabled === 1 && settings.wasEnabled.length === 0) {
                menu.addItem((item) =>
                    item
                        .setTitle("No enabled plugins")
                )
            }
            else {
                menu.addItem((item) =>
                    item
                        .setTitle(settings.wasEnabled.length > 0 ? "Enable previous disabled plugins" : "Disable all plugins")
                        .setIcon(settings.wasEnabled.length > 0 ? "power" : "power-off")
                        .onClick(async () => {
                            // disable all except this plugin
                            if (plugin.lengthEnabled > 1) {
                                const confirmReset = window.confirm('Do you want to disable all plugins?');
                                if (confirmReset) {
                                    for (const i of settings.allPluginsList) {
                                        if (i.id === "quick-plugin-switcher") continue
                                        if (i.enabled) settings.wasEnabled.push(i.id)
                                        await (modal.app as any).plugins.disablePluginAndSave(i.id)
                                        i.enabled = false;
                                    }
                                    getLength(plugin)
                                    modal.onOpen();
                                    await plugin.saveSettings()
                                    new Notice("All plugins disabled.");
                                } else { new Notice("Operation cancelled."); }
                            }
                            else if (settings.wasEnabled.length > 0) {
                                for (const i of settings.wasEnabled) {
                                    //check plugin not deleted between
                                    const pluginToUpdate = settings.allPluginsList.find(plugin => plugin.id === i);
                                    if (pluginToUpdate) {
                                        conditionalEnable(modal, pluginToUpdate)
                                        pluginToUpdate.enabled = true
                                    }
                                }
                                getLength(plugin)
                                modal.onOpen()
                                settings.wasEnabled = []
                                new Notice("All plugins re-enabled.")
                                await modal.plugin.saveSettings()
                            }
                        })
                )
                if (settings.wasEnabled.length > 0) {
                    menu.addItem((item) =>
                        item
                            .setTitle("Skip re-enable")
                            .setIcon("reset")
                            .onClick(async () => {
                                const confirmReset = window.confirm('Delete data to re-enable plugins and return to disable state?');
                                if (confirmReset) {
                                    settings.wasEnabled = []
                                    await modal.plugin.saveSettings();
                                    new Notice("All values have been reset.");
                                } else { new Notice("Operation cancelled."); }
                            })
                    );
                }
                if (plugin.lengthEnabled > 1) {
                    menu.addSeparator()
                    menu.addItem((item) =>
                        item
                            .setTitle("Disable plugins by group")
                            .setDisabled(true)
                    )
                }
                Object.keys(Groups).forEach((groupKey) => {
                    if (groupKey === "SelectGroup") return
                    const groupValue = Groups[groupKey as keyof typeof Groups]
                    const groupIndex = Object.keys(Groups).indexOf(groupKey);
                    const inGroup = settings.allPluginsList.filter((plugin) => {
                        return plugin.groupInfo.groupIndices?.indexOf(groupIndex) !== -1;
                    });
                    let previousWasEnabled = inGroup.filter(
                        (i) => i.groupInfo.groupWasEnabled === true
                    )

                    if (inGroup.length > 0 && (inGroup.some(i => i.enabled === true) || previousWasEnabled.length > 0)) {
                        menu.addItem((item) =>
                            item
                                .setTitle(previousWasEnabled.length > 0 ? `re-enable ${groupValue}` : groupValue)
                                .setIcon(previousWasEnabled.length > 0 ? "power" : "power-off")
                                .onClick(async () => {
                                    if (previousWasEnabled.length === 0) {
                                        const toDisable = inGroup.filter(i => i.enabled === true).map(async (i) => {
                                            i.groupInfo.groupWasEnabled = true
                                            await (modal.app as any).plugins.disablePluginAndSave(i.id)
                                            i.enabled = false
                                        })
                                        await Promise.all(toDisable);
                                        if (toDisable) {
                                            getLength(plugin)
                                            modal.onOpen();
                                            new Notice("All plugins disabled.");
                                            await modal.plugin.saveSettings()
                                        }
                                    }
                                    else {
                                        for (const i of previousWasEnabled) {
                                            conditionalEnable(modal, i)
                                            i.enabled = true
                                            i.switched++

                                        }
                                        previousWasEnabled.map(plugin => {
                                            plugin.groupInfo.groupWasEnabled = false
                                        })
                                        getLength(plugin)
                                        modal.onOpen();
                                        new Notice("All plugins re-enabled.");
                                    }
                                }
                                ))
                        if (previousWasEnabled.length > 0) {
                            menu.addItem((item) =>
                                item
                                    .setTitle("Skip re-enable")
                                    .setIcon("reset")
                                    .onClick(async () => {
                                        const confirmReset = window.confirm('skip re-enable ?');
                                        if (confirmReset) {
                                            previousWasEnabled.map(plugin => {
                                                plugin.groupInfo.groupWasEnabled = false
                                            })
                                            await modal.plugin.saveSettings();
                                            new Notice("All values have been reset.");
                                        } else { new Notice("Operation cancelled."); }
                                    })
                            );
                        }
                    }
                }
                )
            }
            menu.showAtMouseEvent(evt);
        })

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
        const groupIndex = Object.keys(Groups).indexOf(settings.selectedGroup as string);
        if (groupIndex !== 0) {
            const groupedItems = listItems.filter(i => {
                return i.groupInfo.groupIndices?.indexOf(groupIndex) !== -1;
            });
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
export const itemToggleClass = (modal: QPSModal, pluginItem: PluginInfo, itemContainer: HTMLDivElement) => {
    const { settings } = modal.plugin
    if (pluginItem.id === "quick-plugin-switcher") {
        itemContainer.toggleClass("qps-quick-plugin-switcher", true);
    }
    if (settings.filters === Filters.MostSwitched && pluginItem.switched !== 0) {
        itemContainer.toggleClass("qps-most-switched", true);
    }
    if (pluginItem.delayed) {
        itemContainer.toggleClass("toggle-bullet-color", true);
        itemContainer.style.setProperty("--bullet-content", `"${pluginItem.time}"`);
    }

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
                    
                    openDirectoryInFileManager(shell, modal, pluginItem)
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
        menu.addItem((item) => {
            item
                .setTitle("Remove from group")
                .setIcon("user-minus");
            const submenu = (item as any).setSubmenu() as Menu;
            submenu.addItem((subitem) => {
                subitem
                    .setTitle("All groups")
                    .onClick(async () => {
                        const confirmReset = window.confirm('Detach all groups?');
                        if (confirmReset) {
                            pluginItem.groupInfo.groupIndices = [];
                            modal.onOpen();
                            // new Notice("No group on this plugin.");
                        } else { new Notice("Operation cancelled."); }
                    });
            });
            addRemoveItemGroupMenuItems(modal, submenu, plugin, pluginItem);
        })
            .addSeparator();
        menu.addItem((item) => {
            item
                .setTitle("Clear items groups")
                .setIcon("user-minus")

            const submenu = (item as any).setSubmenu() as Menu;
            submenu.addItem((subitem) => {
                subitem
                    .setTitle("All groups")
                    .onClick(async () => {
                        const confirmReset = window.confirm('Do you want to reset all groups?');
                        if (confirmReset) {
                            for (const i of plugin.settings.allPluginsList) {
                                i.groupInfo.groupIndices = [];
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

export const itemTogglePluginButton = (modal: QPSModal, pluginItem: PluginInfo, itemContainer: HTMLDivElement) => {
    let disable = (pluginItem.id === "quick-plugin-switcher")
    const toggleButton = new ToggleComponent(itemContainer)
        .setValue(pluginItem.enabled)
        .setDisabled(disable) //quick-plugin-switcher disabled
        .onChange(async () => {
            await togglePlugin(modal, pluginItem)
        })
}


export const itemTextComponent = (pluginItem: PluginInfo, itemContainer: HTMLDivElement) => {
    const isGrouped = pluginItem.groupInfo.groupIndices?.length;
    let customValue = pluginItem.name;
    if (isGrouped) {
        customValue = `${pluginItem.name}`;
    }

    const text = new TextComponent(itemContainer)
        .setValue(customValue)
        .inputEl

    return text
}

function addRemoveItemGroupMenuItems(modal: QPSModal, submenu: Menu, plugin: Plugin, pluginItem: PluginInfo) {
    const { settings } = plugin;
    Object.keys(Groups).forEach((groupKey) => {
        const { lengthGroup, groupIndex, groupValue } = getGroupIndexLength(settings, groupKey)
        const getGroup = pluginItem.groupInfo.groupIndices?.indexOf(groupIndex) !== -1;
        if (groupKey !== "SelectGroup" && lengthGroup && getGroup) {
            submenu.addItem((subitem) => {
                subitem
                    .setTitle(`${groupValue}`)
                    .onClick(async () => {
                        for (const index of pluginItem.groupInfo.groupIndices) {
                            if (index === groupIndex) {
                                removeItem(pluginItem.groupInfo.groupIndices, index);
                                break;
                            }
                        }
                        modal.onOpen();
                    });
            });
        }
    });
}

const getGroupIndexLength = (settings: QPSSettings, groupKey: string) => {
    const groupIndex = Object.keys(Groups).indexOf(groupKey);
    const lengthGroup = settings.allPluginsList.filter((i) =>
        i.groupInfo.groupIndices?.indexOf(groupIndex) !== -1
    ).length;
    const groupValue = Groups[groupKey as keyof typeof Groups];

    return { groupIndex, lengthGroup, groupValue };
}

function addRemoveGroupMenuItems(modal: QPSModal, submenu: Menu, plugin: Plugin) {
    const { settings } = plugin
    Object.keys(Groups).forEach((groupKey) => {
        const { lengthGroup, groupIndex, groupValue } = getGroupIndexLength(settings, groupKey)
        if (groupKey !== "SelectGroup" && lengthGroup) {
            submenu.addItem((subitem) => {
                subitem
                    .setTitle(`${groupValue}`)
                    .onClick(async () => {
                        let pluginsRemoved = false;
                        for (const i of settings.allPluginsList) {
                            const index = i.groupInfo.groupIndices?.indexOf(groupIndex);
                            if (index !== -1) {
                                i.groupInfo.groupIndices?.splice(index, 1);
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
                        if (pluginItem.groupInfo.groupIndices.length === 4) return
                        const groupIndex = Object.keys(Groups).indexOf(key);
                        pluginItem.groupInfo.groupIndices?.push(groupIndex);
                        modal.onOpen();
                    })
            );
        }
    });
}

