/*
 wildcards (c) 2013 Daniel Wirtz <dcode@dcode.io>

 Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 2.0

 THE WORK (AS DEFINED BELOW) IS PROVIDED UNDER THE TERMS OF THIS CREATIVE
 COMMONS PUBLIC LICENSE ("CCPL" OR "LICENSE"). THE WORK IS PROTECTED BY
 COPYRIGHT AND/OR OTHER APPLICABLE LAW. ANY USE OF THE WORK OTHER THAN AS
 AUTHORIZED UNDER THIS LICENSE OR COPYRIGHT LAW IS PROHIBITED.

 BY EXERCISING ANY RIGHTS TO THE WORK PROVIDED HERE, YOU ACCEPT AND AGREE TO
 BE BOUND BY THE TERMS OF THIS LICENSE. THE LICENSOR GRANTS YOU THE RIGHTS
 CONTAINED HERE IN CONSIDERATION OF YOUR ACCEPTANCE OF SUCH TERMS AND
 CONDITIONS.

 http://creativecommons.org/licenses/by-nc-sa/2.0/
 */

// Game includes
var Player = require(__dirname+"/Player.js"),
    PlayerInGame = require(__dirname+"/PlayerInGame.js");

/**
 * Constructs a new Game.
 * @class Represents a Game.
 * @param {Server} server Server instance
 * @param {string} id Unique Game id
 * @param {string} lang Language to play
 * @param {Player} host Hosting Player
 * @constructor
 */
var Game = function(server, id, lang, host) {
    
    /**
     * Server instance.
     * @type {Server}
     */
    this.server = server;
    
    /**
     * Unique Game id.
     * @type {string}
     */
    this.id = id;
    
    /**
     * Language played as language key.
     * @type {string}
     */
    this.lang = lang;

    /**
     * Game host.
     * @type {Player}
     */
    this.host = host; // Player!

    /**
     * Cards database.
     * @type {Cards}
     */
    this.cards = null;
    
    /**
     * Participating or invited players.
     * @type {Array.<PlayerInGame>}
     */
    this.players = []; // PlayerInGame[]!

    /**
     * Whether this Game is private and can only be joined when the game id is known.
     * @type {boolean}
     */
    this.private = true;

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
     * Timeout counter. -1 if there is currently no timer.
     * @type {number}
     */
    this.timer = -1;
};

/** ID characters */
Game.ID_CHARS = "abzdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generates a Game id.
 * @return {string}
 */
Game.generateId = function() {
    var id = "";
    for (var i=0; i<16; i++) {
        var r; do { r = Math.random(); } while(r == 1.0);
        id += Game.ID_CHARS.charAt(parseInt(r*Game.ID_CHARS.length));
    }
    return id;
};

/**
 * Minimum number of players.
 * @type {number}
 */
Game.MIN_PLAYERS = 2; // 3 are better ofc, but let's not restrict that too much

/**
 * Maximum number of players.
 * @type {number}
 */
Game.MAX_PLAYERS = 9;

/**
 * Number of white cards per player.
 * @type {number}
 */
Game.NUM_CARDS = 10;

/**
 * Pick timeout in seconds.
 * @type {number}
 */
Game.PICK_TIMEOUT = 10;

/**
 * Select timeout in seconds.
 * @type {number}
 */
Game.SELECT_TIMEOUT = 30;

/**
 * Evaluate timeout in seconds.
 * @type {number}
 */
Game.EVALUATE_TIMEOUT = 30;

/**
 * Called once per second.
 */
Game.prototype.onTick = function() {
    if (this.timer > 0) this.timer--;
};

/**
 * Converts this Game to a JSON payload.
 * @param {boolean=} includePrivate Whether to include private fields or not
 * @return {{id: string, lang: string}}
 */
Game.prototype.toJSON = function(includePrivate) {
    return {
        "id": (!this.private || includePrivate) ? this.id : null,
        "lang": this.lang,
        "host": this.host.toJSON(),
        "private": this.private,
        "running": this.running,
        "players": this.getNumConnectedPlayers()
    };
};

/**
 * Converts this Game's state to a JSON payload.
 * @return {{running: boolean, playerInCharge: {id: string, name: string}, card: string|null, selections:Array.<Array.<string>>|null, timer: number}}
 */
Game.prototype.stateToJSON = function() {
    return {
        "running": this.running, // If the game is running or not
        "playerInCharge": this.playerInCharge, // Player currently in charge
        "card": this.card, // Black card currently played
        "selections": this.selections, // Selections of all players
        "timer": this.timer // Current timer
    };
};

/**
 * Initializes the Game.
 * @throws {Error} If anything goes wrong
 */
