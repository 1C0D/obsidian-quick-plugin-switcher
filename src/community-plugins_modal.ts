import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import {
	App,
	DropdownComponent,
	Menu,
	Modal,
	Notice,
	Platform,
	PluginManifest,
	TFile,
	requestUrl,
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
	pressDelay,
	getInstalled,
	isInstalled,
	reOpenModal,
	getElementFromMousePosition,
	getHidden,
	focusSearchInput,
} from "./modal_utils";
import {
	addSearch,
	checkbox,
	doSearchCPM,
	findMatchingItem,
	getFilters,
	handleClick,
	handleContextMenu,
	handleDblClick,
	handleTouchStart,
	notesButton,
	openGitHubRepo,
	searchCommDivButton,
	showStats,
	vertDotsButton,
} from "./modal_components";
import { ReadMeModal, SeeNoteModal } from "./secondary_modals";
import { QPSModal, circleCSSModif, toggleVisibility } from "./main_modal";
import * as path from "path";
import { CommFilters, GroupsComm } from "./types/variables";
import { setGroupTitle, byGroupDropdowns, getEmojiForGroup, getCirclesItem, installAllPluginsInGroup, getIndexFromSelectedGroup, rmvAllGroupsFromPlugin } from "./groups";
import { KeyToSettingsMapType, PackageInfoData, PluginCommInfo } from "./global";
import { Console } from "./Console";

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
	mousePosition: { x: number; y: number };
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
	getHandleTouch = (evt: TouchEvent) => {
		if (this.isDblClick) return;
		handleTouchStart(evt, this);
	}

	removeListeners() {
		this.modalEl.removeEventListener("mousemove", this.getMousePosition);
		document.removeEventListener("keydown", this.getHandleKeyDown);
		this.modalEl.removeEventListener("contextmenu", this.getHandleContextMenu);
		if (Platform.isDesktop) {
			this.modalEl.removeEventListener("dblclick", this.getHandleDblClick);
			this.modalEl.removeEventListener("click", this.getHandleClick);
		}
		if (Platform.isMobile) {
			this.modalEl.removeEventListener("touchstart", this.getHandleTouch);
		}

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

		this.modalEl.addEventListener("mousemove", this.getMousePosition);
		document.addEventListener("keydown", this.getHandleKeyDown);
		this.modalEl.addEventListener("contextmenu", this.getHandleContextMenu);
		if (Platform.isDesktop) {
			this.modalEl.addEventListener("dblclick", this.getHandleDblClick);
			this.modalEl.addEventListener("click", this.getHandleClick);
		}
		if (Platform.isMobile) {
			this.modalEl.addEventListener("touchstart", this.getHandleTouch);
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
		setGroupTitle(this, GroupsComm, settings.numberOfGroupsComm);
		this.addHeader(this.header);
		await addSearch(this, this.search, "Search community plugins");
		if (Platform.isDesktopApp) {
			searchCommDivButton(this, this.search);
		}
		this.addGroups(this, this.groups);
		if (settings.showHotKeys && !this.app.isMobile) this.setHotKeysdesc();
		await this.addItems(settings.search);
	}

	addHeader = (contentEl: HTMLElement): void => {
		const { plugin } = this;
		const { settings } = plugin;
		//dropdown filters
		new DropdownComponent(contentEl)
			.addOptions({
				all: `All(${Object.keys(settings.commPlugins).length})`,
				installed: `Installed(${getInstalled().length})`,
				notInstalled: Platform.isMobile ? "Not Installed" : `Not Installed(${Object.keys(settings.commPlugins).length - getInstalled().length
					})`,
				byGroup: `By Group`,
				hidden: `Hidden(${getHidden(this).length})`,
			})
			.setValue(settings.filtersComm as string)
			.onChange(async (value: keyof typeof CommFilters) => {
				settings.filtersComm = value;
				await plugin.saveSettings();
				await reOpenModal(this);
			});

		getFilters(this, contentEl)
		byGroupDropdowns(this, contentEl);
		checkbox(this, contentEl, "Inv");
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
					}, (el) => {
						const { plugin } = modal;
						const { settings } = plugin;
						const hidden = settings.groupsComm[i]?.hidden
						if (hidden) {
							el.style.textDecoration = "line-through"
						} else {
							el.style.textDecoration = "none"
						}
					});

					const groupNumberText = `(<span class="shortcut-number">${i}</span>)`;
					// postSpan
					span.insertAdjacentHTML("beforeend", groupNumberText);
				}
			);
		}
		if (!this.app.isMobile) {
			contentEl.createSpan({
				text: `> (h)👁️ (🖱️x2)name`,
			});
		} else {
			contentEl.createSpan({
				text: `(🖱️x2)name,icon:delay (🖱️...)context-menu`,
			})
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
					text: ` (🖱️x2/ctrl)Readme `,
				});
				el.createSpan({ text: "(n)📝 " });
				el.createSpan({	text: "(s)📊" });

			}
		);
	}

	async addItems(value: string) {
		const { plugin } = this;
		const { settings } = plugin;
		const { commPlugins, pluginStats } = settings;
		let listItems = doSearchCPM(value, commPlugins);
		listItems = cpmModeSort(this, listItems);
		sortItemsBy.bind(this)(this, listItems);
		await this.drawItemsAsync.bind(this)(listItems, pluginStats, value)
	}

	hightLightSpan(value: string, text: string) {
		if (value.trim() === '') {
			return text;
		} else {
			const regex = new RegExp(`(${value})`, 'gi');
			return text.replace(regex, `<span class="highlighted">$&</span>`);
		}
	}

	async drawItemsAsync(listItems: string[], pluginStats: PackageInfoData, value: string) {
		const batchSize = 50;
		let index = 0;

		const { plugin } = this;
		const { settings } = plugin;
		const { commPlugins, filtersComm } = settings;

		while (index < listItems.length) {
			const batch = listItems.slice(index, index + batchSize);
			const promises = batch.map(async (item) => {
				if (commPlugins[item].groupCommInfo?.hidden && !commPlugins[item].groupCommInfo.groupIndices.length) {
					commPlugins[item].groupCommInfo.hidden = false
				}//if removed from group
				if (filtersComm !== CommFilters.ByGroup) {
					if (commPlugins[item].groupCommInfo?.hidden && filtersComm !== CommFilters.Hidden) {
						return
					}
				}
				// blocks
				const itemContainer = this.items.createEl("div", { cls: "qps-comm-block" });

				if (this.app.isMobile) {
					itemContainer.createEl(
						"div",
						{
							cls: "button-container",
						},
						(el) => {
							vertDotsButton(el);
						})
				}

				const notesButtonContainer = itemContainer.createEl(
					"div",
					{
						cls: "button-container1",
					},
					(el) => {
						notesButton(el, this, commPlugins[item]);
					})
				// higher because only 1 button
				if (Platform.isDesktop) {
					notesButtonContainer.addClass("button-container1-desktop")
				}
				// color background
				if (commPlugins[item].hasNote) {
					notesButtonContainer.addClass("notes-button-background");
				}
				// highlight search results
				const name = this.hightLightSpan(value, commPlugins[item].name);
				const author = `by ${this.hightLightSpan(value, commPlugins[item].author)}`;
				const desc = this.hightLightSpan(value, commPlugins[item].description);

				// community plugin name
				itemContainer.createDiv(
					{ cls: "qps-community-item-name" },
					(el: HTMLElement) => {
						el.innerHTML = name;
						if (isInstalled(item)) {
							el.createSpan({ cls: "installed-span", text: "installed" });
						}
						if (isEnabled(this, item)) {
							const span = el.createSpan({ cls: "enabled-span" });
							setIcon(span, "power");
						}
					}
				);

				//author
				itemContainer.createDiv({ cls: "qps-community-item-author" });

				const pluginInfo = pluginStats[item];
				itemContainer.createDiv(
					{ cls: "qps-community-item-downloads" },
					(el: HTMLElement) => {
						el.innerHTML = author;
						el.createSpan({ cls: "downloads-span" }, (el) => {
							const preSpan = el.createSpan();
							const text = pluginInfo ? formatNumber(pluginInfo.downloads, 1).toString() : "0";
							const span = el.createSpan({
								text: text,
								cls: "downloads-text-span",
							});
							addGroupCircles(this, span, item);
							setIcon(preSpan, "download-cloud");
						});
					}
				);

				const lastUpdated = pluginInfo ? new Date(pluginInfo.updated) : null;
				const timeSinceUpdate = lastUpdated ? calculateTimeElapsed(lastUpdated) : "";
				// Updated
				itemContainer.createDiv({
					cls: "qps-community-item-updated",
					text: lastUpdated ? `Updated ${timeSinceUpdate}` : "Updated: not available yet",
				});

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

	async onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.removeListeners()
		await this.plugin.installedUpdate();
		new QPSModal(this.app, this.plugin).open();
		focusSearchInput(100);
	}
}

export async function fetchData(url: string) {
	try {
		const response = await requestUrl(url);
		const data = await response.json;
		if (data) return data;
	} catch (error) {
		// console.warn(`Error fetching data from ${url}:`);
		return null;
	}
}

export async function getReadMe(item: PluginCommInfo) {
	const repo = item.repo;
	const readmeFormats = ['README.md', 'README.org'];
	for (const format of readmeFormats) {
		const repoURL = `https://api.github.com/repos/${repo}/contents/${format}`;
		try {
			const response = await requestUrl(repoURL);
			if (response.status === 200) {
				return await response.json;
			}
			if (format === 'README.md') {
				break; // Stop searching if README.md is found
			}
		} catch (error) {
			console.warn(`Error fetching ${format}`);
		}
	}
	return null;
}

export async function getManifest(modal: CPModal | QPSModal, id: string) {
	// todo check if last release is ok same manifest version
	const { commPlugins } = modal.plugin.settings
	const repo = commPlugins[id]?.repo;
	const repoURL = `https://raw.githubusercontent.com/${repo}/HEAD/manifest.json`;

	try {
		const response = await requestUrl(repoURL);
		return await response.json;
	} catch (error) {
		Console.log("id, commPlugins[id]", id, commPlugins[id])
		console.warn("Error fetching manifest");
	}
	return null;
}

export async function getReleaseVersion(modal: CPModal | QPSModal, id: string, manifest: PluginManifest) {
	const { commPlugins } = modal.plugin.settings
	const repo = commPlugins[id].repo;
	// manifest.version = "100.0.0" //debug

	const releaseUrl = `https://github.com/${repo}/releases/tag/${manifest.version}`;

	try {
		const response = await requestUrl(releaseUrl);
		if (response) return true
		return false

	} catch {
		return false
	}
}

function sortItemsBy(
	modal: CPModal,
	listItems: string[],
) {
	const { settings } = modal.plugin;
	const { commPlugins } = settings;
	if (settings.sortBy === "Downloads") {
		listItems.sort((a, b) => {
			return settings.invertFiltersComm ? commPlugins[a].downloads - commPlugins[b].downloads : commPlugins[b].downloads - commPlugins[a].downloads;
		});
	} else if (settings.sortBy === "Updated") {
		listItems.sort((a, b) => {
			return settings.invertFiltersComm ? commPlugins[a].updated - commPlugins[b].updated : commPlugins[b].updated - commPlugins[a].updated;
		});

	} else if (settings.sortBy === "Alpha") {
		listItems.sort((a, b) => {
			return settings.invertFiltersComm ? commPlugins[b].name.localeCompare(commPlugins[a].name) : commPlugins[a].name.localeCompare(commPlugins[b].name);
		})
	} else if (settings.sortBy === "Released") {
		listItems.sort((a, b) => {
			const indexA = settings.plugins.findIndex((id: string) => id === commPlugins[a].id);
			const indexB = settings.plugins.findIndex((id: string) => id === commPlugins[b].id);
			return settings.invertFiltersComm ? indexA - indexB : indexB - indexA;
		});
	}
}

function cpmModeSort(modal: CPModal, listItems: string[]) {
	const { settings } = modal.plugin;
	const { filtersComm, commPlugins } = settings;
	if (filtersComm === CommFilters.Installed) {
		const installedPlugins = getInstalled();
		return listItems.filter((item) => installedPlugins.includes(item));
	} else if (filtersComm === CommFilters.NotInstalled) {
		const installedPlugins = getInstalled();
		return listItems.filter((item) => !installedPlugins.includes(item));
	} else if (filtersComm === CommFilters.ByGroup) {
		const groupIndex = getIndexFromSelectedGroup(
			settings.selectedGroup
		);
		if (groupIndex !== 0) {
			const groupedItems = listItems.filter((i) => {
				return commPlugins[i].groupCommInfo?.groupIndices.indexOf(groupIndex) !== -1;
			});
			return groupedItems;
		} else return listItems;
	} else if (filtersComm === CommFilters.Hidden) {
		return getHidden(modal);
	}
	else {
		return listItems;
	}
}

const handleKeyDown = async (event: KeyboardEvent, modal: CPModal) => {
	const elementFromPoint = getElementFromMousePosition(modal);
	const targetBlock = elementFromPoint?.closest(
		".qps-comm-block"
	) as HTMLElement;

	const targetGroupIcon = elementFromPoint?.closest(
		".qps-circle-title-group"
	) as HTMLElement;
	const targetGroup = elementFromPoint?.closest(
		".qps-groups-name"
	) as HTMLElement;

	if (targetBlock) {
		(document.querySelector(".qps-search-component input") as HTMLInputElement)?.blur();// for a reason not working in a function. must be fast I guess
		modal.searchTyping = false;
		const matchingItem = findMatchingItem(modal, targetBlock);
		if (matchingItem) {
			event.preventDefault();
			await handleHotkeysCPM(
				modal,
				event,
				matchingItem as PluginCommInfo
			);
		}
	} else if ((targetGroupIcon || targetGroup) && event.key === "h") {
		modal.searchTyping = false;
		await toggleVisibility(modal, targetGroupIcon, targetGroup);
	}
	else {
		modal.searchTyping = true;
	}
};

const handleHotkeysCPM = async (
	modal: CPModal,
	evt: KeyboardEvent,
	pluginItem: PluginCommInfo
) => {
	if (modal.pressed) {// with press delay...
		return;
	}
	pressDelay(modal);
	const { plugin } = modal;
	const { settings } = plugin;
	const { groupsComm, commPlugins } = settings
	const numberOfGroups = settings.numberOfGroupsComm;

	const KeyToSettingsMap: KeyToSettingsMapType = {
		g: async () => await openGitHubRepo(evt, modal, pluginItem),
		n: async () => await handleNote(evt, modal, pluginItem),
		s: async () => showStats(pluginItem),
	};

	const keyPressed = evt.key;
	let groupIndices = pluginItem.groupCommInfo.groupIndices;
	const key = parseInt(keyPressed);
	if (key > 0 && key <= numberOfGroups) {
		if (groupIndices.length === 6) return;
		const index = groupIndices.indexOf(key);
		if (index === -1) {
			groupIndices.push(key);
			if (groupsComm[key].hidden)
				commPlugins[pluginItem.id].groupCommInfo.hidden = true
			await reOpenModal(modal);
		}
	} else if (keyPressed in KeyToSettingsMap) {
		KeyToSettingsMap[keyPressed]();
	} else if (evt.metaKey || evt.ctrlKey) {
		new ReadMeModal(plugin.app, modal, pluginItem).open()
	} else if (
		keyPressed === "Delete" ||
		keyPressed === "Backspace" ||
		keyPressed === "0"
	) {
		if (groupIndices.length === 1) {
			pluginItem.groupCommInfo.groupIndices = [];
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
							groupIndices = removeItem(
								groupIndices,
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

const addGroupCircles = (
	modal: CPModal,
	el: HTMLElement,
	item: string
) => {
	const { settings } = modal.plugin;
	const { commPlugins } = settings;
	const indices = commPlugins[item].groupCommInfo.groupIndices;
	if (indices.length) {
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
	let properties = ["openFile"];
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
				const plugins = Object.keys(modal.plugin.settings.commPlugins).filter(
					(id) => {
						return pluginList.includes(id);
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

		const plugins = Object.keys(modal.plugin.settings.commPlugins).filter((id) => {
			return installedPlugins.includes(id);
		});
		await installAllPluginsInGroup(modal, plugins, enable);
	}
}

export async function updateNotes(plugin: QuickPluginSwitcher) {
	const name = "Community plugins notes";
	const dir = plugin.settings.commPluginsNotesFolder;
	let note: TFile;
	const path = dir ? dir + "/" + name + ".md" : name + ".md";
	note = this.app.vault.getAbstractFileByPath(path) as TFile;
	if (note) {
		let content = note ? await this.app.vault.read(note) : "";
		const h1Titles: string[] = content.split('\n')
			.filter((line: string) => line.startsWith('# '))
			.map((line: string) => line.substring(2).trim());
		const { commPlugins } = plugin.settings
		Object.values(commPlugins).forEach((plugin: PluginCommInfo) => {
			if (plugin.hasNote && !h1Titles.includes(plugin.name)) {
				plugin.hasNote = false;
			} else if (!plugin.hasNote && h1Titles.includes(plugin.name)) {
				plugin.hasNote = true;
			}
		})
	}
}

export async function handleNote(e: KeyboardEvent | MouseEvent | TouchEvent, modal: CPModal, pluginItem: PluginCommInfo, _this?: ReadMeModal) {
	const name = "Community plugins notes";
	const dir = modal.plugin.settings.commPluginsNotesFolder;
	let note: TFile;
	if (dir && !modal.app.vault.getAbstractFileByPath(dir)) {
		await modal.app.vault.createFolder(dir);
	}
	const path = dir ? dir + "/" + name + ".md" : name + ".md";
	note = modal.app.vault.getAbstractFileByPath(path) as TFile;

	if (!note) {
		await modal.app.vault.create(path, "");
		note = modal.app.vault.getAbstractFileByPath(path) as TFile;
	}
	let content = note ? await modal.app.vault.read(note) : "";
	const savedContent = content;
	const sectionHeader = "# " + pluginItem.name;
	const sectionIndex = content.indexOf(sectionHeader);
	let sectionContent = "";

	if (sectionIndex !== -1) {
		Console.log("exists")
		const contentAfterSection = content.substring(sectionIndex);
		const nextSectionIndex = contentAfterSection.indexOf("\n# ", sectionHeader.length);
		sectionContent = nextSectionIndex !== -1
			? contentAfterSection.substring(0, nextSectionIndex)
			: contentAfterSection;
		sectionContent = sectionContent.replace(sectionHeader + '\n\n', '');
	} else {
		Console.log("append")
		if (content && !content.endsWith("\n")) {
			content = content + "\n";
		}
		const added = content ? content + "\n" + sectionHeader + "\n\n" : sectionHeader + "\n\n";
		Console.log("added", added)
		await modal.app.vault.modify(note, added);
		content = await modal.app.vault.read(note);
		sectionContent = "";
	}

	new SeeNoteModal(modal.app, modal, pluginItem, sectionContent, async (result) => {
		await cb(result, modal, pluginItem, sectionContent, note, content, savedContent, _this)
	}, _this).open();
}

async function cb(result: string | null, modal: CPModal, pluginItem: PluginCommInfo, sectionContent: string, note: TFile, content: string, savedContent: string, _this?: ReadMeModal) {
	Console.log("sectionContent", sectionContent)
	Console.log("result", result)
	if (result === null) {
		Console.log("invalid content");
		const updatedContent = content.replace(sectionContent, "");
		await modal.app.vault.modify(note, updatedContent);
		content = await modal.app.vault.read(note);

		// new SeeNoteModal(modal.app, modal, pluginItem, sectionContent, async (result) => {
		// 	await cb(result, modal, pluginItem, sectionContent, note, content, savedContent)
		// }).open();
		return
	}

	if (result.trim() === "") {
		Console.log(" resut has no content")
		let updatedContent = "";
		const regexPattern = new RegExp("# " + pluginItem.name + "\n\n?" + sectionContent + "\n?", "g");
		updatedContent = content.replace(regexPattern, "");

		Console.log("updatedContent", updatedContent)

		await modal.app.vault.modify(note, updatedContent);
		pluginItem.hasNote = false;
		await modal.plugin.saveSettings();
		if (_this) {
			_this.onOpen()
			modal.onOpen()
		}
		else modal.onOpen()
		return
	}

	Console.log("result has content")
	if (sectionContent.trim() === result.trim()) {
		Console.log("same content")
		return
	} else {
		Console.log("not same content")
		if (!sectionContent) {
			Console.log("append")
			const added = content ? "\n# " + pluginItem.name + "\n\n" + result : "\n" + result
			modal.app.vault.append(note, (result));
		} else {
			Console.log("replace")
			const updatedContent = content.replace(sectionContent, result);
			await modal.app.vault.modify(note, updatedContent);
		}
		pluginItem.hasNote = true;
		await modal.plugin.saveSettings();
		if (_this) {
			_this.onOpen()
			modal.onOpen()
		}
		else modal.onOpen()
	}
}