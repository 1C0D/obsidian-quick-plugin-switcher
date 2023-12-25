import {
	App,
	DropdownComponent,
	KeyToSettingsMapType,
	Menu,
	Modal,
	Platform,
	PluginInfo,
	ToggleComponent,
	setIcon,
} from "obsidian";
import { removeItem } from "./utils";
import QuickPluginSwitcher from "./main";
import {
	mostSwitchedResetButton,
	itemToggleClass,
	itemTextComponent,
	openGitHubRepo,
	searchDivButtons,
	handleContextMenu,
	addSearch,
	handleDblClick,
	findMatchingItem,
	handleClick,
	doSearchQPS,
} from "./modal_components";
import {
	createInput,
	delayedReEnable,
	openDirectoryInFileManager,
	pressDelay,
	togglePlugin,
	reOpenModal,
	openPluginSettings,
	showHotkeysFor,
	getElementFromMousePosition,
	modeSort,
} from "./modal_utils";
import { DescriptionModal } from "./secondary_modals";
import { Filters, Groups } from "./types/variables";
import { addButton } from "./settings";
import { setGroupTitle, byGroupDropdowns, getEmojiForGroup, getCirclesItem, rmvAllGroupsFromPlugin, groupIsEmpty } from "./groups";
import { CPModal } from "./community-plugins_modal";

