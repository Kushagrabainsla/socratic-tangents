import type { Tangent } from './model';
import type { OpenTangent } from './markers';

// A floating button listing every tangent in the current conversation, so none get lost. Hidden
// when there are no tangents.
export class Launcher {
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private tangents: Tangent[] = [];

  constructor(private readonly onOpen: OpenTangent) {
    this.button = document.createElement('button');
    this.button.className = 'st-launcher';
    this.button.title = 'Tangents in this chat';
    this.button.addEventListener('click', () => this.toggle());

    this.panel = document.createElement('div');
    this.panel.className = 'st-launcher-panel';
    this.panel.style.display = 'none';

    document.body.append(this.button, this.panel);
  }

  render(tangents: Tangent[]): void {
    this.tangents = tangents;
    const empty = tangents.length === 0;
    this.button.style.display = empty ? 'none' : 'block';
    this.button.textContent = `↳ ${tangents.length}`;
    if (empty) this.hide();
    else this.rebuildPanel();
  }

  private rebuildPanel(): void {
    this.panel.replaceChildren(...this.tangents.map((tangent) => this.itemFor(tangent)));
  }

  private itemFor(tangent: Tangent): HTMLButtonElement {
    const item = document.createElement('button');
    item.className = 'st-list-item';
    item.textContent = tangent.title || 'Untitled tangent';
    item.addEventListener('click', () => {
      this.hide();
      this.onOpen(tangent.id);
    });
    return item;
  }

  private toggle(): void {
    this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none';
  }

  private hide(): void {
    this.panel.style.display = 'none';
  }
}
