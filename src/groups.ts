import { DropdownComponent, Menu, Notice } from "obsidian";
import { CPModal, getManifest } from "./community-plugins_modal";
import { QPSModal } from "./main_modal";
import { createInput, reOpenModal, conditionalEnable, isInstalled } from "./modal_utils";
import { Filters, Groups, CommFilters, GroupsComm } from "./types/variables";
import { removeItem } from "./utils";
import { createClearGroupsMenuItem, hideOnCLick } from "./modal_components";
import { PluginCommInfo, PluginInstalled, StringString } from "./global";

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
        getDropdownOptions(GroupsComm, Object.keys(settings.commPlugins).length);
    }

    function getDropdownOptions(groups: StringString, length: number) {
        const dropdownOptions: StringString = {};
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
                await reOpenModal(modal);
            });
    }
};

export const addDelayToGroup = (
    modal: QPSModal,
    groupNumber: number,
    span: HTMLElement,
    inGroup: string[]
) => {
    const { plugin } = modal;
    const { settings } = plugin;
    const currentValue = (
        settings.groups[groupNumber]?.time || 0
    ).toString();
    const input = createInput(span, currentValue);
    if (!input) return;

    input.onblur = async () => {
        await setDelay(input, settings, groupNumber, span, modal);
    }

    input.onkeydown = async (event) => {
        if (event.key === "Enter") {
            await setDelay(input, settings, groupNumber, span, modal);
        }
    }

    const setDelay = async (input: HTMLInputElement, settings: any, groupNumber: number, span: HTMLElement, modal: CPModal | QPSModal) => {
        // setTimeout to avoid input from being cleared before the input is set
        const value = parseInt(input.value) || 0;
        settings.groups[groupNumber].time = value;
        span.textContent = `${value}`;
        if (inGroup.length) {
            await applyGroupDelay(inGroup, groupNumber, modal);
        }
        await reOpenModal(modal);

    }

}

const applyGroupDelay = async (inGroup: string[], groupNumber: number, modal: CPModal | QPSModal) => {
    const { plugin } = modal;
    const { settings } = plugin;
    const { installed } = settings
    for (const id of inGroup) {
        installed[id].time = settings.groups[groupNumber]?.time;
        const condition = !!installed[id].time
        installed[id].delayed = condition;
        settings.groups[groupNumber].applied = condition;
        if (installed[id].enabled) {
            await modal.app.plugins.disablePluginAndSave(id);
            condition ? await modal.app.plugins.enablePlugin(id) : await modal.app.plugins.enablePluginAndSave(id);
            installed[id].enabled = true
        }
    }
}

const groupMenuQPS = (
    evt: MouseEvent,
    modal: QPSModal,
    groupNumber: number,
    span: HTMLSpanElement
) => {
    const { plugin } = modal;
    const { settings } = plugin;
    const { installed } = settings
    const inGroup = getPluginsInGroup(modal, groupNumber);
    const menu = new Menu();
    menu.addItem((item) =>
        item.setTitle("Delay group (or dblclick icon)").onClick(() => {
            addDelayToGroup(modal, groupNumber, span, inGroup);
        })
    );

    menu.addSeparator();
    menu.addItem((item) =>
        item.setTitle("Show/hide group content").onClick(async () => {
            await hideOnCLick(modal, groupNumber, inGroup)

        })
    );
    menu.addSeparator();
    const toEnable = inGroup.filter((id) => installed[id].enabled === false);
    menu.addItem((item) =>
        item
            .setTitle("Enable all plugins in group")
            .setDisabled(!inGroup.length || !toEnable.length)
            .onClick(async () => {
                if (toEnable) {
                    await Promise.all(
                        toEnable.map(async (id) => {
                            conditionalEnable(modal, id);
                            installed[id].enabled = true;
                            modal.plugin.saveSettings();
                        })
                    );

                    plugin.getLength();
                    new Notice("All plugins enabled.", 2500);
                    await reOpenModal(modal);
                }
            })
    );

    const toDisable = inGroup.filter((id) => installed[id].enabled === true);
    menu.addItem((item) =>
        item
            .setTitle("Disable all plugins in group")
            .setDisabled(!inGroup.length || !toDisable.length)
            .onClick(async () => {
                if (toDisable) {
                    await Promise.all(
                        toDisable.map(async (id) => {
                            (modal.app as any).plugins.disablePluginAndSave(
                                id
                            );
                            installed[id].enabled = false;
                        })
                    );

                    plugin.getLength();
                    new Notice("All plugins disabled.", 2500);
                    await reOpenModal(modal);
                }
            })
    );
    menu.addSeparator();
    createClearGroupsMenuItem(modal, menu, groupNumber);

    menu.showAtMouseEvent(evt);
};


