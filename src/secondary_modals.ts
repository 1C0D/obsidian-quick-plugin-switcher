import {
	App,
	ButtonComponent,
	Component,
	MarkdownRenderer,
	Menu,
	Modal,
	Notice,
	PluginCommInfo,
	PluginInfo,
	Scope,
	Setting,
} from "obsidian";
import QuickPluginSwitcher from "./main";
import { CPModal, getManifest, getReadMe } from "./community-plugins_modal";
import { getLatestPluginVersion, isInstalled, openPluginSettings, showHotkeysFor } from "./modal_utils";
import { isEnabled } from "./utils";
import { openGitHubRepo, getCommandCondition, getHkeyCondition } from "./modal_components";

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
	mousePosition: any;
	scope: Scope = new Scope(this.app.scope);
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

		const openRepo = contentEl.createDiv();
		new ButtonComponent(openRepo)
			.setButtonText("GitHub Repo")
			.onClick(async () => {
				await openGitHubRepo(pluginItem);
			});

		const divButtons = contentEl.createDiv({ cls: "read-me-buttons" });
		if (!isInstalled(pluginItem)) {
			new ButtonComponent(divButtons)
				.setButtonText("Install")
				.setCta()
				.onClick(async () => {
					const lastVersion = await getLatestPluginVersion(this.modal, pluginItem);
const manifest = await getManifest(pluginItem);
					await this.app.plugins.installPlugin(pluginItem.repo, lastVersion??"", manifest);
					new Notice(`${pluginItem.name} installed`, 2500);
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
						condition = await getCommandCondition(
							this.modal,
							pluginItem
						);
						if (condition) await this.onOpen();
						new Notice(`${pluginItem.name} enabled`, 2500);
					});
			} else {
				const pluginSettings = await (
					this.modal.app as any
				).setting.openTabById(pluginItem.id);
				if (pluginSettings) {
					new ButtonComponent(divButtons)
						.setButtonText("Options")
						.onClick(async () => {
							await openPluginSettings(
								this.modal,
								pluginItem
							);
						});
				}

				condition = await getHkeyCondition(this.modal, pluginItem);
				if (condition) {
					new ButtonComponent(divButtons)
						.setButtonText("Hotkeys")
						.onClick(async () => {
							await showHotkeysFor(this.modal, pluginItem);
						});
				}

				new ButtonComponent(divButtons)
					.setButtonText("Disable")
					.onClick(async () => {
						await (
							this.modal.app as any
						).plugins.disablePluginAndSave(pluginItem.id);
						await this.onOpen();
						new Notice(`${pluginItem.name} disabled`, 2500);
					});
			}
			new ButtonComponent(divButtons)
				.setButtonText("Uninstall")
				.onClick(async () => {
					await (this.modal.app as any).plugins.uninstallPlugin(
						pluginItem.id
					);
					await this.onOpen();
					new Notice(`${pluginItem.name} uninstalled`, 2500);
				});
		}

		const div = contentEl.createDiv({ cls: "qps-read-me" });

		const data = await getReadMe(pluginItem);
		const content = Buffer.from(data.content, "base64").toString("utf-8");

		const updatedContent = modifyGitHubLinks(content, pluginItem);

		await MarkdownRenderer.render(this.app, updatedContent, div, "/", this.comp);

		// || add a menu with translate
		this.modalEl.addEventListener("mousemove", (event) => {
			this.mousePosition = { x: event.clientX, y: event.clientY };
		});

		this.scope.register(["Ctrl"], "t", async () => {
			const selectedContent = getSelectedContent();
			if (!selectedContent) {
				new Notice("no selection", 4000);
				return;
			}
			await translation(selectedContent);
		});

		this.modalEl.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			const selectedContent = getSelectedContent();
			if (selectedContent) {
				const menu = new Menu();
				menu.addItem((item) =>
					item.setTitle("Copy Ctrl+C").onClick(async () => {
						await navigator.clipboard.writeText(selectedContent);
					})
				);
				menu.addItem((item) =>
					item.setTitle("translate").onClick(async () => {
						await translation(selectedContent);
					})
				);
				menu.showAtPosition(this.mousePosition);
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.comp.unload();
	}
}

function getSelectedContent() {
	const selection = window.getSelection();
	return selection?.toString();
}

function canTranslate() {
	return this.plugin.translator && this.plugin.translator.valid;
}

async function translate(text: string, from: string) {
	let to = "";
	const plugin = (this.app as any).plugins.plugins.translate;
	if (!plugin) {
		new Notice(
			"install obsidian-translate and select a translator"
		);
		return;
	}
	if (!canTranslate) {
		new Notice("translator not valid. check your settings", 4000);
		return;
	}
	const loaded_settings = await plugin.loadData();

	if (loaded_settings.target_language_preference === "last") {
		to = loaded_settings.last_used_target_languages[0];
	} else if (loaded_settings.target_language_preference === "specific") {
		to = loaded_settings.default_target_language;
	} else if (loaded_settings.target_language_preference === "display") {
		to = plugin.current_language;
	}

	return plugin.translator.translate(text, from, to);
}

async function translation(selectedContent: string) {
	const translated = await translate(selectedContent, "en");
	if (!translated) return;
	const translation = translated.translation;
	if (!translation) {
		new Notice("translator not valid. check your settings", 4000);
		return;
	}
	new TranslateModal(this.app, translation).open();
}

export class TranslateModal extends Modal {
	constructor(app: App, public message: string) {
		super(app);
		this.modalEl.addClass("translate-modal");
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		const lines = this.message.split("\n");
		lines.forEach((line) => contentEl.createEl("p").setText(line));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

function modifyGitHubLinks(content: string, pluginItem: PluginCommInfo) {
	const regex = /!\[([^\]]*)\]\(([^)]*)\)/g;
	return content
		.replace(/\/blob\//g, "/raw/")
		.replace(regex, (match, alt, url) => {
			if (!url.startsWith("http")) {
				if (url.startsWith(".")) {
					url = `https://github.com/${pluginItem.repo
						}/raw/HEAD${url.substr(1)}`;
				} else {
					url = `https://github.com/${pluginItem.repo}/raw/HEAD/${url}`;
				}
			}
			return `![${alt}](${url})`;
		});
}