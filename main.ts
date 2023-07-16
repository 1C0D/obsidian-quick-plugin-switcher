// await (this.app as any).plugins.pluginsLoaded;

import { App, DropdownComponent, ExtraButtonComponent, Modal, Plugin, SearchComponent, Setting, TextComponent, ToggleComponent } from 'obsidian';

interface QuickPluginSwitcherSettings {
    allPluginsList: PluginInfo[]
    filters: "all" | "enabled" | "disabled" | "mostSwitched",
    search: string
}

const DEFAULT_SETTINGS: QuickPluginSwitcherSettings = {
    allPluginsList: [],
    filters: "all",
    search: ""
}

interface PluginInfo {
    name: string;
    id: string;
    desc: string;
    enabled: boolean;
    switched: number
}

export default class QuickPluginSwitcher extends Plugin {
    settings: QuickPluginSwitcherSettings;
    reset: boolean = false
    lengthAll: number = 0
    lengthDisabled: number = 0
    lengthEnabled: number = 0

    async onload() {
        await this.loadSettings();
        const ribbonIconEl = this.addRibbonIcon('toggle-right', 'Quick Plugin Switcher', (evt: MouseEvent) => {
            // this.settings.allPluginsList = []; console.log("reset allPluginsList ON !") //to reset All
            this.getPluginsInfo()
            this.getLength()
            new QuickPluginSwitcherModal(this.app, this).open();
            // this.debug("after QuickPluginSwitcherModal")
        });
    }

    isEnabled(name: string): boolean {
        return (this.app as any).plugins.enabledPlugins.has(name)
    }

    getLength() {
        this.lengthAll = this.settings.allPluginsList.length
        this.lengthEnabled = this.settings.allPluginsList.
            filter(plugin => plugin.enabled).length
        this.lengthDisabled = this.settings.allPluginsList.
            filter(plugin => !plugin.enabled).length
    }

    async getPluginsInfo() {
        const allPluginsList = this.settings.allPluginsList;
        const manifests = (this.app as any).plugins.manifests;

        // if plugins have been deleted
        const stillInstalled = allPluginsList.filter(plugin =>
            Object.keys(manifests).includes(plugin.id)
        );

        for (const key of Object.keys(manifests)) {
            // if plugin has been toggled from obsidian settings
            const pluginInList = stillInstalled.find(plugin => plugin.id === manifests[key]?.id);
            if (pluginInList) {
                if (this.isEnabled(manifests[key]?.id) !== pluginInList.enabled) {
                    pluginInList.enabled = !pluginInList.enabled;
                }
                continue
            } else {
                const notInListInfo: PluginInfo = {
                    name: manifests[key]?.name,
                    id: manifests[key]?.id,
                    desc: manifests[key]?.description,
                    enabled: this.isEnabled(manifests[key]?.id),
                    switched: 0
                };
                stillInstalled.push(notInListInfo);
            }
        }
        this.settings.allPluginsList = stillInstalled;
        await this.saveSettings()
        this.getLength();
    }

    async loadSettings() {
        this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // create utils file ------------------------------

    debug(where = "") {
        this.getExtMan("ext-to-vault", where)
        this.getExt("ext-to-vault")
    }

    getExt(pluginName: string) {
        this.settings.allPluginsList.map(plugin => {
            if (plugin.id === pluginName) {
                console.log("ext-to-vault in allPluginsList", ", enabled", plugin.enabled,
                    "switched", plugin.switched)
            }
        })
    }

    getExtMan(pluginName: string, where = "") {
        const manifestsKeys = Object.keys((this.app as any).plugins.manifests)
        const isIn = manifestsKeys.includes(pluginName)
        const isEn = this.isEnabled(pluginName)
        console.log("From " + where + " ", "isInManifests", isIn, "enabled", isEn)
    }
}

class QuickPluginSwitcherModal extends Modal {
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
        // this.plugin.debug("onOpen")
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
            .onChange(async (value: QuickPluginSwitcherSettings['filters']) => {
                settings.filters = value;
                plugin.getLength()
                this.open()
                await plugin.saveSettings();
            })

        if (settings.filters === "mostSwitched") {
            new ExtraButtonComponent(contentEl).setIcon("reset").setTooltip("Reset mostSwitched to 0").onClick(async () => {
                plugin.reset = true
                plugin.getLength()
                this.onOpen()
            })

            contentEl.createEl("span", { text: "Reset mostSwitched values", cls: ["reset-desc"] })
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

            const itemContainer = this.items.createEl("div");

            let disable = false
            if (pluginItem.id === "quick-plugin-switcher") disable = true
            new ToggleComponent(itemContainer)
                .setValue(pluginItem.enabled)
                .setDisabled(disable)
                .onChange(async (value) => {
                    pluginItem.enabled = value;
                    value
                        ? await (this.app as any).plugins.enablePluginAndSave(pluginItem.id)
                        : await (this.app as any).plugins.disablePluginAndSave(pluginItem.id);
                    pluginItem.switched++;
                    settings.allPluginsList = listItems
                    plugin.getLength()
                    this.onOpen();
                    await plugin.saveSettings();
                })

            new TextComponent(itemContainer)
                .setValue(pluginItem.name)
                .setDisabled(true);
        }
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

