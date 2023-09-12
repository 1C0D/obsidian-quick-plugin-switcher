import {
    App, DropdownComponent, Menu, Modal, Notice,
    SearchComponent, Setting
} from "obsidian"
import { Groups, PluginInfo, QPSSettings } from "./types"
import { getLength, removeItem } from "./utils";
import QuickPluginSwitcher from "./main";
import {
    doSearch, handleContextMenu, modeSort,
    mostSwitchedResetButton, filterByGroup,
    powerButton, itemTogglePluginButton,
    itemToggleClass, itemTextComponent, shell, openGitHubRepo, openPluginSettings, showHotkeysFor, getCondition
} from "./modal_components";
import { conditionalEnable, delayedReEnable, getCirclesItem, getEmojiForGroup, getGroupTitle, openDirectoryInFileManager, selectValue } from "./modal_utils";


export class QPSModal extends Modal {
    header: HTMLElement
    items: HTMLElement
    search: HTMLElement
    groups: HTMLElement
    hotkeysDesc: HTMLElement
    isDblClick = false


    constructor(app: App, public plugin: QuickPluginSwitcher) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { plugin } = this
        if (this.plugin.toUpdate) { // message when opening 
            new NewVersion(this.app, plugin).open();
            plugin.toUpdate = false
        }
        const { contentEl } = this;
        contentEl.empty();
        getGroupTitle(plugin)
        this.container(contentEl)
        this.addHeader(this.header)
        this.addSearch(this.search)
        this.addGroups(this.groups)
        if (this.plugin.settings.showHotKeys) this.setHotKeysdesc()
        this.addItems(plugin.settings.allPluginsList)
    }

    // create header/search/items elts & class
    container(contentEl: HTMLElement) {
        this.header = contentEl.createEl("div", { text: "Plugins List", cls: ["qps-header"] })
        this.search = contentEl.createEl("div", { cls: ["qps-search"] });
        this.groups = contentEl.createEl("div", { cls: ["qps-groups"] });
        this.hotkeysDesc = contentEl.createEl("p", { cls: ["qps-hk-desc"] });
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
                await plugin.saveSettings();
                this.onOpen()
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
                        settings.search = value
                        const listItems = doSearch(plugin, value)
                        this.items.empty()
                        this.addItems(listItems)
                    });

            })

        // toggle plugin options
        const span = contentEl.createEl("span", { cls: ["qps-toggle-plugins"] })
        powerButton(this, span)
    }

    addGroups(contentEl: HTMLElement): void {
        const { plugin } = this;
        const { settings } = plugin;
        const groups = Object.values(Groups);

        for (let i = 1; i < groups.length; i++) {
            const groupKey = groups[i];
            const span = contentEl.createEl("span", { cls: ["qps-groups-item"] })
            span.textContent = `${groupKey}`;
            const content = this.getCircleGroup(i)
            span.insertAdjacentHTML("beforebegin", content);
            const groupNumberText = `(<span class="shortcut-number">${i}</span>)`;
            span.insertAdjacentHTML("beforeend", groupNumberText);


            span.addEventListener("dblclick", (e) => {
                if (this.isDblClick) return
                this.editGroupName(span, i, groupKey)
            });
            span.addEventListener("contextmenu", (evt) => {
                if (this.isDblClick) return
                this.groupMenu(evt, span, i, groupKey)
            });

            // if (settings.groups[i].applied) {
            //     span.toggleClass("delayed-group", true)
            // }
        }
    }

    getCircleGroup(groupIndex: number) {
        const { settings } = this.plugin
        const { color } = getEmojiForGroup(groupIndex);
        const background = `background-color: ${color};`;
        const value = settings.groups[groupIndex].time ? settings.groups[groupIndex].time : ""

        const content = `<div
            style="${background}"
            class="qps-circle-title-group"
            >
            ${value}
            </div>
            `
        return content
    }

    groupMenu = (evt: MouseEvent, span: HTMLSpanElement, groupNumber: number, emoji: string) => {
        const { plugin } = this
        const { settings } = plugin
        const inGroup = settings.allPluginsList.filter((i) => i.groupInfo.groupIndices?.indexOf(groupNumber) !== -1)

        const menu = new Menu();
        menu.addItem((item) =>
            item
                .setTitle("delay group")
                .setDisabled(!inGroup.length)
                .onClick(() => {
                    const currentValue = settings.groups[groupNumber].time || 0;
                    span.innerHTML = `<input type="text" value="${currentValue}" />`;

                    const input = span.querySelector("input");
                    input?.focus();
                    selectValue(input)

                    input?.addEventListener("blur", () => {
                        setTimeout(() => {
                            if (this.isDblClick) return
                            parseInt(input?.value) ? settings.groups[groupNumber].time = parseInt(input.value) :
                                settings.groups[groupNumber].time = 0;
                            span.textContent = `${input.value}`;
                            this.onOpen();
                        }, 100);
                    });

                    input?.addEventListener("keydown", (event) => {
                        if (event.key === "Enter") {
                            if (this.isDblClick) return
                            parseInt(input?.value) ? settings.groups[groupNumber].time = parseInt(input.value) :
                                settings.groups[groupNumber].time = 0;
                            span.textContent = `${settings.groups[groupNumber].time}`;
                            this.onOpen();
                        };
                    });
                })
        )
        
        menu.addItem((item) =>
            item
                .setTitle("apply")
                .setDisabled(!inGroup.length || settings.groups[groupNumber].time === 0)
                .onClick(async () => {
                    const confirm = window.confirm("Caution: if enabled, plugins will be restarted");
                    if (confirm) {
                        for (const plugin of inGroup) {
                            plugin.time = settings.groups[groupNumber].time
                            plugin.delayed = true
                            settings.groups[groupNumber].applied = true
                            if (plugin.enabled) {
                                // this.plugin.fromPlugin = true
                                await (this.app as any).plugins.disablePluginAndSave(plugin.id)
                                await (this.app as any).plugins.enablePlugin(plugin.id)
                                // this.plugin.fromPlugin = false
                            }
                            this.plugin.saveSettings()
                            this.onOpen()
                        }
                        // plugin.saveSettings()
                    } else new Notice("operation cancelled")

                }))
        menu.addItem((item) =>
            item
                .setTitle("reset")
                .setDisabled(!inGroup.length || settings.groups[groupNumber].time === 0)
                .onClick(async () => {
                    for (const plugin of inGroup) {
                        plugin.time = 0
                        plugin.delayed = false
                        settings.groups[groupNumber].applied = false
                        if (plugin.enabled) {
                            await (this.app as any).plugins.enablePluginAndSave(plugin.id)
                        }
                        this.onOpen()
                    }
                    plugin.saveSettings()
                }
                
            ))
        menu.addSeparator()
        const toEnable = inGroup.filter(i => i.enabled === false)
        menu.addItem((item) =>
            item
                .setTitle("enable all plugins in group")
                .setDisabled(!inGroup.length || !toEnable.length)
                .onClick(async () => { 
                    console.log("toEnable", toEnable)
                    await Promise.all(toEnable.map(async (i) => {
                        conditionalEnable(this, i);
                        i.enabled = true
                        this.plugin.saveSettings()
                    }))
                    if (toEnable) {
                        getLength(plugin)
                        new Notice("All plugins enabled.");
                        await this.plugin.saveSettings()
                        this.onOpen();
                    }
                }))
        
        const toDisable = inGroup.filter(i => i.enabled === true)
        menu.addItem((item) =>
            item
                .setTitle("disable all plugins in group")
                .setDisabled(!inGroup.length || !toDisable.length)
                .onClick(async () => {                     
                    await Promise.all(toDisable.map(async (i) => {
                        (this.app as any).plugins.disablePluginAndSave(i.id)
                        i.enabled = false
                    }))
                    if (toDisable) {
                        getLength(plugin)
                        new Notice("All plugins disabled.");
                        await this.plugin.saveSettings()
                        this.onOpen();
                    }
                }))
        
        menu.showAtMouseEvent(evt);
    }

    editGroupName = (span: HTMLSpanElement, groupNumber: number, emoji: string) => {
        const { plugin } = this
        const { settings } = plugin
        const currentValue = settings.groups[groupNumber].name !== "" ?
            settings.groups[groupNumber]?.name : "";
        span.innerHTML = `<input type="text" value="${currentValue}" />`;

        const input = span.querySelector("input");
        input?.focus();
        selectValue(input)

        input?.addEventListener("blur", () => {
            setTimeout(() => {
                if (this.isDblClick) return
                input?.value ? settings.groups[groupNumber].name = input.value :
                    settings.groups[groupNumber].name = `Group${groupNumber}`;
                span.textContent = `${settings.groups[groupNumber].name}`;
                this.onOpen();
            }, 200);
        });

        input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                if (this.isDblClick) return
                input?.value ? settings.groups[groupNumber].name = input.value :
                    settings.groups[groupNumber].name = Groups[groupNumber];
                span.textContent = `${settings.groups[groupNumber].name}`
                this.onOpen()
            }
        });
    };

    setHotKeysdesc(): void {
        this.hotkeysDesc.setText(`Keys: (1-7)➕ (0)❌ (f)📁 (g)github (s)⚙️ (h)hotkeys`)
    }
    async addItems(listItems: PluginInfo[]) {
        const { plugin } = this
        const { settings } = plugin

        const value = settings.search
        listItems = doSearch(plugin, value)
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
            let itemContainer = this.items.createEl("div", { cls: "qps-item-line" });
            itemToggleClass(this, pluginItem, itemContainer)
            itemTogglePluginButton(this, pluginItem, itemContainer)
            const text = itemTextComponent(pluginItem, itemContainer)
            text.readOnly = true
            // create groups circles
            const indices = pluginItem.groupInfo.groupIndices
            if (indices.length) {
                const content = getCirclesItem(pluginItem, indices);
                text.insertAdjacentHTML("afterend", content);

                if (indices.length >= 3) { // 2 circles
                    const [valeur0, valeur1, ...part2] = indices;
                    const part1 = [valeur0, valeur1];

                    const content1 = getCirclesItem(pluginItem, part1);
                    text.insertAdjacentHTML("afterend", content1);

                    const content2 = getCirclesItem(pluginItem, part2);
                    text.insertAdjacentHTML("afterend", content2);
                }
            }

            // create temp input in input to modify delayed entering time
            itemContainer.addEventListener("dblclick", async (evt) => {
                if (pluginItem.id === "quick-plugin-switcher") return
                const { plugin } = this
                const currentValue = pluginItem.time
                const container = itemContainer
                itemContainer.innerHTML = `<input type="text" value="${currentValue}" />`;
                this.isDblClick = true

                const input = itemContainer.querySelector("input");
                input?.focus();
                //select value
                selectValue(input)

                if (!pluginItem.delayed) {
                    input?.addEventListener("keydown", async (event) => {
                        if (event.key === "Enter") {
                            setTimeout(async () => {
                                this.addDelay(pluginItem, input, itemContainer, container)
                                this.isDblClick = false
                            }, 100);
                        }
                    });
                    input?.addEventListener("blur", () => {
                        setTimeout(async () => {
                            this.addDelay(pluginItem, input, itemContainer, container)
                            this.isDblClick = false
                        }, 100);
                    });
                } else {
                    pluginItem.delayed = false
                    await (this.app as any).plugins.enablePluginAndSave(pluginItem.id)
                    this.isDblClick = false
                    await plugin.saveSettings();
                    itemContainer = container
                    this.onOpen();
                }
            })

            text.addEventListener("click", (evt) => {
                if (this.isDblClick) return
                this.handleHotkeys(evt, pluginItem, text) // modifier encore (sans clic avant)???
            })
            text.addEventListener("contextmenu", (evt) => {
                if (this.isDblClick) return
                handleContextMenu(evt, this, plugin, pluginItem)
            })
        }
    }

    addDelay = async (pluginItem: PluginInfo, input: HTMLInputElement,
        itemContainer: HTMLDivElement, container: HTMLDivElement) => {
        pluginItem.delayed = true
        pluginItem.time = parseInt(input.value) || 0

        if (pluginItem.time === 0) {
            pluginItem.delayed = false
        }
        if (pluginItem.delayed && pluginItem.enabled) {
            delayedReEnable(this, pluginItem)
        }
        await this.plugin.saveSettings();
        itemContainer = container
        this.onOpen();
    }

    handleHotkeys = async (evt: MouseEvent, pluginItem: PluginInfo, itemContainer: HTMLInputElement) => {
        const numberOfGroups = this.plugin.settings.numberOfGroups;
        const keyToGroupMap: Record<string, number> = {};

        // Generate keyToGroupMap based on the number of groups available
        for (let i = 1; i <= numberOfGroups; i++) {
            keyToGroupMap[i.toString()] = i;
        }

        const pluginSettings = (this.app as any).setting.openTabById(pluginItem.id)
        const condition = getCondition(this, pluginItem)
        const KeyToSettingsMap = {
            "g": () => openGitHubRepo(pluginItem),
            "s": () => openPluginSettings(this, pluginSettings),
            "h": () => showHotkeysFor(pluginItem, condition)
        }
        if (shell) KeyToSettingsMap["f"] = () => openDirectoryInFileManager(shell, this, pluginItem)

        // handle groups shortcuts
        const handleKeyDown = async (event: KeyboardEvent) => {
            if (this.isDblClick) return
            const keyPressed = event.key;
            if (keyPressed in keyToGroupMap && !(pluginItem.id === "quick-plugin-switcher")) {
                const groupIndex = keyToGroupMap[keyPressed];
                if (pluginItem.groupInfo.groupIndices.length === 4) return
                const index = pluginItem.groupInfo.groupIndices.indexOf(groupIndex);
                if (index === -1) {
                    pluginItem.groupInfo.groupIndices?.push(groupIndex);
                    this.onOpen();
                }
            } else if (keyPressed in KeyToSettingsMap) {
                KeyToSettingsMap[keyPressed]()
            }
            else if (keyPressed === "Delete" || keyPressed === "Backspace" ||
                keyPressed === "0" && !(pluginItem.id === "quick-plugin-switcher")) {
                if (!pluginItem.groupInfo.groupIndices.length) return
                if (pluginItem.groupInfo.groupIndices.length === 1) {
                    pluginItem.groupInfo.groupIndices = [];
                    this.onOpen();
                } else {
                    const menu = new Menu();
                    menu.addItem((item) =>
                        item
                            .setTitle("Remove item group(s)")
                    )
                    menu.addItem((item) =>
                        item
                            .setTitle("All")
                            .onClick(() => {
                                pluginItem.groupInfo.groupIndices = [];
                                this.onOpen()
                            }))
                    for (const groupIndex of pluginItem.groupInfo.groupIndices) {
                        const { emoji } = getEmojiForGroup(groupIndex)
                        menu.addItem((item) =>
                            item
                                .setTitle(`${emoji} group ${groupIndex}`)
                                .onClick(() => {
                                    pluginItem.groupInfo.groupIndices = removeItem(pluginItem.groupInfo.groupIndices, groupIndex);
                                    this.onOpen();
                                }))
                    }

                    menu.showAtMouseEvent(evt);
                }
            }
            await this.plugin.saveSettings()
            this.items.removeEventListener('keydown', handleKeyDown);
        }
        this.items.addEventListener('keydown', handleKeyDown)
    }


    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class NewVersion extends Modal {
    constructor(app: App, public plugin: QuickPluginSwitcher) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        const content = `
        <b>Warning:</b><br>
        For this new feature(request) adding a delay to plugin(s) at start,
        default values need to be restored. Sorry for the inconvenience.<br><br>
        <b>New feature:</b><br>
        Double click, on a plugin name, to add/delete a delay to a plugin.<br>
        Right click on groups name, to open context menu: add a delay, "apply" to all linked plugins,
        reset.
        `
        contentEl.createDiv("", (el: HTMLDivElement) => {
            el.innerHTML = content;
        });
    }

    async onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.plugin.toUpdate = false
    }
}