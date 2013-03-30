/**
 * Constructs a new GameState.
 * @constructor
 */
var GameState = function() {
    
    // Usually:
    // !running: Game is paused, else:
    // card=null: PlayerInCharge must pick, else:
    // selections=null: Everyone has to make a selection, else:
    // winner=null: PlayerInCharge has to pick a winner, else:
    // display winner

    /**
     * Wherther the game is running or not.
     * @type {boolean}
     */
    this.running = false;
    
    /**
     * Player currently in charge.
     * @type {PlayerInGame}
     */
    this.playerInCharge = null; // PlayerInGame!
    
    /**
     * Currently played black card.
     * @type {string|null}
     */
    this.card = null;

    /**
     * Currently showing cards selected by all players.
     * @type {Array.<Array<string>>}
     */
    this.selections = null;

    /**
     * Currently showing winner.
     * @type {PlayerInGame}
     */
    this.winner = null; // PlayerInGame!

    /**
     * Timeout counter.
     * @type {number|null}
     */
    this.timeout = null;
};

/**
 * Resets the GameState.
 */
GameState.prototype.reset = function() {
    this.running = false;
    this.playerInCharge = null;
    this.card = null;
    this.selections = null;
    this.winner = null;
    this.timeout = null;
};

/**
 * Converts this state into its JSON payload.
 */
GameState.prototype.toJSON = function() {
    return {
        "running": this.running,
        "playerInCharge": this.playerInCharge ? this.playerInCharge.toJSON() : null,
        "card": this.card,
        "selections": this.selections,
        "winner": this.winner ? this.winner.toJSON() : null,
        "timeout": this.timeout
    };
};

module.exports = GameState;