Game.prototype.init = function() {
    var cards = this.server.getCards(this.lang);
    if (!cards) {
        throw(new Error("There are no cards for language "+this.lang));
    }
    this.cards = cards;
    console.info("[Game "+this+"] Initialized with cards "+this.cards);
};

/**
 * Sends an event to all connected players.
 * @param {string} name Event name
 * @param {*} data Event data
 * @param {(Array.<PlayerInGame>|PlayerInGame)=} except To everyone else but except
 */
Game.prototype.send = function(name, data, except) {
    if (typeof except != 'undefined') {
        if (!(except instanceof Array)) {
            except = [except];
        }
    } else {
        except = null;
    }
    for (var i=0; i<this.players.length; i++) {
        var p = this.players[i];
        if (except === null || except.indexOf(p) < 0) p.send(name, data); // May not send if not connected
    }
};

/**
 * Adds invited (not yet connected) friends to the game.
 * @param {Array.<Object>} friends
 * @return {number} Number of actually added friends
 */
Game.prototype.addInvited = function(friends) {
    if (!friends || typeof friends != 'object' || !(friends instanceof Array) || friends.length == 0) return 0;
    var n=0;
    for (var i=0; i<friends.length; i++) {
        if (this.players.length >= Game.MAX_PLAYERS) break;
        var friend = friends[i];
        if (Player.isValidId(friend["id"]) && !this.hasPlayer(friend["id"]) && Player.isValidName(friend["name"])) {
            var p = new PlayerInGame(friend); // Not connected placeholder
            this.players.push(p);
            this.send("join", p.toJSON());
        }
    }
    return n;
};

/**
 * Tests if the given player id is already in.
 * @param {string|{id: string, name: string}|Player|PlayerInGame} id
 * @return {boolean}
 */
Game.prototype.hasPlayer = function(id) {
    if (id === null) return null;
    if (typeof id == 'object') id = id["id"];
    for (var i=0; i<this.players.length; i++) {
        if (this.players[i]["id"] == id) {
            return true;
        }
    }
    return false;
};

/**
 * Finds the index of the given player id.
 * @param {string|{id: string, name: string}|Player|PlayerInGame} id
 * @returns {number} -1 if not found
 */
Game.prototype.findPlayer = function(id) {
    if (id === null) return null;
    if (typeof id == 'object') id = id["id"];
    for (var i=0; i<this.players.length; i++) {
        if (this.players[i].id == id) {
            return i;
        }
    }
    return -1;
};

/**
 * Gets a player by its id.
 * @param {string|{id: string, name: string}|Player|PlayerInGame} id Player id
 * @return {PlayerInGame|null}
 */
Game.prototype.getPlayer = function(id) {
    if (id === null) return null;
    if (typeof id == 'object') id = id["id"];
    for (var i=0; i<this.players.length; i++) {
        if (this.players[i].id == id) {
            return this.players[i];
        }
    }
    return null;
};

/**
 * Adds a player to the game. Notifies all players including the new one about the join.
 * @param {Player} player Player added
 * @param {boolean=} create true if creating a new game
 * @return {boolean} true if successfully added, false if not a valid player or already in
 */
Game.prototype.addPlayer = function(player, create) {
    if (player === null) return false;
    var p = this.getPlayer(player);
    if (p === null && this.players.length >= Game.MAX_PLAYERS) return false; // Game is full
    if (create && !player.isConnected()) return false; // What for?
    
    if (player.isConnected()) { // Not just a placeholder
        // Acknowledge the join
        if (create) {
            player.socket.emit("created", this.toJSON(true));
        } else {
            player.socket.emit("joined", this.toJSON(true));
        }
        // Send a list of players before the join
        for (var i=0; i<this.players.length; i++) {
            player.socket.emit("join", this.players[i].toJSON());
        }
    }
    
    // Check if the player is already known or entirely new
    if (p !== null) {
        // If already known, set to connected and update
        p.player = player;
        this.send("update", p.toJSON());
        // Then send a full update in case of a reconnect
        var cards = [];
        for (i=0; i<p.whites.length; i++) {
            cards.push(p.whites[i]);
        }
        if (player.isConnected()) {
            player.socket.emit("cards", {
                "clear": true,
                "add": cards
            });
            player.socket.emit("state", this.stateToJSON());
        }
        console.info("[Game "+this+"] Added already known player "+p);
    } else {
        // If an entirely new player, add and notify
        p = new PlayerInGame(player);
        this.players.push(p);
        this.send("join", p.toJSON()); // Notifies everyone including self about the join
        if (player.isConnected()) {
            player.socket.emit("state", this.stateToJSON());
        }
        console.info("[Game "+this+"] Added new player "+p);
    }
    return true;
};