export class QPSModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	searchTyping = true;
	groups: HTMLElement;
	hotkeysDesc: HTMLElement;
	isDblClick = false;
	mousePosition: any;
	pressed = false;
	searchInit = true;

	constructor(app: App, public plugin: QuickPluginSwitcher) {
		super(app);
		this.plugin = plugin;
	}

	getMousePosition = (event: MouseEvent) => {
		this.mousePosition = { x: event.clientX, y: event.clientY };
	};
	getHandleKeyDown = async (event: KeyboardEvent) => {
		await handleKeyDown(event, this);
	}
	getHandleContextMenu = (evt: MouseEvent) => {
		if (this.isDblClick) return;
		handleContextMenu(evt, this);
	}
	getHandleDblClick = (evt: MouseEvent) => {
		if (this.isDblClick) return;
		handleDblClick(evt, this);
	}
	getHandleClick = async (evt: MouseEvent) => {
		await handleClick(evt, this);
	}

	removeListeners() {
		this.modalEl.removeEventListener("mousemove", this.getMousePosition);
		document.removeEventListener("keydown", this.getHandleKeyDown);
		this.modalEl.removeEventListener("contextmenu", this.getHandleContextMenu);
		this.modalEl.removeEventListener("dblclick", this.getHandleDblClick);
		this.modalEl.removeEventListener("click", this.getHandleClick);
	}

	container() {
		const { contentEl } = this;
		this.modalEl.addClass("qps-modal");
		this.header = contentEl.createEl("div", {
			cls: "qps-header",
		});
		this.search = contentEl.createEl("div", { cls: "qps-search" });
		this.groups = contentEl.createEl("div", { cls: "qps-groups" });
		this.hotkeysDesc = contentEl.createEl("p", { cls: "qps-hk-desc" });
		if (this.plugin.settings.showReset) addButton(contentEl, this.plugin)
		this.items = contentEl.createEl("div", { cls: "qps-items" });

		this.modalEl.addEventListener("mousemove", this.getMousePosition);
		document.addEventListener("keydown", this.getHandleKeyDown);
		this.modalEl.addEventListener("contextmenu", this.getHandleContextMenu);
		this.modalEl.addEventListener("dblclick", this.getHandleDblClick);
		this.modalEl.addEventListener("click", this.getHandleClick);
	}

	async onOpen() {
		this.removeListeners()
		const { plugin, contentEl } = this;
		const { settings } = plugin;
		if (this.searchInit) settings.search = "";
		else this.searchInit = true;
		contentEl.empty();
		this.container();
		setGroupTitle(this, Groups, settings.numberOfGroups);
		this.addHeader(this.header);
		await addSearch(this, this.search, "Search plugins");
		searchDivButtons(this, this.search);
		this.addGroups(this.groups);
		if (settings.showHotKeys) this.setHotKeysdesc();
		await this.addItems(settings.search);
	}

	addHeader = (contentEl: HTMLElement): void => {
		const { plugin } = this;
		const { settings } = plugin;
		new DropdownComponent(contentEl)
			.addOptions({
				all: `All(${plugin.lengthAll})`,
				enabled: `Enabled(${plugin.lengthEnabled})`,
				disabled: `Disabled(${plugin.lengthDisabled})`,
				enabledFirst: `Enabled First(${plugin.lengthAll})`,
				mostSwitched: `Most Switched(${plugin.lengthAll})`,
				byGroup: `By Group`,
			})
			.setValue(settings.filters)
			.onChange(async (value: keyof typeof Filters) => {
				settings.filters = value;
				await plugin.saveSettings();
				await reOpenModal(this);
			});

		mostSwitchedResetButton(this, contentEl);

		byGroupDropdowns(this, contentEl);
	};

	addGroups(contentEl: HTMLElement): void {
		const groups = Object.values(Groups);

		for (let i = 1; i < groups.length; i++) {
			const groupKey = groups[i];

			contentEl.createEl(
				"span",
				{
					cls: "qps-group-span-container",
				},
				(cont) => {
					cont.createEl(
						"span",
						{
							cls: "qps-circle-title-group",
						},
						(el) => {
							circleCSSModif(this, el, i);
						}
					);

					const span = cont.createEl("span", {
						cls: "qps-groups-name",
						text: `${groupKey}`,
					}, (el) => {
						const { plugin } = this;
						const { settings } = plugin;
						const hidden = settings.groups[i]?.hidden
						if (hidden) {
							el.style.textDecoration = "line-through"
						} else {
							el.style.textDecoration = "none"
						}
					});

					const groupNumberText = `(<span class="shortcut-number">${i}</span>)`;
					span.insertAdjacentHTML("beforeend", groupNumberText);
				}
			);
		}
	}

	setHotKeysdesc(): void {
		const numberOfGroups = this.plugin.settings.numberOfGroups;
		this.hotkeysDesc.createSpan(
			{
				text: `(1-${numberOfGroups})➕ (0)❌ (f)📁 `,
			},
			(el) => {
				el.createSpan({ text: "(g)" }, (el) => {
					let gitHubIcon = el.createSpan({ cls: "git-hub-icon" });
					setIcon(gitHubIcon, "github");
				});
				el.createSpan({
					text: ` (ctrl)ℹ️ (s)⚙️ (h)⌨️ `,
				});
				el.createSpan({
					cls: "qps-hk-desc-last-part",
					text: `(🖱️x2)delay`,
				});
			}
		);
	}

	async addItems(value: string) {
		const { plugin } = this;
		const { settings } = plugin;
		const { allPluginsList } = settings;
		// const previousValue = settings.search;
		let listItems = doSearchQPS(value, allPluginsList) as PluginInfo[];
		listItems = modeSort(plugin, listItems);
		// Sort for chosen mode
		// toggle plugin
		for (const pluginItem of listItems) {
			// don't show hiddens except if Filters.ByGroup
			if (settings.filters !== Filters.ByGroup && pluginItem.groupInfo.hidden === true) {
				continue
			}

			if (
				(settings.filters === Filters.Enabled && !pluginItem.enabled) ||
				(settings.filters === Filters.Disabled && pluginItem.enabled)
			) {
				continue;
			}

			// create items
			let itemContainer = this.items.createEl("div", {
				cls: "qps-item-line",
			});
			itemTogglePluginButton(this, pluginItem, itemContainer);
			const input = itemTextComponent(pluginItem, itemContainer);
			itemToggleClass(this, pluginItem, itemContainer);
			input.readOnly = true;
			// create groups circles
			addGroupCircles(input, pluginItem);

			// create temp input in input to modify delayed entering time
			itemContainer.addEventListener("dblclick", async (evt) => {
				if (pluginItem.id === "quick-plugin-switcher") return;
				const { plugin } = this;
				const currentValue = pluginItem.time.toString();
				this.isDblClick = true;
				if (!itemContainer) {
					return;
				}
				const input = createInput(itemContainer, currentValue);

				if (!pluginItem.delayed) {
					input?.addEventListener("keydown", async (event: KeyboardEvent) => {
						if (event.key === "Enter") {
							setTimeout(async () => {
								this.addDelay(pluginItem, input);
								this.isDblClick = false;
							}, 100);
						}
					});
					input?.addEventListener("blur", () => {
						setTimeout(async () => {
							this.addDelay(pluginItem, input);
							this.isDblClick = false;
						}, 100);
					});
				} else {
					pluginItem.delayed = false;
					await this.app.plugins.enablePluginAndSave(
						pluginItem.id
					);
					this.isDblClick = false;
					await plugin.saveSettings();
					await reOpenModal(this);
				}
			});
		}
	}

	addDelay = async (pluginItem: PluginInfo, input: HTMLInputElement) => {
		pluginItem.delayed = true;
		pluginItem.time = parseInt(input.value) || 0;

		if (pluginItem.time === 0) {
			pluginItem.delayed = false;
		}
		if (pluginItem.delayed && pluginItem.enabled) {
			delayedReEnable(this, pluginItem);
		}
		await this.plugin.saveSettings();
		await reOpenModal(this);
	};

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.removeListeners()
	}
}

export function circleCSSModif(
	modal: QPSModal | CPModal,
	el: HTMLSpanElement,
	groupIndex: number
) {
	const { color } = getEmojiForGroup(groupIndex);
	el.style.backgroundColor = color;
	if (modal instanceof QPSModal) {
		const { settings } = modal.plugin;
		el.textContent = (
			settings.groups[groupIndex]?.time ? settings.groups[groupIndex].time : ""
		).toString();
	}
}

