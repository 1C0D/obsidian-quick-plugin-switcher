import { QPSModal } from "./main_modal";
import { ReadMeModal, confirm } from "./secondary_modals";
import {
	ButtonComponent,
	ExtraButtonComponent,
	Menu,
	Notice,
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
	createInput,
} from "./modal_utils";
import { hasKeyStartingWith, isEnabled } from "./utils";
import {
	CPModal,
	getManifest,
	getPluginsList,
	installFromList,
	installPluginFromOtherVault,
} from "./community-plugins_modal";
import { CommFilters, Filters, Groups } from "./types/variables";
import { getPluginsInGroup, editGroupName, groupMenu, addRemoveGroupMenuItems, addToGroupSubMenu, addRemoveItemGroupMenuItems, getIndexFromSelectedGroup, groupNbFromEmoticon, rmvAllGroupsFromPlugin, groupNbFromGrpName, addDelayToGroup } from "./groups";
import { PluginCommInfo, PluginInstalled } from "./types/global";
import { Console } from "./Console";

export const mostSwitchedResetButton = (
	modal: QPSModal,
	contentEl: HTMLElement
) => {
	const { settings } = modal.plugin;
	const { filters, installed } = settings
	if (
		filters === Filters.MostSwitched &&
		Object.keys(installed).some((id) =>
			installed[id].switched !== 0
		)
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

	new Setting(contentEl)
		.addSearch(async (search: SearchComponent) => {
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
	modal: QPSModal,
	value: string,
	plugins: Record<string, PluginInstalled>
): string[] {
	const lowerCaseValue = value.toLowerCase();
	const { byAuthor } = modal.plugin.settings;

	return Object.keys(plugins).filter((id) => {
		const { name, author } = plugins[id];
		const list = byAuthor ? [name, author] : [name];
		return list.some((prop) => prop.toLowerCase().includes(lowerCaseValue));
	});
}

export function doSearchCPM(
	value: string,
	commPlugins: Record<string, PluginCommInfo>
) {
	const lowerCaseValue = value.toLowerCase();
	const pluginsList = Object.values(commPlugins)
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
			"Search for updates"
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

export const checkbox = (
	modal: QPSModal | CPModal,
	contentEl: HTMLElement,
	text: string,
) => {
	const { plugin } = modal;
	const { settings } = plugin;

	if (modal instanceof QPSModal && settings.filters === Filters.ByGroup || modal instanceof CPModal && settings.filtersComm === CommFilters.ByGroup
	) return
	const isQPS = modal instanceof QPSModal
	contentEl.createDiv({ text: text, cls: "qps-comm-invert" }, (el) => {
		el.createEl("input",
			{
				attr: {
					cls: "qps-invert-button",
					type: "checkbox",
					checked: isQPS ? settings.byAuthor : settings.invertFiltersComm,
				}
			}, (checkbox) => {
				checkbox
					.checked = isQPS ? settings.byAuthor : settings.invertFiltersComm,
					checkbox.onchange = () => {
						isQPS ? settings.byAuthor = checkbox.checked : settings.invertFiltersComm = checkbox.checked
						plugin.saveSettings()
						reOpenModal(modal)
					}
			})
	});
}

export const vertDotsButton = (el: HTMLElement) => {
	new ButtonComponent(el)
		.setButtonText("\u2807")
		.setTooltip(
			"open context-menu"
		)
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
		.buttonEl.addEventListener("click", async (evt: MouseEvent) => {
			await plugin.exeAfterDelay(plugin.pluginsCommInfo.bind(plugin));
			new CPModal(modal.app, plugin).open();
			modal.close();
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
	const { installed } = settings
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
								for (const id in installed) {
									if (id === "quick-plugin-switcher")
										continue;
									if (installed[id].enabled)
										settings.wasEnabled.push(id);
									await (
										modal.app as any
									).plugins.disablePluginAndSave(id);
									installed[id].enabled = false;
								}
								plugin.getLength();
								await reOpenModal(modal);
								new Notice("All plugins disabled", 2500);
							} else if (settings.wasEnabled.length > 0) {
								for (const i of settings.wasEnabled) {
									//check plugin not deleted between
									const toUpdate =
										Object.keys(installed).find(
											(id) => id === i
										);
									if (toUpdate) {
										await conditionalEnable(
											modal,
											toUpdate
										);
										installed[toUpdate].enabled = true;
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
					const inGroup = Object.keys(installed).filter((id) => {
						return (
							installed[id].groupInfo.groupIndices.indexOf(
								groupIndex
							) !== -1
						);
					});
					let previousWasEnabled = inGroup.filter(
						(id) => installed[id].groupInfo.groupWasEnabled === true
					);

					if (
						inGroup.length > 0 &&
						(inGroup.some((id) => installed[id].enabled === true) ||
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
											.filter((id) => installed[id].enabled === true)
											.map(async (id) => {
												installed[id].groupInfo.groupWasEnabled =
													true;
												await (
													modal.app as any
												).plugins.disablePluginAndSave(id);
												installed[id].enabled = false;
											});
										await Promise.all(toDisable);
										if (toDisable) {
											plugin.getLength();
											await reOpenModal(modal);
											new Notice(
												"All plugins disabled",
												2500
											);
										}
									} else {
										for (const id of previousWasEnabled) {
											await conditionalEnable(modal, id);
											installed[id].enabled = true;
											installed[id].switched++;
										}
										previousWasEnabled.map((id) => {
											installed[id].groupInfo.groupWasEnabled =
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
											previousWasEnabled.map((id) => {
												installed[id].groupInfo.groupWasEnabled =
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
	pluginItem: PluginInstalled,
	itemContainer: HTMLDivElement
) => {
	const { settings } = modal.plugin;
	if (pluginItem.id === "quick-plugin-switcher") {
		itemContainer.toggleClass("qps-quick-plugin-switcher", true);
	}
	if (pluginItem.isDesktopOnly === true) {
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
	pluginItem: PluginInstalled,
	itemContainer: HTMLDivElement
) => {
	let customValue = pluginItem.name;
	if (pluginItem.isDesktopOnly) {
		customValue = "\u1D30" + customValue;
	}
	customValue = customValue + `|${pluginItem.version}`
	let text = new TextComponent(itemContainer).setValue(customValue)
	const input = text.inputEl;
	input.readOnly = true;
	return input;
};

const pluginFeatureSubmenu = async (
	submenu: Menu,
	pluginItem: PluginInstalled,
	modal: QPSModal
) => {
	const { settings } = modal.plugin;
	const { installed } = settings;
	const id = pluginItem.id;
	submenu.addItem((item) =>
		item
			.setTitle("Short info (i)")
			.setIcon("text")
			.onClick(() => {
				new DescriptionModal(
					modal.plugin.app,
					modal.plugin,
					installed[id]
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
					await openGitHubRepo(modal, installed[id]);
				})
	);

	const pluginSettings = (modal.app as any).setting.openTabById(
		id
	);
	submenu.addSeparator();
	submenu.addItem((item) =>
		item
			.setTitle("Plugin settings (s)")
			.setIcon("settings")
			.setDisabled(!pluginSettings)
			.onClick(async () => {
				await openPluginSettings(modal, pluginItem);
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
	item: PluginInstalled | PluginCommInfo
) {
	const pluginCommands = await modal.app.setting.openTabById(
		"command-palette"
	)?.app?.commands.commands;
	return hasKeyStartingWith(pluginCommands, item.id);
};

export const openGitHubRepo = async (modal: QPSModal | CPModal, plugin: PluginInstalled | PluginCommInfo) => {
	let repo: string;
	if ("repo" in plugin) {
		repo = plugin.repo
	} else {
		const key = plugin.id;
		const { commPlugins } = modal.plugin.settings;
		const matchingPlugin = Object.values(commPlugins).find(
			(plugin) => plugin.id === key
		);
		repo = matchingPlugin?.repo ?? "";
	}
	const repoURL = `https://github.com/${repo}`;
	window.open(repoURL, "_blank"); // open
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

export async function hideOnCLick(modal: QPSModal | CPModal, groupNumber: number, inGroup: string[]) {
	const { plugin } = modal
	const { settings } = plugin
	const { groups, groupsComm, installed, commPlugins } = settings

	if (modal instanceof QPSModal) {
		if (groups[groupNumber]) {
			if (!groups[groupNumber].hidden && !inGroup.length) { new Notice("empty group", 3000); return }
			groups[groupNumber].hidden = !groups[groupNumber].hidden
		}
		inGroup.forEach(id => {
			if (groups[groupNumber].hidden)
				installed[id].groupInfo.hidden = true
			else {
				let prevent = false;
				for (const i of installed[id].groupInfo.groupIndices) {
					if (groups[i].hidden) prevent = true
				}
				if (!prevent) installed[id].groupInfo.hidden = false
			}
		})
	} else {
		if (groups[groupNumber]) {
			if (!groupsComm[groupNumber].hidden && !inGroup.length) { new Notice("empty group", 3000); return }
			groupsComm[groupNumber].hidden = !groupsComm[groupNumber]?.hidden;
		}
		inGroup.forEach((id) => {
			if (groupsComm[groupNumber].hidden)
				commPlugins[id].groupCommInfo.hidden = true
			else {
				let prevent = false;
				for (const i of commPlugins[id].groupCommInfo.groupIndices) {
					if (groupsComm[i].hidden) prevent = true
				}
				if (!prevent) commPlugins[id].groupCommInfo.hidden = false
			}
		})
	}
	await reOpenModal(modal)
}

export async function handleClick(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(modal);
	const targetBlock = elementFromPoint?.closest(
		".button-container"
	) as HTMLElement;
	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock.parentElement as HTMLElement);
		if (matchingItem) {
			if (modal instanceof QPSModal) {
				await contextMenuQPS(evt, modal, matchingItem as PluginInstalled);
			} else {
				contextMenuCPM(evt, modal, matchingItem as PluginCommInfo);
			}
		}
	}
}

export function handleDblClick(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(modal);

	const targetBlock = elementFromPoint?.closest(
		".qps-comm-block"
	) as HTMLElement;

	const targetGroup = elementFromPoint?.closest(
		".qps-groups-name"
	) as HTMLElement;

	const pluginItemBlock = elementFromPoint?.closest(
		".qps-item-line input"
	) as HTMLDivElement;

	const targetGroupIcon = elementFromPoint?.closest(
		".qps-circle-title-group"
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

	if (pluginItemBlock) {
		const matchingItem = findMatchingItem(modal, pluginItemBlock);
		if (matchingItem) {
			handleInputDblClick(modal as QPSModal, pluginItemBlock, matchingItem as PluginInstalled);
		}
	}

	if (targetGroup) {
		const groupName = targetGroup?.textContent;
		const groupNumber = groupNbFromGrpName(groupName!)
		editGroupName(modal, targetGroup, groupNumber);
	}

	if (targetGroupIcon && modal instanceof QPSModal) {
		const groupNumber = groupNbFromEmoticon(targetGroupIcon)
		const inGroup = getPluginsInGroup(modal, groupNumber);
		addDelayToGroup(modal as QPSModal, groupNumber, targetGroupIcon, inGroup);
	}
}

// create temp input in input to modify delayed entering time
const handleInputDblClick = async (
	modal: QPSModal,
	itemContainer: HTMLDivElement,
	pluginItem: PluginInstalled,
) => {
	if (pluginItem.id === "quick-plugin-switcher") return;
	const currentValue = pluginItem.time.toString();
	modal.isDblClick = true;
	if (!itemContainer) {
		return;
	}
	const input = createInput(itemContainer, currentValue);

	if (!pluginItem.delayed) {
		if (input) {
			const setDelay = () => {
				setTimeout(async () => {
					await modal.addDelay(pluginItem.id, input);
					modal.isDblClick = false;
				}, 100);
			}

			input.onkeydown = (event) => {
				if (event.key === "Enter") {
					setDelay();
				}
			};

			input.onblur = setDelay
		}
	} else {
		pluginItem.delayed = false;
		await modal.app.plugins.enablePluginAndSave(pluginItem.id);
		modal.isDblClick = false;
		await reOpenModal(modal);
	}
};


export async function handleContextMenu(evt: MouseEvent, modal: QPSModal | CPModal) {
	const elementFromPoint = getElementFromMousePosition(modal);
	let targetBlock, targetGroup;

	targetGroup = elementFromPoint?.closest(".qps-groups-name") as HTMLElement;

	const groupName = targetGroup?.textContent;
	const groupNumber = groupNbFromGrpName(groupName!)

	if (targetGroup) {
		await groupMenu(evt, modal, groupNumber, targetGroup);
		return
	}

	if (modal instanceof QPSModal) {
		targetBlock = elementFromPoint?.closest(
			".qps-item-line"
		) as HTMLElement;
	} else {
		targetBlock = elementFromPoint?.closest(
			".qps-comm-block"
		) as HTMLElement;
	}


	if (targetBlock) {
		const matchingItem = findMatchingItem(modal, targetBlock);
		if (matchingItem) {
			if (modal instanceof QPSModal) {
				if (!modal.app.isMobile) {
					await contextMenuQPS(evt, modal, matchingItem as PluginInstalled);
				}
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
	const { settings } = modal.plugin;
	const { installed } = settings;
	const id = matchingItem.id;
	menu.addItem((item) => {
		item.setTitle("Install plugin")
			.setDisabled(isInstalled(id) || id === "quick-plugin-switcher")
			.setIcon("log-in")
			.onClick(async () => {
				const lastVersion = await getLatestPluginVersion(modal, id);
				const manifest = await getManifest(modal, id);
				await this.app.plugins.installPlugin(matchingItem.repo, lastVersion, manifest);
				await reOpenModal(modal);
			});
	});

	menu.addItem((item) => {
		const isenabled = isEnabled(modal, id);
		item.setTitle(isenabled ? "Disable plugin" : "Enable plugin")
			.setDisabled(!isInstalled(id) || id === "quick-plugin-switcher")
			.setIcon(isenabled ? "poweroff" : "power")
			.onClick(async () => {
				isEnabled(modal, id)
					? await (modal.app as any).plugins.disablePluginAndSave(id)
					: await (modal.app as any).plugins.enablePluginAndSave(id);

				const msg = isenabled ? "disabled" : "enabled";
				new Notice(`${matchingItem.name} ${msg}`, 2500);
				reOpenModal(modal);
			});
	});
	menu.addItem((item) => {
		item.setTitle("Uninstall plugin")
			.setDisabled(!isInstalled(id) || id === "quick-plugin-switcher")
			.setIcon("log-out")
			.onClick(async () => {
				await this.app.plugins.uninstallPlugin(id);
				new Notice(`${matchingItem.name} uninstalled`, 2500);
				await reOpenModal(modal);
			});
	});
	if (this.app.isMobile) {
		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle("Plugin github (g)")
				.setIcon("github")
				.onClick(async () => {
					await openGitHubRepo(modal, matchingItem);
				})
		})
		menu.addSeparator();
		addToGroupSubMenu(menu, matchingItem, modal, true);
		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle("Remove All groups")
				.setDisabled(
					matchingItem.groupCommInfo.groupIndices.length === 0
				)
				.onClick(async () => {
					// matchingItem.groupCommInfo.groupIndices;
					await rmvAllGroupsFromPlugin(modal, matchingItem);
				});
		});
		addRemoveItemGroupMenuItems(modal, menu, matchingItem, true);
	}
	menu.showAtMouseEvent(evt);
}

async function contextMenuQPS(
	evt: MouseEvent,
	modal: QPSModal,
	matchingItem: PluginInstalled
) {
	const { plugin } = modal;
	const menu = new Menu();

	if (!this.app.isMobile) {
		menu.addItem((item) =>
			item
				.setTitle("Plugin folder (f)")
				.setIcon("folder-open")
				.onClick(async () => {
					await openDirectoryInFileManager(modal, matchingItem);
				})
		);
	}
	if (!this.app.isMobile) {
		menu.addItem(async (item) => {
			item.setTitle("Plugin features").setIcon("package-plus");
			const submenu = (item as any).setSubmenu() as Menu;
			await pluginFeatureSubmenu(submenu, matchingItem, modal);
		});
	} else {
		await pluginFeatureSubmenu(menu, matchingItem, modal);
	}

	if (isInstalled(matchingItem.id)) {
		menu.addSeparator();
		menu.addItem((item) => {
			const { commPlugins } = plugin.settings
			item.setTitle("Search for update")
				.setDisabled(matchingItem.id === "quick-plugin-switcher")
				.setIcon("rocket")
				.onClick(async () => {
					const lastVersion = await getLatestPluginVersion(modal, matchingItem.id);
					if (lastVersion) {
						if (lastVersion <= matchingItem.version) {
							new Notice(`Already last version ${lastVersion}`, 2500)
							return
						}
						const matchingId = Object.keys(commPlugins).find(
							(id) => id === matchingItem.id
						);
						const manifest = await getManifest(modal, matchingId);
						try { await modal.app.plugins.installPlugin(commPlugins[matchingId!].repo, lastVersion, manifest); } catch {
							console.error("install failed");
						}
						new Notice(`version ${matchingItem.version} updated to ${lastVersion}`, 2500);
						matchingItem.version = lastVersion
						await modal.plugin.installedUpdate();
						await reOpenModal(modal);
					} else {
						new Notice(`Not a published plugin`, 2500);
					}
				});
		});
		menu.addItem((item) => {
			item.setTitle("Uninstall plugin")
				.setDisabled(matchingItem.id === "quick-plugin-switcher")
				.setIcon("log-out")
				.onClick(async () => {
					await this.app.plugins.uninstallPlugin(matchingItem.id);
					new Notice(`${matchingItem.name} uninstalled`, 2500);
					await modal.plugin.installedUpdate();
					await reOpenModal(modal);
				});
		});
	}

	if (matchingItem.id !== "quick-plugin-switcher") {
		menu.addSeparator();
		if (!this.app.isMobile) {
			menu.addItem((item) => {
				item.setTitle("Add to group").setIcon("user");
				const submenu = (item as any).setSubmenu() as Menu;
				addToGroupSubMenu(submenu, matchingItem, modal);
			});
		} else {
			addToGroupSubMenu(menu, matchingItem, modal, true);
		}

		if (!this.app.isMobile) {
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
							// matchingItem.groupInfo.groupIndices;
							await rmvAllGroupsFromPlugin(modal, matchingItem);
						});
				});
				addRemoveItemGroupMenuItems(modal, submenu, matchingItem);
			});
		} else {
			menu.addSeparator();
			menu.addItem((item) => {
				item
					.setTitle("Remove All groups")
					.setDisabled(
						matchingItem.groupInfo.groupIndices.length === 0
					)
					.onClick(async () => {
						// matchingItem.groupInfo.groupIndices;
						await rmvAllGroupsFromPlugin(modal, matchingItem);
					});
			});
			addRemoveItemGroupMenuItems(modal, menu, matchingItem, true);
		}
	}
	menu.showAtMouseEvent(evt);
}

export const findMatchingItem = (
	modal: CPModal | QPSModal,
	targetBlock: HTMLElement
) => {
	const { installed, commPlugins } = modal.plugin.settings
	if (modal instanceof QPSModal) {
		let itemName = targetBlock.children[1] as HTMLInputElement ? (targetBlock.children[1] as HTMLInputElement).value : (targetBlock as HTMLInputElement).value as string;
		if (itemName.startsWith("ᴰ")) {
			itemName = itemName.substring(1);
		}
		itemName = itemName.split("|")[0]
		const matchingItem = Object.keys(installed).find(
			(id) => installed[id].name === itemName
		);

		return installed[matchingItem!];
	} else {
		const target = modal.app.isMobile ? targetBlock.children[1] : targetBlock.firstChild
		const itemName = target?.textContent;
		const cleanItemName = itemName?.replace(/installed$/, "").trim();
		const matchingItem = Object.keys(commPlugins).find(
			(id) => commPlugins[id].name === cleanItemName
		);
		return commPlugins[matchingItem!];
	}
};

export const createClearGroupsMenuItem = (
	modal: QPSModal | CPModal,
	menu: Menu,
	groupNumber: number
) => {
	if (!modal.app.isMobile) {
		menu.addItem((item) => {
			item.setTitle("Clear group(s)").setIcon("user-minus");

			const submenu = (item as any).setSubmenu() as Menu;
			addRemoveGroupMenuItems(modal, submenu, groupNumber);
			submenu.addSeparator();
			clearAllGroups(submenu, modal);

		});
	} else {
		menu.addItem((item) => {
			item.setTitle("Clear group(s)").setIcon("user-minus");
		})
		addRemoveGroupMenuItems(modal, menu, groupNumber);
		clearAllGroups(menu, modal);
	}
};

export function clearAllGroups(submenu: Menu, modal: CPModal | QPSModal) {
	const { plugin } = modal;
	const { settings } = plugin
	const { installed, commPlugins, groups, groupsComm } = settings;
	submenu.addItem((subitem) => {
		subitem.setTitle("All groups").onClick(async () => {
			const confirmReset = await confirm(
				"Detach all groups from all plugins?",
				300
			);
			if (confirmReset) {
				if (modal instanceof QPSModal) {
					for (const id in installed) {
						installed[id].groupInfo.hidden = false;
						installed[id].groupInfo.groupIndices = [];
					}
					for (const group in groups) groups[group].hidden = false
					await reOpenModal(modal);
					new Notice(`All groups empty`, 2500);
				} else {
					for (const group in groupsComm) groupsComm[group].hidden = false
					for (const id in commPlugins) {
						commPlugins[id].groupCommInfo.hidden = false;
						commPlugins[id].groupCommInfo.groupIndices = [];
					}
					await reOpenModal(modal);
					new Notice(`All groups empty`, 2500);
				}
			} else {
				new Notice("Operation cancelled", 2500);
			}
		});
	});
}
