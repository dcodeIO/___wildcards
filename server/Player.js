/*
 wildcardsgame (c) 2013 Daniel Wirtz <dcode@dcode.io>

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
 * @param {Server} server
 * @param {Object} socket
 * @param {Object} data
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
    
    if (this.isConnected()) {
        // Handle joining a room
        this.socket.on("join", this.joinGame.bind(this));
        // Handle creating a room
        this.socket.on("create", this.createGame.bind(this));
        // Emit loggedin
        this.socket.emit("loggedin", this.toJSON());
    }
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
 * Joins a game.
 * @param {string} gameId
 */
Player.prototype.joinGame = function(gameId) {
    if (!this.isConnected()) return;
    if (typeof gameId == 'string') {
        var game = this.server.getGame(gameId);
        if (game !== null) {
            if (game.addInvitedPlayer(this)) {
                this.game = game;
                this.socket.emit("joined", this.game.toJSON());
                var p;
                for (var i=0; i<this.game.players.length; i++) {
                    p = this.game.players[i];
                    this.socket.emit("join", p.toJSON());
                }
                // Update cards if reconnected
                p = this.game.getPlayer(this);
                var cards = [];
                for (i=0; i<p.whites.length; i++) {
                    cards.push(p.whites[i]);
                }
                this.socket.emit("cards", {
                    "clear": true,
                    "add": cards,
                    "running": this.game.running,
                    "black": this.game.card,
                    "playerInCharge": (this.game.playerInCharge) ? this.game.playerInCharge.toJSON() : null
                });
                this.game.updatePlayer(this, /* except to */ this);
                this.socket.on("chat", this.chat.bind(this));
            } else {
                this.socket.emit("joined", "notinvited");
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
    if (!this.isConnected()) return;
    if (!data || !data.lang || typeof data.lang != 'string') {
        console.log("[Player] Player "+this+" failed to create a game: Invalid arguments");
        return;
    }
    this.game = this.server.createGame(data.lang, this); // Prints info, sets host
    try {
        this.game.init(); // Throws if lang is invalid etc.
        this.socket.emit("created", this.game.toJSON());
        this.game.addPlayer(this); // Emits a join
        
        // Allow the host to invite friends
        this.socket.on("invite", function(friends) {
            if (!this.game) return;
            var n = this.game.addInvited(friends);
            console.log("[Game "+this.game+"] Player "+this+" invited "+n+" more friends");
        }.bind(this));

        // Allow the host to chat
        this.socket.on("chat", this.chat.bind(this));
        
        // Allow kicking
        this.socket.on("kick", function(id) {
            if (id == this.id) return;
            var player = this.game.getPlayer(id);
            if (player != null) {
                if (this.game.removePlayer(player)) {
                    console.log("[Game "+this.game+"] Host "+this+" kicked player "+player);
                } else {
                    console.warn("[Game "+this.game+"] Host "+this+" failed to kick player "+player);
                }
            } else {
                console.warn("[Game "+this.game+"] Host "+this+" failed to kick player "+player);
            }
        }.bind(this));
        
        // Allow game start
        this.socket.on("start", function() {
            if (this.game != null && this.game.host["id"] == this.id) {
                this.game.start(); // Will do nothing if already running
            }
        }.bind(this));
        
        // Allow game stop
        this.socket.on("stop", function() {
            if (this.game != null && this.game.host["id"] == this.id) {
                this.game.stop(); // Will do nothing if not running
            }
        }.bind(this));
        
        // Other game events are added dynamically
        
        this.socket.removeAllListeners("create"); // Only once
    } catch (e) {
        console.warn("[Player "+this+"] Failed to initialize game "+this.game+": "+e);
        this.server.removeGame(this.game);
        this.game = null;
        return;
    }
};

/**
 * Sends a chat message.
 * @param {string} message
 */
Player.prototype.chat = function(message) {
    if (!this.isConnected()) return;
    if (typeof message != 'string' || message.length == 0) return;
    if (this.game) {
        this.game.chat(this, message);
    }
};

/**
 * Tests if the Player is still connected.
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
    if (!caught) this.socket.disconnect();
    this.socket = null;
    this.server.onDisconnect(this);
};

Player.prototype.toString = function() {
    return this.id+"/"+this.name+"/connected="+!!this.socket;
};

/**
 * Tests if a player id is valid.
 * @param {string} id
 * @returns {boolean}
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
