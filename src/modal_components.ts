import { QPSModal } from "./main_modal";
import { ReadMeModal, confirm } from "./secondary_modals";
import {
	ButtonComponent,
	ExtraButtonComponent,
	Menu,
	Notice,
	Platform,
	PluginCommInfo,
	PluginInfo,
	SearchComponent,
	Setting,
	TextComponent,
} from "obsidian";
import { DescriptionModal } from "./secondary_modals";
import {
	conditionalEnable,
	getLatestPluginVersion,
	isInstalled,
	openDirectoryInFileManager,
	openPluginSettings,
	reOpenModal,
	reset,
	showHotkeysFor,
	getElementFromMousePosition,
} from "./modal_utils";
import { hasKeyStartingWith, isEnabled, removeItem } from "./utils";
import {
	CPModal,
	getManifest,
	getPluginsList,
	installFromList,
	installPluginFromOtherVault,
} from "./community-plugins_modal";
import { Filters, Groups } from "./types/variables";
import { getPluginsInGroup, editGroupName, groupMenu, addRemoveGroupMenuItems, addToGroupSubMenu, addRemoveItemGroupMenuItems, getIndexFromSelectedGroup, groupNbFromEmoticon, rmvAllGroupsFromPlugin, groupNbFromGrpName } from "./groups";

export const mostSwitchedResetButton = (
	modal: QPSModal,
	contentEl: HTMLElement
) => {
	const { settings } = modal.plugin;
	if (
		settings.filters === Filters.MostSwitched &&
		settings.allPluginsList.some((plugin) => plugin.switched !== 0)
	) {
		new ExtraButtonComponent(contentEl)
			.setIcon("reset")
			.setTooltip("Reset mostSwitched values")
			.onClick(async () => {
				reset(modal);
				await reOpenModal(modal);
			});
	}
};

export async function addSearch(
	modal: CPModal | QPSModal,
	contentEl: HTMLElement,
	placeholder: string
) {
	const { plugin } = modal;
	const { settings } = plugin;

	const search = new Setting(contentEl)
		.addSearch(async (search: SearchComponent) => {
			const actualValue = search.getValue();
			search
				.setValue(settings.search)
				.setPlaceholder(placeholder)
				.onChange(async (value: string) => {
					if (modal.searchTyping) {
						settings.search = value;
						modal.items.empty();
						modal.addItems(value);
					}
				});
		})
		.setClass("qps-search-component");
}

export function doSearchQPS(
	value: string,
	pluginsList: PluginInfo[]
) {
	const lowerCaseValue = value.toLowerCase();
	return pluginsList.filter((item: PluginInfo) =>
		[item.name, item.author]
			.some((prop) => prop.toLowerCase().includes(lowerCaseValue))
	);
}

export function doSearchCPM(
	value: string,
	pluginsList: PluginCommInfo[]
) {
	const lowerCaseValue = value.toLowerCase();
	return pluginsList.filter((item: PluginCommInfo) =>
		[item.name, item.description, item.author]
			.some((prop) => prop.toLowerCase().includes(lowerCaseValue))
	);
}

export const Check4UpdatesButton = (modal: QPSModal | CPModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	new ButtonComponent(el)
		.setIcon("rocket")
		.setCta()
		.setClass("update-button")
		.setTooltip(
			"Search for updateS"
		)
		.buttonEl.addEventListener("click", async (evt: MouseEvent) => {
			modal.app.setting.open();
			const tab = modal.app.setting.openTabById("community-plugins")
			const El = tab.containerEl
			const buttons: NodeListOf<HTMLButtonElement> = El.querySelectorAll('button.mod-cta');// not super useful but I add the type
			const buttonArr: HTMLButtonElement[] = Array.from(buttons);
			const wantedButton = buttonArr.find(button => {
				return (button as HTMLButtonElement).textContent === 'Check for updates'
			}) as HTMLButtonElement
			wantedButton?.click()
		});
};

export const commButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	new ButtonComponent(el)
		.setIcon("download-cloud")
		.setCta()
		.setClass("comm-button")
		.setTooltip(
			"community plugins: you can tag plugins with groups, install by group..."
		)
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			modal.close();
			new CPModal(modal.app, plugin).open();
		});
};

