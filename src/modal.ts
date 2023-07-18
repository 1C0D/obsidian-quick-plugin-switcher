import { App, ButtonComponent, DropdownComponent, ExtraButtonComponent, Menu, Modal, Notice, SearchComponent, Setting, TextComponent, ToggleComponent } from "obsidian"
import QuickPluginSwitcher, { PluginInfo } from "./main"
// npm install electron --save-dev
import { app, shell } from 'electron';
import { QPSSettings } from "./settings";

export class QPSModal extends Modal {
    headBar: HTMLElement
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
        this.addFirstline(this.headBar)
        this.addSearch(this.search)
        this.addItems(this.items, this.allPluginsList)
    }

    container(contentEl: HTMLElement) {
        this.headBar = contentEl.createEl("div", { text: "Plugins List", cls: ["qps-headbar"] })
        this.search = contentEl.createEl("div", { cls: ["qps-search"] });
        this.items = contentEl.createEl("div", { cls: ["qps-items"] });
    }

    addFirstline = (contentEl: HTMLElement): void => {
        const { plugin } = this
        const { settings } = plugin

        new DropdownComponent(contentEl).addOptions({
            all: `All(${plugin.lengthAll})`,
            enabled: `Enabled(${plugin.lengthEnabled})`,
            disabled: `Disabled(${plugin.lengthDisabled})`,
            mostSwitched: `Most Switched(${plugin.lengthAll})`

        })
            .setValue(settings.filters)
            .onChange(async (value: QPSSettings['filters']) => {
                settings.filters = value;
                plugin.getLength()
                this.open()
                await plugin.saveSettings();
            })

        if (settings.filters === "mostSwitched") {
            const reset = () => {
                plugin.reset = true
                plugin.getLength()
                this.onOpen()
            }

            new ExtraButtonComponent(contentEl).setIcon("reset").setTooltip("Reset mostSwitched to 0").onClick(async () => {
                reset()
            })

            const span = contentEl.createEl("span", { text: "Reset mostSwitched values", cls: ["reset-desc"] })
            span.onclick = () => {
                reset()
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
                        const listItems = []
                        // search proces
                        for (const i of settings.allPluginsList) {
                            if (i.name.toLowerCase().includes(value.toLowerCase()) || value.length > 1 && value[value.length - 1] == " " && i.name.toLowerCase().startsWith(value.trim().toLowerCase())) {
                                listItems.push(i)
                            }
                        }
                        this.items.empty()
                        this.addItems(contentEl, listItems)
                        // save settings?
                    });
            });
    }

    async addItems(contentEl: HTMLElement, listItems: PluginInfo[]) {
        const { plugin } = this
        const { settings } = plugin

        // sort mostSwitched/other modes
        if (this.plugin.settings.filters === "mostSwitched" && !this.plugin.reset) {
            listItems.sort((a, b) => a.name.localeCompare(b.name))
            listItems.sort((a, b) => b.switched - a.switched)
        } else {
            listItems.sort((a, b) => a.name.localeCompare(b.name))
            if (plugin.reset) {
                const allPluginsList = settings.allPluginsList
                // reset mostSwitched
                allPluginsList.forEach(i => {
                    i.switched = 0
                })
                plugin.reset = false
            }
        }

        for (const pluginItem of listItems) {
            if (
                (this.plugin.settings.filters === "enabled" && !pluginItem.enabled) ||
                (this.plugin.settings.filters === "disabled" && pluginItem.enabled)
            ) {
                continue;
            }

            const itemContainer = this.items.createEl("div", { cls: ["qps-item-line"] });
            // add context menu on item-line
            itemContainer.addEventListener("contextmenu", (evt: MouseEvent) => {
                evt.preventDefault();
                const menu = new Menu();
                menu?.addItem((item) =>
                    item
                        .setTitle("open plugin folder")
                        .setIcon("folder-open")
                        .onClick(() => {
                            this.openDirectoryInFileManager(pluginItem)
                        })
                );
                menu?.addItem((item) =>
                    item
                        .setTitle("plugin description")
                        .setIcon("text")
                        .onClick(() => {
                            new DescModal(this.app, this.plugin, pluginItem).open();
                        })
                );
                menu.showAtMouseEvent(evt);
            })


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

            text.onClickEvent(async (evt: MouseEvent) => {
                if (evt.button === 0) {
                    await this.togglePluginEnabled(pluginItem, listItems)
                }
                // make input impossible to modify
                contentEl.blur(); //contentEl and not inputEl if not others input like search blocked too
            })

            if (settings.openPluginFolder) {
                new ButtonComponent(itemContainer)
                    .setIcon("folder-open")
                    .setTooltip("Open plugin directory")
                    .onClick(async () => {
                        this.openDirectoryInFileManager(pluginItem)
                    })
            }
        }
    }

    //desktop only. Add some conditions
    async openDirectoryInFileManager(pluginItem: PluginInfo) {
        const filePath = (this.app as any).vault.adapter.getFullPath(pluginItem.dir);
        // const directoryPath = path.dirname(filePath);
        try {
            await shell.openPath(filePath);
            console.debug('Directory opened in the file manager.');
        } catch (err) {
            console.error(`Error opening the directory: ${err.message}`);
        }
    }

    async togglePluginEnabled(pluginItem: PluginInfo, listItems: PluginInfo[]) {
        const { plugin } = this
        const { settings } = plugin
        pluginItem.enabled = !pluginItem.enabled;
        pluginItem.enabled
            ? await (this.app as any).plugins.enablePluginAndSave(pluginItem.id) //AndSave !!
            : await (this.app as any).plugins.disablePluginAndSave(pluginItem.id);
        pluginItem.switched++;
        settings.allPluginsList = listItems
        plugin.getLength()
        this.onOpen();
        await plugin.saveSettings();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// for plugin description 
export class DescModal extends Modal {
    constructor(app: App, public plugin: QuickPluginSwitcher, public pluginItem: PluginInfo) {
        super(app);
        this.plugin = plugin;
        this.pluginItem = pluginItem
    }

    onOpen() {
        const { contentEl, pluginItem } = this;
        contentEl.empty();
        contentEl
            .createEl("p", { text: pluginItem.name + " - v" + pluginItem.version })
            .createEl("p", {
                text:
                    "author: " + pluginItem.author +
                    ", url: " + (pluginItem.authorUrl ? "" : "null")
            })
            .createEl("a", {
                text: pluginItem.authorUrl,
                href: pluginItem.authorUrl,
            })
        contentEl.createEl("p", { text: pluginItem.desc })
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}