const groupMenuCPM = async (evt: MouseEvent, modal: CPModal, groupNumber: number) => {
    const menu = new Menu();
    menu.addItem((item) => {
        item.setTitle("Install & enable in group");
        item.onClick(async () => {
            const inGroup = getPluginsInGroup(
                modal,
                groupNumber
            );

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
            );

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
    if (modal.app.isMobile) {
        menu.addSeparator();
        const inGroup = getPluginsInGroup(
            modal,
            groupNumber
        );
        menu.addItem((item) =>
            item.setTitle("Show/hide group content").onClick(async () => {
                await hideOnCLick(modal, groupNumber, inGroup)

            })
        );
    }

    menu.addSeparator();
    createClearGroupsMenuItem(modal, menu, groupNumber);

    menu.showAtMouseEvent(evt);
};

export const groupMenu = async (
    evt: MouseEvent,
    modal: QPSModal | CPModal,
    groupNumber: number,
    span?: HTMLSpanElement
) => {
    if (modal instanceof QPSModal && span) {
        groupMenuQPS(evt, modal, groupNumber, span);
    } else {
        await groupMenuCPM(evt, modal as CPModal, groupNumber);
    }
};

async function uninstallAllPluginsInGroup(modal: CPModal, groupNumber: number) {
    const inGroup = getPluginsInGroup(modal, groupNumber);

    if (!inGroup.length) return;
    const { plugin } = modal;
    const { settings } = plugin;
    const { commPlugins } = settings
    for (const id of inGroup) {
        if (!isInstalled(id)) continue;
        await this.app.plugins.uninstallPlugin(id);
        new Notice(`${commPlugins[id].name} uninstalled`, 2500);
    }
    await reOpenModal(modal);
}

export async function installAllPluginsInGroup(
    modal: CPModal,
    inGroup: string[],
    enable = false
) {
    const { plugin } = modal;
    const { settings } = plugin;
    const { commPlugins } = settings
    for (const id of inGroup) {
        if (isInstalled(id)) {
            new Notice(`${commPlugins[id].name} already installed`, 2500);
            continue;
        }
        const manifest = await getManifest(modal, id);
        if (!manifest) continue
        const lastVersion = manifest.version
        await this.app.plugins.installPlugin(commPlugins[id].repo, lastVersion, manifest);
        if (enable) {
            await modal.app.plugins.enablePluginAndSave(id);
            new Notice(`${commPlugins[id].name} enabled`, 2500);
        }
    }
    await reOpenModal(modal);
}

export const getPluginsInGroup = (
    modal: QPSModal | CPModal,
    groupNumber: number
): string[] => {
    const { plugin } = modal;
    const { settings } = plugin;
    const { installed, commPlugins } = settings
    if (modal instanceof QPSModal)
        return Object.keys(installed).filter(
            (id) =>
                installed[id].groupInfo.groupIndices.indexOf(groupNumber) !== -1
        )
    else {
        return Object.keys(commPlugins).filter(
            (id) =>
                commPlugins[id].groupCommInfo.groupIndices.indexOf(groupNumber) !== -1
        )
    }
};


export const setGroupTitle = (
    modal: QPSModal | CPModal,
    Groups: StringString,
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
    modal: QPSModal | CPModal,
    submenu: Menu,
    pluginItem: PluginInstalled | PluginCommInfo,
    alt?: boolean
) {
    const { plugin } = modal
    const { settings } = plugin;
    Object.keys(Groups).forEach((groupKey) => {
        const { lengthGroup, groupIndex, groupValue } = getGroupIndexLength(
            modal,
            groupKey
        );
        const isQPS = modal instanceof QPSModal;
        const getGroup =
            isQPS ? (pluginItem as PluginInstalled).groupInfo?.groupIndices.indexOf(groupIndex) !== -1 : (pluginItem as PluginCommInfo).groupCommInfo?.groupIndices.indexOf(groupIndex) !== -1;
        if (groupKey !== "SelectGroup" && lengthGroup && getGroup) {
            let value = alt ? `remove ${groupValue}` : `${groupValue}`
            submenu.addItem((subitem) => {
                subitem.setTitle(value).onClick(async () => {
                    const indexes = isQPS ? (pluginItem as PluginInstalled).groupInfo?.groupIndices : (pluginItem as PluginCommInfo).groupCommInfo?.groupIndices
                    removeItem(indexes, groupIndex);
                    if (groupIsEmpty(groupIndex, modal)) {
                        settings.selectedGroup = "SelectGroup";
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
    const { installed, commPlugins } = settings
    let lengthGroup, groupValue;
    if (modal instanceof QPSModal) {
        lengthGroup = Object.keys(installed).filter(
            (id) => installed[id].groupInfo.groupIndices.indexOf(groupIndex) !== -1
        ).length;
        groupValue = Groups[groupKey as keyof typeof Groups];
    } else {
        lengthGroup = Object.keys(commPlugins).filter(
            (id) => commPlugins[id].groupCommInfo.groupIndices.indexOf(groupIndex) !== -1
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
    const { installed, commPlugins, groups, groupsComm } = settings

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
                    for (const id in installed) {
                        const index =
                            installed[id].groupInfo.groupIndices.indexOf(groupNumber);
                        if (index !== -1) {
                            if (groups[groupNumber].hidden) {
                                groups[groupNumber].hidden = false
                                installed[id].groupInfo.hidden = false
                            }
                            installed[id].groupInfo.groupIndices.splice(index, 1);
                            pluginsRemoved = true;
                        }
                    }
                } else {
                    for (const id in commPlugins) {
                        const index =
                            commPlugins[id].groupCommInfo.groupIndices.indexOf(groupNumber);
                        if (index !== -1) {
                            if (groupsComm[groupNumber].hidden) {
                                groupsComm[groupNumber].hidden = false
                                commPlugins[id].groupCommInfo.hidden = false
                            }
                            commPlugins[id].groupCommInfo.groupIndices.splice(index, 1);
                            pluginsRemoved = true;
                        }
                    }
                }
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
    pluginItem: PluginInstalled | PluginCommInfo,
    modal: QPSModal | CPModal,
    alt?: boolean
) => {
    Object.entries(Groups).forEach(([key, value]) => {
        const groupIndices = (modal instanceof QPSModal) ? (pluginItem as PluginInstalled).groupInfo.groupIndices : (pluginItem as PluginCommInfo).groupCommInfo.groupIndices;
        const groupIndex = getIndexFromSelectedGroup(key);
        if (key !== "SelectGroup") {
            if (alt) {
                value = `add to ${value}`
            }
            const { groups, installed } = modal.plugin.settings
            submenu.addItem((item) =>
                item
                    .setTitle(value)
                    .setDisabled(groupIndices.indexOf(groupIndex) !== -1)
                    .onClick(async () => {
                        if (groupIndices.length === 6) return;
                        groupIndices?.push(groupIndex);
                        if (groups[groupIndex].hidden)
                            installed[pluginItem.id].groupInfo.hidden = true
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
                await reOpenModal(modal);
            }
        }, 100);
    };

    const input = createInput(span, currentValue);
    if (!input) return
    input.onblur = handleBlurOrEnter;
    input.onkeydown = (event) => {
        if (event.key === "Enter") {
            handleBlurOrEnter();
        }
    }
};

export const getEmojiForGroup = (groupNumber: number) => {
    const emojis = ["🟡", "🔵", "🔴", "⚪️", "🟣", "🟢",];
    const colors = [
        "#FFD700",
        "#0000FF",
        "#FF0000",
        "#FFFFFF",
        "#800080",
        "#00FF00",
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
    const { installed, commPlugins } = settings
    if (modal instanceof QPSModal) {
        return !Object.keys(installed).some(
            (id) =>
                installed[id].groupInfo.groupIndices.indexOf(groupIndex) !== -1
        );
    } else {
        return !Object.keys(commPlugins).some(
            (id) =>
                commPlugins[id].groupCommInfo.groupIndices.indexOf(groupIndex) !== -1
        );
    }
}

export function groupNameFromIndex(groups: StringString, index: number) {
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
    pluginItem: PluginInstalled | PluginCommInfo
) {
    const { plugin } = modal;
    if ("repo" in pluginItem) {
        pluginItem.groupCommInfo.groupIndices = []
        plugin.settings.selectedGroupComm = "SelectGroup";
    } else {
        pluginItem.groupInfo.groupIndices = [];
        plugin.settings.selectedGroup = "SelectGroup";
    }
    await reOpenModal(modal);
}

export function groupNbFromEmoticon(el: HTMLElement) {
    const groupNameEl = el.nextElementSibling
    return parseInt(groupNameEl?.querySelector("span")?.textContent ?? "")
}

export function groupNbFromGrpName(groupName: string | undefined) {
    return parseInt(groupName?.match(/\((\d+)\)$/)?.[1] as string);
}