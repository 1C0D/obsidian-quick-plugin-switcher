// ajout filter group
// uninstall by group
// ajout getlength ds addHeader
// do search à revoir et meilleure algo?
// search focus perdu après qu'on referme whole desc
// settings groups length
// group menu voir plus tard
// destkop only
// context menu
// futur?: utiliser une map au lieu d'un array pour pluginList? this.pluginsList = new Map(await getPluginList().map(plugin => [plugin.id, plugin]));
import { App, DropdownComponent, Menu, Modal, setIcon } from "obsidian";
import QuickPluginSwitcher from "./main";
import { calculateTimeElapsed, formatNumber, removeItem } from "./utils";
import {
	GroupData,
	GroupsComm,
	KeyToSettingsMapType,
	PackageInfoData,
	PluginCommInfo,
	commPluginStats,
	commPlugins,
} from "./types";
import {
	getCirclesItem,
	getEmojiForGroup,
	setGroupTitle,
	getIndexFromSelectedGroup,
	pressDelay,
	rmvAllGroupsFromPlugin,
	getInstalled,
	isInstalled,
} from "./modal_utils";
import {
	addSearch,
	doSearch,
	filterByGroup,
	findMatchingItem,
	getElementFromMousePosition,
	handleContextMenu,
	handleDblClick,
	openGitHubRepo,
} from "./modal_components";
import { ReadMeModal } from "./secondary_modals";
import { QPSModal } from "./main_modal";