const itemTogglePluginButton = (
	modal: QPSModal,
	pluginItem: PluginInfo,
	itemContainer: HTMLDivElement
) => {
	let disable = pluginItem.id === "quick-plugin-switcher";
	const toggleButton = new ToggleComponent(itemContainer)
		.setValue(pluginItem.enabled)
		.setDisabled(disable) //quick-plugin-switcher disabled
		.onChange(async () => {
			modal.searchInit = false;
			await togglePlugin(modal, pluginItem);
		});
};

const addGroupCircles = (input: HTMLElement, item: PluginInfo) => {
	const indices = item.groupInfo.groupIndices;
	if (!indices.length) return;
	if (indices.length < 3) {
		const content = getCirclesItem(indices);
		input.insertAdjacentHTML("afterend", content);
	}

	if (indices.length >= 3 && indices.length < 5) {
		// 2 circles
		const [valeur0, valeur1, ...part2] = indices;
		const part1 = [valeur0, valeur1];

		const content1 = getCirclesItem(part1);
		input.insertAdjacentHTML("afterend", content1);

		const content2 = getCirclesItem(part2);
		input.insertAdjacentHTML("afterend", content2);
	} else if (indices.length >= 5) {
		// 3 circles
		const [valeur0, valeur1, valeur2, valeur3, ...part3] = indices;
		const part1 = [valeur0, valeur1];
		const part2 = [valeur2, valeur3];

		const content1 = getCirclesItem(part1);
		input.insertAdjacentHTML("afterend", content1);

		const content2 = getCirclesItem(part2);
		input.insertAdjacentHTML("afterend", content2);

		const content3 = getCirclesItem(part3);
		input.insertAdjacentHTML("afterend", content3);
	}
};

async function handleKeyDown(event: KeyboardEvent, modal: QPSModal) {
	const elementFromPoint = getElementFromMousePosition(event, modal);
	const pluginItemBlock = elementFromPoint?.closest(
		".qps-item-line"
	) as HTMLElement;

	if (pluginItemBlock) {
		modal.searchTyping = false;
		const matchingItem = findMatchingItem(modal, pluginItemBlock);
		if (matchingItem) {
			await handleHotkeysQPS(modal, event, matchingItem as PluginInfo);
		}
	} else {
		modal.searchTyping = true;
	}
}

const handleHotkeysQPS = async (
	modal: QPSModal,
	evt: KeyboardEvent,
	pluginItem: PluginInfo
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const numberOfGroups = settings.numberOfGroups;

	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: async () => await openGitHubRepo(pluginItem),
		s: async () => await openPluginSettings(modal, pluginItem),
		h: async () => await showHotkeysFor(modal, pluginItem),
	};
	if (Platform.isDesktopApp)
		KeyToSettingsMap["f"] = async () =>
			await openDirectoryInFileManager(modal, pluginItem);

	const keyPressed = evt.key;
	if (!pluginItem.groupInfo) {
		pluginItem.groupInfo = {
			groupIndices: [], groupWasEnabled: false, hidden: false
		}
		await modal.plugin.saveSettings();
		await reOpenModal(modal);
	}
	if (modal.pressed) {
		return;
	}
	pressDelay(modal);

	if (modal.isDblClick) return;
	const groupIndices = pluginItem.groupInfo.groupIndices;
	const key = parseInt(keyPressed);
	if (
		key > 0 &&
		key <= numberOfGroups &&
		!(pluginItem.id === "quick-plugin-switcher")
	) {
		if (groupIndices.length === 6) return;
		const index = groupIndices.indexOf(key);
		if (index === -1) {
			groupIndices?.push(key);
			await plugin.saveSettings();
			await reOpenModal(modal);
		}
	} else if (keyPressed in KeyToSettingsMap) {
		KeyToSettingsMap[keyPressed]();
	} else if (evt.metaKey || evt.ctrlKey) {
		new DescriptionModal(plugin.app, plugin, pluginItem).open()
	} else if (
		(keyPressed === "Delete" ||
			keyPressed === "Backspace" ||
			keyPressed === "0") &&
		!(pluginItem.id === "quick-plugin-switcher")
	) {
		if (!groupIndices.length) return;
		if (groupIndices.length === 1) {
			const groupIndex = groupIndices[0];
			pluginItem.groupInfo.groupIndices = [];
			if (groupIsEmpty(groupIndex, modal)) {
				settings.selectedGroup = "SelectGroup";
			}
			await plugin.saveSettings();
			await reOpenModal(modal);
		} else {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle("Remove item group(s)")
					.setDisabled(true)
					.setDisabled(true)
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item.setTitle("All").onClick(async () => {
					await rmvAllGroupsFromPlugin(modal, pluginItem);
				})
			);
			for (const groupIndex of groupIndices) {
				const { emoji } = getEmojiForGroup(groupIndex);
				menu.addItem((item) =>
					item
						.setTitle(`${emoji} group ${groupIndex}`)
						.onClick(async () => {
							pluginItem.groupInfo.groupIndices = removeItem(
								pluginItem.groupInfo.groupIndices,
								groupIndex
							);
							await plugin.saveSettings();
							await reOpenModal(modal);
						})
				);
			}
			menu.showAtPosition(modal.mousePosition);
		}
	}
};

