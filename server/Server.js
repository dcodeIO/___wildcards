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
 * @license wildcardsgame Server (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Creative Commons Attribution-NonCommercial-ShareAlike 2.0 License
 * see: https://github.com/dcodeIO/wildcardsgame for details
 */

// The most essential things here are double checking all the data that comes in over the network and to always test for
// a working connection before doing anything on it.

// Node includes
var fs = require("fs"),
    path = require("path"),
    express = require('express'),
    http = require('http'),
    https = require('https'),
    io = require('socket.io');

// Game includes
var pkg = require(__dirname+"/../package.json"),
    Cards = require(__dirname+"/Cards.js"),
    Game = require(__dirname+"/Game.js"),
    Player = require(__dirname+"/Player.js");

/**
 * Constructs a new Server.
 * @param {{key: string, cert: string}=} credentials SSL/TLS credentials
 * @constructor
 */
var Server = function(credentials) {
    var app = express();

    /**
     * HTTP server.
     * @type {http.Server}
     */
    this.http = http.createServer(app);
    console.info("[Server] Created HTTP server");

    /**
     * HTTPS server.
     * @type {https.Server}
     */
    if (!!credentials) {
        this.https = https.createServer(credentials, app);
        console.info("[Server] Created HTTPS server (key size: "+credentials["key"].length+", cert size: "+credentials["cert"].length+")");
    } else this.https = null;

    /**
     * App.
     * @type {express.Application}
     */
    this.app = app;

    /**
     * Socket.io HTTP.
     * @type {Object}
     */
    this.io = io.listen(this.http, { "log level": 1 });

    /**
     * Socket.io HTTPS.
     * @type {Object}
     */
    this.ioSecure = this.https ? io.listen(this.https, { "log level": 1 }) : null;
    
    /**
     * Cards database by language key.
     * @type {Object.<string,Cards>}
     */
    this.cards = null;

    /**
     * Available languages.
     * @type {Array.<{lang: string, name: string, black: number, white: number}>}
     */
    this.languages = [];
    
    this.reload(/* failOnError */ true);

    /**
     * Connections.
     * @type {Array}
     */
    this.connections = [];
    
    /**
     * Games by unique Game id.
     * @type {Object.<string,Game>}
     */
    this.games = {};
    
    /**
     * Players by unique Player id.
     * @type {Object.<string,Player>}
     */
    this.players = {};
};

/**
 * Reloads all Cards databases.
 * @param {boolean=} failOnError If the server should fail on error
 */
Server.prototype.reload = function(failOnError) {
    console.info("[Server] Updating cards database ...");
    Cards.loadAll(function(err, all) {
        if (err) {
            console.warn("[Server] Failed to update cards database: "+err);
            if (!!failOnError) {
                process.exit(1);
            }
            return;
        }
        this.cards = all;
        var langs = Object.keys(this.cards);
        console.info("[Server] Available cards databases:", langs);
        this.languages = [];
        for (var i=0; i<langs.length; i++) {
            var cs = this.cards[langs[i]];
            this.languages.push({
                "lang": langs[i],
                "name": cs.name,
                "black": cs.black.length,
                "white": cs.white.length
            });
        }
    }.bind(this));
};

/**
 * Base (root) directory of the repo.
 * @type {string}
 */
Server.BASEDIR = path.normalize(__dirname+"/..");

/**
 * Listens on the given port.
 * @param {number} port Port number
 * @param {string} host Host name
 * @param {boolean=} secure SSL/TLS
 * @return {Server} this
 */
Server.prototype.listen = function(port, host, secure) {
    secure = !!secure;
    console.info("[Server] Listening on "+host+":"+port+" (secure="+secure+")");
    (secure ? this.https : this.http).listen(port, host);
    return this;
};

/**
 * Starts this Server.
 */
Server.prototype.start = function() {
    console.info("[Server] Starting up ...");
    
    // Serve static
    this.app.use(express.static(Server.BASEDIR+"/www"));
    // Serve dumb FB canvas post
    this.app.post("/", function(req, res) {
        res.set("Refresh", "0; url=/");
    });
    console.info("[Server] Base directory is "+Server.BASEDIR+"/www");
    
    // Accept socket connections
    this.io.sockets.on('connection', this._onConnect.bind(this));
    if (this.ioSecure) this.ioSecure.sockets.on('connection', this._onConnect.bind(this));
    
    // Update players online every 60 seconds
    setInterval(this.updateOnline.bind(this), 60*1000);
    return this;
};

/**
 * Connection handler.
 * @param {Object} socket
 * @private
 */
Server.prototype._onConnect = function(socket) {
    this.connections.push(socket);
    
    // Handle disconnect
    socket.on("disconnect", function(socket) {
        var i = this.connections.indexOf(socket);
        if (i >= 0) {
            this.connections.splice(i, 1);
        } else { // Should not happen
            console.error("[Server] A disconnected socket is not contained in known connections");
        }
        if (typeof socket.player != 'undefined') {
            socket.player.disconnect(true);
        }
    }.bind(this, socket));
    
    // Say hello
    socket.emit('hello', {
        version: pkg.version,
        languages: this.languages // Array of language descriptions
    });
    
    // Tell how many are online
    socket.emit("online", this.connections.length);
    
    // Handle login
    socket.on('login', function(data) {
        if (!!data["id"] && !!data["name"]) {
            var p = new Player(this, socket, data); // Prints info
            socket.player = p;
            this.players[data["id"]] = p;
        } else {
            console.warn("[Server] Invalid login from "+socket);
        }
    }.bind(this));
};

/**
 * Updates the players online count to all connected players.
 */
Server.prototype.updateOnline = function() {
    for (var i=0; i<this.connections.length; i++) {
        if (!this.connections[i]["disconnected"]) {
            this.connections[i].emit("online", this.connections.length);
        } else { // Should not happen
            console.error("[Server] Found a no more connected socket that is still contained in known connections");
        }
    }
    console.info("[Server] Updated online count: "+this.connections.length);
};

/**
 * Tests if a language key is valid.
 * @param {string} lang Language key
 * @return {boolean} true if valid, else false
 */
Server.prototype.isValidLanguage = function(lang) {
    return !!this.cards[lang];
};

/**
 * Gets the cards for the specified language.
 * @param {string} lang Language
 * @return {Cards}
 */
Server.prototype.getCards = function(lang) {
    // We clone this for each game. Also allows reloading on the fly.
    if (!this.cards[lang]) {
        console.warn("[Server] There are no cards for language "+lang);
        return null;
    }
    var cards = this.cards[lang].clone().shuffle();
    if (cards.ext) {
        if (this.cards[cards.ext]) {
            var ext = this.cards[cards.ext];
            cards.black = ext.black.concat(cards.black);
            cards.white = ext.white.concat(cards.white);
        } else {
            this.warn("[Server] Language "+lang+" extends "+cards.ext+" but there is no such language");
        }
    }    
    return cards;
};

/**
 * Called when a Player disconnects.
 * @param {!Player} player
 */
Server.prototype.onDisconnect = function(player) {
    if (player.id && this.players[player.id]) {
        if (player.game !== null) {
            player.game.onDisconnect(player);
        }
        delete this.players[player.id];
        console.info("[Server] Removed player: "+player);
    } // else never logged in
};

/**
 * Creates a new Game.
 * @param {string} lang Language
 * @param {!Player} host Hosting player
 * @return {!Game}
 */
Server.prototype.createGame = function(lang, host) {
    var id; do { id = Game.generateId(); } while (this.games[id]);
    var game = new Game(this, id, lang, host);
    this.games[id] = game;
    console.info("[Server] Created game "+game+" (lang="+game.lang+") hosted by player "+host);
    return game;
};

/**
 * Gets a Game.
 * @param {string} id Game id
 * @returns {Game|null}
 */
Server.prototype.getGame = function(id) {
    return this.games[id] || null;
};

/**
 * Removes a Game when all players have left.
 * @param {!Game} game Game to remove
 * @return {boolean} true if successfully removed, false if not a valid game or not found
 */
Server.prototype.removeGame = function(game) {
    if (game.id && this.games[game.id]) {
        delete this.games[game.id];
        console.info("[Server] Removed game "+game);
        return true;
    }
    console.warn("[Server] Failed to remove game: "+game);
    return false;
};

/**
 * Starts a Server.
 * @param {...*} var_args Ports to listen on
 * @return {!Server}
 */
Server.start = function(var_args) {
    return new Server(arguments).start();
};

module.exports = Server;
