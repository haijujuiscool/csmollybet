const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(numDecks = 6) {
    const deck = [];
    for (let d = 0; d < numDecks; d++) {
        for (const suit of suits) {
            for (const rank of ranks) {
                let value = parseInt(rank);
                if (['J', 'Q', 'K'].includes(rank)) value = 10;
                if (rank === 'A') value = 11;
                deck.push({ rank, suit, value });
            }
        }
    }
    return shuffle(deck);
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function calculateValue(hand) {
    let sum = 0;
    let aces = 0;
    for (const card of hand) {
        sum += card.value;
        if (card.rank === 'A') aces += 1;
    }
    while (sum > 21 && aces > 0) {
        sum -= 10;
        aces -= 1;
    }
    return sum;
}

function isBlackjack(hand) {
    return hand.length === 2 && calculateValue(hand) === 21;
}

module.exports = {
    createDeck,
    shuffle,
    calculateValue,
    isBlackjack
};
