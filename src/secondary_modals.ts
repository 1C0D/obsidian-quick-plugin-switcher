import { App, Modal } from "obsidian";
import QuickPluginSwitcher from "./main";
import { PluginInfo } from "./types"

// for plugin description 
export class DescriptionModal extends Modal {
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


export class GroupSelectModal extends Modal {
    constructor(app: App, public plugin: QuickPluginSwitcher, public pluginItem: PluginInfo) {
        super(app);
        this.plugin = plugin;
        this.pluginItem = pluginItem
    }

    onOpen() {
        const { contentEl, pluginItem } = this;
        contentEl.empty();

    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}