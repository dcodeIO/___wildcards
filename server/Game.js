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
     * Language played.
     * @type {string}
     */
    this.lang = lang;
    
    /**
     * Hosting Player.
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
    this.players = []; // PlayerInGame!
    
    /**
     * Player currently playing the black card.
     * @type {PlayerInGame}
     */
    this.playerInCharge = null; // PlayerInGame!
    
    /**
     * Current black card.
     * @type {string}
     */
    this.card = null;
    
    /**
     * Whether currently running (started) or not (stopped).
     * @type {boolean}
     */
    this.running = false;
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
Game.NUM_CARDS = 8; // Usually 10, but there's only place enough for 8

/**
 * Pick timeout in seconds.
 * @type {number}
 */
Game.PICK_TIMEOUT = 30*1000;

/**
 * Select timeout in seconds.
 * @type {number}
 */
Game.SELECT_TIMEOUT = 60*1000;

/**
 * Evaluate timeout in seconds.
 * @type {number}
 */
Game.EVALUATE_TIMEOUT = 60*1000;

/**
 * Converts this Game to a JSON payload.
 * @return {{id: string, lang: string, host: {id: string, name: string}, minplayers: number, maxplayers: number}}
 */
Game.prototype.toJSON = function() {
    return {
        "id": this.id,
        "lang": this.lang,
        "host": this.host.toJSON(),
        "minplayers": Game.MIN_PLAYERS,
        "maxplayers": Game.MAX_PLAYERS
    };
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
 * Initializes the Game.
 * @throws {Error} If anything goes wrong
 */
Game.prototype.init = function() {
    var cards = this.server.getCards(this.lang);
    if (!cards) {
        throw(new Error("[Game] No cards for language "+this.lang));
    }
    this.cards = cards;
    console.info("[Game "+this+"] Initialized with cards "+this.cards);
};

/**
 * Sends an event to all connected players.
 * @param {string} name Event name
 * @param {*} data Event data
 * @param {PlayerInGame=} except To everyone else but except
 */
Game.prototype.send = function(name, data, except) {
    for (var i=0; i<this.players.length; i++) {
        var p = this.players[i];
        if (p != except) p.send(name, data); // May not send if not connected
    }
};

/**
 * Sends an event to a PlayerInGame.
 * @param {PlayerInGame} player
 * @param {string} name Event name
 * @param {*} data Event data
 * @return {boolean} true if sent, false if not connected
 */
Game.prototype.sendTo = function(player, name, data) {
    return player.send(name, data);
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
    
    // Acknowledge the join
    if (create) {
        player.socket.emit("created", this.toJSON());
    } else {
        player.socket.emit("joined", this.toJSON());
    }
    
    // Send a list of players before the join
    for (var i=0; i<this.players.length; i++) {
        player.socket.emit("join", this.players[i].toJSON());
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
        player.socket.emit("cards", {
            "clear": true,
            "add": cards,
            "running": this.running,
            "black": this.card,
            "playerInCharge": (this.playerInCharge !== null) ? this.playerInCharge.toJSON() : null
        });
        console.info("[Game "+this+"] Added already known player "+p);
    } else {
        // If an entirely new player, add and notify
        p = new PlayerInGame(player);
        this.players.push(p);
        this.send("join", p.toJSON()); // Notifies everyone including self about the join
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
    if (player == this.playerInCharge) return false; // Cannot kick playerInCharge
    var i = this.players.indexOf(player);
    if (i < 0) return false;
    this.send("left", player.toJSON());
    this.players.splice(i, 1);
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
 * Sends a chat message.
 * @param {Player} player
 * @param {string} message
 */
Game.prototype.chat = function(player, message) {
    player = this.getPlayer(player); // Ensure PlayerInGame
    if (player !== null) {
        this.send("chat", {
            player: player.toJSON(),
            message: message
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
    if (!player.isConnected()) return true;
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

/**
 * Starts the game.
 * @throws {Error} If the language is no longer available
 */
Game.prototype.start = function() {
    if (this.running || this.players.length < Game.MIN_PLAYERS) return;
    if (this.cards === null || this.cards.black.length == 0 || this.cards.white.length == 0) {
        this.init(); // Reinitialize
    }
    console.info("[Game "+this+"] Started");
    this.running = true;
    this.send("started", {});
    this.nextRound();
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
        this.stop();
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
    this.playerInCharge = this.getNextPlayer(this.playerInCharge);
    if (this.playerInCharge == null || !this.playerInCharge.isConnected()) {
        // Should not happen
        console.warn("[Game "+this+"] Failed to start next round: Failed to pick next player - ERROR");
        this.stop();
        return;
    }
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
    this.send("pick", {
        "player": this.playerInCharge.toJSON(),
        "timeout": Game.PICK_TIMEOUT
    });
    var to = null;
    var doPick = function(afterTimeout) {
        if (to) { clearTimeout(to); to = null; }
        if (this.playerInCharge.isConnected()) {
            this.playerInCharge.player.socket.removeAllListeners("pick");
        }
        this.card = this.cards.pickBlack();
        if (this.card === null) {
            console.info("[Game "+this+"] No more black cards. Stopping... ");
            this.send("outofblack", {});
            this.stop();
            return;
        }
        console.info("[Game "+this+"] Picked black: "+this.card+(afterTimeout ? " after timeout" : ""));
        this.playRound();
    };
    if (this.playerInCharge.isConnected()) {
        to = setTimeout(doPick.bind(this, true), Game.PICK_TIMEOUT);
        this.playerInCharge.player.socket.on("pick", doPick.bind(this, false));
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
        this.stop();
        return;
    }
    console.info("[Game "+this+"] Playing round with card: "+this.card);
    this.send("select", {
        "player": this.playerInCharge.toJSON(),
        "card": this.card,
        "timeout": Game.SELECT_TIMEOUT
    });
    /** @type {Array.<PlayerInGame>} */
    var selecting = [];
    /** @type {Array.<{player: PlayerInGame, cards: Array.<string>}>} */
    var selections = [];
    
    for (var i=0; i<this.players.length; i++) {
        var p = this.players[i];
        if (p.isConnected() && p != this.playerInCharge) {
            (function(player) {
                selecting.push(player); // This player is selecting
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
                    to = setTimeout(doSelect.bind(this, true), Game.SELECT_TIMEOUT+3000 /* tolerate last minute decisions :-) */);
                    player.player.socket.on("select", doSelect.bind(this, false));
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
        this.stop();
        return;
    }
    selections.shuffle(); // Shuffle selections
    var sel = []; // Anonymize selections
    for (var i=0; i<selections.length; i++) {
        sel[i] = selections[i]["cards"];
    }
    console.info("[Game "+this+"] Evaluating round: playerInCharge="+this.playerInCharge+", "+sel.length+" selections");
    this.send("selected", sel);
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
        this.card = null;
        setTimeout(this.nextRound.bind(this), 3000); // Show for at least 3 sec
    };
    to = setTimeout(doEval.bind(this, true), Game.EVALUATE_TIMEOUT+3000 /* tolerate last minute decisions :-) */);
    if (this.playerInCharge.isConnected()) {
        this.playerInCharge.player.socket.on("winner", doEval.bind(this, false));
    }
};

/**
 * Stops the game.
 */
Game.prototype.stop = function() {
    if (!this.running) return;
    this.running = false;
    this.send("stopped", {});
};

Game.prototype.toString = function() {
    return this.id;
};

module.exports = Game;
