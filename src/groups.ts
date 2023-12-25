import { DropdownComponent, GroupData, Menu, Notice, PluginCommInfo, PluginInfo } from "obsidian";
import { CPModal, getManifest } from "./community-plugins_modal";
import { QPSModal } from "./main_modal";
import { createInput, reOpenModal, conditionalEnable, isInstalled, getLatestPluginVersion } from "./modal_utils";
import { Filters, Groups, CommFilters, GroupsComm, SortBy } from "./types/variables";
import { removeItem } from "./utils";
import { createClearGroupsMenuItem } from "./modal_components";

export const getFilters = (
    modal: CPModal,
    contentEl: HTMLElement
) => {
    const { plugin } = modal;
    const { settings } = plugin;
    if (settings.filtersComm === CommFilters.ByGroup) return
    const dropdownOptions: Record<string, string> = {}
    for (const key in SortBy) {
        dropdownOptions[key] = SortBy[key as keyof typeof SortBy]
    }
    new DropdownComponent(contentEl)
        .addOptions(dropdownOptions)
        .setValue(settings.sortBy)
        .onChange(async (value: keyof typeof SortBy) => {
            settings.sortBy = value;
            await plugin.saveSettings();
            await reOpenModal(modal);
        });
}

export const byGroupDropdowns = (
    modal: QPSModal | CPModal,
    contentEl: HTMLElement
) => {
    const { plugin } = modal;
    const { settings } = plugin;

    if (modal instanceof QPSModal && settings.filters === Filters.ByGroup) {
        getDropdownOptions(Groups, plugin.lengthAll);
    } else if (
        modal instanceof CPModal &&
        settings.filtersComm === CommFilters.ByGroup
    ) {
        getDropdownOptions(GroupsComm, settings.commPlugins.length);
    }

    function getDropdownOptions(groups: GroupData, length: number) {
        const dropdownOptions: Record<string, string> = {};
        for (const groupKey in groups) {
            const groupIndex = getIndexFromSelectedGroup(groupKey);
            if (groupKey === "SelectGroup") {
                dropdownOptions[groupKey] = groups[groupKey] + `(${length})`;
            } else if (!groupIsEmpty(groupIndex, modal)) {
                dropdownOptions[groupKey] =
                    getEmojiForGroup(groupIndex).emoji + groups[groupKey];
            }
        }
        new DropdownComponent(contentEl)
            .addOptions(dropdownOptions)
            .setValue(settings.selectedGroup)
            .onChange(async (value) => {
                settings.selectedGroup = value;
                await plugin.saveSettings();
                await reOpenModal(modal);
            });
    }
};

const groupMenuQPS = (
    evt: MouseEvent,
    modal: QPSModal,
    groupNumber: number,
    span: HTMLSpanElement
) => {
    const { plugin } = modal;
    const { settings } = plugin;
    const inGroup = getPluginsInGroup(modal, groupNumber) as PluginInfo[];
    const menu = new Menu();
    menu.addItem((item) =>
        item.setTitle("Delay group").onClick(() => {
            const currentValue = (
                settings.groups[groupNumber]?.time || 0
            ).toString();
            const input = createInput(span, currentValue);
            if (!input) return;

            const handleBlurOrEnter = () => {
                setTimeout(async () => {
                    if (!modal.isDblClick) {
                        const value = parseInt(input.value) || 0;
                        settings.groups[groupNumber].time = value;
                        span.textContent = `${value}`;
                        if (modal instanceof CPModal) {
                            await reOpenModal(modal);
                        } else if (modal instanceof QPSModal) {
                            await reOpenModal(modal);
                        }
                    }
                }, 100);
            };

            input.addEventListener("blur", handleBlurOrEnter);
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    handleBlurOrEnter();
                }
            });
        })
    );

    menu.addItem((item) =>
        item
            .setTitle("Apply")
            .setDisabled(
                !inGroup.length || settings.groups[groupNumber]?.time === 0
            )
            .onClick(async () => {
                for (const plugin of inGroup) {
                    plugin.time = settings.groups[groupNumber]?.time;
                    plugin.delayed = true;
                    settings.groups[groupNumber].applied = true;
                    if (plugin.enabled) {
                        await (modal.app as any).plugins.disablePluginAndSave(
                            plugin.id
                        );
                        await (modal.app as any).plugins.enablePlugin(
                            plugin.id
                        );
                    }
                    modal.plugin.saveSettings();
                    await reOpenModal(modal);
                }
            })
    );
    menu.addItem((item) =>
        item
            .setTitle("Reset")
            .setDisabled(
                !inGroup.length || settings.groups[groupNumber]?.time === 0
            )
            .onClick(async () => {
                for (const plugin of inGroup) {
                    plugin.time = 0;
                    plugin.delayed = false;
                    settings.groups[groupNumber].applied = false;
                    if (plugin.enabled) {
                        await (modal.app as any).plugins.enablePluginAndSave(
                            plugin.id
                        );
                    }
                    await reOpenModal(modal);
                }
                plugin.saveSettings();
            })
    );
    menu.addSeparator();
    const toEnable = inGroup.filter((i: PluginInfo) => i.enabled === false);
    menu.addItem((item) =>
        item
            .setTitle("Enable all plugins in group")
            .setDisabled(!inGroup.length || !toEnable.length)
            .onClick(async () => {
                if (toEnable) {
                    await Promise.all(
                        toEnable.map(async (i: PluginInfo) => {
                            conditionalEnable(modal, i);
                            i.enabled = true;
                            modal.plugin.saveSettings();
                        })
                    );

                    plugin.getLength();
                    new Notice("All plugins enabled.", 2500);
                    await modal.plugin.saveSettings();
                    await reOpenModal(modal);
                }
            })
    );

    const toDisable = inGroup.filter((i: PluginInfo) => i.enabled === true);
    menu.addItem((item) =>
        item
            .setTitle("Disable all plugins in group")
            .setDisabled(!inGroup.length || !toDisable.length)
            .onClick(async () => {
                if (toDisable) {
                    await Promise.all(
                        toDisable.map(async (i: PluginInfo) => {
                            (modal.app as any).plugins.disablePluginAndSave(
                                i.id
                            );
                            i.enabled = false;
                        })
                    );

                    plugin.getLength();
                    new Notice("All plugins disabled.", 2500);
                    await modal.plugin.saveSettings();
                    await reOpenModal(modal);
                }
            })
    );
    menu.addSeparator();
    createClearGroupsMenuItem(modal, menu, groupNumber);

    menu.showAtMouseEvent(evt);
};