/**
 * Removes a player from the game.
 * @param {PlayerInGame} player
 * @return {boolean} true if removed, false if not found
 */
Game.prototype.removePlayer = function(player) {
    player = this.getPlayer(player); // Ensure PlayerInGame
    if (player === null) return false;
    player.player = null; // Mark as disconnected
    if (player == this.playerInCharge) {
        console.info("[Game "+this+"] Set player "+player+" to disconnected");
        return true;
    }
    var i = this.players.indexOf(player);
    if (i < 0) { // Should not happen
        console.error("[Game "+this+"] Failed to remove player "+player+": In game but not in players list?");
        return false;
    }
    this.send("left", player.toJSON());
    this.players.splice(i, 1);
    console.info("[Game "+this+"] Removed player "+player);
    var nConnected = this.getNumConnectedPlayers();
    if (nConnected == 0) {
        this.server.removeGame(this);
    }
    return true;
};

/**
 * Updates a player, i.e. when now connected.
 * @param {PlayerInGame} player
 * @param {PlayerInGame=} except
 * @return {boolean} true if updated, false if not found
 */
Game.prototype.updatePlayer = function(player, except) {
    player = this.getPlayer(player); // Ensure PlayerInGame
    if (player === null) return false;
    this.send("update", player.toJSON(), except);
    return true;
};

/**
 * Gets the number of connected players.
 * @return {number}
 */
Game.prototype.getNumConnectedPlayers = function() {
    var n = 0;
    for (var i=0; i<this.players.length; i++) {
        if (this.players[i].isConnected()) n++;
    }
    return n;
};

/**
 * Toggles privacy.
 */
Game.prototype.togglePrivate = function() {
    this.private = !this.private;
    this.send("gameupdate", this.toJSON(true));
};

/**
 * Sends a chat message.
 * @param {Player} player
 * @param {string} message
 */
Game.prototype.chat = function(player, message) {
    player = this.getPlayer(player); // Ensure PlayerInGame
    if (player !== null) {
        this.send("chat", {
            "player": player.toJSON(),
            "message": message
        });
    }
};

/**
 * Handles a disconnected Player.
 * @param {Player} player
 * @return {boolean} true if successfully removed, false if not found
 */
Game.prototype.onDisconnect = function(player) {
    player = this.getPlayer(player); // Ensure PlayerInGame
    if (player == null) return false;
    player.player = null; // Set to not connected
    var nConnected = this.getNumConnectedPlayers();
    if (nConnected == 0) {
        this.server.removeGame(this);
        return true;
    }
    if (player["id"] == this.host["id"]) { // Select a new host
        for (var i=0; i<this.players.length; i++) {
            var p = this.players[i];
            if (p.isConnected()) {
                this.host = p.player;
                break;
            }
        }
        console.log("[Game "+this+"] New host: "+this.host);
        this.send("newhost", this.host.toJSON());
    }
    console.info("[Game "+this+"] Set player "+player+" to disconnected");
    if (nConnected < Game.MIN_PLAYERS) {
        console.info("[Game "+this+"] Not enough connected players left: Stopping...");
        this.stop();
    }
    return true;
};

//
// Game State Management
//

/**
 * Starts the game.
 * @return {boolean} true if started, else false
 * @throws {Error} If the language is no longer available
 */
Game.prototype.start = function() {
    if (this.running || this.players.length < Game.MIN_PLAYERS) return false;
    if (this.cards === null || this.cards.black.length == 0 || this.cards.white.length == 0) {
        this.init(); // Reinitialize, throws
        for (var i=0; i<this.players.length; i++) {
            this.players[i].whites = [];
            this.players[i].send("cards", {
                "clear": true // Reset all remaining cards
            });
        }
    }
    console.info("[Game "+this+"] Started");
    // Reset everything
    this.running = true;
    this.playerInCharge = null;
    this.card = null;
    this.timer = -1;
    this.send("state", this.stateToJSON());
    this.nextRound();
    return true;
};

/**
 * Gets the next player relative to the given player.
 * @param {PlayerInGame} player
 * @return {PlayerInGame}
 */
