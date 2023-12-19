import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import {
	App,
	DropdownComponent,
	Menu,
	Modal,
	Notice,
	Platform,
	debounce,
	setIcon,
} from "obsidian";
import QuickPluginSwitcher from "./main";
import {
	calculateTimeElapsed,
	formatNumber,
	isEnabled,
	removeItem,
} from "./utils";
import {
	GroupsComm,
	KeyToSettingsMapType,
	PackageInfoData,
	PluginCommInfo,
	PluginInfo,
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
	reOpenModal,
} from "./modal_utils";
import {
	addSearch,
	byGroupDropdowns,
	doSearch,
	findMatchingItem,
	getElementFromMousePosition,
	handleContextMenu,
	handleDblClick,
	installAllPluginsInGroup,
	openGitHubRepo,
	searchCommDivButton,
} from "./modal_components";
import { ReadMeModal } from "./secondary_modals";
import { QPSModal } from "./main_modal";
import * as path from "path";

declare global {
	interface Window {
		electron: any;
	}
}

export class CPModal extends Modal {
	header: HTMLElement;
	items: HTMLElement;
	search: HTMLElement;
	searchTyping = true;
	groups: HTMLElement;
	hotkeysDesc: HTMLElement;
	isDblClick = false;
	pressed = false;
	mousePosition: any;
	searchInit = true;

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

		this.modalEl.addEventListener("mousemove", (event) => {
			this.mousePosition = { x: event.clientX, y: event.clientY };
		});

