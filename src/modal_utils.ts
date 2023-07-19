import { PluginInfo } from "./interfaces";
import Plugin from "./main";
import { QPSModal } from "./modal";
import { getLength } from "./utils";
import { Menu } from "obsidian"
import { shell } from 'electron';
import { DescriptionModal } from "./secondary_modals";



export const reset = (plugin: Plugin, modal: QPSModal) => {
    plugin.reset = true //if true reset in modals.addItems
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

export const sortSwitched = (listItems: PluginInfo[]) => {//spéarer en sous fonction pour d'autres filtres
    listItems.sort((a, b) => b.switched - a.switched)
}


export const itemsContextMenu = (plugin: Plugin, itemContainer: HTMLDivElement, pluginItem: PluginInfo) => {
    itemContainer.addEventListener("contextmenu", (evt: MouseEvent) => {
        evt.preventDefault();
        const menu = new Menu();
        menu?.addItem((item) =>
            item
                .setTitle("open plugin folder")
                .setIcon("folder-open")
                .onClick(() => {
                    openDirectoryInFileManager(plugin, pluginItem)
                })
        );
        menu?.addItem((item) =>
            item
                .setTitle("plugin description")
                .setIcon("text")
                .onClick(() => {
                    new DescriptionModal(plugin.app, plugin, pluginItem).open();
                })
        );
        menu.showAtMouseEvent(evt);
    })
}


//desktop only. Add some conditions
export const openDirectoryInFileManager = async (plugin: Plugin,pluginItem: PluginInfo) => {
    const filePath = (plugin.app as any).vault.adapter.getFullPath(pluginItem.dir);
    // const directoryPath = path.dirname(filePath);
    try {
        await shell.openExternal(filePath);
        // await shell.openPath(filePath);
        console.debug('Directory opened in the file manager.');
    } catch (err) {
        console.error(`Error opening the directory: ${err.message}`);
    }
}