export class CPModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	groups: HTMLElement;
	hotkeysDesc: HTMLElement;
	isDblClick = false;
	pluginsList: PluginCommInfo[];
	pluginStats: PackageInfoData;
	pressed = false;
	mousePosition: any;

	constructor(app: App, public plugin: QuickPluginSwitcher) {
		super(app);
		this.plugin = plugin;
	}

	container() {
		const { contentEl } = this;
		this.modalEl.addClass("community-plugins-modal");
		this.header = contentEl.createEl("div", {
			cls: "qps-community-header",
		});
		this.search = contentEl.createEl("div", {
			cls: "qps-community-search",
		});
		this.groups = contentEl.createEl("div", {
			cls: ["qps-community-groups", "qps-comm-group"],
		});
		this.hotkeysDesc = contentEl.createEl("p", { cls: "qps-hk-desc" });
		this.items = contentEl.createEl("div", { cls: "qps-community-items" });

		document.addEventListener("mousemove", (event) => {
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
		contentEl.empty();
		plugin.settings.search = "";
		this.pluginsList = await fetchData(commPlugins);
		this.pluginStats = await fetchData(commPluginStats);
		this.draw(this);
	}

	async draw(modal: CPModal) {
		const { plugin, contentEl } = this;
		const { settings } = plugin;
		contentEl.empty();
		this.container();
		setGroupTitle(modal, plugin, GroupsComm, settings.numberOfGroupsComm);
		this.addHeader(this.header);
		await addSearch(
			this,
			this.search,
			modal.pluginsList,
			"Search community plugins"
		);
		this.addGroups(this, this.groups, GroupsComm);
		if (plugin.settings.showHotKeys) this.setHotKeysdesc();
		await this.addItems(this, modal.pluginsList);
	}

	addHeader = (contentEl: HTMLElement): void => {
		const { plugin } = this;
		const { settings } = plugin;
		//dropdown filters
		new DropdownComponent(contentEl)
			.addOptions({
				all: `All(${this.pluginsList.length})`,
				installed: `Installed(${getInstalled().length})`,
				notInstalled: `Not Installed(${
					this.pluginsList.length - getInstalled().length
				})`,
				byGroup: `By Group`,
			})
			.setValue(settings.filtersComm as string)
			.onChange(async (value) => {
				settings.filtersComm = value;
				await plugin.saveSettings();
				this.draw(this);
			});

		filterByGroup(this, contentEl);
	};

	addGroups(modal: CPModal, contentEl: HTMLElement, Groups: GroupData): void {
		const groups = Object.values(Groups);

		for (let i = 1; i < groups.length; i++) {
			const groupKey = groups[i];

			contentEl.createEl(
				"span",
				{
					cls: "qps-group-span-container",
				},
				(cont) => {
					const preSpan = cont.createEl(
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
					// postSpan
					span.insertAdjacentHTML("beforeend", groupNumberText);
				}
			);
		}
	}

	setHotKeysdesc(): void {
		const numberOfGroups = this.plugin.settings.numberOfGroupsComm;
		this.hotkeysDesc.createSpan(
			{
				text: `(1-${numberOfGroups})➕ (0)❌ `,
			},
			(el) => {
				el.createSpan({ text: "(g)" }, (el) => {
					let gitHubIcon = el.createSpan({ cls: "git-hub-icon" });
					setIcon(gitHubIcon, "github");
				});
				el.createSpan({
					text: ` (i)readme`,
				});
			}
		);
	}

	async addItems(modal: CPModal, listItems: PluginCommInfo[]) {
		const { plugin, pluginStats } = modal;
		const { settings } = plugin;
		listItems = filter(modal, listItems);
		const value = settings.search;
		listItems = doSearch(
			modal,
			value,
			modal.pluginsList
		) as PluginCommInfo[];
		sortItemsByDownloads(listItems, pluginStats);

		for (const item of listItems) {
			const itemContainer = modal.items.createEl("div", {
				cls: "qps-comm-block",
			});
			//name
			itemContainer.createDiv(
				{
					cls: "qps-community-item-name",
					text: item.name,
				},
				(el: HTMLElement) => {
					if (isInstalled(item))
						el.createSpan({
							cls: "installed-span",
							text: "installed",
						});
				}
			);
			//author
			itemContainer.createDiv({
				cls: "qps-community-item-author",
				text: `By ${item.author} `,
			});

			const pluginInfo = pluginStats[item.id];
			if (pluginInfo) {
				// downloads
				itemContainer.createDiv(
					{
						cls: "qps-community-item-downloads",
					},
					(el: HTMLElement) => {
						el.createSpan({ cls: "downloads-span" }, (el) => {
							const preSpan = el.createSpan();
							const span = el.createSpan({
								text: formatNumber(
									pluginInfo.downloads,
									1
								).toString(),
								cls: "downloads-text-span",
							});
							addGroupCircles(this, span, item);
							setIcon(preSpan, "download-cloud");
						});
					}
				);

				const lastUpdated = new Date(pluginInfo.updated);
				const timeSinceUpdate = calculateTimeElapsed(lastUpdated);
				// Updated
				itemContainer.createDiv({
					cls: "qps-community-item-updated",
					text: `Updated ${timeSinceUpdate}`,
				});
			}

			// desc
			itemContainer.createDiv({
				cls: "qps-community-item-desc",
				text: item.description,
			});
		}
	}

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

		// this.plugin.getPluginsInfo();
		// this.plugin.getLength();
		// new QPSModal(this.app, this.plugin).open();
	}
}

async function fetchData(url: string) {
	try {
		const response = await fetch(url);
		const data = await response.json();
		return data;
	} catch (error) {
		console.error(`Error fetching data from ${url}:`, error);
		return null;
	}
}

export async function getReadMe(item: PluginCommInfo) {
	const repo = item.repo;
	const repoURL = `https://api.github.com/repos/${repo}/contents/README.md`;
	try {
		const response = await fetch(repoURL);
		return await response.json();
	} catch (error) {
		console.error("Error fetching ReadMe", error);
	}
	return null;
}

export async function getManifest(item: PluginCommInfo) {
	const repo = item.repo;
	const repoURL = `https://raw.githubusercontent.com/${repo}/master/manifest.json`;
	try {
		const response = await fetch(repoURL);
		return await response.json();
	} catch (error) {
		console.error("Error fetching ReadMe", error);
	}
	return null;
}

function sortItemsByDownloads(listItems: PluginCommInfo[], pluginStats: any) {
	listItems.sort((a, b) => {
		const pluginAStats = pluginStats[a.id];
		const pluginBStats = pluginStats[b.id];

		if (pluginAStats && pluginBStats) {
			return pluginBStats.downloads - pluginAStats.downloads;
		}

		return 0;
	});
}

function filter(modal: CPModal, listItems: PluginCommInfo[]) {
	const { settings } = modal.plugin;
	const { filtersComm } = settings;
	const installedPlugins = getInstalled();
	if (filtersComm === "installed") {
		return listItems.filter((item) => installedPlugins.includes(item.id));
	} else if (filtersComm === "notInstalled") {
		return listItems.filter((item) => !installedPlugins.includes(item.id));
	} else if (filtersComm === "byGroup") {
		const groupIndex = getIndexFromSelectedGroup(
			settings.selectedGroup as string
		);
		if (groupIndex !== 0) {
			const groupedItems = listItems.filter((i) => {
				const { pluginsTagged } = settings;
				const taggedItem = pluginsTagged[i.id];
				if (taggedItem) {
					const { groupInfo } = taggedItem;
					const { groupIndices } = groupInfo;
					return groupIndices?.indexOf(groupIndex) !== -1;
				} else return false;
			});
			return groupedItems;
		} else return listItems;
	} else {
		return listItems;
	}
}

function circleCSSModif(
	modal: CPModal,
	el: HTMLSpanElement,
	groupIndex: number
) {
	const { settings } = modal.plugin;
	const { color } = getEmojiForGroup(groupIndex);
	el.style.backgroundColor = color;
}

// const editGroupName = (
// 	modal: any,
// 	span: HTMLSpanElement,
// 	groupNumber: number
// ) => {
// 	const { plugin } = modal;
// 	const { settings } = plugin;
// 	const currentValue =
// 		settings.groups[groupNumber].name !== ""
// 			? settings.groups[groupNumber]?.name
// 			: "";

// 	const input = createInput(span, currentValue);

// 	input?.addEventListener("blur", () => {
// 		setTimeout(async () => {
// 			if (modal.isDblClick) return;
// 			input?.value
// 				? (settings.groups[groupNumber].name = input.value)
// 				: (settings.groups[groupNumber].name = `Group${groupNumber}`);
// 			input.textContent = `${settings.groups[groupNumber].name}`;
// 			await modal.plugin.saveSettings();
// 			modal.draw(modal, modal.pluginsList, modal.pluginStats);
// 		}, 200);
// 	});

// 	input?.addEventListener("keydown", async (event) => {
// 		if (event.key === "Enter") {
// 			if (modal.isDblClick) return;
// 			input?.value
// 				? (settings.groups[groupNumber].name = input.value)
// 				: (settings.groups[groupNumber].name = GroupsComm[groupNumber]);
// 			input.textContent = `${settings.groups[groupNumber].name}`;
// 			await modal.plugin.saveSettings();
// 			modal.draw(modal, modal.pluginsList, modal.pluginStats);
// 		}
// 	});
// };

function handleKeyDown(event: KeyboardEvent, modal: CPModal) {
	const elementFromPoint = getElementFromMousePosition(event, modal);
	const targetBlock = elementFromPoint?.closest(
		".qps-comm-block"
	) as HTMLElement;

	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock);

		if (matchingItem) {
			handleHotkeysCPM(modal, event, matchingItem as PluginCommInfo);
		}
	}
}

