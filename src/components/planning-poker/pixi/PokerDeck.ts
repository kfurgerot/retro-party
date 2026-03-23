import { Container } from "pixi.js";
import { PokerCard } from "./PokerCard";

type PokerDeckOptions = {
  values: string[];
  cardWidth: number;
  cardHeight: number;
  onSelect: (value: string) => void;
};

export class PokerDeck {
  readonly view = new Container();

  private readonly cards = new Map<string, PokerCard>();

  private readonly onSelect: (value: string) => void;

  private values: string[];

  private selectedValue: string | null = null;

  private interactive = true;

  private cardWidth: number;

  private cardHeight: number;

  constructor(options: PokerDeckOptions) {
    this.values = options.values;
    this.cardWidth = options.cardWidth;
    this.cardHeight = options.cardHeight;
    this.onSelect = options.onSelect;

    this.syncCards();
  }

  destroy() {
    this.cards.forEach((card) => card.destroy());
    this.cards.clear();
    this.view.destroy({ children: true });
  }

  setValues(values: string[]) {
    this.values = values;
    this.syncCards();
  }

  setSelectedValue(value: string | null) {
    this.selectedValue = value;
    this.cards.forEach((card, current) => {
      card.setSelected(value === current);
    });
  }

  setInteractive(interactive: boolean) {
    this.interactive = interactive;
    this.cards.forEach((card) => card.setInteractive(interactive));
  }

  resize({
    width,
    columnsOverride,
    gapOverride,
  }: {
    width: number;
    columnsOverride?: number;
    gapOverride?: number;
  }) {
    const colCount = Math.max(1, columnsOverride ?? (width < 520 ? 4 : width < 760 ? 6 : 8));
    const gap = gapOverride ?? (width < 520 ? 10 : 12);

    this.values.forEach((value, index) => {
      const card = this.cards.get(value);
      if (!card) return;

      const col = index % colCount;
      const row = Math.floor(index / colCount);

      card.view.x = col * (this.cardWidth + gap);
      card.view.y = row * (this.cardHeight + gap);
    });

    const rows = Math.ceil(this.values.length / colCount);
    const contentWidth = Math.min(this.values.length, colCount) * this.cardWidth + (Math.min(this.values.length, colCount) - 1) * gap;
    const contentHeight = rows * this.cardHeight + Math.max(0, rows - 1) * gap;

    this.view.pivot.set(contentWidth / 2, contentHeight / 2);
  }

  private syncCards() {
    const active = new Set(this.values);

    for (const [value, card] of this.cards) {
      if (active.has(value)) continue;
      this.view.removeChild(card.view);
      card.destroy();
      this.cards.delete(value);
    }

    this.values.forEach((value) => {
      if (this.cards.has(value)) return;
      const card = new PokerCard({
        width: this.cardWidth,
        height: this.cardHeight,
        value,
        interactive: this.interactive,
        selected: this.selectedValue === value,
        onClick: () => this.onSelect(value),
      });
      this.cards.set(value, card);
      this.view.addChild(card.view);
    });

    this.setSelectedValue(this.selectedValue);
    this.setInteractive(this.interactive);
  }
}