const groupMenuCPM = (evt: MouseEvent, modal: CPModal, groupNumber: number) => {
    const menu = new Menu();
    menu.addItem((item) => {
        item.setTitle("Install & enable in group");
        item.onClick(async () => {
            const inGroup = getPluginsInGroup(
                modal,
                groupNumber
            ) as PluginCommInfo[];

            if (!inGroup.length) return;
            await installAllPluginsInGroup(modal, inGroup, true);
        });
    });
    menu.addItem((item) => {
        item.setTitle("Install plugins in group");
        item.onClick(async () => {
            const inGroup = getPluginsInGroup(
                modal,
                groupNumber
            ) as PluginCommInfo[];

            if (!inGroup.length) return;
            await installAllPluginsInGroup(modal, inGroup);
        });
    });
    menu.addItem((item) => {
        item.setTitle("Uninstall plugins in group");
        item.onClick(async () => {
            await uninstallAllPluginsInGroup(modal, groupNumber);
        });
    });
    menu.addSeparator();
    createClearGroupsMenuItem(modal, menu, groupNumber);

    menu.showAtMouseEvent(evt);
};

export const groupMenu = (
    evt: MouseEvent,
    modal: QPSModal | CPModal,
    groupNumber: number,
    span?: HTMLSpanElement
) => {
    if (modal instanceof QPSModal && span) {
        groupMenuQPS(evt, modal, groupNumber, span);
    } else {
        groupMenuCPM(evt, modal as CPModal, groupNumber);
    }
};

async function uninstallAllPluginsInGroup(modal: CPModal, groupNumber: number) {
    const inGroup = getPluginsInGroup(modal, groupNumber);

    if (!inGroup.length) return;

    for (const plugin of inGroup) {
        if (!isInstalled(plugin)) continue;
        await this.app.plugins.uninstallPlugin(plugin.id);
        new Notice(`${plugin.name} uninstalled`, 2500);
    }

    await reOpenModal(modal);
}

export async function installAllPluginsInGroup(
    modal: CPModal,
    pluginList: PluginCommInfo[],
    enable = false
) {
    for (const plugin of pluginList) {
        if (isInstalled(plugin)) {
            new Notice(`${plugin.name} already installed`, 2500);
            continue;
        }
        const lastVersion = await getLatestPluginVersion(modal, plugin);
        const manifest = await getManifest(plugin);
        await this.app.plugins.installPlugin(plugin.repo, lastVersion, manifest);
        if (enable) {
            await (modal.app as any).plugins.enablePluginAndSave(plugin.id);
            new Notice(`${plugin.name} enabled`, 2500);
        }
    }
    await reOpenModal(modal);
}

