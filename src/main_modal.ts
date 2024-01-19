import {
	App,
	DropdownComponent,
	Menu,
	Modal,
	Platform,
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
	doSearchQPS,
	hideOnCLick,
	checkbox,
	vertDotsButton,
	handleClick,
} from "./modal_components";
import {
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
// import { addButton } from "./settings";
import { setGroupTitle, byGroupDropdowns, getEmojiForGroup, getCirclesItem, rmvAllGroupsFromPlugin, groupIsEmpty, groupNbFromEmoticon, getPluginsInGroup, groupNbFromGrpName } from "./groups";
import { CPModal } from "./community-plugins_modal";
import { KeyToSettingsMapType, PluginInstalled } from "./types/global";

export class QPSModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	groups: HTMLElement;
	hotkeysDesc: HTMLElement;
	searchTyping = true;
	isDblClick = false;
	mousePosition: { x: number, y: number };
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
	getHandleContextMenu = async (evt: MouseEvent) => {
		if (this.isDblClick) return;
		await handleContextMenu(evt, this);
	}
	getHandleDblClick = (evt: MouseEvent) => {
		if (this.isDblClick) return;
		handleDblClick(evt, this);
	}
	getHandleClick = (evt: MouseEvent) => {
		if (this.isDblClick) return;
		handleClick(evt, this);
	}

	removeListeners() {
		this.modalEl.removeEventListener("mousemove", this.getMousePosition);
		document.removeEventListener("keydown", this.getHandleKeyDown);
		this.modalEl.removeEventListener("contextmenu", this.getHandleContextMenu);
		this.modalEl.removeEventListener("dblclick", this.getHandleDblClick);
		if (this.app.isMobile) {
			this.modalEl.removeEventListener("dblclick", this.getHandleClick);
		}
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

		this.modalEl.addEventListener("mousemove", this.getMousePosition);
		document.addEventListener("keydown", this.getHandleKeyDown);
		this.modalEl.addEventListener("contextmenu", this.getHandleContextMenu);
		this.modalEl.addEventListener("dblclick", this.getHandleDblClick);
		if (this.app.isMobile) {
			this.modalEl.addEventListener("click", this.getHandleClick);
		}
	}

	async onOpen() {
		this.removeListeners()
		const { plugin, contentEl } = this;
		const { settings } = plugin;
		if (this.searchInit) settings.search = "";
		this.searchInit = true;
		contentEl.empty();
		this.container();
		setGroupTitle(this, Groups, settings.numberOfGroups);
		this.addHeader(this.header);
		await addSearch(this, this.search, "Search plugins");
		checkbox(this, this.search, "+Author");
		searchDivButtons(this, this.search);
		this.addGroups(this.groups);
		if (settings.showHotKeys && !this.app.isMobile) this.setHotKeysdesc();
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
			.setValue(settings.filters as string)
			.onChange(async (value) => {
				settings.filters = value;
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

		if (!this.app.isMobile)
			contentEl.createSpan({
				text: `> (h)👁️ (🖱️x2)name`,
			});
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
		const { installed } = settings;
		// const previousValue = settings.search;
		let listItems = doSearchQPS(this, value, installed)
		listItems = modeSort(plugin, listItems);
		// Sort for chosen mode
		// toggle plugin
		for (const id of listItems) {
			// don't show hiddens except if Filters.ByGroup
			if (settings.filters !== Filters.ByGroup && installed[id].groupInfo.hidden === true) {
				continue
			}
			// don't filter enabled/disabled if Filters.Enabled/Disabled
			if (
				(settings.filters === Filters.Enabled && !installed[id].enabled) ||
				(settings.filters === Filters.Disabled && installed[id].enabled)
			) {
				continue;
			}

			// create items
			let itemContainer = this.items.createEl("div", {
				cls: "qps-item-line",
			});

			itemTogglePluginButton(this, installed[id], itemContainer);
			const input = itemTextComponent(installed[id], itemContainer);
			itemToggleClass(this, installed[id], itemContainer);
			// create groups circles
			addGroupCircles(input, installed[id]);
			if (this.app.isMobile) {
				const div = itemContainer.createEl(
					"div",
					{
						cls: "button-container",
					},
					(el) => {
						vertDotsButton(el);
					})
			}
		}
	}

	addDelay = async (id: string, input: HTMLInputElement) => {
		const { plugin } = this;
		const { settings } = plugin;
		const { installed } = settings;
		installed[id].delayed = true;
		installed[id].time = parseInt(input.value) || 0;

		if (installed[id].time === 0) {
			installed[id].delayed = false;
		}
		if (installed[id].delayed && installed[id].enabled) {
			await delayedReEnable(this, id);
		}
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
	pluginItem: PluginInstalled,
	itemContainer: HTMLDivElement
) => {
	let disable = pluginItem.id === "quick-plugin-switcher";
	new ToggleComponent(itemContainer)
		.setValue(pluginItem.enabled)
		.setDisabled(disable) //quick-plugin-switcher disabled
		.onChange(async () => {
			await togglePlugin(modal, pluginItem); // searchInit = ? in reOpenModal...
		});
};

const addGroupCircles = (input: HTMLElement, item: PluginInstalled) => {
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
	const elementFromPoint = getElementFromMousePosition(modal);
	const pluginItemBlock = elementFromPoint?.closest(
		".qps-item-line"
	) as HTMLDivElement;

	const targetGroupIcon = elementFromPoint?.closest(
		".qps-circle-title-group"
	) as HTMLElement;
	const targetGroup = elementFromPoint?.closest(
		".qps-groups-name"
	) as HTMLElement;

	if (pluginItemBlock) {
		modal.searchTyping = false;
		const matchingItem = findMatchingItem(modal, pluginItemBlock);
		if (matchingItem) {
			await handleHotkeysQPS(modal, event, matchingItem as PluginInstalled);
		}
	} else if ((targetGroupIcon || targetGroup) && event.key === "h") {
		modal.searchTyping = false;
		await toggleVisibility(modal, targetGroupIcon, targetGroup);
	} else {
		modal.searchTyping = true;
	}
}

export const toggleVisibility = async (
	modal: QPSModal | CPModal,
	targetGroupIcon: HTMLElement,
	targetGroup: HTMLElement,
) => {
	let groupNumber: number;
	if (targetGroupIcon) {
		groupNumber = groupNbFromEmoticon(targetGroupIcon)
	} else {
		const groupName = targetGroup?.textContent;
		groupNumber = groupNbFromGrpName(groupName!)
	}
	const inGroup = getPluginsInGroup(modal, groupNumber)
	await hideOnCLick(modal, groupNumber, inGroup)
}

const handleHotkeysQPS = async (
	modal: QPSModal,
	evt: KeyboardEvent,
	pluginItem: PluginInstalled
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const numberOfGroups = settings.numberOfGroups;

	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: async () => await openGitHubRepo(modal, pluginItem),
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
							await reOpenModal(modal);
						})
				);
			}
			menu.showAtPosition(modal.mousePosition);
		}
	}
};

