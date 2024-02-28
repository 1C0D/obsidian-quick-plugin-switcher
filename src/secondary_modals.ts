import {
	App,
	ButtonComponent,
	Component,
	MarkdownRenderer,
	Menu,
	Modal,
	Notice,
	Platform,
	Scope,
	Setting,
} from "obsidian";
import QuickPluginSwitcher from "./main";
import { CPModal, getManifest, getReadMe, handleNote } from "./community-plugins_modal";
import { isInstalled, modifyGitHubLinks, openPluginSettings, reOpenModal, showHotkeysFor } from "./modal_utils";
import { base64ToUint8Array, getSelectedContent, isEnabled } from "./utils";
import { openGitHubRepo, getHkeyCondition } from "./modal_components";
import { translation } from "./translate";
import { PluginCommInfo, PluginInstalled } from "./types/global";
import { Console } from "./Console";

// for plugin description
export class DescriptionModal extends Modal {
	constructor(
		app: App,
		public plugin: QuickPluginSwitcher,
		public pluginItem: PluginInstalled
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
		contentEl.createEl("p", { text: pluginItem.description });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

type ConfirmCallback = (confirmed: boolean) => void;

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
		contentEl.empty();
		const id = pluginItem.id;

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
			.onClick(async (e) => {
				await openGitHubRepo(e, this.modal, pluginItem);
			});

		const divButtons = contentEl.createDiv({ cls: "read-me-buttons" });
		if (!isInstalled(id)) {
			new ButtonComponent(divButtons)
				.setButtonText("Install")
				.setCta()
				.onClick(async () => {
					const manifest = await getManifest(this.modal, id);
					if (!manifest) {
						new Notice(`Manifest ${id} not found`, 2500);
						return
					}
					const lastVersion = manifest.version
					await this.app.plugins.installPlugin(pluginItem.repo, lastVersion ?? "", manifest);
					new Notice(`${pluginItem.name} installed`, 2500);
					await this.onOpen();
					await reOpenModal(this.modal);
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
						this.modal.plugin.installedUpdate()
						new Notice(`${pluginItem.name} enabled`, 2500);
						await reOpenModal(this.modal);
					});
			} else {
				const pluginSettings = this.modal.app.setting.openTabById(pluginItem.id);
				if (pluginSettings) {
					new ButtonComponent(divButtons)
						.setButtonText("Options")
						.onClick(async (e) => {
							await openPluginSettings(e,
								this.modal,
								pluginItem
							);
						});
				}

				condition = await getHkeyCondition(this.modal, pluginItem);
				if (condition) {
					new ButtonComponent(divButtons)
						.setButtonText("Hotkeys")
						.onClick(async (e) => {
							await showHotkeysFor(e, this.modal, pluginItem);
						});
				}
				if (id !== "quick-plugin-switcher")
					new ButtonComponent(divButtons)
						.setButtonText("Disable")
						.onClick(async () => {
							await (
								this.modal.app as any
							).plugins.disablePluginAndSave(pluginItem.id);
							await this.onOpen();
							new Notice(`${pluginItem.name} disabled`, 2500);
							await reOpenModal(this.modal);
						});
			}
			if (id !== "quick-plugin-switcher")
				new ButtonComponent(divButtons)
					.setButtonText("Uninstall")
					.onClick(async () => {
						await (this.modal.app as any).plugins.uninstallPlugin(
							pluginItem.id
						);
						await this.onOpen();
						new Notice(`${pluginItem.name} uninstalled`, 2500);
						await reOpenModal(this.modal);
					});
		}

		const shortcuts = contentEl.createDiv(
			{
				cls: "read-me-shortcuts",
			},)

		const noteButton = new ButtonComponent(shortcuts)
			.setButtonText("📝")
			.onClick(async (e) => {
				await handleNote(e, this.modal, pluginItem)
			})

		if (Platform.isDesktop) {
			shortcuts.createSpan({
				text: " (t) translate selection  (n) add note"
			})
		}

		const div = contentEl.createDiv({ cls: "qps-read-me" });

		const data = await getReadMe(pluginItem);
		// const content = Buffer.from(data.content, "base64").toString("utf-8"); // Buffer not working on mobile
		if (!data) {
			Console.log("pluginItem", pluginItem)
			return
		}
		const decoder = new TextDecoder("utf-8");
		const content = decoder.decode(base64ToUint8Array(data.content));

		const updatedContent = modifyGitHubLinks(content, pluginItem);

		await MarkdownRenderer.render(this.app, updatedContent, div, "/", this.comp);

		// || add a menu with translate
		this.modalEl.addEventListener("mousemove", (event) => {
			this.mousePosition = { x: event.clientX, y: event.clientY };
		});

		this.scope.register([], "t", async () => {
			const selectedContent = getSelectedContent();
			if (!selectedContent) {
				new Notice("no selection", 4000);
				return;
			}
			await translation(selectedContent);
		});

		this.scope.register([], "n", async (e) => await handleNote(e, this.modal, pluginItem))

		this.modalEl.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			const selectedContent = getSelectedContent();
			if (selectedContent) {
				const menu = new Menu();
				menu.addItem((item) =>
					item.setTitle("Copy (Ctrl+C)").onClick(async () => {
						await navigator.clipboard.writeText(selectedContent);
					})
				);
				menu.addItem((item) =>
					item.setTitle("translate (t)").onClick(async () => {
						await translation(selectedContent);
					})
				);
				// menu.addItem((item) =>
				// 	item.setTitle("Add note Ctrl+n").onClick(async (e) => await handleNote(e, this.modal, pluginItem))
				// );
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

export class SeeNoteModal extends Modal {
	constructor(app: App, public modal: CPModal, public pluginItem: PluginCommInfo, public sectionContent: string | null, public cb: (result: string | null) => Promise<void>) {
		super(app);
	}

	onOpen() {
		const { contentEl: El } = this;
		El.createEl('h6', { text: "DON'T INCLUDE H1 titles. To delete a note delete all content.", cls: "read-me-shortcuts " })
		El.createEl('h3', { text: this.pluginItem.name + " by " + this.pluginItem.author })
		new Setting(El)
			.addTextArea((text) => {
				text.setValue(this.sectionContent ?? "")
				text.inputEl.rows = 40
				text.inputEl.cols = 82
				text.inputEl.onblur = async () => {
					this.sectionContent = text.getValue();
					const lines = this.sectionContent.split("\n");
					let stop = false
					for (const line of lines) {
						if (line.startsWith("# ")) {
							new Notice("H1 are not allowed, content was paste in clipboard", 4000);
							const clipboard = navigator.clipboard.writeText(this.sectionContent)
							await this.cb(null)
							stop = true
							break
						}
					}
					this.onClose()
					if (stop) return
					if (this.sectionContent && !this.sectionContent.endsWith("\n")) {
						this.sectionContent = this.sectionContent + "\n"
					}
					this.sectionContent
					await this.cb(this.sectionContent)
				}
			})
	}
}