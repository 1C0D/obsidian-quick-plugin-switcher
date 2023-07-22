import { App, ButtonComponent, DropdownComponent, ExtraButtonComponent, Menu, Modal, Notice, SearchComponent, Setting, TextComponent, ToggleComponent } from "obsidian"
import { Filters, Groups, PluginGroupInfo, PluginInfo, defaultPluginGroup } from "./interfaces"
import { QPSSettings } from "./interfaces";
import { getEmojiForGroup, getLength, getNumberOfGroupsSettings } from "./utils";
import QuickPluginSwitcher from "./main";
import { doSearch, handleContextMenu, handleHotkeys, reset, sortByName, sortSwitched } from "./modal_utils";
import {openDirectoryInFileManager} from "./modal_utils";

export class QPSModal extends Modal {
    header: HTMLElement
    items: HTMLElement
    search: HTMLElement
    listItems: PluginInfo[] = []
    allPluginsList = this.plugin.settings.allPluginsList

    constructor(app: App, public plugin: QuickPluginSwitcher) {
        super(app);
        this.plugin = plugin;
        getNumberOfGroupsSettings(this.plugin)
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
            mostSwitched: `Most Switched(${plugin.lengthAll})`,
            byGroup: `By Group`
        })
            .setValue(settings.filters)
            .onChange(async (value: QPSSettings['filters']) => {
                settings.filters = value;
                getLength(plugin)
                this.open()
                await plugin.saveSettings();
            })

        // mostSwitched reset button
        if (settings.filters === Filters.MostSwitched) { // settings.filters === "mostSwitched"
            new ExtraButtonComponent(contentEl).setIcon("reset").onClick(async () => {
                reset(plugin, this)
            })

            const span = contentEl.createEl("span", { text: "Reset mostSwitched values", cls: ["reset-desc"] })
            span.onclick = () => {
                reset(plugin, this)
            }
        }

        // dropdown with groups
        if (settings.filters === Filters.ByGroup) {
            // Créer l'objet dropdownOptions à partir des groupes existants dans Groups
            const dropdownOptions: { [key: string]: string } = {};

            // Ajouter les groupes disponibles à dropdownOptions
            for (const groupKey in Groups) {
                dropdownOptions[groupKey] = Groups[groupKey];
            }

            // Créer le menu déroulant avec les options
            new DropdownComponent(contentEl)
                .addOptions(dropdownOptions)
                .setValue(settings.groups as string)
                .onChange(async (value: QPSSettings['groups']) => {
                    settings.groups = value;
                    await plugin.saveSettings();
                    this.onOpen();
                });
        }


    }

    // à revoir plus tard ?
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

        const span = contentEl.createEl("span", { cls: ["qps-toggle-plugins"] })
        new ButtonComponent(span)
            .setIcon("power")
            .setCta()
            .setTooltip("toggle plugins options").buttonEl
            .addEventListener("click", (evt: MouseEvent) => {
                const menu = new Menu();
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
                    menu.addItem((item) =>
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
                menu.addSeparator()
                menu.addItem((item) =>
                    item
                        .setTitle("Disable plugins by group")
                )
                Object.keys(Groups).forEach((groupKey) => {
                    const groupValue = Groups[groupKey as keyof typeof Groups]
                    const groupIndex = Object.keys(Groups).indexOf(groupKey);
                    const lengthGroup =settings.allPluginsList.
                        filter((plugin) => plugin.group === groupIndex).length
                    if (groupKey !== "SelectGroup" && lengthGroup) { // && group length > 0
                        const previousPluginGroup = settings.pluginGroups[groupIndex - 1] || defaultPluginGroup;
                        menu.addItem((item) =>
                            item
                                .setTitle(groupValue) // `Re-enable ${groupValue} Plugins` : `Disable all in ${groupValue}`)
                                .setIcon(previousPluginGroup.wasEnabled?.length > 0 ? "power" : "power-off")// faux mais ok...
                                .onClick(async () => {
                                    const pluginGroup: PluginGroupInfo = {
                                        groupIndex,
                                        // plugins: settings.allPluginsList
                                        //     .filter((i) => i.group === groupIndex),
                                        wasEnabled: [],
                                    };
                                    // ne devrait pas être ensuite nécessaire
                                    const existingIndex = settings.pluginGroups.findIndex((group) => group.groupIndex === groupIndex);
                                    if (existingIndex === -1) {
                                        settings.pluginGroups.push(pluginGroup);
                                    } else {
                                        // replace it
                                        settings.pluginGroups[existingIndex] = pluginGroup;
                                    }
                                    
                                    if (pluginGroup.wasEnabled.length > 0) {
                                        for (const i of settings.allPluginsList) {
                                            if (i.id === "quick-plugin-switcher") continue
                                            if (i.enabled && i.group === groupIndex) {
                                                console.log("ici")
                                                settings.pluginGroups[groupIndex - 1].wasEnabled.push(i.id)
                                            }
                                            await (this.app as any).plugins.disablePluginAndSave(i.id)
                                            i.enabled = false;
                                        }

                                        getLength(plugin)
                                        this.onOpen();
                                        new Notice("All plugins disabled.");
                                        await plugin.saveSettings();
                                    } else {
                                        for (const i of pluginGroup.wasEnabled) {
                                            //check plugin not deleted between
                                            const pluginToUpdate = settings.allPluginsList.find(plugin => plugin.id === i);
                                            if (pluginToUpdate) {
                                                await (this.app as any).plugins.enablePluginAndSave(i)
                                                pluginToUpdate.enabled = true
                                            }
                                        }
                                        getLength(plugin)
                                        this.onOpen()
                                        pluginGroup.wasEnabled = []
                                        new Notice("All plugins re-enabled.")
                                        await this.plugin.saveSettings()
                                    }
                                }))
                    }
                }
                )
                console.log("pluginGroups", settings.pluginGroups)


                menu.showAtMouseEvent(evt);
            })

    }

    async addItems(contentEl: HTMLElement, listItems: PluginInfo[]) {
        const { plugin } = this
        const { settings } = plugin

        // sort by mode
        if (settings.filters === Filters.MostSwitched && !this.plugin.reset) {
            sortByName(listItems)
            sortSwitched(listItems)
        } else {
            // reset switched
            if (plugin.reset) {
                const allPluginsList = settings.allPluginsList
                allPluginsList.forEach(i => {
                    i.switched = 0 // no need to save apparently. because of mutability? 
                })
                plugin.reset = false
            }

            // filter values
            if (settings.filters === Filters.EnabledFirst) {
                const enabledItems = listItems.filter(i => i.enabled)
                const disabledItems = listItems.filter(i => !i.enabled)
                sortByName(enabledItems)
                sortByName(disabledItems)
                listItems = [...enabledItems, ...disabledItems]
            }
            else if (settings.filters === Filters.ByGroup) {
                const groupsIndex = Object.keys(Groups).indexOf(settings.groups);
                if (groupsIndex !== 0) {
                    const groupedItems = listItems.filter(i => i.group === groupsIndex);
                    listItems = groupedItems;
                    sortByName(listItems);
                }
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

            // create items
            const itemContainer = this.items.createEl("div", { cls: ["qps-item-line"] });
            // context menu on item-line
            plugin.registerDomEvent(
                itemContainer,
                "contextmenu",
                (evt) => handleContextMenu(evt, this, plugin, itemContainer, pluginItem)
            )
            plugin.registerDomEvent(
                itemContainer,
                "mouseover",// mouseover  mouseenter
                (evt) => handleHotkeys(evt, this, itemContainer, pluginItem)
            )

            let disable = false
            // do nothing on this plugin
            if (pluginItem.id === "quick-plugin-switcher") disable = true

            new ToggleComponent(itemContainer)
                .setValue(pluginItem.enabled)
                .setDisabled(disable)
                .onChange(async () => {
                    await this.togglePluginEnabled(pluginItem, listItems)
                })

            const prefix = pluginItem.group === 0 ? "" : getEmojiForGroup(pluginItem.group);
            const customValue = `${prefix} ${pluginItem.name}`;
            const text = new TextComponent(itemContainer)
                .setValue(customValue)
                .setDisabled(disable)
                .inputEl

            // text can be clicked to toggle too
            text.onClickEvent(async (evt: MouseEvent) => {
                if (evt.button === 0) {
                    await this.togglePluginEnabled(pluginItem, listItems)
                }
                // disable input modifs
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

