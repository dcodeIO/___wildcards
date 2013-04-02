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
 * @license wildcardsgame Client (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Creative Commons Attribution-NonCommercial-ShareAlike 2.0 License
 * see: https://github.com/dcodeIO/wildcardsgame for details
 */

/**
 * @type {Client}
 */
var Client = (function(global, io, debug) {


    /**
     * Prints log output if debugging is enabled.
     * @function
     * @param {...*} var_args
     */
    var log = (debug && typeof console != 'undefined' && console.log) ? console.log.bind(console) : function() {};
    
    /**
     * Constructs a new Client.
     * @exports Client
     * @class The ___wildcards Client.
     * @param {Teaser} teaser Teaser instance
     * @constructor
     */
    var Client = function(teaser) {
        
        //////////////////////////////
        // General

        /**
         * Teaser instance.
         * @type {Teaser}
         */
        this.teaser = teaser || null;
        
        /**
         * Socket.
         * @type {Object}
         */
        this.socket = null;

        /**
         * Available languages.
         * @type {Array.<{lang: string, name: string, black: number, white: number}>}
         */
        this.languages = [];

        /**
         * Current hash.
         * @type {string}
         */
        this.hash = "";
        
        ///////////////////////////////
        // FB data

        /**
         * User data.
         * @type {Object}
         */
        this.me = null;

        /**
         * FB Friends.
         * @type {Array.<Object>}
         */
        this.friends = null;

        /**
         * Number of players online.
         * @type {number}
         */
        this.onlineCount = 0;
        
        ////////////////////////////////
        // Game state

        /**
         * Current Game.
         * @type {{id: string, lang: string}}
         */
        this.game = null;

        /**
         * Whether the Game is currently running (has been started).
         * @type {boolean}
         */
        this.running = false;

        /**
         * Players in the Game.
         * @type {Array.<{id: string, name: string, connected: boolean}>}
         */
        this.players = null;

        /**
         * Player currently in charge of the black card.
         * @type {{id: string, name: string, connected: boolean}}
         */
        this.playerInCharge = null;

        /**
         * Current black card.
         * @type {?string}
         */
        this.card = null;

        /**
         * The local player's cards.
         * @type {Array.<string>}
         */
        this.cards = [];

        /**
         * Locally selected white cards to play.
         * @type {Array}
         */
        this.selection = null;

        /**
         * All players' selections.
         * @type {Array.<Array.<string>>}
         */
        this.selections = null;

        /**
         * Winner of the last round.
         * @type {{id:string, name: string, connected: boolean}}
         */
        this.winner = null;
    };

    /**
     * Minimum number of players required.
     * @type {number}
     * @const
     */
    Client.MIN_PLAYERS = 2; // 3 is better ofc
    
    /**
     * Maximum number of players in a game.
     * @type {number}
     * @const
     */
    Client.MAX_PLAYERS = 9;

    /**
     * Tests if we are connected to the server.
     * @return {boolean}
     */
    Client.prototype.isConnected = function() {
        return this.socket && this.socket.socket && this.socket.socket.connected;
    };

    /**
     * Tests if we are logged into FB.
     * @return {boolean}
     */
    Client.prototype.isLoggedIn = function() {
        return this.me && this.me["id"];
    };

    /**
     * Tests if the local user is the game's host.
     * @returns {boolean}
     */
    Client.prototype.isHost = function() {
        return this.game !== null && this.game.host["id"] == this.me["id"];
    };

    /**
     * Gets a language by its language keys.
     * @param {string} key
     * @return {{lang: string, name: string}|null}
     */
    Client.prototype.getLanguage = function(key) {
        for (var i=0; i<this.languages.length; i++) {
            var l = this.languages[i];
            if (l["lang"] == key) {
                return l;
            }
        }
        return null;
    };

    /**
     * Preloads some stuff.
     */
    Client.preload = function() {
        (new Image()).src = "/assets/img/white-hover.png";
        (new Image()).src = "/assets/img/white-selected.png";
        (new Image()).src = "/assets/img/kick-hover.png";
    };

    /**
     * Initializes the game.
     */
    Client.prototype.init = function() {
        
        // Handle FB app request landings first as they'll require a redirect
        var reqIds = getquery("request_ids");
        if (reqIds !== null) {
            log("Landing via FB app request");
            this.handleAppRequest(reqIds.length == 0 ? [] : reqIds.split(","));
            
        // Else connect to get all the available languages etc.
        } else {
            log("Landing normally");
            this.connect(function(success) {
                if (!success) {
                    Client.showAlert(_("Sorry"), _("Connecting to the server has failed. Try again later!"), "error");
                    return;
                }
                Client.preload();
                this.testHash(true); // Testing the hash for the first time sets up everything                
            }.bind(this));
        }
    };

    /**
     * Called periodically to monitor hash changes.
     * @param {boolean=} forceUpdate Whether to force the update even if nothing has changed
     */
    Client.prototype.testHash = function(forceUpdate) {
        if (location.hash != this.hash || forceUpdate) {
            // Game
            if(location.hash.length == 17 && /^#[a-zA-Z0-9]+$/.test(location.hash)) {
                var gameId = location.hash.substring(1);
                this.showHome();
                this.login(function(success) {
                    if (success) {
                        this.joinGame(gameId);
                    }
                }.bind(this));
                
            // Home
            } else {
                this.showHome();
            }
            this.hash = location.hash;
        }
        setTimeout(this.testHash.bind(this), 100);
    };

    /**
     * Connects to the server.
     * @param {function(boolean)=} callback Called upon success or error
     */
    Client.prototype.connect = function(callback) {
        if (this.isConnected()) {
            log("Already connected.");
            callback(true);
            return;
        }        
        var con = location.protocol+"//"+location.host;
        log("Connecting to "+con);
        this.socket = io.connect(con, { secure: location.protocol == "https:" });

        // Handle connection error
        this.socket.once("connect_failed", function() {
            if (callback) callback(false);
        }.bind(this));

        // Handle successful connect
        this.socket.once("connect", function() {

            // Handle disconnect
            this.socket.once("disconnect", this.onDisconnect.bind(this));

            // Handle server hello
            this.socket.once("hello", function(data) {

                // Process the response
                log("S->C hello: version="+data.version+", "+data.languages.length+" languages");
                log("C->S hello");
                this.socket.emit("hello");
                this.languages = data['languages'];
                this.languages.sort(function(a,b) {
                    return a["name"] < b["name"] ? -1 : 1;
                });
                log("Available languages: "+this.languages.length+" languages");

                // Test available languages against the locally preferred language
                var blang = null;
                if (typeof localStorage != 'undefined' && localStorage.getItem) {
                    blang = localStorage.getItem("lang");
                }
                if (!blang) {
                    blang = global.navigator["userLanguage"] || global.navigator["language"];
                }
                if (blang) {
                    log("Browser wants language: "+blang);
                    var found = false;
                    var i, l;
                    for (i=0; i<this.languages.length; i++) {
                        l = this.languages[i];
                        if (l["lang"] == blang) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        blang = blang.substring(0, 2);
                        for (i=0; i<this.languages.length; i++) {
                            l = this.languages[i];
                            if (l["lang"] == blang) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) {
                        log("Browser language "+blang+" is available");
                        this.setLanguage(blang);
                    }
                }

                // Handle online counter updates
                this.socket.on("online", this.onOnlineCount.bind(this));

                if (callback) callback(true);
            }.bind(this));
            // If server sends no hello, callback will never be called.
        }.bind(this));
    };

    /**
     * Connect and login shorthand.
     * @param {function(boolean)=} callback
     */
    Client.prototype.connectAndLogin = function(callback) {
        this.connect(function(success) {
            if (success) {
                this.login(function(success) {
                    if (callback) callback(success);
                }.bind(this));
            } else{
                if (callback) callback(false);
            }
        }.bind(this));
    };

    /**
     * Shows the home view and unregisters all the game listeners.
     */
    Client.prototype.showHome = function() {
        log("Showing home view");
        
        this.hash = location.hash = "#";
        
        // Unset game
        if (this.game !== null) {
            log("Unsetting game");
            this.game = null;
            this.card = null;
            this.cards = [];
            this.selection = null;
            this.selections = null;
            this.players = [];
            this.playerInCharge = null;
            this.winner = null;
            if (this.isConnected()) {
                this.socket.removeAllListeners();
                this.socket.once("disconnect", this.onDisconnect.bind(this));
                this.socket.on("online", this.onOnlineCount.bind(this));
                log("C->S leave");
                this.socket.emit("leave");
            }
        }

        // Switch screen
        $('#game').hide();
        $('#home').show();
        
        // Start teaser animation
        if (this.teaser != null) {
            log("Starting teaser");
            this.teaser.start();
        }
    };

    /**
     * Shows the game view and registers all the neccessary listeners.
     */
    Client.prototype.showGame = function() {
        if (this.game === null) {
            log("Unable to show game view: No game");
            return;
        }
        log("Showing game view");
        
        this.hash = location.hash = "#"+this.game.id; // Prevent automatic
        
        // Stop teaser animation
        if (this.teaser != null) {
            log("Stopping teaser");
            this.teaser.stop();
        }
        
        // Switch screen
        $('#alert').alert("close");
        $('#home').hide();
        $('#game').show();
        $('#game-link').val(location.href);
        
        // Register listeners
        this.socket.on("join", function(player) {
            log("S->C join: "+player["id"]+"/"+player["name"]+", connected="+player["connected"]);
            if (this.players === null) {  // First player (self)
                this.players = [];
            }
            this.players.push(player);
            this.updatePlayers();
        }.bind(this));

        this.socket.on("left", function(player) {
            log("S->C left: "+player["id"]+"/"+player["name"]+", connected="+player["connected"]);
            for (var i=0; i<this.players.length; i++) {
                if (this.players[i]["id"] == player["id"]) {
                    this.players.splice(i,1);
                    this.updatePlayers(); // Also updates buttons
                    return;
                }
            }
            log("[ERROR] Player "+player["id"]+" not found");
        }.bind(this));

        this.socket.on("update", function(player) {
            log("S->C update: "+player["id"]+"/"+player["name"]+", connected="+player["connected"]);
            for (var i=0; i<this.players.length; i++) {
                if (this.players[i]["id"] == player["id"]) {
                    this.players[i] = player;
                    this.updatePlayers(); // Also updates buttons
                    return;
                }
            }
            log("[ERROR] Player "+player["id"]+" not found");
        }.bind(this));
        
        this.socket.on("gameupdate", function(game) {
            log("S->C gameupdate");
            this.game = game;
            this.updateButtons();
        }.bind(this));

        this.socket.on("chat", function(data) {
            log("S->C chat: "+data["player"]["name"]+": "+data["message"]);
            var msg = nohtml(data["message"]);
            var self = (data["player"]["id"] == this.me["id"]);
            var ce = $('<div class="message"><img src="https://graph.facebook.com/'+data["player"]["id"]+'/picture" class="avatar"/> <strong class="name'+(self ? ' self' : '')+'">'+data["player"]["name"]+'</strong> <span class="text">'+msg+'</span></div>');
            var e = $('#game-chat-messages').append(ce);
            e[0].scrollTop = Math.max(e[0].scrollHeight, e[0].clientHeight) - e[0].clientHeight;
            Client.playSound("message");
        }.bind(this));

        this.socket.on("started", function() {
            log("S->C started");
            this.running = true;
            this.updateButtons();
        }.bind(this));

        this.socket.on("stopped", function(reason) {
            log("S->C stopped: "+reason);
            this.running = false;
            this.selection = null;
            this.playerInCharge = null;
            this.updateButtons();
            if (reason == "outofblack") {
                Client.showAlert(_("That's it!"), _("All the black cards have been played. Start again if you wish!"), "info");
            }
        }.bind(this));

        this.socket.on("state", function(state) {
            this.running = state["running"];
            this.playerInCharge = state["playerInCharge"];
            this.card = state["card"];
            this.selections = state["selections"];
            this.timer = state["timer"];
            if (this.card === null || this.selections !== null) {
                this.selection = null;
            }
            if (this.selections === null) {
                this.winner = null;
            }
            this.updatePlayers();
            this.updateCards();
            this.updateButtons();
        }.bind(this));
        
        this.socket.on("newhost", function(host) {
            log("S->C newhost: "+host["id"]+"/"+host["name"]);
            this.game["host"] = host;
            this.updatePlayers();
            this.updateButtons();
        }.bind(this));

        this.socket.on("cards", function(data) {
            log("S->C cards");
            var i, idx;
            // On reconnect only (e.g. a full update)
            if (data["clear"]) {
                log("Clearing cards");
                this.cards = [];
            }
            // As usual
            if (data["del"] && data["del"].length > 0) {
                log("Deleting "+data["del"].length+" cards");
                for (i=0; i<data["del"].length; i++) {
                    idx = this.cards.indexOf(data["del"][i]);
                    if (idx >= 0) {
                        this.cards.splice(idx, 1);
                    }
                }
            }
            if (data["add"] && data["add"].length > 0) {
                log("Adding "+data["add"].length+" cards");
                for (i=0; i<data["add"].length; i++) {
                    this.cards.push(data["add"][i]);
                }
            }
            this.updateMyCards();
        }.bind(this));

        this.socket.on("nudge", function(reason) {
            log("S->C nudge");
            Client.playSound("nudge");
            if (reason == "pick") {
                this.card = null;
                this.updateButtons();
            } else if (reason == "select") {
                this.selection = [];
                this.updateButtons();
            } else if (reason == "evaluate") {
                this.updateButtons();
            }
        }.bind(this));

        this.socket.on("winner", function(data) {
            var player = data.player;
            var index = data.index;
            log("S->C winner: "+data["index"]);
            player["index"] = index;
            this.winner = player;
            this.updateCards();
        }.bind(this));
    };

    /**
     * Called for online counter updates.
     * @param {number=} count Just updates if not specified
     */
    Client.prototype.onOnlineCount = function(count) {
        if (typeof count != 'undefined') {
            log("S->C online: "+count);
            this.onlineCount = count;
        }
        $('#onlinecount').text(_("%n% players online", { "n": this.onlineCount }));
    };

    /**
     * Disconnect handler.
     */
    Client.prototype.onDisconnect = function() {
        log("Disconnected.");
        log("Disconnected.");
        if (this.socket != null) { // If it is already set to null, it's a manual disconnect and we don't need to show an error
            this.socket.removeAllListeners();
            this.socket = null;
            Client.showAlert(_("Disconnected."), _("Your connection to the server has been lost. Reloading the game might help."), "error");
        }
        this.showHome();
    };

    /**
     * Disconnects.
     */
    Client.prototype.disconnect = function() {
        if (this.socket != null) {
            log("Disconnecting...");
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
            // onDisconnect will fire
        }
    };

    /**
     * Logs in the user.
     * @param {function(boolean)=} callback
     */
    Client.prototype.login = function(callback) {
        if (this.isLoggedIn()) {
            log("Already logged in");
            if (callback) callback(true);
            return;
        }
        log("C->FB login");
        FB.login(function(response) {
            if (response["authResponse"]) {
                log("FB->C authResponse");
                log("C->FB userInfo");
                FB.api('/me', function(response) {
                    if (response && response["id"]) {
                        log("FB->C userInfo: "+response["id"]+"/"+response["name"]);
                        if (this.socket != null) {
                            log("C->S login");
                            this.socket.emit("login", response);
                            this.socket.once("loggedin", function(me) {
                                if (me) {
                                    log("S->C loggedin");
                                    this.me = me;
                                    this.onLoggedIn();
                                    if (callback) callback(true);
                                } else {
                                    log("S->C loginFailed");
                                    if (callback) callback(false);
                                }
                            }.bind(this));
                        } else {
                            log("Logged in to FB but not connected, skipping login.");
                            this.me = response;
                            if (callback) callback(true);
                        }
                    } else{
                        log("FB->C noUserInfo");
                        if (callback) callback(false);
                    }
                }.bind(this));
            } else {
                log("FB->C failedAuth");
                if (callback) callback(false);
            }
        }.bind(this));
    };

    /**
     * Called upon successfully logging in.
     */
    Client.prototype.onLoggedIn = function() {
        /* FB.api('/me/scores', function(data) {
            console.log("scores: "+JSON.stringify(data, null, 4));
        }.bind(this));
        FB.api('/me/scores', 'post', { "score": 0 }, function(response) {
            console.log("res: "+JSON.stringify(response, null, 4));
        }.bind(this)); */
    };

    /**
     * Logs in and show a list of public games.
     */
    Client.prototype.loginAndList = function() {
        this.login(function(success) {
            if (success) {
                this.getGames(function(games) {
                    log("S->C games: "+games.length+" public games");
                    if (games.length > 0) {
                        var tbl = $('<table class="table" />');
                        for (var i=0; i<games.length; i++) {
                            var game = games[i];
                            var tr = $('<tr />');
                            var lang = this.getLanguage(game["lang"]);
                            tr.append(
                                $('<td />').append(
                                    $('<i />').attr("class", game["running"] ? "icon-play" : "icon-stop"),
                                    $('<span />').text(" "+game["host"]["name"])
                                )
                            ).append(
                                $('<td />').text(lang ? lang["name"] : game["lang"])
                            ).append(
                                $('<td />').text(_("%n% players", { "n": game["players"] }))
                            ).append(
                                $('<td />').attr("class", "last").append(
                                    $('<a />').attr("class", "btn").text(_("Join")).bind("click", this._joinGame.bind(this, game["id"]))
                                )
                            );
                            tbl.append(tr);
                        }
                        $('#selectgame-list').empty().append(tbl);
                    } else {
                        $('#selectgame-list').empty().append($('<h4 />').text(_("There are currently no public games.")));
                    }
                    $('#selectgame').modal();
                }.bind(this));
            }
        }.bind(this));
    };

    /**
     * Called when a join game button is pressed.
     * @param {string} gameId
     * @private
     */
    Client.prototype._joinGame = function(gameId) {
        if (!this.isConnected()) return;
        if (this.game !== null) {
            log("Cannot join game: Already in a game");
            return;
        }
        $('#selectgame').modal('hide');
        this.joinGame(gameId);
    };

    /**
     * Gets a list of public games.
     * @param {function(Array.<Object>)} callback
     */
    Client.prototype.getGames = function(callback) {
        if (!this.isConnected()) {
            log("Cannot list games: Not connected");
            return;
        }
        if (!this.isLoggedIn()) {
            log("Cannot list games: Not logged in");
            return;
        }
        this.socket.emit("list");
        this.socket.once("games", function(games) {
            callback(games);
        }.bind(this));
    };

    /**
     * Gets the user's FB friends.
     * @param {function(boolean)=} callback
     */
    Client.prototype.getFriends = function(callback) {
        if (!this.isLoggedIn()) {
            log("Cannot get friends: Not logged in");
            if (callback) callback(false);
            return;
        }
        if (this.friends !== null) {
            log("Already got friends");
            if (callback) callback(true);
            return;
        }
        log("C->FB friends");
        FB.api('/me/friends?limit=0', function(response) {
            if (response && response["data"] && typeof response["data"] == 'object' && response["data"] instanceof Array) {
                log("FB->C friends: "+response["data"].length+" friends");
                this.friends = response["data"];
                this.friends.sort(function(a, b) {
                    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
                });
                if (callback) callback(true);
            } else {
                log("FB->C failedFriends", response);
                if (callback) callback(false);
            }
        }.bind(this));
    };

    /**
     * Gets the ids of all friends that are online.
     * @param {function(Array.<string>|null)} callback
     */
    Client.prototype.getOnlineFriends = function(callback) {
        if (!this.isLoggedIn()) {
            log("Cannot get online friends: Not logged in");
            if (callback) callback(null);
            return;
        }
        var q = "SELECT uid, online_presence FROM user WHERE online_presence IN ('active', 'idle') AND uid IN (SELECT uid2 FROM friend WHERE uid1='"+this.me["id"]+"')";
        console.log("C->F fql: "+q);
        FB.api({
            method: 'fql.query',
            query: q
        }, function(response) {
            console.log("res: ", response);
        });
        // TODO: Actually does not work: Returns online_precense=null for everyone. Any ideas?
    };

    /**
     * Creates a new game.
     * @param {function(boolean)=} callback
     */
    Client.prototype.createGame = function(callback) {
        if (!this.isConnected()) {
            log("Cannot create game: Not connected");
            if (callback) callback(false);
            return;
        }
        if (!this.isLoggedIn()) {
            log("Cannot create game: Not logged in");
            if (callback) callback(false);
            return;
        }
        
        // Leave current game
        if (this.game !== null) {
            log("C->S leave");
            this.socket.emit("leave");
        }
        this.showHome(); // Resets all listeners
        
        log("C->S create: "+Client.I18N["lang"]);
        this.socket.emit("create", {
            "lang": Client.I18N["lang"]
        });
        
        // Game created
        this.socket.once("created", function(game) {
            if (typeof game == 'object') {
                log("S->C created: "+game.id);
                this.game = game;
                this.showGame();
                if (callback) callback(true);
            }  else {
                log("S->C createFailed: "+game);
                if (callback) callback(false);
            }
        }.bind(this));
    };

    /**
     * Toggles if the game is private or not.
     */
    Client.prototype.togglePrivate = function() {
        if (!this.isConnected() || this.game === null) return;
        if (!this.isHost()) {
            log("Cannot toggle privacy: Not the host");
            return;
        }
        log("C->S private");
        this.socket.emit("private");
    };

    /**
     * Redirects to a game via an FB app request.
     * @param {Array.<string>} reqIds FB request ids
     */
    Client.prototype.handleAppRequest = function(reqIds) {
        this.login(function(success) {
            if (success) {
                log("Login ok");
                for (var i=0; i<reqIds.length; i++) {
                    (function(i) {
                        log("C->FB: request "+reqIds[i]+"_"+this.me["id"]+"?");
                        var uri = "/"+reqIds[i]+"_"+this.me["id"];
                        FB.api(uri, function(uri, last, response) {
                            if (response && typeof response["data"] == 'string') {
                                if (!last) { // Delete all old requests, keep the most recent one if multiple tries are necessary to join
                                    log("Deleting old app request: "+response["data"]);
                                    FB.api(uri, "delete");
                                } else { // Process the most recent request only
                                    log("Redirecting to game via app request: "+response["data"]);
                                    location.href = location.protocol+"//"+location.host+"/#"+encodeURIComponent(response["data"]);
                                }
                            } else {
                                if (last) {
                                    log("Redirect via app request failed: Most recent request failed");
                                    location.href = location.protocol+"//"+location.host;
                                }
                            }
                        }.bind(this, uri, i==reqIds.length-1));
                    }.bind(this))(i);
                }
            } else {
                this.handleAppRequest(reqIds); // Keep nagging
            }
        }.bind(this));
    };

    /**
     * Shows an alert.
     * @param {string} title
     * @param {string} message
     * @param {string} type
     */
    Client.showAlert = function(title, message, type) {
        type = type || "info";
        $('#alert-title').text(title);
        $('#alert-message').text(message);
        $('#alert')
            .removeClass("alert-error")
            .removeClass("alert-warning")
            .removeClass("alert-info")
            .addClass("alert-"+type)
            .show();
    };

    /**
     * Joins a game.
     * @param {string} gameId Game id
     * @param {function(boolean)=} callback
     */
    Client.prototype.joinGame = function(gameId, callback) {        
        if (!this.isConnected()) {
            log("Cannot join "+gameId+": Not connected");
            if (callback) callback(false);
            return;
        }
        if (!this.isLoggedIn()) {
            log("Cannot join "+gameId+": Not logged in");
            if (callback) callback(false);
            return;
        }
        if (!gameId || gameId.length != 16 || !/^[\w\d]+$/.test(gameId)) {
            log("Cannot join "+gameId+": Invalid game id");
            if (callback) callback(false);
            return;
        }
        
        // Leave previous game
        if (this.game != null) {
            this.socket.emit("leave");
        }
        this.showHome(); // Resets all states and listeners
        
        log("C->S join: "+gameId);
        this.socket.emit("join", gameId);
        this.socket.once("joined", function(game) {
            if (typeof game == 'object') {
                log("S->C joined: "+game.id);
                this.game = game; // Joins following
                this.showGame();
                if (callback) callback(true);
            } else {
                log("S->C failedJoin: "+game);
                if (game == "full") {
                    Client.showAlert(_("Sorry"), _("The game you are trying to join is already full. Create a new game instead!"), "warning");
                } else if (game == "notfound") {
                    Client.showAlert(_("Sorry"), _("This game does no longer exist. Create a new one instead!"), "warning");
                } else {
                    Client.showAlert(_("Sorry"), _("You cannot join this game for some ridiculous reason. Create a new one instead!"), "warning");
                }
                if (callback) callback(false);
            }
        }.bind(this));
    };

    /**
     * Selects friends to play with.
     */
    Client.prototype.selectFriends = function() {
        var doSelect = (function() {
            var exclude = [];
            for (var i=0; i<this.players.length; i++) {
                exclude.push(this.players[i]["id"]);
            }
            var req = {
                "method": 'apprequests',
                "message": _("Come on, let's play ___wildcards! A party game for horrible people."),
                "max_recipient": Client.MAX_PLAYERS - this.players.length,
                "exclude_ids": exclude,
                "data": this.game.id,
                "title": _("Invite your horrible friends")
            };
            FB.ui(req, function(response) {
                if (!response || !response["to"] || response["to"].length == 0) { // Noone invited
                    log("Noone invited");
                    return;
                }
                var ids = response["to"];
                var friends = [];
                for (var i=0; i<ids.length; i++) {
                    var id = ids[i];
                    // Find the friend
                    for (var j=0; j<this.friends.length; j++) {
                        var friend = this.friends[j];
                        if (friend["id"] == id) {
                            friends.push(friend);
                        }
                    }
                }
                log("C->S invite: "+friends.length+" friends");
                this.socket.emit("invite", friends);
            }.bind(this));
        }).bind(this);

        if (this.friends === null) {
            this.getFriends(function(success) {
                if (success) doSelect();
            }.bind(this));
        } else {
            doSelect();
        }
    };
    
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Game management
    
    /**
     * Tests if the given player is already in.
     * @param {string} id Player id
     * @returns {boolean}
     */
    Client.prototype.hasPlayer = function(id) {
        if (this.players === null) return false;
        for (var i=0; i<this.players.length; i++) {
            if (this.players[i]["id"] == id) return true;
        }
        return false;
    };

    /**
     * Gets the number of connected players.
     * @returns {number}
     */
    Client.prototype.getNumConnectedPlayers = function() {
        if (this.players === null) return 0;
        var n = 0;
        for (var i=0; i<this.players.length; i++) {
            if (this.players[i].connected) {
                n++;
            }
        }
        return n;
    };

    /**
     * Updates the players list.
     */
    Client.prototype.updatePlayers = function() {
        $('#game-nplayers').text(_("%n% players", { "n": this.getNumConnectedPlayers() }));
        var elem = $('#game-players');
        elem.empty();
        for (var i=0; i<this.players.length; i++) {
            var player = this.players[i];
            var kick = "";
            if (this.game && this.me && this.game.host["id"] == this.me["id"] && player["id"] != this.me["id"] && (!this.playerInCharge || player["id"] != this.playerInCharge["id"])) {
                kick = '<a class="kick" href="#" onclick="client.kick(\''+player["id"]+'\'); return false"></a>';
            }
            var pe = $('<div class="player'+(player.connected ? ' connected' : '')+((this.playerInCharge !== null && player["id"] == this.playerInCharge["id"]) ? " incharge" : "")+'">'+kick+'<img src="https://graph.facebook.com/'+player["id"]+'/picture" /><span class="name">'+player["name"]+'</span> <span class="score">['+player["score"]+']</span></div>');
            elem.append(pe);
        }
        this.updateButtons();
    };

    /**
     * Updates the cards display.
     */
    Client.prototype.updateCards = function() {
        var elem = $('#game-cards');
        
        // Display player selections
        if (this.selections !== null) {
            var elem = $('#game-cards');
            var e = $('#game-cards h3');
            elem.empty().append('<h3>'+(this.winner != null ? _("%name% wins!", { "name": this.winner["name"] }) : _("What made you laugh the most?"))+'</h3>');
            for (var i=0; i<this.selections.length; i++) {
                // Show the current black plus every players selection, one selection per row
                var sel = this.selections[i];
                var row = $('<div class="cards" id="selection'+i+'" />').append($('<div class="card card-black">'+nohtml(makeblack(this.card))+'</div>'));
                // Clicking a white card picks this answer as the best
                for (var j=0; j<sel.length; j++) {
                    var ce;
                    if (this.me["id"] == this.playerInCharge["id"] && this.winner == null) {
                        ce = $('<a href="#" class="card card-white">'+nohtml(sel[j])+'</a>');
                        ce.on("click", function(index) {
                            log("C->S winner: "+index);
                            this.socket.emit("winner", index);
                            return false;
                        }.bind(this, i));
                    } else {
                        ce = $('<div class="card card-white">'+nohtml(sel[j])+'</div>');
                        if (this.winner != null && i == this.winner["index"]) {
                            ce.addClass("selected");
                        }
                    }
                    row.append(ce);
                }
                elem.append(row);
            }
        // Display picked black card
        } else if (this.card !== null) {
            elem.empty().append('<h3>'+_("%name% plays:", { "name": this.playerInCharge["name"] })+'</h3>').append($('<div class="cards" />').append($('<div class="card card-black">'+nohtml(makeblack(this.card))+'</div>')));
        }
    };

    /**
     * Updates the local player's cards.
     */
    Client.prototype.updateMyCards = function() {
        var elem = $('#game-mycards');
        var row = $('<div class="cards" />');
        for (var i=0; i<this.cards.length; i++) {
            var c = this.cards[i];
            var ce = $('<a href="#" class="card card-white">'+nohtml(c)+'</a>');
            ce.on("click", this.selectCard.bind(this, c, ce));
            row.append(ce);
        }
        elem.empty().append(row);
    };

    /**
     * Selects a card.
     * @param {string} card
     * @param {HTMLElement} elem
     * @return {boolean} false
     */
    Client.prototype.selectCard = function(card, elem) {
        if (this.selection === null) return false;
        var i = this.cards.indexOf(card);
        if (i >= 0) {
            var count = this.card.match(/[_]+/g).length;
            var j = this.selection.indexOf(card);
            if (j >= 0) { // Deselect (always allowed)
                log("Deselecting card: "+card);
                this.selection.splice(j, 1);
                elem.remove();
                $('#game-mycards .cards').append(elem);
                elem.off("click").on("click", this.selectCard.bind(this, card, elem));
            } else if (j < 0 && this.selection.length < count) { // Select (allowed up to count)
                log("Selecting card: "+card);
                this.selection.push(card);
                elem.remove();
                $('#game-cards .cards').append(elem);
                elem.off("click").on("click", this.selectCard.bind(this, card, elem));
            }
            // updateCards will reset the view
            this.updateButtons();
        } else {
            log("Clicked a card that is not owned: "+card);
        }
        return false; // onclick
    };

    /**
     * Updates button states.
     */
    Client.prototype.updateButtons = function() {
        if (!this.isConnected() || !this.isLoggedIn()) {
            log("Not connected or not logged in: Switching home...");
            this.switchHome();
            return;
        }
        var btn = $('#game-button'); // One-button-model :-)
        btn.attr("disabled", "true");
        btn.off("click");
        if (!this.running) {
            if (this.getNumConnectedPlayers() >= Client.MIN_PLAYERS) {
                // Allow only the host to start the game
                if (this.me["id"] == this.game["host"]["id"]) {
                    btn.text(_("Start the game"));
                    btn.removeAttr("disabled");
                    btn.on("click", function() {
                        log("C->S start");
                        this.socket.emit("start");
                    }.bind(this));
                } else {
                    btn.text(_("Waiting for %name%...", { "name": this.game["host"]["name"] }));
                }
            } else {
                btn.text(_("Waiting for more players..."));
            }
        } else {
            if (this.playerInCharge !== null && this.playerInCharge["id"] == this.me["id"]) {
                if (this.card === null) {
                    btn.text(_("Pick a Black Card!"));
                    btn.removeAttr("disabled");
                    btn.on("click", function() {
                        log("C->S pick");
                        this.socket.emit("pick");
                    }.bind(this));
                    
                } else {
                    if (this.selections !== null && this.winner === null) {
                        btn.text(_("You chose!"));
                    } else {
                        btn.text(_("Waiting for other players..."));
                    }
                }
            } else if (this.playerInCharge) {
                if (this.card === null) {
                    btn.text(_("Waiting for %name%...", { "name": this.playerInCharge["name"] }));
                } else {
                    if (this.selection !== null) { // Selection allowed
                        var count = this.card.match(/[_]+/g).length; // Number of required cards
                        if (this.selection.length == count) {
                            btn.text(_("Do it!"));
                            btn.removeAttr("disabled");
                            btn.on("click", function(btn) {
                                log("C->S select: "+this.selection);
                                this.socket.emit("select", this.selection); // Server will pick something, always.
                                // this.onCardsPlayed(this.card, this.selection);
                                this.selection = null;
                                btn.text(_("Waiting for other players..."));
                                btn.attr("disabled", "true");
                            }.bind(this, btn));
                        } else {
                            btn.text(_("Pick %n%!", { "n": count }));
                        }
                    } else {
                        if (this.playerInCharge["chose"]) {
                            btn.text(_("Waiting for %name%...", { "name": this.playerInCharge["name"] }));
                        } else {
                            btn.text(_("Waiting for other players..."));
                        }
                    }
                }
            } else {
                btn.text(_("Waiting for the end of the world..."));
            }
        }
        
        // Private/public
        $('#private-btn').attr("disabled", "true");
        if (this.game["private"]) {
            $('#private-icon').attr("class", "icon-lock");
            $('#lang-private').text( _("Private"));
        } else {
            $('#private-icon').attr("class", "icon-globe");
            $('#lang-private').text( _("Public"));
        }
        if (this.isHost()) {
            $('#private-btn').removeAttr("disabled");
        }
    };

    /**
     * Toggles if the game is private or public.
     */
    Client.prototype.togglePrivate = function() {
        if (!this.isConnected() || this.game === null) {
            log("Cannot toggle private: Not connected or not in a game");
            return;
        }
        if (!this.isHost()) {
            log("Cannot toggle private: Not the host");
            return;
        }
        this.socket.emit("private", !this.game["private"]); // Causes a state update
    };

    /**
     * Kicks a player.
     * @param {string} id
     */
    Client.prototype.kick = function(id) {
        if (this.hasPlayer(id)) {
            log("C->S kick: "+id);
            this.socket.emit("kick", id); // Left following
        }
    };

    /**
     * Sends a chat message.
     */
    Client.prototype.chat = function() {
        if (!this.isConnected()) {
            log("Failed to chat: Not connected");
            return;
        }
        if (this.game == null) {
            log("Failed to chat: Not in a game");
            return;
        }
        var ci = $('#chat-input');
        var msg = ci.val().replace(/^\s+|\s+$/g, '');
        if (msg.length > 0) {
            log("C->S chat: "+msg);
            this.socket.emit("chat", msg);
        } else {
            log("Skipping empty chat message");
        }
        ci.val('');
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Sounds

    /**
     * Sounds.
     * @type {*}
     */
    Client.SOUNDS = {
        "message": global.document.getElementById("sound-message"),
        "nudge": global.document.getElementById("sound-nudge")
    };

    /**
     * Plays a sound.
     * @param {string} type
     */
    Client.playSound = function(type) {
        if (Client.SOUNDS[type]) {
            try { Client.SOUNDS[type].play(); } catch (e) {}
        }
    };
    
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Internationalization

    /**
     * Internationalization.
     * @type {{lang: string, name: string, translations: Object.<string,string>}}
     */
    Client.I18N = {
        "lang": "en",
        "name": "English",
        "translations": {}
    };
    
    /**
     * Inline-translated elements.
     * @type {Array.<$>}
     */
    Client.I18N_E = [
        $('#lang-title'),
        $('#lang-desc'),
        $('#lang-frontcard1'),
        $('#lang-frontcard2'),
        $('#lang-frontcard3'),
        $('#lang-selectlang'),
        $('#lang-login'),
        $('#lang-invitemore'),
        $('#lang-gamelink'),
        $('#lang-gamecard1'),
        $('#lang-gamecard2'),
        $('#lang-gamecard3'),
        $('#lang-selectfriendstitle'),
        $('#selectfriends-button'),
        $('#lang-selectlanguage'),
        $('#lang-publicgames'),
        $('#lang-creategame'),
        $('#lang-chat'),
        $('#lang-policy'),
        $('#lang-cardgen'),
        $('#lang-features1'),
        $('#lang-features2')
    ];

    /**
     * Translates a string.
     * @param {string} s
     * @param {Object.<string,string>=} replace
     * @return {string}
     */
    Client.translate = function(s, replace) {
        if (Client.I18N.translations[s]) {
            s = Client.I18N.translations[s];
        }
        if (typeof replace == 'object' && replace) {
            for (var i in replace) {
                if (replace.hasOwnProperty(i)) s = s.replace("%"+i+"%", replace[i]);
            }
        }
        return s;
    };

    /**
     * Gettext like translation alias.
     * @alias Client.translate
     */
    var _ = Client.translate;

    /**
     * Shows the language selection.
     */
    Client.prototype.selectLanguage = function() {
        if (this.languages.length > 0) {
            var elem = $('#selectlanguage-list');
            elem.empty();
            for (var i=0; i<this.languages.length; i++) {
                var lang = this.languages[i];
                // if (lang["lang"].length > 2) { // Skip generic
                var le = $('<a class="btn lang"><img class="icon-globe" /> '+nohtml(lang['name'])+'</a>');
                le.on("click", this.setLanguage.bind(this, lang['lang'], true));
                elem.append(le);
                // }
            }
            $('#selectlanguage').modal({
                "show": true,
                "backdrop": "static",
                "keyboard": false
            });
        }
    };

    /**
     * Sets the language.
     * @param {string} key Language key
     */
    Client.prototype.setLanguage = function(key) {
        log("Setting language: "+key);
        $('#selectlanguage').modal('hide');
        // Grep the language
        $.getJSON("/assets/i18n/"+key+".json", function(data) {
            if (!data || !data["translations"]) {
                log("No such language: "+key);
                return;
            }
            Client.I18N = data;

            // Translate inline
            for (var i=0; i<Client.I18N_E.length; i++) {
                var e = Client.I18N_E[i];
                if (e.size() == 0) continue;
                if (!e.attr("i18n-text")) {
                    e.attr("i18n-text", e.text());
                }
                e.text(_(e.attr("i18n-text")));
            }
            document.title = "___wildcards - "+_("A party game for horrible people.");
            $('#chat-input').attr("placeholder", _("Type something..."));
            this.onOnlineCount();
            
            if (typeof localStorage != 'undefined' && localStorage.setItem) {
                localStorage.setItem("lang", key);
            }

        }.bind(this));
    };
    
    return Client;
    
})(this, io, /* debug */ true);

var client = null;
var teaser = null;
$(document).ready(function() {
    teaser = new Teaser($('#teaser-cards'));
    client = new Client(teaser); // Calls teaser.start/stop()
});
