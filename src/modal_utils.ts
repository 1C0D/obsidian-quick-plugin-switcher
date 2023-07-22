import { Groups, PluginInfo } from "./interfaces";
import Plugin from "./main";
import { QPSModal } from "./modal";
import { getLength } from "./utils";
import { Menu, Notice } from "obsidian"
// import { shell } from 'electron';    
let shell: any = null;
try {
    const electron = require("electron");
    shell = electron.shell;
} catch {
    console.debug("electron not found");
}
import { DescriptionModal } from "./secondary_modals";


export const reset = (modal: QPSModal,plugin: Plugin) => {
    plugin.reset = true //if true reset done in modals addItems()
    getLength(plugin)
    modal.onOpen()
}

export const doSearch = (plugin: Plugin, value: string) => {
    const listItems = []
    // search process
    for (const i of plugin.settings.allPluginsList) {
        if (i.name.toLowerCase().includes(value.toLowerCase()) ||
            value.length > 1 && value[value.length - 1] == " " &&
            i.name.toLowerCase().startsWith(value.trim().toLowerCase())) {
            listItems.push(i)
        }
    }
    return listItems
}

export const sortByName = (listItems: PluginInfo[]) => {
    listItems.sort((a, b) => a.name.localeCompare(b.name))
}

export const sortSwitched = (listItems: PluginInfo[]) => {
    listItems.sort((a, b) => b.switched - a.switched)
}

export const handleContextMenu = (evt: MouseEvent, modal: QPSModal, plugin: Plugin, itemContainer: HTMLDivElement, pluginItem: PluginInfo) => {
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
    ).addSeparator()
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
                pluginItem.group = 0
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
                            i.group = 0;
                        }
                        modal.onOpen();
                        new Notice("All groups have been reset.");
                    } else { new Notice("Operation cancelled."); }
                });
        });
        addRemoveGroupMenuItems(submenu, plugin, modal);
    });
    menu.showAtMouseEvent(evt);

}

export const handleHotkeys = (event: MouseEvent, modal: QPSModal, itemContainer: HTMLDivElement, pluginItem: PluginInfo) => {
    const numberOfGroups = modal.plugin.settings.numberOfGroups;
    const keyToGroupMap: Record<string, number> = {};

    // Generate keyToGroupMap based on the number of groups available
    for (let i = 0; i <= numberOfGroups; i++) {
        keyToGroupMap[i.toString()] = i;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
        event.stopPropagation();
        const keyPressed = event.key;
        if (keyPressed in keyToGroupMap) {
            pluginItem.group = parseInt(keyPressed);
        } else if (keyPressed === "Delete" || keyPressed === "Backspace") {
            pluginItem.group = 0;
        }
        document.removeEventListener('keydown', handleKeyDown);
        modal.onOpen();
    }

    const handleMouseLeave = (event: MouseEvent) => {
        document.removeEventListener('keydown', handleKeyDown);
        itemContainer.removeEventListener('mouseleave', handleMouseLeave);
    }

    document.addEventListener('keydown', handleKeyDown);
    itemContainer.addEventListener('mouseleave', handleMouseLeave);
};


function addRemoveGroupMenuItems(submenu: Menu, plugin: Plugin, modal: QPSModal) {
    const {settings} = plugin
    Object.keys(Groups).forEach((groupKey) => {
        const groupIndex = Object.keys(Groups).indexOf(groupKey);
        const lengthGroup = settings.allPluginsList.
            filter((i) => i.group === groupIndex).length
        if (groupKey !== "SelectGroup" && lengthGroup) {
            const groupValue = Groups[groupKey as keyof typeof Groups];
            const groupIndex = Object.keys(Groups).indexOf(groupKey);
            submenu.addItem((subitem) => {
                subitem
                    .setTitle(`Clear ${groupValue}`)
                    .onClick(async () => {
                        let pluginsRemoved = false;
                        for (const i of settings.allPluginsList) {
                            if (i.group === groupIndex) {
                                i.group = 0;
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

function addToGroupMenuItems(submenu: Menu, pluginItem: PluginInfo, modal: QPSModal) {
    Object.keys(Groups).forEach((groupKey) => {
        const groupValue = Groups[groupKey as keyof typeof Groups];
        if (groupKey !== "SelectGroup") {
            submenu.addItem((item) =>
                item
                    .setTitle(groupValue)
                    .onClick(() => {
                        const groupIndex = Object.keys(Groups).indexOf(groupKey);
                        pluginItem.group = groupIndex;
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
        console.debug('Directory opened in the file manager.');
    } catch (err) {
        console.error(`Error opening the directory: ${err.message}`);
    }
}