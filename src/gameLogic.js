const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function randomInt(max) {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return values[0] % max;
}

export function randomFloat() {
  return randomInt(1_000_000) / 1_000_000;
}

export function shuffledDeck() {
  const deck = suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

export function cardValue(card) {
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return Number(card.rank);
}

export function handValue(cards) {
  let total = cards.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = cards.filter((card) => card.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

export function draw(deck) {
  return { card: deck[0], deck: deck.slice(1) };
}

export function blackjackPayout(hand, dealerCards) {
  const player = handValue(hand.cards);
  const dealer = handValue(dealerCards);
  if (player > 21) return { result: "Bust", payout: 0 };
  if (dealer > 21 || player > dealer) {
    const blackjack = hand.cards.length === 2 && player === 21 && !hand.split;
    return { result: blackjack ? "Blackjack" : "Win", payout: Math.floor(hand.bet * (blackjack ? 2.5 : 2)) };
  }
  if (player === dealer) return { result: "Push", payout: hand.bet };
  return { result: "Lose", payout: 0 };
}

export function dealerTurn(deck, dealerCards) {
  let remaining = deck;
  let cards = dealerCards;
  while (handValue(cards) < 17) {
    const next = draw(remaining);
    cards = [...cards, next.card];
    remaining = next.deck;
  }
  return { deck: remaining, cards };
}

export function mineMultiplier(picks, mineCount) {
  let survival = 1;
  for (let pick = 0; pick < picks; pick += 1) survival *= (25 - mineCount - pick) / (25 - pick);
  return Math.max(1, Math.floor((0.99 / survival) * 100) / 100);
}

export const caseCatalog = [
  {
    id: "starter", name: "Starter Case", cost: 250, accent: "cyan",
    drops: [{ name: "Lucky Paw", value: 160, weight: 430 }, { name: "Moon Charm", value: 260, weight: 330 }, { name: "Ruby Collar", value: 600, weight: 190 }, { name: "Aurora Pet", value: 1800, weight: 50 }],
  },
  {
    id: "midnight", name: "Midnight Case", cost: 1000, accent: "violet",
    drops: [{ name: "Shadow Tag", value: 500, weight: 420 }, { name: "Nebula Treat", value: 1050, weight: 330 }, { name: "Comet Crown", value: 2400, weight: 190 }, { name: "Eclipse Dragon", value: 7500, weight: 60 }],
  },
  {
    id: "royal", name: "Royal Case", cost: 3500, accent: "gold",
    drops: [{ name: "Gold Biscuit", value: 1800, weight: 420 }, { name: "Titan Harness", value: 3700, weight: 320 }, { name: "Royal Throne", value: 8400, weight: 200 }, { name: "Celestial Fox", value: 28000, weight: 60 }],
  },
];

export function openCase(caseInfo) {
  const ticket = randomInt(caseInfo.drops.reduce((sum, item) => sum + item.weight, 0));
  let cursor = 0;
  return caseInfo.drops.find((item) => { cursor += item.weight; return ticket < cursor; }) || caseInfo.drops[0];
}