export const getPluginsInGroup = (
    modal: QPSModal | CPModal,
    groupNumber: number
): PluginCommInfo[] | PluginInfo[] => {
    const { plugin } = modal;
    const { settings } = plugin;
    if (modal instanceof QPSModal)
        return settings.allPluginsList.filter(
            (i: PluginInfo) =>
                i.groupInfo.groupIndices.indexOf(groupNumber) !== -1
        ) as PluginInfo[]
    else {
        return settings.commPlugins.filter(
            (i: PluginCommInfo) =>
                i.groupCommInfo.groupIndices.indexOf(groupNumber) !== -1
        ) as PluginCommInfo[]
    }
};


export const setGroupTitle = (
    modal: QPSModal | CPModal,
    Groups: GroupData,
    numberOfGroups: number
) => {
    const { plugin } = modal
    const { settings } = plugin;
    const currentGroupKeys = Object.keys(Groups);

    // delete groups if new value < previous value (when moving slider in prefs)
    for (let i = 1; i < currentGroupKeys.length; i++) {
        const key = currentGroupKeys[i];
        delete Groups[key];
    }

    for (let i = 1; i <= numberOfGroups; i++) {
        if (modal instanceof CPModal) {
            if (!settings.groupsComm[i]) {
                settings.groupsComm[i] = {
                    name: "",
                    hidden: false
                };
            }
            const groupKey =
                settings.groupsComm[i]?.name
                    ? settings.groupsComm[i]?.name
                    : `Group${i}`;
            Groups[`Group${i}`] = `${groupKey}`;
        } else {
            if (!settings.groups[i]) {
                settings.groups[i] = {
                    name: "",
                    delayed: false,
                    time: 0,
                    applied: false,
                    hidden: false
                };
            }
            const groupKey =
                settings.groups[i]?.name
                    ? settings.groups[i]?.name
                    : `Group${i}`;
            Groups[`Group${i}`] = `${groupKey}`;
        }
    }
};

export function addRemoveItemGroupMenuItems(
    modal: QPSModal,
    submenu: Menu,
    pluginItem: PluginInfo
) {
    const { plugin } = modal
    const { settings } = plugin;
    Object.keys(Groups).forEach((groupKey) => {
        const { lengthGroup, groupIndex, groupValue } = getGroupIndexLength(
            modal,
            groupKey
        );
        const getGroup =
            pluginItem.groupInfo.groupIndices.indexOf(groupIndex) !== -1;
        if (groupKey !== "SelectGroup" && lengthGroup && getGroup) {
            submenu.addItem((subitem) => {
                subitem.setTitle(`${groupValue}`).onClick(async () => {
                    for (const index of pluginItem.groupInfo.groupIndices) {
                        if (index === groupIndex) {
                            removeItem(
                                pluginItem.groupInfo.groupIndices,
                                index
                            );
                            await plugin.saveSettings();
                            if (groupIsEmpty(groupIndex, modal)) {
                                settings.selectedGroup = "SelectGroup";
                            }
                            break;
                        }
                    }
                    await reOpenModal(modal);
                });
            });
        }
    });
}

const getGroupIndexLength = (modal: QPSModal | CPModal, groupKey: string) => {
    const groupIndex = getIndexFromSelectedGroup(groupKey);
    const { settings } = modal.plugin;
    let lengthGroup, groupValue;
    if (modal instanceof QPSModal) {
        lengthGroup = settings.allPluginsList.filter(
            (i) => i.groupInfo.groupIndices.indexOf(groupIndex) !== -1
        ).length;
        groupValue = Groups[groupKey as keyof typeof Groups];
    } else {
        lengthGroup = settings.commPlugins.filter(
            (i) => i.groupCommInfo.groupIndices.indexOf(groupIndex) !== -1
        ).length;
        groupValue = GroupsComm[groupKey as keyof typeof GroupsComm];
    }

    return { groupIndex, lengthGroup, groupValue };
};

