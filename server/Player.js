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

/**
 * Constructs a new Player.
 * @class Represents a Player connected to the Server.
 * @param {Server} server Server instance
 * @param {Object} socket Socket
 * @param {Object} data Player data payload
 * @constructor
 * @throws {Error} If anything goes wrong
 */
var Player = function(server, socket, data) {
    if (!Player.isValidId(data["id"]) || !Player.isValidName(data["name"])) {
        throw(new Error("Invalid or missing id or name"));
    }
    /** @type {Server} */
    this.server = server;
    /** @type {Object} */
    this.socket = socket;
    
    /** @type {Object} */
    this.data = data;
    /** @type {string} */
    this.id = data["id"];
    /** @type {string} */
    this.name = data["first_name"] ? data["first_name"] : data["name"];
    /** @type {number} */
    this.blacks = 0;
    
    /** @type {Game} */
    this.game = null;
    
    console.info("[Player] Created player: "+this);

    // Attach all listeners
    this.setGame(null, true);
    
    // Finally emit loggedin
    this.socket.emit("loggedin", this.toJSON());
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Connection

/**
 * Tests if the Player is (still) connected.
 * @returns {boolean}
 */
Player.prototype.isConnected = function() {
    return this.socket !== null;
};

/**
 * Disconnects the Player.
 * @param {boolean=} caught If caught or explicit
 */
Player.prototype.disconnect = function(caught) {
    if (this.socket === null) return; // Only once
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.server.onDisconnect(this);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Game

/**
 * Sets the current game and attaches or removes all the game specific listeners.
 * @param {Game} game
 * @param {boolean=} force
 */
Player.prototype.setGame = function(game, force) {
    if (game == this.game && !force) return;
    if (this.socket == null) return;
    this.game = game;
    if (this.game != null) {
        // +Game
        this.socket.on("invite", this.invite.bind(this));
        this.socket.on("chat", this.chat.bind(this));
        this.socket.on("kick", this.kick.bind(this));
        this.socket.on("start", this.startGame.bind(this));
        this.socket.on("private", this.togglePrivate.bind(this));
        this.socket.on("stop", this.stopGame.bind(this));
        this.socket.on("leave", this.leaveGame.bind(this));
        // -Lobby
        this.socket.removeAllListeners("join");
        this.socket.removeAllListeners("create");
        this.socket.removeAllListeners("list");
    } else {
        // -Game
        this.socket.removeAllListeners("invite");
        this.socket.removeAllListeners("chat");
        this.socket.removeAllListeners("kick");
        this.socket.removeAllListeners("start");
        this.socket.removeAllListeners("private");
        this.socket.removeAllListeners("stop");
        // +Lobby
        this.socket.on("join", this.joinGame.bind(this));
        this.socket.on("create", this.createGame.bind(this));
        this.socket.on("list", this.listGames.bind(this));
    }
};

/**
 * Joins a game.
 * @param {string} gameId
 */
Player.prototype.joinGame = function(gameId) {
    if (!this.isConnected() || this.game !== null) return;
    if (typeof gameId == 'string') {
        var game = this.server.getGame(gameId);
        if (game !== null) {
            if (game.addPlayer(this)) { // Fails only if the game is full
                this.setGame(game);
            } else {
                this.socket.emit("joined", "full");
            }
        } else {
            this.socket.emit("joined", "notfound");
        }
    } else{
        this.socket.emit("joined", "invalid");
    }
};

/**
 * Creates a game.
 * @param {{lang: string}} data Selected language
 */
Player.prototype.createGame = function(data) {
    if (!this.isConnected() || this.game !== null) return;
    if (!data || !data["lang"] || typeof data["lang"] != 'string' || !this.server.isValidLanguage(data["lang"])) {
        console.warn("[Player] Player "+this+" failed to create a game: Invalid arguments");
        return;
    }
    var game = this.server.createGame(data.lang, this); // Prints info, sets host
    try {
        game.init(); // Throws if lang is invalid
        game.addPlayer(this, true); // Emits "created" + state
        this.setGame(game); // Adds all listeners
    } catch (e) {
        // Shouldn't happen
        console.error("[Player "+this+"] Failed to initialize game "+this.game+": "+e);
        this.server.removeGame(this.game);
        this.setGame(null);
    }
};

/**
 * Sends a list of public games.
 */
Player.prototype.listGames = function() {
    if (!this.isConnected() || this.game !== null) return;
    var games = [];
    for (var i in this.server.games) {
        if (this.server.games.hasOwnProperty(i)) {
            var game = this.server.games[i];
            if (!game.private) {
                games.push(game.toJSON());
            }
        }
    }
    this.socket.emit("games", games);
};

Player.prototype.togglePrivate = function() {
    if (!this.isConnected() || this.game === null) return;
    if (this.game.host.id != this.id) {
        console.warn("[Game "+this.game+"] "+this+" failed to toggle privacy: Not the host");
        return;
    }
    this.game.togglePrivate();
};

/**
 * Starts the current game.
 */
Player.prototype.startGame = function() {
    if (this.game === null) return false;
    if (this.game.host.id != this.id) {
        console.warn("[Game "+this.game+"] "+this+" failed to start the current game: Not the host");
        return;
    }
    try {
        this.game.start(); // Throws on re-init if lang is invalid
    } catch (e) {
        // Shouldn't happen
        console.error("[Game "+this.game+"] "+this+" failed to start the current game: "+e);
    }
};

/**
 * Stops the current game.
 */
Player.prototype.stopGame = function() {
    if (this.game === null) return;
    if (this.game.host.id != this.id) {
        console.warn("[Game "+this.game+"] "+this+" failed to stop the current game: Not the host");
        return;
    }
    this.game.stop();
};

/**
 * Leaves the current game.
 */
Player.prototype.leaveGame = function() {
    if (this.game === null) return;
    console.info("[Game "+this.game+"] "+this+" leaving...");
    this.game.removePlayer(this);
    if (this.isConnected()) {
        this.socket.emit("meleft");
    }
    this.setGame(null); // Removes all listeners
};

/**
 * Invites more friends.
 */
Player.prototype.invite = function(friends) {
    if (this.game === null) return;
    if (typeof friends != 'object' || !(friends instanceof Array) || friends.length == 0) return;
    var n = this.game.addInvited(friends);
    console.log("[Game "+this.game+"] Player "+this+" invited "+n+" more friends");
};

/**
 * Sends a chat message.
 * @param {string} message
 */
Player.prototype.chat = function(message) {
    if (!this.isConnected() || this.game === null) return;
    if (typeof message != 'string' || message.length == 0) return;
    this.game.chat(this, message);
};

/**
 * Kicks a player.
 * @param {string} id
 * @return {boolean} true on success, else false
 */
Player.prototype.kick = function(id) {
    if (this.game === null || !Player.isValidId(id)) return false;
    var player = this.game.getPlayer(id);
    if (player == null) {
        console.warn("[Game "+this.game+"] Player "+this+" failed to kick player #"+id+": Not found");
        return false;
    }
    if (player["id"] == this.id || this.game.host.id != this.id) {
        console.warn("[Game "+this.game+"] Player "+this+" failed to kick "+player+": Not allowed");
        return false;
    }
    if (!this.game.removePlayer(player)) {
        console.warn("[Game "+this.game+"] Host "+this+" failed to kick player "+player);
        return false;
    }
    console.log("[Game "+this.game+"] Host "+this+" kicked player "+player);
    return true;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Utility

/**
 * Returns a string representation of this instance.
 * @return {string}
 */
Player.prototype.toString = function() {
    return this.id+"/"+this.name+"/connected="+!!this.socket;
};

/**
 * Converts this Player to a JSON payload.
 * @return {{id: string, name: string, connected: boolean}}
 */
Player.prototype.toJSON = function() {
    return {
        "id": this.id,
        "name": this.name,
        "connected": this.isConnected()
    };
};

/**
 * Tests if a player id is valid.
 * @param {string} id
 * @return {boolean}
 */
Player.isValidId = function(id) {
    return typeof id == 'string' && /\-?\d+/.test(id);
};

/**
 * Tests if a player name is valid.
 * @param {string} name
 * @return {boolean}
 */
Player.isValidName = function(name) {
    return typeof name == 'string';
};

module.exports = Player;