export const commOptionButton = (modal: CPModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	new ButtonComponent(el)
		.setIcon("list-end")
		.setCta()
		.setTooltip(
			"Install & enable plugins based on another Vault content or from a JSON list"
		)
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle("Install plugins based on another Vault")
					.setIcon("book-copy")
					.onClick(async () => {
						await installPluginFromOtherVault(modal);
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Install & enable plugins based on another Vault")
					.setIcon("book-copy")
					.onClick(async () => {
						await installPluginFromOtherVault(modal, true);
					})
			);
			menu.addSeparator();

			menu.addItem((item) =>
				item
					.setTitle("Save installed plugins list")
					.setIcon("pen-square")
					.onClick(async () => {
						await getPluginsList(modal, true);
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Install & enable plugins from json list")
					.setIcon("list")
					.onClick(async () => {
						await installFromList(modal, true);
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Install plugins from json list")
					.setIcon("list")
					.onClick(async () => {
						await installFromList(modal);
					})
			);

			menu.showAtMouseEvent(evt);
		});
};

export const powerButton = (modal: QPSModal, el: HTMLSpanElement) => {
	const { plugin } = modal;
	const { settings } = plugin;
	new ButtonComponent(el)
		.setIcon("power")
		.setCta()
		.setTooltip(
			"toggle plugins: you can disable some plugins and enable them later"
		)
		.buttonEl.addEventListener("click", (evt: MouseEvent) => {
			const menu = new Menu();
			if (
				plugin.lengthEnabled === 1 &&
				settings.wasEnabled.length === 0
			) {
				menu.addItem((item) => item.setTitle("No enabled plugins"));
			} else {
				menu.addItem((item) =>
					item
						.setTitle(
							settings.wasEnabled.length > 0
								? "Enable previous disabled plugins"
								: "Disable all plugins"
						)
						.setIcon(
							settings.wasEnabled.length > 0
								? "power"
								: "power-off"
						)
						.onClick(async () => {
							// disable all except this plugin
							if (plugin.lengthEnabled > 1) {
								for (const i of settings.allPluginsList) {
									if (i.id === "quick-plugin-switcher")
										continue;
									if (i.enabled)
										settings.wasEnabled.push(i.id);
									await (
										modal.app as any
									).plugins.disablePluginAndSave(i.id);
									i.enabled = false;
								}
								plugin.getLength();
								await reOpenModal(modal);
								await plugin.saveSettings();
								new Notice("All plugins disabled", 2500);
							} else if (settings.wasEnabled.length > 0) {
								for (const i of settings.wasEnabled) {
									//check plugin not deleted between
									const pluginToUpdate =
										settings.allPluginsList.find(
											(plugin) => plugin.id === i
										);
									if (pluginToUpdate) {
										await conditionalEnable(
											modal,
											pluginToUpdate
										);
										pluginToUpdate.enabled = true;
									}
								}
								plugin.getLength();
								await reOpenModal(modal);
								settings.wasEnabled = [];
								new Notice("All plugins re-enabled", 2500);
								await modal.plugin.saveSettings();
							}
						})
				);
				if (settings.wasEnabled.length > 0) {
					menu.addItem((item) =>
						item
							.setTitle("Skip re-enable")
							.setIcon("reset")
							.onClick(async () => {
								const confirmReset = await confirm(
									"reset to disable",
									300
								);
								if (confirmReset) {
									settings.wasEnabled = [];
									await modal.plugin.saveSettings();
									new Notice("Done", 2500);
								} else {
									new Notice("Operation cancelled", 2500);
								}
							})
					);
				}

				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Toggle enabled-plugins by group")
						.setDisabled(true)
				);

				Object.keys(Groups).forEach((groupKey) => {
					if (groupKey === "SelectGroup") return;
					const groupValue = Groups[groupKey as keyof typeof Groups];
					const groupIndex = getIndexFromSelectedGroup(groupKey);
					const inGroup = settings.allPluginsList.filter((plugin) => {
						return (
							plugin.groupInfo.groupIndices?.indexOf(
								groupIndex
							) !== -1
						);
					});
					let previousWasEnabled = inGroup.filter(
						(i) => i.groupInfo.groupWasEnabled === true
					);

					if (
						inGroup.length > 0 &&
						(inGroup.some((i) => i.enabled === true) ||
							previousWasEnabled.length > 0)
					) {
						menu.addItem((item) =>
							item
								.setTitle(
									previousWasEnabled.length > 0
										? `Re-enable ${groupValue}`
										: groupValue
								)
								.setIcon(
									previousWasEnabled.length > 0
										? "power"
										: "power-off"
								)
								.onClick(async () => {
									if (previousWasEnabled.length === 0) {
										const toDisable = inGroup
											.filter((i) => i.enabled === true)
											.map(async (i) => {
												i.groupInfo.groupWasEnabled =
													true;
												await (
													modal.app as any
												).plugins.disablePluginAndSave(
													i.id
												);
												i.enabled = false;
											});
										await Promise.all(toDisable);
										if (toDisable) {
											plugin.getLength();
											await reOpenModal(modal);
											new Notice(
												"All plugins disabled",
												2500
											);
											await modal.plugin.saveSettings();
										}
									} else {
										for (const i of previousWasEnabled) {
											await conditionalEnable(modal, i);
											i.enabled = true;
											i.switched++;
										}
										previousWasEnabled.map((plugin) => {
											plugin.groupInfo.groupWasEnabled =
												false;
										});
										plugin.getLength();
										await reOpenModal(modal);
										new Notice(
											"All plugins re-enabled",
											2500
										);
									}
								})
						);
						if (previousWasEnabled.length > 0) {
							menu.addItem((item) =>
								item
									.setTitle("Skip re-enable")
									.setIcon("reset")
									.onClick(async () => {
										const confirmReset = await confirm(
											"skip re-enable ?",
											200
										);
										if (confirmReset) {
											previousWasEnabled.map((plugin) => {
												plugin.groupInfo.groupWasEnabled =
													false;
											});
											await modal.plugin.saveSettings();
											new Notice("Done", 2500);
										} else {
											new Notice(
												"Operation cancelled",
												2500
											);
										}
									})
							);
						}
					}
				});
			}
			menu.showAtMouseEvent(evt);
		});
};

export const itemToggleClass = (
	modal: QPSModal,
	pluginItem: PluginInfo,
	itemContainer: HTMLDivElement
) => {
	const { settings } = modal.plugin;
	if (pluginItem.id === "quick-plugin-switcher") {
		itemContainer.toggleClass("qps-quick-plugin-switcher", true);
	}
	if (pluginItem.desktopOnly === true) {
		itemContainer.addClass("qps-desktop-only");
	}
	if (
		settings.filters === Filters.MostSwitched &&
		pluginItem.switched !== 0
	) {
		itemContainer.toggleClass("qps-most-switched", true);
	}
	if (pluginItem.delayed) {
		itemContainer.toggleClass("toggle-bullet-color", true);
		itemContainer.style.setProperty(
			"--bullet-content",
			`"${pluginItem.time}"`
		);
	}
};

export const itemTextComponent = (
	pluginItem: PluginInfo,
	itemContainer: HTMLDivElement
) => {
	let customValue = pluginItem.name;
	if (pluginItem.desktopOnly) {
		customValue = "\u1D30" + customValue;
	}
	customValue = customValue + `|${pluginItem.version}`
	const text = new TextComponent(itemContainer).setValue(customValue).inputEl;

	return text;
};

const pluginFeatureSubmenu = async (
	submenu: Menu,
	pluginItem: PluginInfo,
	modal: QPSModal
) => {
	submenu.addItem((item) =>
		item
			.setTitle("Plugin infos (i)")
			.setIcon("text")
			.onClick(() => {
				new DescriptionModal(
					modal.plugin.app,
					modal.plugin,
					pluginItem
				).open();
			})
	);

	submenu.addItem(
		(
			item // TODO
		) =>
			item
				.setTitle("Plugin github (g)")
				.setIcon("github")
				.onClick(async () => {
					await openGitHubRepo(pluginItem);
				})
	);

	const pluginSettings = (modal.app as any).setting.openTabById(
		pluginItem.id
	);
	submenu.addSeparator();
	submenu.addItem((item) =>
		item
			.setTitle("Plugin settings (s)")
			.setIcon("settings")
			.setDisabled(!pluginSettings)
			.onClick(async () => {
				await openPluginSettings(modal, pluginSettings);
			})
	);

	// helped by hotkey-helper code, even if it is extremly simplified
	const condition = await getHkeyCondition(modal, pluginItem);
	submenu.addItem((item) =>
		item
			.setTitle("Modify hotkeys (h)")
			.setIcon("plus-circle")
			.setDisabled(!condition)
			.onClick(async () => {
				await showHotkeysFor(modal, pluginItem);
			})
	);
};

export const getHkeyCondition = async function (
	modal: QPSModal | CPModal,
	pluginItem: PluginInfo | PluginCommInfo | Record<string, string>
) {
	const pluginCommands = await (modal.app as any).setting.openTabById(
		"command-palette"
	)?.app?.commands.commands;
	return hasKeyStartingWith(pluginCommands, pluginItem.id);
};

export async function openGitHubRepo(plugin: PluginInfo | PluginCommInfo) {
	if ("repo" in plugin) {
		const repoURL = `https://github.com/${plugin.repo}`;
		window.open(repoURL, "_blank"); // open
	} else {
		try {
			const response = await fetch(
				"https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json"
			);
			const pluginsData: Array<any> = await response.json();

			const pluginData = pluginsData.find(
				(item) => item.id === plugin.id
			);
			if (pluginData && pluginData.repo) {
				const repoURL = `https://github.com/${pluginData.repo}`;
				window.open(repoURL, "_blank"); // open browser in new tab
			} else {
				console.debug("Repo not found for the plugin.");
				try {
					const repoURL = `https://github.com/${plugin.author}/${plugin.id}`;
					window.open(repoURL, "_blank");
				} catch {
					const repoURL = `https://github.com/${plugin.author}`;
					window.open(repoURL, "_blank");
					console.debug("Repo not found for the plugin.");
				}
			}
		} catch (error) {
			console.error("Error fetching plugin data:", error);
		}
	}
}

export const searchDivButtons = (
	modal: QPSModal,
	contentEl: HTMLElement
): void => {
	// toggle plugin options
	const span = contentEl.createEl(
		"span",
		{
			cls: "qps-toggle-plugins",
		},
		(el) => {
			powerButton(modal, el);
			commButton(modal, el);
			Check4UpdatesButton(modal, el)
		}
	);
};

export const searchCommDivButton = (
	modal: CPModal,
	contentEl: HTMLElement
): void => {
	// toggle plugin options
	const span = contentEl.createEl(
		"span",
		{
			cls: "qps-toggle-plugins",
		},
		(el) => {
			commOptionButton(modal, el);
		}
	);
};

let timer: ReturnType<typeof setTimeout>;
let clickCount = 0;

export async function handleClick(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(evt, modal);
	const targetGroupIcon = elementFromPoint?.closest(
		".qps-circle-title-group"
	) as HTMLElement;
	const targetGroup = elementFromPoint?.closest(
		".qps-groups-name"
	) as HTMLElement;

	clickCount++;
	if (clickCount === 1) {
		timer = setTimeout(async () => {
			let groupNumber: number;
			if (targetGroupIcon) {
				groupNumber = groupNbFromEmoticon(targetGroupIcon)
			} else {
				const groupName = targetGroup?.textContent;
				groupNumber = groupNbFromGrpName(groupName!)
			}
			const inGroup = getPluginsInGroup(modal, groupNumber)
			await hideOnCLick(modal, groupNumber, inGroup)
			clickCount = 0
		}, 250)

	} else if (clickCount === 2) {
		clearTimeout(timer)
		if (targetGroup) {
			const groupName = targetGroup?.textContent;
			const groupNumber = groupNbFromGrpName(groupName!)
			editGroupName(modal, targetGroup, groupNumber);
		}
		clickCount = 0
	}
}

export async function hideOnCLick(modal: QPSModal | CPModal, groupNumber: number, inGroup: PluginCommInfo[] | PluginInfo[]) {
	const { plugin } = modal
	const { settings } = plugin
	
	if(!inGroup.length) new Notice("empty group",3000)
	if (modal instanceof QPSModal) {
		if (settings.groups[groupNumber]) {
			settings.groups[groupNumber].hidden = !settings.groups[groupNumber]?.hidden
		}
		inGroup.forEach(p => {
			p.groupInfo!.hidden = !p.groupInfo!.hidden
		})
	} else {
		if (settings.groups[groupNumber]) {
			settings.groupsComm[groupNumber].hidden = !settings.groupsComm[groupNumber]?.hidden;
		}
		(inGroup as PluginCommInfo[]).forEach((p) => {
			p.hidden = !p.hidden
		})
	}
	await plugin.saveSettings()
	await reOpenModal(modal)
}

export function handleDblClick(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(evt, modal);

	const targetBlock = elementFromPoint?.closest(
		".qps-comm-block"
	) as HTMLElement;

	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock);
		if (matchingItem) {
			new ReadMeModal(
				modal.plugin.app,
				modal as CPModal,
				matchingItem as PluginCommInfo
			).open();
		}
	}
}