const handleHotkeysCPM = async (
	modal: CPModal,
	evt: KeyboardEvent,
	pluginItem: PluginCommInfo
) => {
	if (modal.pressed) {
		return;
	}
	const { plugin } = modal;
	const { settings } = plugin;
	const numberOfGroups = settings.numberOfGroupsComm;
	// handle groups shortcuts
	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: () => openGitHubRepo(pluginItem),
		i: () => new ReadMeModal(plugin.app, modal, pluginItem).open(),
	};

	const { pluginsTagged } = settings;
	const keyPressed = evt.key;
	const itemID = pluginItem.id;
	let taggedItem = pluginsTagged[itemID];
	if (!taggedItem) {
		pluginsTagged[itemID] = {
			groupInfo: { groupIndices: [] },
		};
		await modal.plugin.saveSettings();
	}
	taggedItem = pluginsTagged[itemID];
	pressDelay(modal);
	const { groupInfo } = taggedItem;
	const { groupIndices } = groupInfo;
	const key = parseInt(keyPressed);
	if (key > 0 && key <= numberOfGroups) {
		if (groupIndices.length === 6) return;
		const index = groupIndices.indexOf(key);
		if (index === -1) {
			groupIndices.push(key);
			await plugin.saveSettings();
			modal.draw(modal);
		}
	} else if (keyPressed in KeyToSettingsMap) {
		KeyToSettingsMap[keyPressed]();
	} else if (
		keyPressed === "Delete" ||
		keyPressed === "Backspace" ||
		keyPressed === "0"
	) {
		if (groupIndices.length === 1) {
			groupInfo.groupIndices = [];
			await plugin.saveSettings();
			modal.draw(modal);
		} else if (groupIndices.length > 1) {
			const menu = new Menu();
			menu.addItem((item) =>
				item.setTitle("Remove item group(s)").setDisabled(true)
			);
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
						.onClick(() => {
							if (groupInfo)
								groupInfo.groupIndices = removeItem(
									groupIndices,
									groupIndex
								);
							modal.draw(modal);
						})
				);
			}

			menu.showAtPosition(modal.mousePosition);
		}
	}
};

const addGroupCircles = (
	modal: CPModal,
	el: HTMLElement,
	item: PluginCommInfo
) => {
	const { settings } = modal.plugin;
	const key = item.id;
	// maybe doesn't exist ?
	const taggedItem = settings.pluginsTagged[key];
	if (!taggedItem) return;
	const indices = taggedItem.groupInfo.groupIndices;
	if (indices?.length) {
		if (indices.length < 3) {
			const content = getCirclesItem(indices);
			el.insertAdjacentHTML("afterend", content);
		}

		if (indices.length >= 3 && indices.length < 5) {
			// 2 circles
			const [valeur0, valeur1, ...part2] = indices;
			const part1 = [valeur0, valeur1];

			const content1 = getCirclesItem(part1);
			el.insertAdjacentHTML("afterend", content1);

			const content2 = getCirclesItem(part2);
			el.insertAdjacentHTML("afterend", content2);
		} else if (indices.length >= 5) {
			// 3 circles
			const [valeur0, valeur1, valeur2, valeur3, ...part3] = indices;
			const part1 = [valeur0, valeur1];
			const part2 = [valeur2, valeur3];

			const content1 = getCirclesItem(part1);
			el.insertAdjacentHTML("afterend", content1);

			const content2 = getCirclesItem(part2);
			el.insertAdjacentHTML("afterend", content2);

			const content3 = getCirclesItem(part3);
			el.insertAdjacentHTML("afterend", content3);
		}
	}
};
