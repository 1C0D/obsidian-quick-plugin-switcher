import { App, DropdownComponent, Modal, SearchComponent, Setting } from "obsidian"
import { PluginInfo, QPSSettings } from "./types"
import { getLength, removeItem } from "./utils";
import QuickPluginSwitcher from "./main";
import {
    doSearch, handleContextMenu, modeSort,
    mostSwitchedResetButton, filterByGroup,
    powerButton, itemTogglePluginButton,
    folderOpenButton, itemToggleClass,
    itemTextComponent
} from "./modal_components";
import { getGroupTitle } from "./modal_utils";
import { RemoveFromGroupModal } from "./secondary_modals";

export class QPSModal extends Modal {
    header: HTMLElement
    items: HTMLElement
    search: HTMLElement
    // listItems: PluginInfo[] = []
    allPluginsList = this.plugin.settings.allPluginsList

    constructor(app: App, public plugin: QuickPluginSwitcher) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        getGroupTitle(this.plugin)
        this.container(contentEl)
        this.addHeader(this.header)
        this.addSearch(this.search)
        this.addItems(this.allPluginsList)
    }

    // create header/search/items elts & class
    container(contentEl: HTMLElement) {
        this.header = contentEl.createEl("div", { text: "Plugins List", cls: ["qps-header"] })
        this.search = contentEl.createEl("div", { cls: ["qps-search"] });
        this.items = contentEl.createEl("div", { cls: ["qps-items"] });
    }

    addHeader = (contentEl: HTMLElement): void => {
        const { plugin } = this
        const { settings } = plugin

        //dropdown with filters
        new DropdownComponent(contentEl).addOptions({
            all: `All(${plugin.lengthAll})`,
            enabled: `Enabled(${plugin.lengthEnabled})`,
            disabled: `Disabled(${plugin.lengthDisabled})`,
            enabledFirst: `Enabled First(${plugin.lengthAll})`,
            mostSwitched: `Most Switched(${plugin.lengthAll})`,
            byGroup: `By Group`
        })
            .setValue(settings.filters as string)
            .onChange(async (value: QPSSettings['filters']) => {
                settings.filters = value;
                getLength(plugin)
                this.onOpen()
                await plugin.saveSettings();
            })

        // mostSwitched reset button
        mostSwitchedResetButton(this, contentEl)

        // byGroup
        filterByGroup(this, contentEl)
    }

    addSearch(contentEl: HTMLElement): void {
        const { plugin } = this
        const { settings } = plugin

        new Setting(contentEl)
            .setName("Search Plugin")
            .setDesc("")
            .addSearch(async (search: SearchComponent) => {
                search
                    .setValue(settings.search)
                    .setPlaceholder("Search")
                    .onChange(async (value: string) => {
                        const listItems = doSearch(plugin, value)
                        this.items.empty()
                        this.addItems(listItems)
                    });

            })

        // toggle plugin options
        const span = contentEl.createEl("span", { cls: ["qps-toggle-plugins"] })
        powerButton(this, span)
    }

    async addItems(listItems: PluginInfo[]) {
        const { plugin } = this
        const { settings } = plugin

        // Sort for chosen mode
        listItems = modeSort(plugin, listItems)

        // toggle plugin
        for (const pluginItem of listItems) {
            if (
                (settings.filters === "enabled" && !pluginItem.enabled) ||
                (settings.filters === "disabled" && pluginItem.enabled)
            ) {
                continue;
            }

            // create items
            const itemContainer = this.items.createEl("div", { cls: "qps-item-line" });
            itemToggleClass(this, pluginItem, itemContainer)

            itemTogglePluginButton(this, pluginItem, itemContainer)

            const text = itemTextComponent(pluginItem, itemContainer)
            //add hotkeys
            text.addEventListener("mouseover", (evt) => this.handleHotkeys(evt, pluginItem, text))
            // click on text to toggle plugin
            let isClickActionDone = false;
            text.addEventListener("click", async (evt: MouseEvent) => {
                if (evt.button === 0 && pluginItem.id !== "quick-plugin-switcher") {
                    if (!isClickActionDone) {
                        text.blur()
                    }
                }
            },)
            // context menu on item-line
            text.addEventListener("contextmenu", (evt) => {
                text.blur()
                handleContextMenu(evt, this, plugin, pluginItem)
            })

            folderOpenButton(this, pluginItem, text)
        }
    }

    handleHotkeys = async (evt: MouseEvent, pluginItem: PluginInfo, itemContainer: HTMLInputElement) => {
        if (pluginItem.id === "quick-plugin-switcher") return
        const numberOfGroups = this.plugin.settings.numberOfGroups;
        const keyToGroupMap: Record<string, number> = {};

        // Generate keyToGroupMap based on the number of groups available
        for (let i = 1; i <= numberOfGroups; i++) {
            keyToGroupMap[i.toString()] = i;
        }

        const handleMouseLeave = () => {
            document.removeEventListener('keydown', handleKeyDown);
            itemContainer.removeEventListener('mouseleave', handleMouseLeave);
        }
        itemContainer.addEventListener('mouseleave', handleMouseLeave);

        const handleKeyDown = async (event: KeyboardEvent) => {
            const keyPressed = event.key;
            if (keyPressed in keyToGroupMap) {
                const groupIndex = parseInt(keyPressed);
                const index = pluginItem.groupInfo.groupIndices.indexOf(groupIndex);
                if (index === -1) {
                    pluginItem.groupInfo.groupIndices?.push(groupIndex);
                }
            } else if (keyPressed === "Delete" || keyPressed === "Backspace" ||
                keyPressed === "0") {
                if (!pluginItem.groupInfo.groupIndices.length) return
                if (pluginItem.groupInfo.groupIndices.length === 1) {
                    pluginItem.groupInfo.groupIndices = [];
                    this.onOpen();
                } else new RemoveFromGroupModal(this.app, pluginItem, this).open()
            } else {
                document.removeEventListener('keydown', handleKeyDown);
                itemContainer.removeEventListener('mouseleave', handleMouseLeave);
                return
            }

            await this.plugin.saveSettings()
            document.removeEventListener('keydown', handleKeyDown);
            this.onOpen();
        }
        document.addEventListener('keydown', handleKeyDown)
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

