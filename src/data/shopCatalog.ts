import { ShopCatalogItem, ShopItemType } from "@/types/game";

export const SHOP_CATALOG: Record<ShopItemType, ShopCatalogItem> = {
  double_roll: {
    type: "double_roll",
    label: "Double lance de des",
    cost: 10,
    description: "Lance 2 des et additionne le resultat.",
  },
  swap_position: {
    type: "swap_position",
    label: "Echanger ma place",
    cost: 20,
    description: "Echange ta position avec un autre joueur.",
  },
  plus_two_roll: {
    type: "plus_two_roll",
    label: "+2 au lancer",
    cost: 5,
    description: "Ajoute +2 au prochain lancer.",
  },
  go_to_star: {
    type: "go_to_star",
    label: "Aller sur l'etoile",
    cost: 30,
    description: "Te teleporte a l'etoile et ouvre l'achat Kudo.",
  },
  steal_points: {
    type: "steal_points",
    label: "Voler 5 points",
    cost: 5,
    description: "Vole jusqu'a 5 points a un joueur cible.",
  },
};

export const SHOP_ITEMS: ShopCatalogItem[] = Object.values(SHOP_CATALOG);
