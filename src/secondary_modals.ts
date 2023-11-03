import {
	App,
	ButtonComponent,
	Component,
	MarkdownRenderer,
	Modal,
	Notice,
	Setting,
} from "obsidian";
import QuickPluginSwitcher from "./main";
import { PluginCommInfo, PluginInfo } from "./types";
import { CPModal, getReadMe } from "./community-plugins_modal";
import { isInstalled, reOpenModal } from "./modal_utils";
import {
	getCondition,
	installLatestPluginVersion,
	openPluginSettings,
	showHotkeysFor,
} from "./modal_components";
import { isEnabled } from "./utils";

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
	comp: Component;
	constructor(
		app: App,
		public modal: CPModal,
		public pluginItem: PluginCommInfo
	) {
		super(app);
		this.modal = modal;
		this.pluginItem = pluginItem;
		this.modalEl.addClass("read-me-modal");
		this.comp = new Component();
		this.comp.load();
	}

	async onOpen() {
		const { contentEl, pluginItem } = this;
		// this.modalEl.addClass("read-me-modal");
		contentEl.empty();

		contentEl
			.createEl("p", {
				text: pluginItem.name,
				cls: "readme-title",
			})
			.createEl("p", {
				text: "By: " + pluginItem.author,
			});

		const divButtons = contentEl.createDiv({ cls: "read-me-buttons" });
		if (!isInstalled(pluginItem)) {
			new ButtonComponent(divButtons)
				.setButtonText("Install")
				.setCta()
				.onClick(async () => {
					await installLatestPluginVersion(this.modal, pluginItem);
					new Notice(`${pluginItem.name} installed`, 4000);
					await this.onOpen();
				});
		} else {
			const manifests = (this.app as any).plugins.manifests || {};
			let condition: boolean;
			if (!isEnabled(this.modal, manifests[pluginItem.id].id)) {
				new ButtonComponent(divButtons)
					.setButtonText("Enable")
					.onClick(async () => {
						await (
							this.modal.app as any
						).plugins.enablePluginAndSave(pluginItem.id);
						await this.onOpen();
						condition = await getCondition(this.modal, pluginItem);
						if (condition) await this.onOpen();
						new Notice(`${pluginItem.name} enabled`, 4000);
					});
			} else {
				const pluginSettings = await (
					this.modal.app as any
				).setting.openTabById(pluginItem.id);
				if (pluginSettings)
					{new ButtonComponent(divButtons)
						.setButtonText("Options")
						.onClick(async () => {
							await openPluginSettings(
								this.modal,
								pluginSettings
							);
						});}

				condition = await getCondition(this.modal, pluginItem);
				if (condition) {
					new ButtonComponent(divButtons)
						.setButtonText("Hotkeys")
						.onClick(async () => {
							await showHotkeysFor(pluginItem, condition);
						});
				}

				new ButtonComponent(divButtons)
					.setButtonText("Disable")
					.onClick(async () => {
						await (
							this.modal.app as any
						).plugins.disablePluginAndSave(pluginItem.id);
						await this.onOpen();
						new Notice(`${pluginItem.name} disabled`, 4000);
					});
			}
			new ButtonComponent(divButtons)
				.setButtonText("Uninstall")
				.onClick(async () => {
					await (this.modal.app as any).plugins.uninstallPlugin(
						pluginItem.id
					);
					await this.onOpen();
					new Notice(`${pluginItem.name} uninstalled`, 4000);
				});
		}

		const div = contentEl.createDiv({ cls: "qps-read-me" });

		const data = await getReadMe(pluginItem);
		const content = Buffer.from(data.content, "base64").toString("utf-8");

		const updatedContent = modifyGitHubLinks(content, pluginItem);

		MarkdownRenderer.render(this.app, updatedContent, div, "/", this.comp);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.comp.unload();
	}
}

function modifyGitHubLinks(content: string, pluginItem: PluginCommInfo) {
	const regex = /!\[([^\]]*)\]\(([^)]*)\)/g;
	return content
		.replace(/\/blob\//g, "/raw/")
		.replace(regex, (match, alt, url) => {
			if (!url.startsWith("http")) {
				if (url.startsWith(".")) {
					url = `https://github.com/${
						pluginItem.repo
					}/raw/master${url.substr(1)}`;
				} else {
					url = `https://github.com/${pluginItem.repo}/raw/master/${url}`;
				}
			}
			return `![${alt}](${url})`;
		});
}