Game.prototype.getNextPlayer = function(player) {
    var i, p;
    player = this.getPlayer(player); // Ensure PlayerInGame
    if (player == null) {
        // Find the first connected player
        for (i=0; i<this.players.length; i++) {
            p = this.players[i];
            if (p.isConnected()) {
                return p;
            }
        }
        // Should not happen, game is destroyed before
        console.warn("[Game "+this+"] Cannot find next player: There are no connected players - ERROR");
        return null;
    } else {
        i = this.findPlayer(player);
        if (i < 0) return this.getNextPlayer(null); // No more in? Find the first connected. We must make sure that the
                                                    // currently picking player is not kicked.
        for (;i<this.players.length; i++) {
            p = this.players[i];
            if (p.isConnected() && p != player) {
                return p;
            }
        }
        return this.getNextPlayer(null); // No more connected behind, so pick again from the start.
    }
};

/**
 * Starts the next round.
 */
Game.prototype.nextRound = function() {
    if (!this.running) return;
    this.timer = Game.PICK_TIMEOUT;
    this.playerInCharge = this.getNextPlayer(this.playerInCharge);
    if (this.playerInCharge == null || !this.playerInCharge.isConnected()) {
        // Should not happen
        console.warn("[Game "+this+"] Failed to start next round: Failed to pick next player - ERROR");
        this.stop();
        return;
    }
    this.send("state", this.stateToJSON());
    this.card = null; // ^ show this till something new is picked
    this.selections = null;
    this.playerInCharge.send("nudge", "pick");
    console.info("[Game "+this+"] Starting next round: playerInCharge="+this.playerInCharge);
    // Fill up cards
    var total = 0;
    for (var i=0; i<this.players.length; i++) {
        var p = this.players[i];
        if (p.isConnected() && p.whites.length < Game.NUM_CARDS) {
            var newCards = [];
            while (p.whites.length < Game.NUM_CARDS) {
                var c = this.cards.pickWhite();
                if (c !== null) {
                    newCards.push(c);
                    p.whites.push(c);
                    total++;
                } else {
                    break; // Out of white
                }
            }
            if (newCards.length > 0) {
                p.send("cards", {
                    "del": [],
                    "add": newCards
                });
            }
        }
    }
    if (total > 0) console.info("[Game "+this+"] Filled up "+total+" cards");
    var to = null;
    var doPick = function(afterTimeout) {
        if (to) { clearTimeout(to); to = null; }
        if (this.playerInCharge.isConnected()) {
            this.playerInCharge.player.socket.removeAllListeners("pick");
        }
        this.card = this.cards.pickBlack();
        if (this.card === null) {
            console.info("[Game "+this+"] No more black cards. Stopping... ");
            this.stop("outofblack");
            return;
        }
        console.info("[Game "+this+"] Picked black: "+this.card+(afterTimeout ? " after timeout" : ""));
        this.playRound();
    };
    if (this.playerInCharge.isConnected()) {
        to = setTimeout(doPick.bind(this, true), Game.PICK_TIMEOUT*1000);
        this.playerInCharge.player.socket.once("pick", doPick.bind(this, false));
    } else {
        (doPick.bind(this))(true);
    }
};

/**
 * Plays the current round.
 */
