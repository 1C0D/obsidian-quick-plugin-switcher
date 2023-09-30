// ajout getlength ds addHeader
// do search à revoir
// sticky header
// settings groups length
// group menu voir plus tard

import {
	App,
	DropdownComponent,
	Modal,
	SearchComponent,
	Setting,
	setIcon,
} from "obsidian";
import QuickPluginSwitcher from "./main";
import { calculateTimeElapsed, formatNumber } from "./utils";
import { GroupData, Groups, GroupsComm } from "./types";
import { getEmojiForGroup, getGroupTitle, selectValue } from "./modal_utils";

export class CPModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	groups: HTMLElement;
	// hotkeysDesc: HTMLElement;
	isDblClick = false;

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
			cls: "qps-community-groups",
		});
		this.items = contentEl.createEl("div", { cls: "qps-community-items" });
	}

	async onOpen() {
		this.plugin.settings.search = "";
		const pluginsList = await getPluginList();
		const pluginStats = await fetchAndStorePluginStats();
		this.draw(this, pluginsList, pluginStats);
	}

	async draw(modal: CPModal, pluginsList: any[], pluginStats: any[]) {
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
		await addItems(this, pluginsList, pluginStats);
	}

	addHeader = (
		contentEl: HTMLElement,
		pluginsList: any,
		pluginStats: any[]
	): void => {
		const { plugin } = this;
		const { settings } = plugin;
		//dropdown with filters
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
				// modal.onOpen();
				this.draw(this, pluginsList, pluginStats);
			});
	};

	addSearch = async (
		contentEl: HTMLElement,
		pluginsList: any[],
		placeholder: string,
		pluginStats: any[]
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
						const listItems = await this.doSearch(
							value,
							pluginsList
						);
						this.items.empty();
						addItems(this, listItems, pluginStats);
					});
			})
			.setClass("qps-search-component");
	};

	doSearch(value: string, pluginsList: any[]) {
		const listItems: any = [];

		for (const i of pluginsList) {
			if (
				i.name.toLowerCase().includes(value.toLowerCase()) ||
				(value.length > 1 &&
					value[value.length - 1] === " " &&
					i.name.toLowerCase().startsWith(value.trim().toLowerCase()))
			) {
				listItems.push(i);
			}
		}
		return listItems;
	}

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
					// span.addEventListener("contextmenu", (evt) => {
					// 	if (this.isDblClick) return;
					// 	groupMenu(this, evt, span, i);
					// });
				}
			);
		}
	}

	async addItems(modal: CPModal, listItems: any[], pluginStats: any[]) {
		// const { plugin } = modal;
		// const { settings } = plugin;
		// const value = settings.search;
		listItems = filter(modal, listItems);
		sortItemsByDownloads(listItems, pluginStats);

		for (const item of listItems.slice(0, 14)) {
			// console.log("item", item);
			const itemContainer = modal.items.createEl("div", {
				cls: "qps-block",
			});
			const text = isInstalled(item)
				? `${item.name} installed`
				: item.name;
			const name = itemContainer.createDiv(
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
			const author = itemContainer.createDiv({
				cls: "qps-community-item-author",
				text: `By ${item.author} `,
			});
			const pluginId = item.id;
			const pluginInfo = pluginStats[pluginId];
			// console.log("pluginInfo", pluginInfo);
			if (pluginInfo) {
				const downloads = itemContainer.createDiv(
					{
						cls: "qps-community-item-downloads",
					},
					(el: HTMLElement) => {
						const before = el.createSpan();
						el.createSpan({
							text: formatNumber(
								pluginInfo.downloads,
								3
							).toString(),
						});
						setIcon(before, "download-cloud");
					}
				);
				const lastUpdated = new Date(pluginInfo.updated);
				const timeSinceUpdate = calculateTimeElapsed(lastUpdated);
				const updatedSince = itemContainer.createDiv({
					cls: "qps-community-item-updated",
					text: `Updated ${timeSinceUpdate}`,
				});
			}
			const desc = itemContainer.createDiv({
				cls: "qps-community-item-desc",
				text: item.description,
			});
		}
	}
}

