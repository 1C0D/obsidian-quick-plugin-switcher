import { App, ButtonComponent, DropdownComponent, ExtraButtonComponent, Menu, Modal, Notice, SearchComponent, Setting, TextComponent, ToggleComponent } from "obsidian"
import { PluginInfo } from "./interfaces"
import { QPSSettings } from "./interfaces";
import { getLength } from "./utils";
import QuickPluginSwitcher from "./main";
import { doSearch, itemsContextMenu, openDirectoryInFileManager, reset, sortByName, sortSwitched } from "./modal_utils";

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
        this.container(contentEl)
        this.addHeader(this.header)
        this.addSearch(this.search)
        this.addItems(this.items, this.allPluginsList)
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
            mostSwitched: `Most Switched(${plugin.lengthAll})`
        })
            .setValue(settings.filters)
            .onChange(async (value: QPSSettings['filters']) => {
                settings.filters = value;
                getLength(plugin)
                this.open()
                await plugin.saveSettings();
            })

        if (settings.filters === "mostSwitched") {
            new ExtraButtonComponent(contentEl).setIcon("reset").setTooltip("Reset mostSwitched to 0").onClick(async () => {
                reset(plugin, this)
            })

            const span = contentEl.createEl("span", { text: "Reset mostSwitched values", cls: ["reset-desc"] })
            span.onclick = () => {
                reset(plugin, this)
            }
        }
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
                        this.addItems(contentEl, listItems)
                    });

            })
            .addButton((btn) => {
                btn
                    .setIcon("more-vertical")
                    .setCta()
                    .setTooltip("settings").buttonEl
                    .addEventListener("click", (evt: MouseEvent) => {
                        const menu = new Menu();
                        menu?.addItem((item) =>
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
                                                await (this.app as any).plugins.disablePluginAndSave(i.id)
                                                i.enabled = false;
                                            }
                                            getLength(plugin)
                                            this.onOpen();
                                            new Notice("All plugins disabled.");
                                        } else { new Notice("Operation cancelled."); }
                                    }
                                    else if (settings.wasEnabled.length > 0) {
                                        for (const i of settings.wasEnabled) {
                                            //check plugin not deleted between
                                            const pluginToUpdate = settings.allPluginsList.find(plugin => plugin.id === i);
                                            if (pluginToUpdate) {
                                                await (this.app as any).plugins.enablePluginAndSave(i)
                                                pluginToUpdate.enabled = true
                                            }
                                        }
                                        getLength(plugin)
                                        this.onOpen()
                                        this.plugin.settings.wasEnabled = []
                                        new Notice("All plugins re-enabled.")
                                        await this.plugin.saveSettings()
                                    }
                                })
                        )
                        if (settings.wasEnabled.length > 0) {
                            menu?.addItem((item) =>
                                item
                                    .setTitle("Skip re-enable")
                                    .setIcon("reset")
                                    .onClick(async () => {
                                        const confirmReset = window.confirm('Delete data to re-enable plugins and return to disable state?');
                                        if (confirmReset) {
                                            // this.plugin.settings.allPluginsList = []
                                            this.plugin.settings.wasEnabled = []
                                            await this.plugin.saveSettings();
                                            new Notice("All values have been reset.");
                                        } else { new Notice("Operation cancelled."); }
                                    })
                            );
                        }
                        menu.showAtMouseEvent(evt);
                    })
            })
    }

    async addItems(contentEl: HTMLElement, listItems: PluginInfo[]) {
        const { plugin } = this
        const { settings } = plugin

        // sort by mode
        if (this.plugin.settings.filters === "mostSwitched" && !this.plugin.reset) {
            sortByName(listItems)
            sortSwitched(listItems)
        } else {
            if (plugin.reset) {
                const allPluginsList = settings.allPluginsList
                // reset switched
                allPluginsList.forEach(i => {
                    i.switched = 0 // no need to save apparently. because of mutability? 
                })
                plugin.reset = false
            }
            if (settings.filters === "enabledFirst") {
                const enabledItems = listItems.filter(i => i.enabled)
                const disabledItems = listItems.filter(i => !i.enabled)
                sortByName(enabledItems)
                sortByName(disabledItems)
                listItems=[...enabledItems,...disabledItems]
            }
            else {
                sortByName(listItems)                
            }
        }

        // toggle plugin
        for (const pluginItem of listItems) {
            if (
                (this.plugin.settings.filters === "enabled" && !pluginItem.enabled) ||
                (this.plugin.settings.filters === "disabled" && pluginItem.enabled)
            ) {
                continue;
            }

            // create elts
            const itemContainer = this.items.createEl("div", { cls: ["qps-item-line"] });
            // context menu on item-line
            itemsContextMenu(plugin, itemContainer, pluginItem)

            let disable = false
            // do nothing on this plugin
            if (pluginItem.id === "quick-plugin-switcher") disable = true

            new ToggleComponent(itemContainer)
                .setValue(pluginItem.enabled)
                .setDisabled(disable)
                .onChange(async () => {
                    await this.togglePluginEnabled(pluginItem, listItems)
                })

            const text = new TextComponent(itemContainer)
                .setValue(pluginItem.name)
                .setDisabled(disable)
                .inputEl
            
            // text can be clicked to toggle too
            text.onClickEvent(async (evt: MouseEvent) => {
                if (evt.button === 0) {
                    await this.togglePluginEnabled(pluginItem, listItems)
                }
                // input impossible to modify
                contentEl.blur(); //not inputEl, if not applied on other input too
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


    async togglePluginEnabled(pluginItem: PluginInfo, listItems: PluginInfo[]) {
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

