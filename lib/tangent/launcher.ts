import type { Tangent } from './model';
import type { OpenTangent } from './markers';
import { buildTangentTree, type TangentNode } from './tree';
import { downloadTangents, type ExportFormat } from './export';
import { pickJsonFile } from './import';
import { TRASH_ICON } from './icons';
import { isDark } from './theme';

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
    this.button.dataset.stUi = '1';
    this.button.title = 'Tangents in this chat';
    this.button.setAttribute('aria-label', 'Tangents in this chat');
    this.button.addEventListener('click', () => this.toggle());

    this.panel = document.createElement('div');
    this.panel.className = 'st-launcher-panel';
    this.panel.dataset.stUi = '1';
    this.panel.style.display = 'none';

    document.body.append(this.button, this.panel);
  }

  render(tangents: Tangent[]): void {
    this.tangents = tangents;
    this.button.textContent = `↳ ${tangents.length}`;
    this.rebuildPanel();
  }

  private rebuildPanel(): void {
    const rows = this.tangents.length > 0 ? this.treeRows() : [this.emptyHint()];
    this.panel.replaceChildren(this.actionsBar(), ...rows);
  }

  /** Flatten the tangent forest into indented rows so nested tangents read as a tree. */
  private treeRows(): HTMLElement[] {
    const rows: HTMLElement[] = [];
    const walk = (nodes: TangentNode[], depth: number): void => {
      for (const node of nodes) {
        rows.push(this.itemFor(node.tangent, depth));
        walk(node.children, depth + 1);
      }
    };
    walk(buildTangentTree(this.tangents), 0);
    return rows;
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

  private itemFor(tangent: Tangent, depth: number): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'st-launcher-row';
    if (depth > 0) row.style.paddingLeft = `${depth * 14}px`;

    const open = document.createElement('button');
    open.className = 'st-list-item';
    open.textContent = `${depth > 0 ? '↳ ' : ''}${tangent.title || 'Untitled tangent'}`;
    open.addEventListener('click', () => {
      this.hide();
      this.onOpen(tangent.id);
    });

    const del = document.createElement('button');
    del.className = 'st-icon st-row-del';
    del.title = 'Delete tangent';
    del.setAttribute('aria-label', 'Delete tangent');
    del.innerHTML = TRASH_ICON;
    del.addEventListener('click', () => this.onDelete(tangent.id));

    row.append(open, del);
    return row;
  }

  private toggle(): void {
    const show = this.panel.style.display === 'none';
    if (show) this.panel.dataset.stTheme = isDark() ? 'dark' : 'light';
    this.panel.style.display = show ? 'block' : 'none';
  }

  private hide(): void {
    this.panel.style.display = 'none';
  }
}