		document.addEventListener("keydown", async (event) => {
			await handleKeyDown(event, this);
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
		await plugin.saveSettings();
		contentEl.empty();
		this.container();
		setGroupTitle(this, plugin, GroupsComm, settings.numberOfGroupsComm);
		this.addHeader(this.header);
		await addSearch(this, this.search, "Search community plugins");
		if (Platform.isDesktopApp) {
			searchCommDivButton(this, this.search);
		}
		this.addGroups(this, this.groups);
		if (settings.showHotKeys) this.setHotKeysdesc();
		await this.addItems(settings.search);
	}

	addHeader = (contentEl: HTMLElement): void => {
		const { plugin } = this;
		const { settings } = plugin;
		//dropdown filters
		new DropdownComponent(contentEl)
			.addOptions({
				all: `All(${settings.commPlugins.length})`,
				installed: `Installed(${getInstalled().length})`,
				notInstalled: `Not Installed(${settings.commPlugins.length - getInstalled().length
					})`,
				byGroup: `By Group`,
			})
			.setValue(settings.filtersComm as string)
			.onChange(async (value) => {
				settings.filtersComm = value;
				await plugin.saveSettings();
				await reOpenModal(this);
			});

		byGroupDropdowns(this, contentEl);
	};

	addGroups(modal: CPModal, contentEl: HTMLElement): void {
		const groups = Object.values(GroupsComm);

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
					text: ` (i,🖱️x2)Readme`,
				});
			}
		);
	}

	async addItems(value: string) {
		const { plugin } = this;
		const { settings } = plugin;
		const { commPlugins, pluginStats } = settings;
		let listItems = cpmModeSort(this, commPlugins);
		sortItemsByDownloads(listItems, pluginStats);
		listItems = doSearch(this, value, listItems) as PluginCommInfo[];
		await this.drawItemsAsync(listItems, pluginStats, value)
	}

	hightLightSpan(value: string, text: string) {
		if (value.trim() === '') {
			return text; // Retourne le texte original si la valeur est vide
		} else {
			const regex = new RegExp(`(${value})`, 'gi');
			return text.replace(regex, `<span class="highlighted">$&</span>`);
		}
	}

	async drawItemsAsync(listItems: PluginCommInfo[], pluginStats: PackageInfoData, value: string) {
		const batchSize = 50;
		let index = 0;

		while (index < listItems.length) {
			const batch = listItems.slice(index, index + batchSize);
			const promises = batch.map(async (item) => {
				const itemContainer = this.items.createEl("div", { cls: "qps-comm-block" });

				const name = this.hightLightSpan(value, item.name);
				const author = `by ${this.hightLightSpan(value, item.author)}`;
				const desc = this.hightLightSpan(value, item.description);

				//name
				itemContainer.createDiv(
					{ cls: "qps-community-item-name" },
					(el: HTMLElement) => {
						el.innerHTML = name;
						if (isInstalled(item)) {
							el.createSpan({ cls: "installed-span", text: "installed" });
						}
						if (isEnabled(this, item.id)) {
							const span = el.createSpan({ cls: "enabled-span" });
							setIcon(span, "power");
						}
					}
				);

				//author
				itemContainer.createDiv({ cls: "qps-community-item-author" });

				const pluginInfo = pluginStats[item.id];
				if (pluginInfo) {
					// downloads
					itemContainer.createDiv(
						{ cls: "qps-community-item-downloads" },
						(el: HTMLElement) => {
							el.innerHTML = author;
							el.createSpan({ cls: "downloads-span" }, (el) => {
								const preSpan = el.createSpan();
								const span = el.createSpan({
									text: formatNumber(pluginInfo.downloads, 1).toString(),
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
				itemContainer.createDiv({ cls: "qps-community-item-desc" }, (el: HTMLElement) => {
					el.innerHTML = desc;
				});

				return itemContainer;
			});

			await Promise.all(promises);
			index += batchSize;
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		document.removeEventListener("mousemove", (event) => {
			this.mousePosition = { x: event.clientX, y: event.clientY };
		});

		document.removeEventListener("keydown", async (event) => {
			await handleKeyDown(event, this);
		});

		this.modalEl.removeEventListener("contextmenu", (evt) => {
			if (this.isDblClick) return;
			handleContextMenu(evt, this);
		});

		this.modalEl.removeEventListener("dblclick", (evt) => {
			if (this.isDblClick) return;
			handleDblClick(evt, this);
		});

		this.plugin.getPluginsInfo();
		this.plugin.getLength();
		new QPSModal(this.app, this.plugin).open();
	}
}

export async function fetchData(url: string) {
	try {
		const response = await fetch(url);
		const data = await response.json();
		if (data) return data;
	} catch (error) {
		// console.warn(`Error fetching data from ${url}:`);
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
		console.warn("Error fetching ReadMe");
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
		console.warn("Error fetching manifest");
	}
	return null;
}

function sortItemsByDownloads(
	listItems: PluginCommInfo[],
	pluginStats: PackageInfoData
) {
	listItems.sort((a, b) => {
		const pluginAStats = pluginStats[a.id];
		const pluginBStats = pluginStats[b.id];

		if (pluginAStats && pluginBStats) {
			return pluginBStats.downloads - pluginAStats.downloads;
		}

		return 0;
	});
}

function cpmModeSort(modal: CPModal, listItems: PluginCommInfo[]) {
	const { settings } = modal.plugin;
	const { filtersComm } = settings;
	if (filtersComm === "installed") {
		const installedPlugins = getInstalled();
		return listItems.filter((item) => installedPlugins.includes(item.id));
	} else if (filtersComm === "notInstalled") {
		const installedPlugins = getInstalled();
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

const handleKeyDown = async (event: KeyboardEvent, modal: CPModal) => {
	const elementFromPoint = getElementFromMousePosition(event, modal);
	const targetBlock = elementFromPoint?.closest(
		".qps-comm-block"
	) as HTMLElement;

	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock);

		if (matchingItem) {
			modal.searchTyping = false;
			await handleHotkeysCPM(
				modal,
				event,
				matchingItem as PluginCommInfo
			);
		}
	} else {
		modal.searchTyping = true;
	}
};

const handleHotkeysCPM = async (
	modal: CPModal,
	evt: KeyboardEvent,
	pluginItem: PluginCommInfo
) => {
	if (modal.pressed) {
		return;
	}
	pressDelay(modal);
	const { plugin } = modal;
	const { settings } = plugin;
	const numberOfGroups = settings.numberOfGroupsComm;
	// handle groups shortcuts
	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: async () => await openGitHubRepo(pluginItem),
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
	}
	taggedItem = pluginsTagged[itemID];
	const { groupInfo } = taggedItem;
	const { groupIndices } = groupInfo;
	const key = parseInt(keyPressed);
	if (key > 0 && key <= numberOfGroups) {
		if (groupIndices.length === 6) return;
		const index = groupIndices.indexOf(key);
		if (index === -1) {
			groupIndices.push(key);
			await plugin.saveSettings();
			await reOpenModal(modal);
		}
	} else if (keyPressed in KeyToSettingsMap) {
		KeyToSettingsMap[keyPressed]();
	} else if (
		keyPressed === "Delete" ||
		keyPressed === "Backspace" ||
		keyPressed === "0"
	) {
		if (groupIndices.length === 1) {
			delete pluginsTagged[itemID];
			await plugin.saveSettings();
			await reOpenModal(modal);
		} else if (groupIndices.length > 1) {
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
							if (groupInfo) {
								groupInfo.groupIndices = removeItem(
									groupIndices,
									groupIndex
								);
								await plugin.saveSettings();
								await reOpenModal(modal);
							}
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

export async function installFromList(modal: CPModal, enable = false) {
	let properties = ["openFile"]; //, "dontAddToRecent"
	let filePaths: string[] = window.electron.remote.dialog.showOpenDialogSync({
		title: "Pick json list file of plugins to install",
		properties,
		filters: ["JsonList", "json"],
	});

	if (filePaths && filePaths.length) {
		const contenu = readFileSync(filePaths[0], "utf-8");

		try {
			const pluginList = JSON.parse(contenu);
			if (Array.isArray(pluginList)) {
				const plugins = modal.plugin.settings.commPlugins.filter(
					(plugin) => {
						return pluginList.includes(plugin.id);
					}
				);

				await installAllPluginsInGroup(modal, plugins, enable);
			} else {
				console.error("this file is not a JSON list.");
			}
		} catch (erreur) {
			console.error("Error reading JSON file: ", erreur);
		}
	}
}

export async function getPluginsList(modal: CPModal, enable = false) {
	const installed = getInstalled();
	let filePath: string = window.electron.remote.dialog.showSaveDialogSync({
		title: "Save installed plugins list as JSON",
		filters: [{ name: "JSON Files", extensions: ["json"] }],
	});
	if (filePath && filePath.length) {
		try {
			const jsonContent = JSON.stringify(installed, null, 2);
			writeFileSync(filePath, jsonContent);
			new Notice(`${filePath} created`, 2500);
		} catch (error) {
			console.error("Error saving JSON file:", error);
		}
	}
}

export async function installPluginFromOtherVault(
	modal: CPModal,
	enable = false
) {
	let dirPath: string[] = window.electron.remote.dialog.showOpenDialogSync({
		title: "Select your vault directory, you want plugins list from",
		properties: ["openDirectory"],
	});
	if (dirPath && dirPath.length) {
		const vaultPath = dirPath[0];

		const obsidianPath = path.join(vaultPath, ".obsidian");
		// isVault?
		if (!existsSync(obsidianPath)) {
			new Notice("Select a vault folder!", 2500);
			return;
		}

		// don't select actual vault!
		const selectedVaultName = path.basename(vaultPath);
		const currentVaultName = modal.app.vault.getName();

		if (selectedVaultName === currentVaultName) {
			new Notice("You have selected the current vault!", 2500);
			return;
		}

		const pluginsPath = path.join(obsidianPath, "plugins");
		if (!existsSync(pluginsPath)) {
			new Notice(
				"This vault doesn't contain any installed plugin!",
				2500
			);
			return;
		}

		const installedPlugins: string[] = [];
		const pluginFolders = readdirSync(pluginsPath);

		for (const pluginFolder of pluginFolders) {
			const pluginFolderPath = path.join(pluginsPath, pluginFolder);
			const packageJsonPath = path.join(pluginFolderPath, "package.json");
			const manifestJsonPath = path.join(
				pluginFolderPath,
				"manifest.json"
			);
			const mainJsPath = path.join(pluginFolderPath, "main.js");

			if (existsSync(packageJsonPath)) {
				// Le plugin a un package.json
				continue;
			}

			if (existsSync(manifestJsonPath) && existsSync(mainJsPath)) {
				const manifestContent = readFileSync(manifestJsonPath, "utf-8");
				const manifestData = JSON.parse(manifestContent);
				const pluginId = manifestData.id;

				installedPlugins.push(pluginId);
			}
		}

		if (!installedPlugins.length) {
			new Notice("Found no plugin to install", 2500);
			return;
		}

		const plugins = modal.plugin.settings.commPlugins.filter((plugin) => {
			return installedPlugins.includes(plugin.id);
		});
		await installAllPluginsInGroup(modal, plugins, enable);
	}
}