export function handleContextMenu(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(evt, modal);
	let targetBlock, targetGroup;

	targetGroup = elementFromPoint?.closest(".qps-groups-name") as HTMLElement;

	if (!targetGroup) {
		if (modal instanceof QPSModal) {
			targetBlock = elementFromPoint?.closest(
				".qps-item-line"
			) as HTMLElement;
		} else {
			targetBlock = elementFromPoint?.closest(
				".qps-comm-block"
			) as HTMLElement;
		}
	}

	const groupName = targetGroup?.textContent;
	const groupNumber = groupNbFromGrpName(groupName!)

	if (targetGroup) {
		groupMenu(evt, modal, groupNumber, targetGroup);
	}

	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock);
		if (matchingItem) {
			if (modal instanceof QPSModal) {
				contextMenuQPS(evt, modal, matchingItem as PluginInfo);
			} else {
				contextMenuCPM(evt, modal, matchingItem as PluginCommInfo);
			}
		}
	}
}

export function contextMenuCPM(
	evt: MouseEvent,
	modal: CPModal,
	matchingItem: PluginCommInfo
) {
	evt.preventDefault();
	const menu = new Menu();
	menu.addItem((item) => {
		item.setTitle("Install plugin")
			.setDisabled(isInstalled(matchingItem))
			.setIcon("log-in")
			.onClick(async () => {
				const lastVersion = await getLatestPluginVersion(modal, matchingItem);
				const manifest = await getManifest(matchingItem);
				await this.app.plugins.installPlugin(matchingItem.repo, lastVersion, manifest);
				await reOpenModal(modal);
			});
	});

	menu.addItem((item) => {
		const isenabled = isEnabled(modal, matchingItem.id);
		item.setTitle(isenabled ? "Disable plugin" : "Enable plugin")
			.setDisabled(!isInstalled(matchingItem))
			.setIcon(isenabled ? "poweroff" : "power")
			.onClick(async () => {
				isEnabled(modal, matchingItem.id)
					? await (modal.app as any).plugins.disablePluginAndSave(
						matchingItem.id
					)
					: await (modal.app as any).plugins.enablePluginAndSave(
						matchingItem.id
					);

				const msg = isenabled ? "disabled" : "enabled";
				new Notice(`${matchingItem.name} ${msg}`, 2500);
			});
	});
	menu.addItem((item) => {
		item.setTitle("Uninstall plugin")
			.setDisabled(!isInstalled(matchingItem))
			.setIcon("log-out")
			.onClick(async () => {
				await this.app.plugins.uninstallPlugin(matchingItem.id);
				new Notice(`${matchingItem.name} uninstalled`, 2500);
				await reOpenModal(modal);
			});
	});
	menu.showAtMouseEvent(evt);
}

