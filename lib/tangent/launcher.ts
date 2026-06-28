import type { Tangent } from './model';
import type { OpenTangent } from './markers';
import { downloadTangents, type ExportFormat } from './export';
import { pickJsonFile } from './import';

export type DeleteTangent = (id: string) => void;
export type ImportTangents = (json: string) => void;

// A floating button listing every tangent in the current conversation, so none get lost. Always
// visible so export and import stay reachable, including on a fresh profile with no tangents yet.
export class Launcher {
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private tangents: Tangent[] = [];

  constructor(
    private readonly onOpen: OpenTangent,
    private readonly onDelete: DeleteTangent,
    private readonly onImport: ImportTangents,
  ) {
    this.button = document.createElement('button');
    this.button.className = 'st-launcher';
    this.button.title = 'Tangents in this chat';
    this.button.setAttribute('aria-label', 'Tangents in this chat');
    this.button.addEventListener('click', () => this.toggle());

    this.panel = document.createElement('div');
    this.panel.className = 'st-launcher-panel';
    this.panel.style.display = 'none';

    document.body.append(this.button, this.panel);
  }

  render(tangents: Tangent[]): void {
    this.tangents = tangents;
    this.button.textContent = `↳ ${tangents.length}`;
    this.rebuildPanel();
  }

  private rebuildPanel(): void {
    const rows =
      this.tangents.length > 0 ? this.tangents.map((tangent) => this.itemFor(tangent)) : [this.emptyHint()];
    this.panel.replaceChildren(this.actionsBar(), ...rows);
  }

  private actionsBar(): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'st-launcher-actions';
    if (this.tangents.length > 0) {
      bar.append(this.exportButton('Export Markdown', 'md'), this.exportButton('Export JSON', 'json'));
    }
    bar.append(this.importButton());
    return bar;
  }

  private exportButton(label: string, format: ExportFormat): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'st-export';
    button.textContent = label;
    button.addEventListener('click', () => downloadTangents(this.tangents, format));
    return button;
  }

  private importButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'st-export';
    button.textContent = 'Import';
    button.addEventListener('click', () => void this.importFromFile());
    return button;
  }

  private async importFromFile(): Promise<void> {
    const json = await pickJsonFile();
    if (json) this.onImport(json);
  }

  private emptyHint(): HTMLDivElement {
    const hint = document.createElement('div');
    hint.className = 'st-launcher-empty';
    hint.textContent = 'No tangents yet. Select text in a reply to start one.';
    return hint;
  }

  private itemFor(tangent: Tangent): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'st-launcher-row';

    const open = document.createElement('button');
    open.className = 'st-list-item';
    open.textContent = tangent.title || 'Untitled tangent';
    open.addEventListener('click', () => {
      this.hide();
      this.onOpen(tangent.id);
    });

    const del = document.createElement('button');
    del.className = 'st-icon st-row-del';
    del.title = 'Delete tangent';
    del.setAttribute('aria-label', 'Delete tangent');
    del.textContent = '🗑';
    del.addEventListener('click', () => this.onDelete(tangent.id));

    row.append(open, del);
    return row;
  }

  private toggle(): void {
    this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none';
  }

  private hide(): void {
    this.panel.style.display = 'none';
  }
}
