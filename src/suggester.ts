import { TFolder, AbstractInputSuggest } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    textInputEl: HTMLInputElement;

    protected getSuggestions(query: string): TFolder[] | Promise<TFolder[]> {
        const result: TFolder[] = [];
        for (const abstractFile of this.app.vault.getAllLoadedFiles()) {
            if (abstractFile instanceof TFolder && abstractFile.path.includes(query)) {
                result.push(abstractFile);
            }
        }
        return result;
    }

    renderSuggestion(value: TFolder, el: HTMLElement): void {
        el.createEl('span', { text: value.path });
    }

    selectSuggestion(value: TFolder): void {
        this.textInputEl.value = value.path;
        this.textInputEl.trigger("input");
        this.close();
    }
}