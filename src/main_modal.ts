import {
	App,
	DropdownComponent,
	Menu,
	Modal,
	Platform,
	ToggleComponent,
	setIcon,
} from "obsidian";
import { Groups, KeyToSettingsMapType, PluginInfo, QPSSettings } from "./types";
import { removeItem } from "./utils";
import QuickPluginSwitcher from "./main";
import {
	modeSort,
	mostSwitchedResetButton,
	itemToggleClass,
	itemTextComponent,
	openGitHubRepo,
	openPluginSettings,
	showHotkeysFor,
	searchDivButtons,
	handleContextMenu,
	doSearch,
	addSearch,
	handleDblClick,
	getElementFromMousePosition,
	findMatchingItem,
	byGroupDropdowns,
	getHkeyCondition,
} from "./modal_components";
import {
	createInput,
	delayedReEnable,
	getCirclesItem,
	getEmojiForGroup,
	setGroupTitle,
	groupNotEmpty,
	openDirectoryInFileManager,
	pressDelay,
	rmvAllGroupsFromPlugin,
	togglePlugin,
	reOpenModal,
} from "./modal_utils";
import { DescriptionModal } from "./secondary_modals";

export class QPSModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	searchTyping= true;
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

	container() {
		const { contentEl } = this;
		this.modalEl.addClass("qps-modal");
		this.header = contentEl.createEl("div", {
			cls: "qps-header",
		});
		this.search = contentEl.createEl("div", { cls: "qps-search" });
		this.groups = contentEl.createEl("div", { cls: "qps-groups" });
		this.hotkeysDesc = contentEl.createEl("p", { cls: "qps-hk-desc" });
		this.items = contentEl.createEl("div", { cls: "qps-items" });

		this.modalEl.addEventListener("mousemove", (event) => {
			this.mousePosition = { x: event.clientX, y: event.clientY };
		});

		document.addEventListener("keydown", (event) => {
			handleKeyDown(event, this);
		});

		this.modalEl.addEventListener("contextmenu", (evt) => {
			if (this.isDblClick) return;
			handleContextMenu(evt, this);
		});

		this.modalEl.addEventListener("dblclick", (evt) => {
			if (this.isDblClick) return;
			handleDblClick(evt, this);
		});
	}

	async onOpen() {
		const { plugin, contentEl } = this;
		const { settings } = plugin;
		if (this.searchInit) settings.search = "";
		else this.searchInit = true;
		contentEl.empty();
		this.container();
		setGroupTitle(this, plugin, Groups, settings.numberOfGroups);
		this.addHeader(this.header);
		await addSearch(this, this.search, "Search plugins");
		searchDivButtons(this, this.search);
		this.addGroups(this, this.groups);
		if (settings.showHotKeys) this.setHotKeysdesc();
		await this.addItems();
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
			.setValue(settings.filters as string)
			.onChange(async (value) => {
				settings.filters = value;
				await plugin.saveSettings();
				await reOpenModal(this);
			});

		mostSwitchedResetButton(this, contentEl);

		byGroupDropdowns(this, contentEl);
	};

	addGroups(modal: QPSModal, contentEl: HTMLElement): void {
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
					text: ` (i)ℹ️ (s)⚙️ (h)⌨️ `,
				});
				el.createSpan({
					cls: "qps-hk-desc-last-part",
					text: `(🖱️x2)delay`,
				});
			}
		);
	}

	async addItems() {
		const { plugin } = this;
		const { settings } = plugin;
		const { allPluginsList } = settings;
		const value = settings.search;
		let listItems = doSearch(this, value, allPluginsList) as PluginInfo[];
		// Sort for chosen mode
		listItems = modeSort(plugin, listItems);

		// toggle plugin
		for (const pluginItem of listItems) {
			if (
				(settings.filters === "enabled" && !pluginItem.enabled) ||
				(settings.filters === "disabled" && pluginItem.enabled)
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
					input?.addEventListener("keydown", async (event) => {
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
					await (this.app as any).plugins.enablePluginAndSave(
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
		document.removeEventListener("mousemove", (event) => {
			this.mousePosition = { x: event.clientX, y: event.clientY };
		});

		document.removeEventListener("keydown", (event) => {
			handleKeyDown(event, this);
		});

		this.modalEl.removeEventListener("contextmenu", (evt) => {
			if (this.isDblClick) return;
			handleContextMenu(evt, this);
		});

		this.modalEl.removeEventListener("dblclick", (evt) => {
			if (this.isDblClick) return;
			handleDblClick(evt, this);
		});
	}
}

function circleCSSModif(
	modal: QPSModal,
	el: HTMLSpanElement,
	groupIndex: number
) {
	const { settings } = modal.plugin;
	const { color } = getEmojiForGroup(groupIndex);
	el.style.backgroundColor = color;
	el.textContent = (
		settings.groups[groupIndex].time ? settings.groups[groupIndex].time : ""
	).toString();
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

function handleKeyDown(event: KeyboardEvent, modal: QPSModal) {
	// const key = event.key;
	const elementFromPoint = getElementFromMousePosition(event, modal);
	const pluginItemBlock = elementFromPoint?.closest(
		".qps-item-line"
	) as HTMLElement;

	if (pluginItemBlock) {
		modal.searchTyping = false;
		const matchingItem = findMatchingItem(modal, pluginItemBlock);
		if (matchingItem) {
			handleHotkeysQPS(modal, event, matchingItem as PluginInfo);
		}
	}else{
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
	// const pluginSettings = (modal.app as any).setting.openTabById(
	// 	pluginItem.id
	// );
	// const condition = await getHkeyCondition(modal, pluginItem);	

	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: async () => await openGitHubRepo(pluginItem),
		s: async () => await openPluginSettings(modal, pluginItem),
		h: async () => await showHotkeysFor(modal, pluginItem),
		i: () => new DescriptionModal(plugin.app, plugin, pluginItem).open(),
	};
	if (Platform.isDesktopApp)
		KeyToSettingsMap["f"] = async () =>
			await openDirectoryInFileManager(modal, pluginItem);

	const keyPressed = evt.key;
	const itemID = pluginItem.id;
	const taggedItem = settings.pluginsTagged[itemID];
	if (!taggedItem) {
		settings.pluginsTagged[itemID] = {
			groupInfo: { groupIndices: [] },
		};
		await modal.plugin.saveSettings();
		await reOpenModal(modal);
	}
	if (!taggedItem || modal.pressed) {
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
			if (!groupNotEmpty(groupIndex, modal)) {
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