Game.prototype.playRound = function() {
    if (!this.running) return;
    if (this.playerInCharge === null || this.card === null) {
        console.warn("[Game "+this+"] Failed to play round: No player or card - ERROR");
        this.stop("noplayerorcard");
        return;
    }
    console.info("[Game "+this+"] Playing round with card: "+this.card);
    // this.card has already been set
    this.selections = null;
    this.timer = Game.SELECT_TIMEOUT;
    this.send("state", this.stateToJSON());
    
    /** @type {Array.<PlayerInGame>} */
    var selecting = [];
    /** @type {Array.<{player: PlayerInGame, cards: Array.<string>}>} */
    var selections = [];
    
    for (var i=0; i<this.players.length; i++) {
        var p = this.players[i];
        if (p.isConnected() && p != this.playerInCharge) {
            (function(player) {
                selecting.push(player); // This player is selecting
                player.send("nudge", "select");
                var to = null;
                
                var doSelect = function(afterTimeout, which) { // Perform selection
                    if (player.isConnected()) {
                        player.player.socket.removeAllListeners("select");
                    }
                    var playerIndex = selecting.indexOf(player);
                    if (to) { clearTimeout(to); to = null; }
                    if (playerIndex < 0) return; // (Still) selecting in this round?
                    if (this.card === null) {
                        console.error("[Game "+this+"] Player "+player+" selected but there is no black card - ERROR");
                        return;
                    }
                    
                    var cards = []; // Selected cards
                    var count = (this.card.match(/[_]+/g)).length; // Number of required cards
                    
                    // Find the card indexes
                    if (which && typeof which == 'object' && which instanceof Array && which.length == count) {
                        var card;
                        for (var i=0; i<which.length; i++) {
                            card = which[i];
                            var ic = player.whites.indexOf(card); // Owns the card?
                            if (ic >= 0) {
                                cards.push(player.whites[ic]);
                                player.whites.splice(ic, 1);
                            }
                        }
                    }

                    // If at least one card is invalid or missing after the timeout, select these randomly
                    while (cards.length < count) {
                        var r; do { r = Math.random(); } while (r == 1.0);
                        var ic = parseInt(r*player.whites.length);
                        cards.push(player.whites[ic]);
                        player.whites.splice(ic, 1);
                    }
                    
                    // Fill up with new cards (let players already read them while waiting)
                    var newCards = [];
                    while (player.whites.length < Game.NUM_CARDS) {
                        var c = this.cards.pickWhite();
                        if (c !== null) {
                            newCards.push(c);
                            player.whites.push(c);
                        } else {
                            break; // TODO: Out of whites
                        }
                    }
                    console.info("[Game "+this+"] Player "+player+" plays: "+cards+(afterTimeout ? " after timeout" : ""));
                    
                    // Notify the player to remove the selected and to add the new cards
                    player.send("cards", {
                        "del": cards,
                        "add": newCards
                    });
                    
                    // Process the selection
                    selecting.splice(playerIndex, 1); // This player is done
                    selections.push({
                        "player": player,
                        "cards": cards
                    });
                    if (selecting.length == 0) {
                        this.evaluateRound(selections);
                    }
                };
                
                if (player.isConnected()) {
                    to = setTimeout(doSelect.bind(this, true), Game.SELECT_TIMEOUT*1000+3000 /* tolerate last minute decisions :-) */);
                    player.player.socket.once("select", doSelect.bind(this, false));
                } else {
                    (doSelect.bind(this))(true);
                }
                
            }.bind(this))(p);
        }
    }
};

/**
 * Shuffles an Array.
 * @return {Array} this
 */
Array.prototype.shuffle = function () {
    for (var i = this.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = this[i];
        this[i] = this[j];
        this[j] = tmp;
    }
    return this;
};

/**
 * Evaluates the current round.
 * @param {Array.<{player: PlayerInGame, cards: Array.<string>}>} selections
 */
Game.prototype.evaluateRound = function(selections) {
    if (this.playerInCharge === null) {
        // Should not happen
        console.error("[Game "+this+"] Failed to evaluate round: No playerInCharge");
        this.stop("noplayerincharge");
        return;
    }
    selections.shuffle(); // Shuffle selections
    this.selections = []; // Anonymize selections
    for (var i=0; i<selections.length; i++) {
        this.selections[i] = selections[i]["cards"];
    }
    console.info("[Game "+this+"] Evaluating round: playerInCharge="+this.playerInCharge+", "+this.selections.length+" selections");
    this.send("state", this.stateToJSON()); // Display selections
    this.playerInCharge.send("nudge", "evaluate");
    var to = null;
    var doEval = function(afterTimeout, winnerIndex) {
        if (this.playerInCharge.isConnected()) {
            this.playerInCharge.player.socket.removeAllListeners("winner");
        }
        if (to) { clearTimeout(to); to = null; }
        if (typeof winnerIndex == 'undefined' || winnerIndex < 0 || winnerIndex >= selections.length) {
            // Not a valid index, select one randomly
            var r; do { r = Math.random(); } while (r == 1.0);
            winnerIndex = parseInt(r*selections.length);
            console.info("[Game "+this+"] PlayerInCharge "+this.playerInCharge+" did not select a proper winner: Selected #"+winnerIndex+" instead");
        }
        var winner = selections[winnerIndex];
        winner["index"] = winnerIndex;
        console.info("[Game "+this+"] PlayerInCharge "+this.playerInCharge+" selected "+winner.player+" as the winner"+(afterTimeout ? " after timeout" : ""));
        this.send("winner", winner); // Contains player, cards and index
        winner.player.score++;
        this.updatePlayer(winner.player);
        setTimeout(this.nextRound.bind(this), 3000); // Show for at least 3 sec
    };
    to = setTimeout(doEval.bind(this, true), Game.EVALUATE_TIMEOUT*1000+3000 /* tolerate last minute decisions :-) */);
    if (this.playerInCharge.isConnected()) {
        this.playerInCharge.player.socket.once("winner", doEval.bind(this, false));
    }
};

/**
 * Stops the game.
 * @param {string=} reason
 */
Game.prototype.stop = function(reason) {
    if (!this.running) return;
    this.running = false;
    this.send("stopped", typeof reason != 'undefined' ? reason : null);
};

Game.prototype.toString = function() {
    return this.id;
};

module.exports = Game;
