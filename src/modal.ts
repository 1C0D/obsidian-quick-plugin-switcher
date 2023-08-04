import { App, ButtonComponent, DropdownComponent, ExtraButtonComponent, Menu, Modal, Notice, SearchComponent, Setting, TextComponent } from "obsidian"
import { Filters, Groups, PluginInfo, QPSSettings } from "./types"
import { getLength } from "./utils";
import QuickPluginSwitcher from "./main";
import { doSearch, handleContextMenu, modeSort, togglePluginButton, openDirectoryInFileManager, mostSwitchedResetButton, filterByGroup, powerButton } from "./modal_components";
import { getEmojiForGroup, getGroupTitle } from "./modal_utils";

export class QPSModal extends Modal {
    header: HTMLElement
    items: HTMLElement
    search: HTMLElement
    listItems: PluginInfo[] = []
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
        powerButton (this, span)
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
            if (pluginItem.id === "quick-plugin-switcher") {
                itemContainer.toggleClass("qps-quick-plugin-switcher", true);
            }
            if (settings.filters === Filters.MostSwitched && pluginItem.switched !== 0) { // && !plugin.reset
                itemContainer.toggleClass("qps-most-switched", true);
            }
            // context menu on item-line
            itemContainer.addEventListener("contextmenu", (evt) => {
                handleContextMenu(evt, this, plugin, pluginItem)
            })

            togglePluginButton(this, pluginItem, itemContainer)

            const prefix = pluginItem.groupInfo.groupIndex === 0 ? "" : getEmojiForGroup(pluginItem.groupInfo.groupIndex);
            const customValue = `${prefix} ${pluginItem.name}`;
            const text = new TextComponent(itemContainer)
                .setValue(customValue)
                .inputEl
            //add hotkeys
            text.addEventListener("mouseover", (evt) => this.handleHotkeys(evt, pluginItem, itemContainer))
            // click on text to toggle plugin
            text.onClickEvent(async (evt: MouseEvent) => {
                if (evt.button === 0 && pluginItem.id !== "quick-plugin-switcher") {
                    await this.togglePluginAndSave(pluginItem)
                }
            })

            if (settings.openPluginFolder) {
                new ButtonComponent(itemContainer)
                    .setIcon("folder-open")
                    .setTooltip("Open plugin directory")
                    .onClick(async () => {
                        openDirectoryInFileManager(plugin, pluginItem)
                    })
            }
        }
    }

    handleHotkeys = async (evt: MouseEvent, pluginItem: PluginInfo, itemContainer: HTMLDivElement) => {
        console.log("itemContainer", itemContainer)
        const target = evt.currentTarget as HTMLElement;
        console.log("target", target)
        console.log("target.textContent", target.innerText)
        if (pluginItem.id === "quick-plugin-switcher") return
        const numberOfGroups = this.plugin.settings.numberOfGroups;
        const keyToGroupMap: Record<string, number> = {};

        // Generate keyToGroupMap based on the number of groups available
        for (let i = 0; i <= numberOfGroups; i++) {
            keyToGroupMap[i.toString()] = i;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            event.stopPropagation();
            const keyPressed = event.key;
            if (keyPressed in keyToGroupMap) {
                pluginItem.groupInfo.groupIndex = parseInt(keyPressed);
            } else if (keyPressed === "Delete" || keyPressed === "Backspace" || keyPressed === "0") {
                pluginItem.groupInfo.groupIndex = 0;
            }
            document.removeEventListener('keydown', handleKeyDown);
            this.onOpen();
        }

        const handleMouseLeave = () => {
            document.removeEventListener('keydown', handleKeyDown);
            itemContainer.removeEventListener('mouseleave', handleMouseLeave);
        }

        document.addEventListener('keydown', handleKeyDown);
        itemContainer.addEventListener('mouseleave', handleMouseLeave);
        await this.plugin.saveSettings()
    }

    async togglePluginAndSave(pluginItem: PluginInfo) {
        const { plugin } = this

        pluginItem.enabled = !pluginItem.enabled;
        pluginItem.enabled
            ? await (this.app as any).plugins.enablePluginAndSave(pluginItem.id) //AndSave
            : await (this.app as any).plugins.disablePluginAndSave(pluginItem.id);
        pluginItem.switched++;
        getLength(plugin)
        this.onOpen();
        await plugin.saveSettings();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

