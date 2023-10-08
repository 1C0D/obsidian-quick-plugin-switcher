import { App, Modal, Setting } from "obsidian";
import QuickPluginSwitcher from "./main";
import { PluginCommInfo, PluginInfo } from "./types";
import { CPModal, getReadMe } from "./community-plugins_modal";

type ConfirmCallback = (confirmed: boolean) => void;

// for plugin description
export class DescriptionModal extends Modal {
	constructor(
		app: App,
		public plugin: QuickPluginSwitcher,
		public pluginItem: PluginInfo
	) {
		super(app);
		this.plugin = plugin;
		this.pluginItem = pluginItem;
	}

	onOpen() {
		const { contentEl, pluginItem } = this;
		contentEl.empty();
		contentEl
			.createEl("p", {
				text: pluginItem.name + " - v" + pluginItem.version,
			})
			.createEl("p", {
				text:
					"author: " +
					pluginItem.author +
					", url: " +
					(pluginItem.authorUrl ? "" : "null"),
			})
			.createEl("a", {
				text: pluginItem.authorUrl,
				href: pluginItem.authorUrl,
			});
		contentEl.createEl("p", { text: pluginItem.desc });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ConfirmModal extends Modal {
	constructor(
		app: App,
		public message: string,
		public callback: ConfirmCallback,
		public width?: number,
		public height?: number
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		if (this.width) {
			this.modalEl.style.width = `${this.width}px`;
		}

		if (this.height) {
			this.modalEl.style.height = `${this.height}px`;
		}

		contentEl.createEl("p").setText(this.message);

		new Setting(this.contentEl)
			.addButton((b) => {
				b.setIcon("checkmark")
					.setCta()
					.onClick(() => {
						this.callback(true);
						this.close();
					});
			})
			.addExtraButton((b) =>
				b.setIcon("cross").onClick(() => {
					this.callback(false);
					this.close();
				})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

async function openConfirmModal(
	app: App,
	message: string,
	width?: number,
	height?: number
): Promise<boolean> {
	return await new Promise((resolve) => {
		new ConfirmModal(
			app,
			message,
			(confirmed: boolean) => {
				resolve(confirmed);
			},
			width ?? undefined,
			height ?? undefined
		).open();
	});
}

export async function confirm(
	message: string,
	width?: number,
	height?: number
): Promise<boolean> {
	return await openConfirmModal(
		this.app,
		message,
		width ?? undefined,
		height ?? undefined
	);
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
        `;
		contentEl.createDiv("", (el: HTMLDivElement) => {
			el.innerHTML = content;
		});
	}

	async onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class ReadMeModal extends Modal {
	constructor(
		app: App,
		public modal: CPModal,
		public pluginItem: PluginCommInfo
	) {
		super(app);
		this.modal = modal;
		this.pluginItem = pluginItem;
		this.modalEl.addClass("read-me-modal");
	}

	async onOpen() {
		const { contentEl, pluginItem } = this;
		contentEl.empty();
		contentEl
			.createEl("p", {
				text: pluginItem.name,
			})
			.createEl("p", {
				text: "By: " + pluginItem.author,
			});
		const div = contentEl.createDiv({ cls: "qps-read-me" });
		const data = await getReadMe(pluginItem);
		const content = Buffer.from(data.content, "base64").toString("utf-8");
		const updatedContent = content
			.replace(/\/blob\//g, "/raw/")
			.replace(
				/\]\(\.\//g,
				`](https://github.com/${pluginItem.repo}/raw/master/`
			);
		var MarkdownIt = require("markdown-it"),
			md = new MarkdownIt();
		var htmlContent = md.render("---\n" + updatedContent);
		div.innerHTML = htmlContent;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
