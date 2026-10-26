import * as path from "path";
import * as vscode from "vscode";

function hasUri(input: unknown): input is { uri: vscode.Uri } {
	return (
		typeof input === "object" &&
		input !== null &&
		"uri" in input &&
		(input as Record<string, object>).uri instanceof vscode.Uri
	);
}

export function activate(context: vscode.ExtensionContext) {
	// #region: bdelete
	const bdeleteCommand = vscode.commands.registerCommand(
		"buf.bdelete",
		async () => {
			const activeUri = vscode.window.activeTextEditor?.document.uri;
			if (!activeUri) {
				return;
			}

			const activeUriStr = activeUri.toString();

			for (const groups of vscode.window.tabGroups.all) {
				for (const tab of groups.tabs) {
					if (hasUri(tab.input)) {
						if (tab.input.uri.toString() === activeUriStr) {
							vscode.window.tabGroups.close(tab);
						}
					}
				}
			}
		},
	);

	context.subscriptions.push(bdeleteCommand);
	// #endregion: bdelete

	// #region: pick
	const pickCommand = vscode.commands.registerCommand("buf.pick", async () => {
		const openedUriStrSet = new Set<string>();
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (hasUri(tab.input)) {
					openedUriStrSet.add(tab.input.uri.toString());
				}
			}
		}

		if (openedUriStrSet.size === 0) {
			return;
		}

		const mruUriStrSet = new Set([
			...mruUriStrs.filter((uriStr) => openedUriStrSet.has(uriStr)),
			...openedUriStrSet,
		]);

		const quickPick = vscode.window.createQuickPick();
		quickPick.items = [...mruUriStrSet]
			.map((uriStr) => vscode.Uri.parse(uriStr))
			.map((uri) => ({
				label: path.basename(uri.fsPath),
				iconPath: vscode.ThemeIcon.File,
				description: vscode.workspace.asRelativePath(uri, false),
				resourceUri: uri,
			}));

		const activeUri = vscode.window.activeTextEditor?.document.uri;
		if (activeUri) {
			const activeUriStr = activeUri.toString();
			const activeItem = quickPick.items.find(
				(item) => item.resourceUri?.toString() === activeUriStr,
			);
			if (activeItem) {
				quickPick.activeItems = [activeItem];
			}
		}

		quickPick.onDidAccept(async () => {
			const selectedItem = quickPick.selectedItems[0];
			if (selectedItem.resourceUri) {
				await vscode.window.showTextDocument(selectedItem.resourceUri);
			}
			quickPick.hide();
		});
		quickPick.onDidHide(async () => quickPick.dispose());
		quickPick.show();
	});

	context.subscriptions.push(pickCommand);
	// #endregion: pick

	// #region: quit
	const quitCommand = vscode.commands.registerCommand("buf.quit", async () => {
		const groups = vscode.window.tabGroups;
		if (groups.all.length <= 1) {
			await groups.close(groups.all);
			return;
		}

		const activeGroup = groups.activeTabGroup;

		const destGroup = groups.all
			.filter((x) => x !== activeGroup)
			.reduce((a, b) => (a.tabs.length < b.tabs.length ? b : a));
		const destGroupActiveTab = destGroup.activeTab;

		for (const tab of activeGroup.tabs) {
			if (hasUri(tab.input)) {
				await vscode.window.showTextDocument(tab.input.uri, {
					viewColumn: destGroup.viewColumn,
					preserveFocus: true,
					preview: false,
				});
			}
		}

		await groups.close(activeGroup);

		if (destGroupActiveTab && hasUri(destGroupActiveTab.input)) {
			const uriStr = destGroupActiveTab.input.uri.toString();
			for (const tab of destGroup.tabs) {
				if (hasUri(tab.input) && uriStr === tab.input.uri.toString()) {
					await vscode.window.showTextDocument(tab.input.uri, {
						viewColumn: destGroup.viewColumn,
						preserveFocus: true,
					});
				}
			}
		}
	});

	context.subscriptions.push(quitCommand);
	// #endregion: quit

	// #region: mru
	let mruUriStrs: string[] = [];

	const updateMru = vscode.window.onDidChangeActiveTextEditor((textEditor) => {
		if (!textEditor) {
			return;
		}

		const uriStr = textEditor.document.uri.toString();
		mruUriStrs = mruUriStrs.filter((uri) => uri.toString() !== uriStr);
		mruUriStrs.unshift(uriStr);
	});

	context.subscriptions.push(updateMru);
	// #endregion: mru
}

export function deactivate() {}
