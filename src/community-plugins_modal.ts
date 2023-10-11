// ajout getlength ds addHeader
// do search à revoir et meilleure algo?
// search focus perdu après qu'on referme whole desc
// sticky header, focus ?
// settings groups length
// group menu voir plus tard
// destkop only
// context menu
// futur?: utiliser une map au lieu d'un array pour pluginList? this.pluginsList = new Map(await getPluginList().map(plugin => [plugin.id, plugin]));
import {
	App,
	DropdownComponent,
	Menu,
	Modal,
	SearchComponent,
	Setting,
	setIcon,
} from "obsidian";
import QuickPluginSwitcher from "./main";
import { calculateTimeElapsed, formatNumber, removeItem } from "./utils";
import {
	GroupData,
	GroupsComm,
	KeyToSettingsMapType,
	PackageInfoData,
	PluginCommInfo,
} from "./types";
import {
	GroupsKeysObject,
	createInput,
	getCirclesItem,
	getEmojiForGroup,
	getGroupTitle,
	pressDelay,
	rmvAllGroupsFromPlugin,
} from "./modal_utils";
import { openGitHubRepo } from "./modal_components";
import { ReadMeModal } from "./secondary_modals";

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
	}

	async onOpen() {
		const { plugin, contentEl } = this;
		contentEl.empty();
		plugin.settings.search = "";
		this.pluginsList = await getPluginList();
		this.pluginStats = await fetchAndStorePluginStats();
		this.draw(this, this.pluginsList, this.pluginStats);
	}

	async draw(
		modal: CPModal,
		pluginsList: PluginCommInfo[],
		pluginStats: PackageInfoData
	) {
		const { plugin, contentEl } = this;
		contentEl.empty();
		this.container();
		getGroupTitle(plugin, GroupsComm);
		this.addHeader(this.header, pluginsList, pluginStats);
		await this.addSearch(
			this.search,
			pluginsList,
			"Search community plugins",
			pluginStats
		);
		this.addGroups(this.groups, GroupsComm);
		if (plugin.settings.showHotKeys) this.setHotKeysdesc();
		await this.addItems(this, pluginsList, pluginStats);
	}

	addHeader = (
		contentEl: HTMLElement,
		pluginsList: PluginCommInfo[],
		pluginStats: PackageInfoData
	): void => {
		const { plugin } = this;
		const { settings } = plugin;
		//dropdown filters
		new DropdownComponent(contentEl)
			.addOptions({
				all: `All(${pluginsList.length})`,
				installed: `Installed(${getInstalled().length})`,
				notInstalled: `Not Installed(${
					pluginsList.length - getInstalled().length
				})`,
				byGroup: `By Group`,
			})
			.setValue(settings.communityFilters as string)
			.onChange(async (value) => {
				settings.communityFilters = value;
				await plugin.saveSettings();
				this.draw(this, pluginsList, pluginStats);
			});
	};

	addSearch = async (
		contentEl: HTMLElement,
		pluginsList: PluginCommInfo[],
		placeholder: string,
		pluginStats: PackageInfoData
	) => {
		const { plugin } = this;
		const { settings } = plugin;

		new Setting(contentEl)
			.addSearch(async (search: SearchComponent) => {
				search
					.setValue(settings.search)
					.setPlaceholder(placeholder)
					.onChange(async (value: string) => {
						settings.search = value;
						// to update list
						const listItems = doSearch(value, pluginsList);
						this.items.empty();
						this.addItems(this, listItems, pluginStats);
					});
			})
			.setClass("qps-search-component");
	};

	addGroups(contentEl: HTMLElement, Groups: GroupData): void {
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
					const postSpan = span.insertAdjacentHTML(
						"beforeend",
						groupNumberText
					);

					span.addEventListener("dblclick", (e) => {
						if (this.isDblClick) return;
						editGroupName(this, span, i);
					});
					span.addEventListener("contextmenu", (evt) => {
						if (this.isDblClick) return;
						groupMenu(this, evt, span, i);
					});
				}
			);
		}
	}

	setHotKeysdesc(): void {
		const numberOfGroups = this.plugin.settings.numberOfGroupsComm;
		const nameEl = this.hotkeysDesc.createSpan(
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

	async addItems(
		modal: CPModal,
		listItems: PluginCommInfo[],
		pluginStats: PackageInfoData
	) {
		listItems = filter(modal, listItems);
		sortItemsByDownloads(listItems, pluginStats);

		for (const item of listItems) {
			//.slice(0, 28)
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
	}
}

async function getPluginList(): Promise<PluginCommInfo[]> {
	const repoURL =
		"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";
	return await fetchIt(repoURL, "communityPluginsData");
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
	// const repoURL = `https://api.github.com/repos/${repo}/contents/manifest.json`;
	const repoURL = `https://raw.githubusercontent.com/${repo}/master/manifest.json`;
	try {
		const response = await fetch(repoURL);
		return await response.json();
	} catch (error) {
		console.error("Error fetching ReadMe", error);
	}
	return null;
}

async function fetchAndStorePluginStats(): Promise<PackageInfoData> {
	const communityPluginStatsUrl =
		"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json";
	const pluginStats = await fetchIt(
		communityPluginStatsUrl,
		"communityPluginStats"
	);
	return pluginStats;
}

async function fetchIt(url: string, storageDataName: string) {
	try {
		const response = await fetch(url);
		const data = await response.json();
		localStorage.setItem(storageDataName, JSON.stringify(data));
		// console.log("data from url");
		return data;
	} catch (error) {
		console.error("Error fetching plugin data:", error);
		const storedData = localStorage.getItem(storageDataName);
		if (storedData) {
			console.log("data from localStorage");
			return JSON.parse(storedData);
		}

		return null;
	}
}

function doSearch(value: string, pluginsList: PluginCommInfo[]) {
	const listItems: PluginCommInfo[] = [];

	for (const i of pluginsList) {
		if (
			i.name.toLowerCase().includes(value.toLowerCase()) ||
			i.description.toLowerCase().includes(value.toLowerCase()) ||
			i.author.toLowerCase().includes(value.toLowerCase())
		) {
			listItems.push(i);
		}
	}
	return listItems;
}

function getInstalled() {
	return Object.keys(this.app.plugins.manifests);
}

function isInstalled(item: any) {
	return getInstalled().includes(item.id);
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

function filter(modal: CPModal, listItems: PluginCommInfo[]): PluginCommInfo[] {
	if (modal.plugin.settings.communityFilters === "installed") {
		const installedPlugins = getInstalled.call(this);
		listItems = listItems.filter((item) =>
			installedPlugins.includes(item.id)
		);
	}
	if (modal.plugin.settings.communityFilters === "notInstalled") {
		const installedPlugins = getInstalled.call(this);
		listItems = listItems.filter(
			(item) => !installedPlugins.includes(item.id)
		);

		// const notInstalledCount = listItems.length;
		// console.log("Nombre de plugins non installés : ", notInstalledCount);
	}

	return listItems;
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

const editGroupName = (
	modal: any,
	span: HTMLSpanElement,
	groupNumber: number
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const currentValue =
		settings.groups[groupNumber].name !== ""
			? settings.groups[groupNumber]?.name
			: "";

	const input = createInput(span, currentValue);

	input?.addEventListener("blur", () => {
		setTimeout(async () => {
			if (modal.isDblClick) return;
			input?.value
				? (settings.groups[groupNumber].name = input.value)
				: (settings.groups[groupNumber].name = `Group${groupNumber}`);
			input.textContent = `${settings.groups[groupNumber].name}`;
			await modal.plugin.saveSettings();
			modal.draw(modal, modal.pluginsList, modal.pluginStats);
		}, 200);
	});

	input?.addEventListener("keydown", async (event) => {
		if (event.key === "Enter") {
			if (modal.isDblClick) return;
			input?.value
				? (settings.groups[groupNumber].name = input.value)
				: (settings.groups[groupNumber].name = GroupsComm[groupNumber]);
			input.textContent = `${settings.groups[groupNumber].name}`;
			await modal.plugin.saveSettings();
			modal.draw(modal, modal.pluginsList, modal.pluginStats);
		}
	});
};

const groupMenu = (
	modal: any,
	evt: MouseEvent,
	span: HTMLSpanElement,
	groupNumber: number
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	// const inGroup = settings.allPluginsList.filter(
	// 	(i: PluginInfo) => i.groupInfo.groupIndices?.indexOf(groupNumber) !== -1
	// );

	const menu = new Menu();
	menu.addItem((item) => {
		item.setTitle("clear group items");
	});
	menu.addItem((item) => {
		item.setTitle("install plugins in group");
	});

	menu.showAtMouseEvent(evt);
};

function handleKeyDown(event: KeyboardEvent, modal: CPModal) {
	const key = event.key;
	if (modal.mousePosition) {
		const elementFromPoint = document.elementFromPoint(
			modal.mousePosition.x,
			modal.mousePosition.y
		);
		const targetBlock = elementFromPoint?.closest(
			".qps-comm-block"
		) as HTMLElement;

		if (targetBlock) {
			const itemName = targetBlock.firstChild?.textContent;
			const cleanItemName = itemName?.replace(/installed$/, "").trim();
			const matchingItem = modal.pluginsList.find(
				(item) => item.name === cleanItemName
			);

			if (matchingItem) {
				handleHotkeys(modal, event, matchingItem, targetBlock);
			}
		}
	}
}

const handleHotkeys = async (
	modal: CPModal,
	evt: KeyboardEvent,
	pluginItem: PluginCommInfo,
	itemContainer: HTMLElement
) => {
	const { plugin } = modal;
	const { settings } = plugin;
	const numberOfGroups = settings.numberOfGroupsComm;
	const keyToGroupObject = GroupsKeysObject(numberOfGroups);
	// handle groups shortcuts
	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: () => openGitHubRepo(pluginItem),
		i: () => new ReadMeModal(plugin.app, modal, pluginItem).open(),
	};
	const keyPressed = evt.key;
	const itemID = pluginItem.id;
	const taggedItem = settings.pluginsTagged[itemID];
	if (!taggedItem) {
		settings.pluginsTagged[itemID] = {
			groupInfo: { groupIndices: [] },
		};
		await modal.plugin.saveSettings();
		modal.draw(modal, modal.pluginsList, modal.pluginStats);
	}
	if (!taggedItem || modal.pressed) {
		return;
	}
	pressDelay(modal);
	const { groupInfo } = taggedItem;
	const groupIndices = groupInfo.groupIndices;
	if (keyPressed in keyToGroupObject) {
		const groupIndex = keyToGroupObject[keyPressed];
		if (groupIndices.length === 6) return;
		const index = groupIndices.indexOf(groupIndex);
		if (index === -1) {
			groupIndices.push(groupIndex);
			await plugin.saveSettings();
			modal.draw(modal, modal.pluginsList, modal.pluginStats);
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
			modal.draw(modal, modal.pluginsList, modal.pluginStats);
		} else if (groupIndices.length > 1) {
			const menu = new Menu();
			menu.addItem((item) =>
				item.setTitle("Remove item group(s)").setDisabled(true)
			);
			menu.addItem((item) =>
				item.setTitle("All").onClick(() => {
					rmvAllGroupsFromPlugin(modal, pluginItem);
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
									groupInfo.groupIndices,
									groupIndex
								);
							modal.draw(
								modal,
								modal.pluginsList,
								modal.pluginStats
							);
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

export function handleContextMenu(evt: MouseEvent, modal: CPModal) {
	if (modal.mousePosition) {
		const elementFromPoint = document.elementFromPoint(
			modal.mousePosition.x,
			modal.mousePosition.y
		);
		const targetBlock = elementFromPoint?.closest(
			".qps-comm-block"
		) as HTMLElement;

		if (targetBlock) {
			const itemName = targetBlock.firstChild?.textContent;
			const cleanItemName = itemName?.replace(/installed$/, "").trim();
			const matchingItem = modal.pluginsList.find(
				(item) => item.name === cleanItemName
			);

			if (matchingItem) {
				console.log("matchingItem", matchingItem);
				const { plugin } = modal;
				evt.preventDefault();
				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle("install")
						.setIcon("arrow-down-to-dot")
						.onClick(async () => {
							const manifest = await getManifest(matchingItem);
							console.log("manifest", manifest);
							console.log("matchingItem.repo", matchingItem.repo)
							await this.app.plugins.installPlugin(
								matchingItem.repo,
								"latest",
								manifest
							);
						});
				});
				menu.showAtMouseEvent(evt);
			}
		}
	}
}
