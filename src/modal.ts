import { App, ButtonComponent, DropdownComponent, ExtraButtonComponent, Menu, Modal, Notice, SearchComponent, Setting, TextComponent, ToggleComponent } from "obsidian"
import { Filters, Groups, PluginInfo } from "./interfaces"
import { QPSSettings } from "./interfaces";
import { getEmojiForGroup, getLength, getGroupTitle } from "./utils";
import QuickPluginSwitcher from "./main";
import { doSearch, handleContextMenu, handleHotkeys, modeSort, reset, togglePluginButton } from "./modal_utils";
import { openDirectoryInFileManager } from "./modal_utils";

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
                this.open()
                await plugin.saveSettings();
            })

        // mostSwitched reset button
        if (settings.filters === Filters.MostSwitched) {
            new ExtraButtonComponent(contentEl).setIcon("reset").setTooltip("Reset mostSwitched values")
                .onClick(async () => {
                    reset(this, plugin)
                })
        }
        // byGroup
        if (settings.filters === Filters.ByGroup) {
            const dropdownOptions: { [key: string]: string } = {};
            // set dropdownOptions
            for (const groupKey in Groups) {
                const groupIndex = parseInt(groupKey.replace("Group", ""));// NaN, 1, 2...
                if (groupKey === "SelectGroup" ||
                    settings.allPluginsList.some(
                        plugin => plugin.groupInfo.groupIndex === groupIndex)
                ) {
                    dropdownOptions[groupKey] = Groups[groupKey];
                }
            }

            // if a group is empty get back dropdown to SelectGroup
            const notEmpty = (settings.selectedGroup === "SelectGroup" || settings.allPluginsList.some(
                plugin => plugin.groupInfo.groupIndex ===
                    parseInt((settings.selectedGroup as string).replace("Group", ""))))
            new DropdownComponent(contentEl)
                .addOptions(dropdownOptions)
                .setValue(notEmpty ? settings.selectedGroup as string : "SelectGroup")
                // .setValue(settings.groups as string)
                .onChange(async (value: QPSSettings['selectedGroup']) => {
                    settings.selectedGroup = value;
                    await plugin.saveSettings();
                    this.onOpen();
                });
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
                        this.addItems(listItems)
                    });

            })

        const span = contentEl.createEl("span", { cls: ["qps-toggle-plugins"] })
        new ButtonComponent(span)
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
                                            await (this.app as any).plugins.disablePluginAndSave(i.id)
                                            i.enabled = false;
                                        }
                                        getLength(plugin)
                                        this.onOpen();
                                        await plugin.saveSettings()
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
                                    settings.wasEnabled = []
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
                                        settings.wasEnabled = []
                                        await this.plugin.saveSettings();
                                        new Notice("All values have been reset.");
                                    } else { new Notice("Operation cancelled."); }
                                })
                        );
                    }
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
                    const inGroup = settings.allPluginsList.
                        filter((plugin) => plugin.groupInfo.groupIndex === groupIndex)
                    // show group
                    let previousWasEnabled = inGroup.filter(
                        (i) => i.groupInfo.wasEnabled === true
                    )

                    if (inGroup.length > 0 && (inGroup.some(i => i.enabled === true) || previousWasEnabled.length > 0)) {
                        menu.addItem((item) =>
                            item
                                .setTitle(previousWasEnabled.length > 0 ? `re-enable ${groupValue}` : groupValue)
                                .setIcon(previousWasEnabled.length > 0 ? "power" : "power-off")
                                .onClick(async () => {
                                    if (previousWasEnabled.length === 0) {
                                        const toDisable = inGroup.filter(i => i.enabled === true).map(async (i) => {
                                            i.groupInfo.wasEnabled = true
                                            await (this.app as any).plugins.disablePluginAndSave(i.id)
                                            i.enabled = false
                                        })
                                        await Promise.all(toDisable);
                                        if (toDisable) {
                                            getLength(plugin)
                                            this.onOpen();
                                            new Notice("All plugins disabled.");
                                            await this.plugin.saveSettings()
                                        }
                                    }
                                    else {
                                        for (const i of previousWasEnabled) {
                                            await (this.app as any).plugins.enablePluginAndSave(i)
                                            i.enabled = true
                                            i.switched++
                                            
                                        }
                                        previousWasEnabled.map(plugin => {
                                            plugin.groupInfo.wasEnabled = false
                                        })
                                        getLength(plugin)
                                        this.onOpen();
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
                                                plugin.groupInfo.wasEnabled = false
                                            })
                                            await this.plugin.saveSettings();
                                            new Notice("All values have been reset.");
                                        } else { new Notice("Operation cancelled."); }
                                    })
                            );
                        }
                    }
                }
                )
                menu.showAtMouseEvent(evt);
            })

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

            togglePluginButton(this, pluginItem, itemContainer, listItems)

            const prefix = pluginItem.groupInfo.groupIndex === 0 ? "" : getEmojiForGroup(pluginItem.groupInfo.groupIndex);
            const customValue = `${prefix} ${pluginItem.name}`;
            const text = new TextComponent(itemContainer)
                .setValue(customValue)
                .inputEl
            
            text.addEventListener("mouseover", (evt) => {
                if (pluginItem.id === "quick-plugin-switcher") return
                handleHotkeys(evt, this, itemContainer, pluginItem)
            })      
            // click on text to toggle plugin
            text.onClickEvent(async (evt: MouseEvent) => {
                if (evt.button === 0 && pluginItem.id !== "quick-plugin-switcher") {
                    await this.togglePluginAndSave(pluginItem, listItems)
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

    async togglePluginAndSave(pluginItem: PluginInfo, listItems: PluginInfo[]) {
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