async function addItems(modal: CPModal, listItems: any[], pluginStats: any[]) {
	// const { plugin } = modal;
	// const { settings } = plugin;
	// const value = settings.search;
	listItems = filter(modal, listItems);
	sortItemsByDownloads(listItems, pluginStats);

	for (const item of listItems.slice(0, 14)) {
		// console.log("item", item);
		const itemContainer = modal.items.createEl("div", {
			cls: "qps-block",
		});
		const text = isInstalled(item) ? `${item.name} installed` : item.name;
		const name = itemContainer.createDiv(
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
		const author = itemContainer.createDiv({
			cls: "qps-community-item-author",
			text: `By ${item.author} `,
		});
		const pluginId = item.id;
		const pluginInfo = pluginStats[pluginId];
		// console.log("pluginInfo", pluginInfo);
		if (pluginInfo) {
			const downloads = itemContainer.createDiv(
				{
					cls: "qps-community-item-downloads",
				},
				(el: HTMLElement) => {
					const before = el.createSpan();
					el.createSpan({
						text: formatNumber(pluginInfo.downloads, 3).toString(),
					});
					setIcon(before, "download-cloud");
				}
			);
			const lastUpdated = new Date(pluginInfo.updated);
			const timeSinceUpdate = calculateTimeElapsed(lastUpdated);
			const updatedSince = itemContainer.createDiv({
				cls: "qps-community-item-updated",
				text: `Updated ${timeSinceUpdate}`,
			});
		}
		const desc = itemContainer.createDiv({
			cls: "qps-community-item-desc",
			text: item.description,
		});
	}
}

async function getPluginList() {
	const repoURL =
		"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";
	return await fetchIt(repoURL, "communityPluginsData");
}

async function fetchAndStorePluginStats() {
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
		console.log("data from url");
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

function getInstalled() {
	return Object.keys(this.app.plugins.manifests);
}

function isInstalled(item: any) {
	return getInstalled().includes(item.id);
}

function sortItemsByDownloads(listItems: any[], pluginStats: any) {
	listItems.sort((a, b) => {
		const pluginAStats = pluginStats[a.id];
		const pluginBStats = pluginStats[b.id];

		if (pluginAStats && pluginBStats) {
			return pluginBStats.downloads - pluginAStats.downloads;
		}

		return 0;
	});
}

function filter(modal: CPModal, listItems: any[]) {
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

		const notInstalledCount = listItems.length; 
		console.log("Nombre de plugins non installés : ", notInstalledCount);
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

	const input = document.createElement("input");
	input.type = "text";
	input.value = currentValue;
	span.replaceWith(input);
	input?.focus();
	selectValue(input);

	input?.addEventListener("blur", () => {
		setTimeout(() => {
			if (modal.isDblClick) return;
			input?.value
				? (settings.groups[groupNumber].name = input.value)
				: (settings.groups[groupNumber].name = `Group${groupNumber}`);
			input.textContent = `${settings.groups[groupNumber].name}`;
			modal.onOpen();
		}, 200);
	});

	input?.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			if (modal.isDblClick) return;
			input?.value
				? (settings.groups[groupNumber].name = input.value)
				: (settings.groups[groupNumber].name = GroupsComm[groupNumber]);
			input.textContent = `${settings.groups[groupNumber].name}`;
			modal.onOpen();
		}
	});
};

// const groupMenu = (
// 	modal: any,
// 	evt: MouseEvent,
// 	span: HTMLSpanElement,
// 	groupNumber: number
// ) => {
// 	const { plugin } = modal;
// 	const { settings } = plugin;
// 	const inGroup = settings.allPluginsList.filter(
// 		(i: PluginInfo) => i.groupInfo.groupIndices?.indexOf(groupNumber) !== -1
// 	);

// 	const menu = new Menu();
// 	menu.addItem((item) =>
// 		item.setTitle("delay group").onClick(() => {
// 			const currentValue = settings.groups[groupNumber].time || 0;
// 			const input = document.createElement("input");
// 			input.type = "text";
// 			input.value = currentValue;
// 			span.replaceWith(input);
// 			input?.focus();
// 			selectValue(input);