function contextMenuQPS(
	evt: MouseEvent,
	modal: QPSModal,
	matchingItem: PluginInfo
) {
	const { plugin } = modal;
	const menu = new Menu();

	if (Platform.isDesktopApp) {
		menu.addItem((item) =>
			item
				.setTitle("Plugin folder (f)")
				.setIcon("folder-open")
				.onClick(async () => {
					await openDirectoryInFileManager(modal, matchingItem);
				})
		);
	}
	menu.addItem(async (item) => {
		item.setTitle("Plugin features").setIcon("package-plus");
		const submenu = (item as any).setSubmenu() as Menu;
		await pluginFeatureSubmenu(submenu, matchingItem, modal);
	});

	if (isInstalled(matchingItem)) {
		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle("Search for update")
				.setDisabled(!(!!plugin.settings.pluginStats[matchingItem.id]))
				.setIcon("rocket")
				.onClick(async () => {
					const lastVersion = await getLatestPluginVersion(modal, matchingItem);
					if (lastVersion) {
						if (lastVersion <= matchingItem.version) {
							new Notice(`Already last version ${lastVersion}`, 2500)
							return
						}
						const pluginCominfo = plugin.settings.commPlugins.find(
							(item) => item.id === matchingItem.id
						) as PluginCommInfo;
						const manifest = await getManifest(pluginCominfo);
						try { await modal.app.plugins.installPlugin(pluginCominfo.repo, lastVersion, manifest); } catch {
							console.error("install failed");
						}
						new Notice(`version ${matchingItem.version} updated to ${lastVersion}`, 2500);
						matchingItem.version = lastVersion
						await modal.plugin.getPluginsInfo();
						await reOpenModal(modal);
					} else {
						new Notice(`not a published plugin`, 2500);
					}
				});
		});
		menu.addItem((item) => {
			item.setTitle("Uninstall plugin")
				.setIcon("log-out")
				.onClick(async () => {
					await this.app.plugins.uninstallPlugin(matchingItem.id);
					new Notice(`${matchingItem.name} uninstalled`, 2500);
					await modal.plugin.getPluginsInfo();
					await reOpenModal(modal);
				});
		});
	}

	if (matchingItem.id !== "quick-plugin-switcher") {
		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle("Add to group").setIcon("user");
			const submenu = (item as any).setSubmenu() as Menu;
			addToGroupSubMenu(submenu, matchingItem, modal);
		});
		menu.addItem((item) => {
			item.setTitle("Remove from group").setIcon("user-minus");
			const submenu = (item as any).setSubmenu() as Menu;
			submenu.addItem((subitem) => {
				subitem
					.setTitle("All groups")
					.setDisabled(
						matchingItem.groupInfo.groupIndices.length === 0
					)
					.onClick(async () => {
						matchingItem.groupInfo.groupIndices;
						await rmvAllGroupsFromPlugin(modal, matchingItem);
					});
			});
			addRemoveItemGroupMenuItems(modal, submenu, matchingItem);
		});
	}
	menu.showAtMouseEvent(evt);
}

