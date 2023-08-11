import { App, DropdownComponent, Menu, Modal, Notice, SearchComponent, Setting } from "obsidian"
import { Groups, PluginInfo, QPSSettings } from "./types"
import { getLength, removeItem } from "./utils";
import QuickPluginSwitcher from "./main";
import {
    doSearch, handleContextMenu, modeSort,
    mostSwitchedResetButton, filterByGroup,
    powerButton, itemTogglePluginButton,
    itemToggleClass, itemTextComponent,

} from "./modal_components";
import { getEmojiForGroup, getGroupTitle } from "./modal_utils";

export class QPSModal extends Modal {
    header: HTMLElement
    items: HTMLElement
    search: HTMLElement
    groups: HTMLElement
    allPluginsList = this.plugin.settings.allPluginsList
    isDblClick = false

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
        this.addGroups(this.groups)
        this.addItems(this.allPluginsList)
    }

    // create header/search/items elts & class
    container(contentEl: HTMLElement) {
        this.header = contentEl.createEl("div", { text: "Plugins List", cls: ["qps-header"] })
        this.search = contentEl.createEl("div", { cls: ["qps-search"] });
        this.groups = contentEl.createEl("div", { cls: ["qps-groups"] });
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

    addGroups(contentEl: HTMLElement): void {
        const { plugin } = this;
        const { settings } = plugin;
        const groups = Object.values(Groups);

        for (let i = 1; i < groups.length; i++) {
            const groupKey = groups[i];
            const span = contentEl.createEl("span", { cls: ["qps-groups-item"] })
            span.textContent = `${groupKey}`;
            span.addEventListener("dblclick", () => {
                if (this.isDblClick) return
                this.editGroupName(span, i, groupKey)
            });
        }
    }

    editGroupName = (span: HTMLSpanElement, groupNumber: number, emoji: string) => {
        const { plugin } = this
        const { settings } = plugin
        const currentValue = settings.groupsNames[groupNumber] || "";
        span.innerHTML = `<input type="text" value="${currentValue}" />`;

        const input = span.querySelector("input");
        input?.focus();

        input?.addEventListener("blur", () => {
            setTimeout(() => {
                if (this.isDblClick) return
                input.value ? settings.groupsNames[groupNumber] = input.value :
                    settings.groupsNames[groupNumber] = Groups[groupNumber];
                span.textContent = `${emoji}${input.value}`;
                this.onOpen();
            }, 100);
        });

        input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                if (this.isDblClick) return
                input.value ? settings.groupsNames[groupNumber] = input.value :
                    settings.groupsNames[groupNumber] = Groups[groupNumber];
                span.textContent = `${emoji}${input.value}`
                this.onOpen()
            }
        });
    };

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
            let itemContainer = this.items.createEl("div", { cls: "qps-item-line" });
            itemToggleClass(this, pluginItem, itemContainer)
            itemTogglePluginButton(this, pluginItem, itemContainer)
            const text = itemTextComponent(pluginItem, itemContainer)
            text.readOnly = true
            const indices = pluginItem.groupInfo.groupIndices
            if (indices.length) {
                const content = this.getContent(pluginItem, indices);
                text.insertAdjacentHTML("afterend", content);

                if (indices.length >= 3) {
                    const [valeur0, valeur1, ...part2] = indices;
                    const part1 = [valeur0, valeur1];

                    const content1 = this.getContent(pluginItem, part1);
                    text.insertAdjacentHTML("afterend", content1);

                    const content2 = this.getContent(pluginItem, part2);
                    text.insertAdjacentHTML("afterend", content2);
                }
            }
            itemContainer.addEventListener("dblclick", async (evt) => {
                const { plugin } = this
                const {settings} = plugin
                const currentValue = pluginItem.time
                const container = itemContainer
                itemContainer.innerHTML = `<input type="text" value="${currentValue}" />`;
                this.isDblClick = true

                const input = itemContainer.querySelector("input");
                input?.focus();
                if (!pluginItem.delayed) {
                    input?.addEventListener("keydown", async (event) => {//remove keydown
                        if (event.key === "Enter") {
                            this.addDelay(pluginItem, input, itemContainer, container)
                            this.isDblClick = false
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
                    await (this.app as any).plugins.disablePluginAndSave(pluginItem.id)
                    await (this.app as any).plugins.enablePluginAndSave(pluginItem.id)
                    removeItem(settings.delayedPlugins, pluginItem)
                    this.isDblClick = false
                    await plugin.saveSettings();
                    itemContainer = container
                    this.onOpen();
                }

            })

            text.addEventListener("click", (evt) => {
                if (this.isDblClick) return
                this.handleHotkeys(evt, pluginItem, text)
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

        if (pluginItem.enabled) {
            await (this.app as any).plugins.disablePluginAndSave(pluginItem.id)
            await (this.app as any).plugins.enablePlugin(pluginItem.id)
            // this.onOpen()
            if (!this.plugin.settings.delayedPlugins.some((plugin) => plugin.id === pluginItem.id))
                this.plugin.settings.delayedPlugins.push(pluginItem)
        }
        if (pluginItem.time === 0) {
            pluginItem.delayed = false
        }
        await this.plugin.saveSettings();
        itemContainer = container
        this.onOpen();
    }

    getContent(pluginItem: PluginInfo, indices: number[]) {
        const len = indices.length
        let background = "";
        if (len === 1) {
            const { color } = getEmojiForGroup(indices[len - 1]);
            background = `background: ${color};`;
        } else if (len === 2) {
            const { color: color1 } = getEmojiForGroup(indices[len - 2]);
            const { color: color2 } = getEmojiForGroup(indices[len - 1]);
            background = `background: linear-gradient(90deg, ${color1} 50%, ${color2} 50%);`;
        }

        // style="background: linear-gradient(90deg, red 50%, yellow 50%);"
        const content = `<div
            style="${background}"
            class="qps-item-line-group"
            >
            &nbsp;
            </div>
            `
        return content
    }

    handleHotkeys = async (evt: MouseEvent, pluginItem: PluginInfo, itemContainer: HTMLInputElement) => {
        if (pluginItem.id === "quick-plugin-switcher") return
        const numberOfGroups = this.plugin.settings.numberOfGroups;
        const keyToGroupMap: Record<string, number> = {};

        // Generate keyToGroupMap based on the number of groups available
        for (let i = 1; i <= numberOfGroups; i++) {
            keyToGroupMap[i.toString()] = i;
        }

        const handleKeyDown = async (event: KeyboardEvent) => {
            if(this.isDblClick) return
            const keyPressed = event.key;
            if (keyPressed in keyToGroupMap) {
                const groupIndex = parseInt(keyPressed);
                if (pluginItem.groupInfo.groupIndices.length === 4) return
                const index = pluginItem.groupInfo.groupIndices.indexOf(groupIndex);
                if (index === -1) {
                    pluginItem.groupInfo.groupIndices?.push(groupIndex);
                    await this.plugin.saveSettings()
                    this.onOpen();
                }
            } else if (keyPressed === "Delete" || keyPressed === "Backspace" ||
                keyPressed === "0") {
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
            // this.onOpen();
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
        contentEl.createEl("h1", { text: "Quick Plugin Switcher" });
        const content = `
        <b>Warning:</b> to make this new version work, a reset is needed.
        you will loose previous added groups. Sorry for the inconvenience. <br><br>
        <b>Important:</b> you have to click plugin items now before to use shortcuts.<br>
        you can click several plugins then a shortcut. <br><br>
        <b>New feature:</b> you can now change groups name by double cliking them, 
        and reset value to default just entering nothing and validating (with return or clicking on the modal UI).
        I will add a gif in the github help
        `
        contentEl.createDiv("", (el: HTMLDivElement) => {
            el.innerHTML = content;
        });
    }

    async onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.plugin.settings.savedVersion = this.plugin.manifest.version;
        this.plugin.settings.allPluginsList = []
        await this.plugin.saveSettings();
    }
}