// 			input?.addEventListener("blur", () => {
// 				setTimeout(() => {
// 					if (modal.isDblClick) return;
// 					parseInt(input?.value)
// 						? (settings.groups[groupNumber].time = parseInt(
// 								input.value
// 						  ))
// 						: (settings.groups[groupNumber].time = 0);
// 					span.textContent = `${input.value}`;
// 					modal.onOpen();
// 				}, 100);
// 			});

// 			input?.addEventListener("keydown", (event) => {
// 				if (event.key === "Enter") {
// 					if (modal.isDblClick) return;
// 					parseInt(input?.value)
// 						? (settings.groups[groupNumber].time = parseInt(
// 								input.value
// 						  ))
// 						: (settings.groups[groupNumber].time = 0);
// 					span.textContent = `${settings.groups[groupNumber].time}`;
// 					modal.onOpen();
// 				}
// 			});
// 		})
// 	);

// 	menu.addItem((item) =>
// 		item
// 			.setTitle("apply")
// 			.setDisabled(
// 				!inGroup.length || settings.groups[groupNumber].time === 0
// 			)
// 			.onClick(async () => {
// 				for (const plugin of inGroup) {
// 					plugin.time = settings.groups[groupNumber].time;
// 					plugin.delayed = true;
// 					settings.groups[groupNumber].applied = true;
// 					if (plugin.enabled) {
// 						await (modal.app as any).plugins.disablePluginAndSave(
// 							plugin.id
// 						);
// 						await (modal.app as any).plugins.enablePlugin(
// 							plugin.id
// 						);
// 					}
// 					modal.plugin.saveSettings();
// 					modal.onOpen();
// 				}
// 			})
// 	);
// 	menu.addItem((item) =>
// 		item
// 			.setTitle("reset")
// 			.setDisabled(
// 				!inGroup.length || settings.groups[groupNumber].time === 0
// 			)
// 			.onClick(async () => {
// 				for (const plugin of inGroup) {
// 					plugin.time = 0;
// 					plugin.delayed = false;
// 					settings.groups[groupNumber].applied = false;
// 					if (plugin.enabled) {
// 						await (modal.app as any).plugins.enablePluginAndSave(
// 							plugin.id
// 						);
// 					}
// 					modal.onOpen();
// 				}
// 				plugin.saveSettings();
// 			})
// 	);
// 	menu.addSeparator();
// 	const toEnable = inGroup.filter((i: PluginInfo) => i.enabled === false);
// 	menu.addItem((item) =>
// 		item
// 			.setTitle("enable all plugins in group")
// 			.setDisabled(!inGroup.length || !toEnable.length)
// 			.onClick(async () => {
// 				await Promise.all(
// 					toEnable.map(async (i: PluginInfo) => {
// 						conditionalEnable(this, i);
// 						i.enabled = true;
// 						modal.plugin.saveSettings();
// 					})
// 				);
// 				if (toEnable) {
// 					plugin.getLength();
// 					new Notice("All plugins enabled.");
// 					await modal.plugin.saveSettings();
// 					modal.onOpen();
// 				}
// 			})
// 	);

// 	const toDisable = inGroup.filter((i: PluginInfo) => i.enabled === true);
// 	menu.addItem((item) =>
// 		item
// 			.setTitle("disable all plugins in group")
// 			.setDisabled(!inGroup.length || !toDisable.length)
// 			.onClick(async () => {
// 				await Promise.all(
// 					toDisable.map(async (i: PluginInfo) => {
// 						(modal.app as any).plugins.disablePluginAndSave(i.id);
// 						i.enabled = false;
// 					})
// 				);
// 				if (toDisable) {
// 					plugin.getLength();
// 					new Notice("All plugins disabled.");
// 					await modal.plugin.saveSettings();
// 					modal.onOpen();
// 				}
// 			})
// 	);

// 	menu.showAtMouseEvent(evt);
// };
