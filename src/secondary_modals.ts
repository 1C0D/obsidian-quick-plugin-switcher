import { App, ButtonComponent, ExtraButtonComponent, Modal, TextComponent } from "obsidian";
import QuickPluginSwitcher from "./main";
import { PluginInfo } from "./types"
import { QPSModal } from "./modal";
import { removeItem } from "./utils";

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


export class RemoveFromGroupModal extends Modal {
    constructor(app: App, public pluginItem: PluginInfo, public modal: QPSModal) {
        super(app);
    }

    onOpen() {
        const { contentEl, pluginItem } = this;
        contentEl.empty();

        contentEl.createEl("h6", { text: "Remove Item Group(s)" })

        const all = contentEl.createEl("div", { cls: "remove-item-groups" })
        // button to delete all groups
        new ButtonComponent(all)
            .setButtonText("All")
            .onClick(() => {
                pluginItem.groupInfo.groupIndices = [];
                this.close();
                this.modal.onOpen()
            });

        // button to delete group
        for (const groupIndex of pluginItem.groupInfo.groupIndices) {
            new ButtonComponent(all)
                .setButtonText(`group ${groupIndex}`)
                .onClick(() => {
                    pluginItem.groupInfo.groupIndices = removeItem(pluginItem.groupInfo.groupIndices, groupIndex);
                    this.close();
                    this.modal.onOpen();
                });
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}