export function addRemoveGroupMenuItems(
    modal: QPSModal | CPModal,
    submenu: Menu,
    groupNumber: number
) {
    const { plugin } = modal;
    const { settings } = plugin;
    let groupName;
    if (modal instanceof QPSModal) {
        groupName = groupNameFromIndex(Groups, groupNumber);
    } else {
        groupName = groupNameFromIndex(GroupsComm, groupNumber);
    }

    const { lengthGroup, groupValue } = getGroupIndexLength(modal, groupName!);
    if (groupName !== "SelectGroup" && lengthGroup) {
        submenu.addItem((subitem) => {
            subitem.setTitle(`${groupValue}`).onClick(async () => {
                let pluginsRemoved = false;
                if (modal instanceof QPSModal) {
                    for (const i of settings.allPluginsList) {
                        const index =
                            i.groupInfo.groupIndices.indexOf(groupNumber);
                        if (index !== -1) {
                            i.groupInfo.groupIndices.splice(index, 1);
                            pluginsRemoved = true;
                        }
                    }
                } else {
                    for (const i of settings.commPlugins) {
                        const index =
                            i.groupCommInfo.groupIndices.indexOf(groupNumber);
                        if (index !== -1) {
                            i.groupCommInfo.groupIndices.splice(index, 1);
                            pluginsRemoved = true;
                        }
                    }
                }
                await plugin.saveSettings();
                await reOpenModal(modal);
                if (pluginsRemoved) {
                    new Notice(`All plugins removed from ${groupValue}`, 2500);
                } else {
                    new Notice(`No plugins found in ${groupValue} group`, 2500);
                }
            });
        });
    }
}

export const addToGroupSubMenu = (
    submenu: Menu,
    pluginItem: PluginInfo,
    modal: QPSModal
) => {
    Object.entries(Groups).forEach(([key, value]) => {
        const groupIndices = pluginItem.groupInfo.groupIndices;
        const groupIndex = getIndexFromSelectedGroup(key);
        if (key !== "SelectGroup") {
            submenu.addItem((item) =>
                item
                    .setTitle(value)
                    .setDisabled(groupIndices.indexOf(groupIndex) !== -1)
                    .onClick(async () => {
                        if (groupIndices.length === 6) return;
                        groupIndices?.push(groupIndex);
                        await reOpenModal(modal);
                    })
            );
        }
    });
};

export const editGroupName = (
    modal: CPModal | QPSModal,
    span: HTMLSpanElement,
    groupNumber: number
) => {
    const { plugin } = modal;
    const { settings } = plugin;
    const currentValue =
        (modal instanceof CPModal
            ? settings.groupsComm[groupNumber]?.name || ""
            : settings.groups[groupNumber]?.name) || "";

    const updateGroupName = (value: string) => {
        if (modal instanceof CPModal) {
            settings.groupsComm[groupNumber].name =
                value || GroupsComm[groupNumber];
            span.textContent = settings.groupsComm[groupNumber].name;
        } else {
            settings.groups[groupNumber].name = value || Groups[groupNumber];
            span.textContent = settings.groups[groupNumber]?.name;
        }
    };

    const handleBlurOrEnter = () => {
        setTimeout(async () => {
            if (!modal.isDblClick && input) {
                updateGroupName(input.value);
                if (modal instanceof CPModal) {
                    await reOpenModal(modal);
                } else {
                    await reOpenModal(modal);
                }
            }
        }, 200);
    };

    const input = createInput(span, currentValue);

    if (input) {
        input.addEventListener("blur", handleBlurOrEnter);
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                handleBlurOrEnter();
            }
        });
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

export function groupIsEmpty(groupIndex: number, modal: QPSModal | CPModal) {
    const { plugin } = modal;
    const { settings } = plugin;
    if (modal instanceof QPSModal) {
        return !settings.allPluginsList.some(
            (plugin) =>
                plugin.groupInfo.groupIndices.indexOf(groupIndex) !== -1
        );
    } else {
        return !settings.commPlugins.some(
            (plugin) =>
                plugin.groupCommInfo.groupIndices.indexOf(groupIndex) !== -1
        );
    }
}

export function groupNameFromIndex(groups: GroupData, index: number) {
    for (let key in groups) {
        if (key.endsWith(index.toString())) {
            return key;
        }
    }
    return null;
}

export function getIndexFromSelectedGroup(str: string) {
    if (str === "SelectGroup") return 0;
    else return parseInt(str.slice(-1));
}

// removing groups ---------------
export async function rmvAllGroupsFromPlugin(
    modal: QPSModal | CPModal,
    pluginItem: PluginInfo | PluginCommInfo
) {
    const { plugin } = modal;
    if ("repo" in pluginItem) {
        pluginItem.groupCommInfo.groupIndices = [] 
        plugin.settings.selectedGroupComm = "SelectGroup";
    } else {
        pluginItem.groupInfo.groupIndices = [];
        plugin.settings.selectedGroup = "SelectGroup";       
    }
    await plugin.saveSettings();
    await reOpenModal(modal);
}

export function groupNbFromEmoticon(el: HTMLElement) {
    const groupNameEl = el.nextElementSibling
    return parseInt(groupNameEl?.querySelector("span")?.textContent ?? "")
}

export function groupNbFromGrpName(groupName: string | undefined) {
    return parseInt(groupName?.match(/\((\d+)\)$/)?.[1] as string);
}