export const findMatchingItem = (
	modal: CPModal | QPSModal,
	targetBlock: HTMLElement
) => {
	if (modal instanceof QPSModal) {
		let itemName = (targetBlock.children[1] as HTMLInputElement).value;
		if (itemName.startsWith("ᴰ")) {
			itemName = itemName.substring(1);
		}
		itemName = itemName.split("|")[0]
		const matchingItem = modal.plugin.settings.allPluginsList.find(
			(item) => item.name === itemName
		);

		return matchingItem;
	} else {
		const itemName = targetBlock.firstChild?.textContent;
		const cleanItemName = itemName?.replace(/installed$/, "").trim();
		const matchingItem = modal.plugin.settings.commPlugins.find(
			(item) => item.name === cleanItemName
		);
		return matchingItem;
	}
};

export const createClearGroupsMenuItem = (
	modal: QPSModal | CPModal,
	menu: Menu,
	groupNumber: number
) => {
	menu.addItem((item) => {
		const { plugin } = modal;
		item.setTitle("Clear group(s)").setIcon("user-minus");

		const submenu = (item as any).setSubmenu() as Menu;
		addRemoveGroupMenuItems(modal, submenu, groupNumber);
		submenu.addSeparator();
		submenu.addItem((subitem) => {
			subitem.setTitle("All groups").onClick(async () => {
				const confirmReset = await confirm(
					"Detach all groups from all plugins?",
					300
				);
				if (confirmReset) {
					if (modal instanceof QPSModal) {
						for (const i of plugin.settings.allPluginsList) {
							i.groupInfo.groupIndices = [];
						}
						await plugin.saveSettings();
						await reOpenModal(modal);
						new Notice(`All groups empty`, 2500);
					} else {
						const { settings } = modal.plugin;
						let { pluginsTagged, commPlugins } = settings;
						for (const item of commPlugins) {
							delete pluginsTagged[item.id];
						}
						await modal.plugin.saveSettings();
						await reOpenModal(modal);
						new Notice(`All groups empty`, 2500);
					}
				} else {
					new Notice("Operation cancelled", 2500);
				}
			});
		});
	});
};


