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
var Client = (function(global, io) {

    /**
     * Whether debugging is enabled or not.
     * @type {boolean}
     */
    var DEBUG = true && (typeof console != 'undefined' && console.log);

    /**
     * Logs a message if debugging is enabled.
     * @param {...string} var_args
     */
    function log(var_args) {
        if (DEBUG) console.log.apply(console, arguments);
    }

    /**
     * Escapes html.
     * @param {string} s String to escape
     * @return {string} Escaped string
     */
    function nohtml(s) {
        if (s === null) return null;
        return (s+"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /**
     * Constructs a new Client.
     * @exports Client
     * @class The ___wildcards Client.
     * @constructor
     */
    var Client = function() {
        
        /**
         * Socket.
         * @type {Object}
         */
        this.socket = null;

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
         * Available languages.
         * @type {Array.<{lang: string, name: string, black: number, white: number}>}
         */
        this.languages = [];

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
         * Selected white cards to play.
         * @type {Array}
         */
        this.selection = null;

        /**
         * All players' selections.
         * @type {Array.<Array.<string>>}
         */
        this.selections = null;

        /**
         * Internationalization.
         * @type {{lang: string, name: string, translations: Object.<string,string>}}
         */
        this.i18n = {
            "lang": "en",
            "name": "English",
            "translations": {}
        };
    };

    /**
     * Minimum number of players required.
     * @type {number}
     * @const
     */
    Client.MIN_PLAYERS = 2;
    
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
     * Initializes the game.
     */
    Client.prototype.init = function() {
        this.connect(function() {

            // FB apprequest redirect
            var reqIds = Client.getQuery("request_ids");
            if (typeof reqIds == "string" && reqIds.length > 0) {
                log("Landing via FB apprequest");
                this.redirect(reqIds.split(",")); // Logs in

            // Landing with game id
            } else if (location.hash.length > 1) {
                var gameId = location.hash.substring(1);
                if (gameId.length == 16 && /^[\w\d]+$/.test(gameId)) {
                    console.log("Landing on game "+gameId+": Logging in");
                    this.login(function(success) {
                        if (success) {
                            log("Joining game "+gameId);
                            this.join(gameId);
                        } else {
                            log("Login failed: Not joining");
                            location.hash = ''; // See plain landing
                        }
                    }.bind(this));
                } else {
                    log("Landing with invalid game id: Not joining");
                    location.hash = ''; // See plain landing
                }

            } else {
                log("Plain landing"); // Wait for further actions
            }
            
        }.bind(this));
    };

    /**
     * Connects to the server.
     * @param {function=} callback Called on successful connection only
     */
    Client.prototype.connect = function(callback) {
        var con = location.protocol+"//"+location.host;
        log("Connecting to "+con);
        this.socket = io.connect(con, { secure: location.protocol == "https:" });
        this.socket.on("disconnect", function() {
            log("Disconnected");
            this.socket = null;
            this.switchHome();
        }.bind(this));
        this.socket.on("hello", function(data) {
            log("S->C hello: version="+data.version+", "+data.languages.length+" languages");
            log("C->S hello");
            this.socket.emit("hello");
            this.languages = data['languages'];
            this.languages.sort(function(a,b) {
                return a["name"] < b["name"] ? -1 : 1;
            });
            log("Available languages: "+this.languages.length+" languages");
            var blang = global.navigator["userLanguage"] || global.navigator["language"];
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
            if (callback) callback();
        }.bind(this));
    };

    /**
     * Logs in the user.
     * @param {function(boolean)=} callback
     */
    Client.prototype.login = function(callback) {
        if (!this.isConnected()) {
            log("Cannot login: Not connected");
            if (callback) callback(false);
            return;
        }
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
                        log("C->S login");
                        this.socket.emit("login", response);
                        this.socket.on("loggedin", function(me) {
                            if (me) {
                                log("S->C loggedin");
                                this.socket.removeAllListeners("loggedin");
                                this.me = me;
                                if (callback) callback(true);
                            } else {
                                log("S->C loginFailed");
                                if (callback) callback(false);
                            }
                        }.bind(this));
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
     * Gets the user's FB friends.
     * @param {function(boolean)=} callback
     */
    Client.prototype.getFriends = function(callback) {
        if (!this.isLoggedIn()) {
            log("Cannot get friends: Not logged in");
            if (callback) callback(false);
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
     * Switches to the game view.
     */
    Client.prototype.switchGame = function() {
        if (!this.game || !this.game.id) return;
        log("Switching to game view");
        $('#alert').alert("close");
        location.href = "#"+this.game.id;
        $('#header').addClass("header-low");
        $('#teaser').hide();
        $('#game').show();
        $('#game-link').val(location.href);

        // Player joined
        this.socket.on("join", function(player) {
            log("S->C join: "+player["id"]+"/"+player["name"]+", connected="+player["connected"]);
            var first = this.players === null;
            var doSelect = false;
            if (first) {  // First player (self)
                this.players = [];
                doSelect = this.game["host"]["id"] == this.me["id"];
            }
            this.players.push(player);
            this.updatePlayers();
            if (doSelect) {
                $('#game-invite').show();
                this.select();
            } else if (first) {
                $('#game-invite').hide();
            }
        }.bind(this));

        // Player left
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

        // Player updated
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
        
        // Chat message
        this.socket.on("chat", function(data) {
            log("S->C chat: "+data["player"]["name"]+": "+data["message"]);
            var msg = nohtml(data["message"]);
            var self = (data["player"]["id"] == this.me["id"]);
            var ce = $('<div class="message"><strong class="name'+(self ? ' self' : '')+'">'+data["player"]["name"]+'</strong> <span class="text">'+msg+'</span></div>');
            var e = $('#game-chat-messages').append(ce);
            e[0].scrollTop = Math.max(e[0].scrollHeight, e[0].clientHeight) - e[0].clientHeight;
            Client.playSound("message");
        }.bind(this));
        
        // Game started
        this.socket.on("started", function() {
            log("S->C started");
            this.running = true;
            this.updateButtons();
        }.bind(this));
        
        // Game stopped
        this.socket.on("stopped", function() {
            log("S->C stopped");
            this.running = false;
            this.selection = null;
            this.playerInCharge = null;
            this.updateButtons();
        }.bind(this));
        
        // Cards update for the local player
        this.socket.on("cards", function(data) {
            log("S->C cards");
            var i, idx;
            // On reconnect only (e.g. a full update)
            var updateAll = false;
            if (data["clear"]) {
                log("Clearing cars");
                updateAll = true;
                this.cards = [];
            }
            if (typeof data["card"] != 'undefined') {
                log("Setting current card: "+data["card"]);
                updateAll = true;
                this.card = data["card"];
            }
            if (typeof data["playerInCharge"] != 'undefined') {
                log("Setting player in charge: "+data["playerInCharge"]);
                updateAll = true;
                this.playerInCharge = data["playerInCharge"];
            }
            if (typeof data["running"] != 'undefined') {
                log("Setting running: "+data["running"]);
                updateAll = true;
                this.running = data["running"];
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
            if (updateAll) {
                log("Updating everything");
                this.updatePlayers();
                this.updateCards();
            }
            this.updateMyCards();
        }.bind(this));
        
        // New round: Picking Black...
        this.socket.on("pick", function(data) {
            log("S->C pick: playerInCharge="+data["player"]["id"]+"/"+data["player"]["name"]);
            this.card = null;
            this.selection = null;
            this.playerInCharge = data["player"];
            this.timeout = (new Date().getTime()) + data["timeout"];
            if (this.me["id"] == this.playerInCharge["id"]) {
                Client.playSound("nudge");
            }
            this.updatePlayers();
        }.bind(this));
        
        // No more black cards. Stopped afterwards.
        this.socket.on("outofblack", function() {
            log("S->C outofblack");
            // TODO: Show a nice message
        });
        
        // Select card(s) for the picked black
        this.socket.on("select", function(data) {
            if (this.playerInCharge === null) {
                this.playerInCharge = data["player"]; // If a newly joined player has missed it
                this.updatePlayers();
            }
            this.selections = null;
            this.card = data["card"];
            log("S->C select: card='"+this.card+"' by "+this.playerInCharge);
            this.timeout = (new Date().getTime()) + data["timeout"];
            if (this.playerInCharge["id"] != this.me["id"]) {
                this.selection = []; // Array = marker to allow selecting
                Client.playSound("nudge");
            } else {
                this.selection = null;
            }
            this.updateCards(); // Display the black card
            this.updateButtons(); // Players with selection!==null will be allowed to select, everyone else waits
        }.bind(this));
        
        // Anonymized and shuffled player selections. PlayerInCharge decides on the index.
        this.socket.on("selected", function(data) {
            log("S->C selected: "+data.length+" players");
            this.playerInCharge["chose"] = true;
            this.selected = null; // No more selections
            this.selections = data; // All players' selections for display
            this.updateCards();
            this.updateButtons(); // Player in charge will be allowed to chose)
            if (this.me["id"] == this.playerInCharge["id"]) {
                Client.playSound("nudge");
            }
        }.bind(this));
        
        // Display winner
        this.socket.on("winner", function(data) {
            var player = data.player;
            var index = data.index;
            $('#game-cards h3').text(this.translate("%name% wins!", { "name": player["name"] }));
            $('#selection'+index+' .card-white').addClass("selected");
        }.bind(this));
    };

    /**
     * Switches to the home view (reloads).
     */
    Client.prototype.switchHome = function() {
        location.href = location.protocol+"//"+location.host;
    };

    /**
     * Creates a new game.
     * @param {function(boolean)=} callback
     */
    Client.prototype.create = function(callback) {
        if (!this.isConnected()) {
            log("Cannot create: Not connected");
            if (callback) callback(false);
            return;
        }
        if (!this.isLoggedIn()) {
            log("Cannot create: Not logged in");
            if (callback) callback(false);
            return;
        }
        // Freshen up
        this.game = null;
        this.players = null;
        this.socket.removeAllListeners("created");
        this.socket.removeAllListeners("join");
        this.socket.removeAllListeners("left");
        this.socket.removeAllListeners("update");
        
        log("C->S create");
        this.socket.emit("create", {
            "lang": this.i18n["lang"]
        });
        
        // Game created
        this.socket.on("created", function(game) {
            this.socket.removeAllListeners("created");
            log("S->C created: "+game.id);
            this.game = game;
            this.switchGame();
            if (callback) callback(true);
        }.bind(this));
    };

    /**
     * Redirects to a game via an FB app request.
     * @param {Array.<string>} reqIds FB request ids
     */
    Client.prototype.redirect = function(reqIds) {
        this.login(function(success) {
            if (success) {
                log("Login ok");
                for (var i=0; i<reqIds.length; i++) {
                    (function(i) {
                        log("C->FB: request "+reqIds[i]+"_"+this.me["id"]+"?");
                        var uri = "/"+reqIds[i]+"_"+this.me["id"];
                        var last = i==reqIds.length-1;
                        FB.api(uri, function(response) {
                            if (response && response["data"]) {
                                FB.api(uri, "delete"); // Delete all requests
                                if (last) { // Process the most recent request only
                                    log("Redirecting to game: "+response.data);
                                    location.href = location.protocol+"//"+location.host+"/#"+encodeURIComponent(response.data);
                                }
                            } else {
                                if (last) {
                                    log("Redirect failed: Redirecting to home");
                                    location.href = location.protocol+"//"+location.host;
                                }
                            }
                        }.bind(this));
                    }.bind(this))(i);
                }
            } else {
                log("Login failed: Redirecting to home");
                location.href = location.protocol+"//"+location.host;
            }
        }.bind(this));
    };

    /**
     * Logs in and creates a game.
     */
    Client.prototype.loginAndCreate = function() {
        this.login(function(success) {
            if (success) {
                this.create();
            }
        }.bind(this));
    };

    /**
     * Joins another game.
     * @param {string} gameId Game id
     * @param {function(boolean)=} callback
     */
    Client.prototype.join = function(gameId, callback) {
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
        log("C->S join: "+gameId);
        this.socket.emit("join", gameId);
        this.socket.on("joined", function(game) {
            if (typeof game == 'object') {
                log("S->C joined: "+game.id);
                this.game = game; // Joins following
                this.switchGame();
                if (callback) callback(true);
            } else {
                log("S->C failedJoin: "+game);
                if (callback) callback(false);
                $('#alert-title').text(this.translate("Sorry"));
                var msg;
                if (msg == "notinvited") {
                    msg = this.translate("You are no more invited to this game. Contact the game host to invite you again or create a new gmae instead!");
                } else if (msg == "notfound") {
                    msg = this.translate("This game does no longer exist. Create a new one instead!");
                } else {
                    msg = this.translate("You cannot join this game for some ridiculous reason. Create a new one instead!");
                }
                $('#alert-message').text(msg);
                $('#alert').show();
            }
        }.bind(this));
    };

    /**
     * Selects friends to play with.
     */
    Client.prototype.select = function() {
        var doSelect = (function() {
            var exclude = [];
            for (var i=0; i<this.players.length; i++) {
                exclude.push(this.players[i]["id"]);
            }
            var req = {
                method: 'apprequests',
                message: this.translate("Come on, let's play ___wildcards! A party game for horrible people."),
                max_recipient: Client.MAX_PLAYERS - this.players.length,
                exclude_ids: exclude,
                data: this.game.id,
                title: this.translate("Invite your horrible friends")
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
        var elem = $('#game-players');
        elem.empty();
        for (var i=0; i<this.players.length; i++) {
            var player = this.players[i];
            var kick = "";
            if (this.game && this.me && this.game.host["id"] == this.me["id"] && player["id"] != this.me["id"]) {
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
            elem.empty();
            for (var i=0; i<this.selections.length; i++) {
                // Show the current black plus every players selection, one selection per row
                var sel = this.selections[i];
                var row = $('<div class="cards" id="selection'+i+'" />').append('<h3>'+this.translate("What's the most horrible?")+'</h3>').append($('<div class="card card-black">'+nohtml(Client.makeBlack(this.card))+'</div>'));
                // Clicking a white card picks this answer as the best
                for (var j=0; j<sel.length; j++) {
                    var ce;
                    if (this.me["id"] == this.playerInCharge["id"]) {
                        ce = $('<a href="#" class="card card-white">'+nohtml(sel[j])+'</a>');
                        ce.on("click", function(index) {
                            log("C->S winner: "+index);
                            this.socket.emit("winner", index);
                            return false;
                        }.bind(this, i));
                    } else {
                        ce = $('<div class="card card-white">'+nohtml(sel[j])+'</div>');
                    }
                    row.append(ce);
                }
                elem.append(row);
            }
        // Display picked black card
        } else if (this.card !== null) {
            elem.empty().append($('<div class="cards" />').append('<h3>'+this.translate("%name% plays:", { "name": this.playerInCharge["name"] })+'</h3>').append($('<div class="card card-black">'+nohtml(Client.makeBlack(this.card))+'</div>')));
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
                    btn.text(this.translate("Start the game"));
                    btn.removeAttr("disabled");
                    btn.on("click", function() {
                        this.socket.emit("start");
                    }.bind(this));
                } else {
                    btn.text(this.translate("Waiting for %name%...", { "name": this.game["host"]["name"] }));
                }
            } else {
                btn.text(this.translate("Waiting for more players..."));
            }
        } else {
            if (this.playerInCharge !== null && this.playerInCharge["id"] == this.me["id"]) {
                if (this.card === null) {
                    btn.text(this.translate("Pick a Black Card!"));
                    btn.removeAttr("disabled");
                    btn.on("click", function() {
                        this.socket.emit("pick");
                    }.bind(this));
                    
                } else {
                    if (this.playerInCharge["chose"]) {
                        btn.text(this.translate("You chose!"));
                    } else {
                        btn.text(this.translate("Waiting for other players..."));
                    }
                }
            } else if (this.playerInCharge) {
                if (this.card === null) {
                    btn.text(this.translate("Waiting for %name%...", { "name": this.playerInCharge["name"] }));
                } else {
                    if (this.selection !== null) { // Selection allowed
                        var count = this.card.match(/[_]+/g).length; // Number of required cards
                        if (this.selection.length == count) {
                            btn.text(this.translate("Play these!"));
                            btn.removeAttr("disabled");
                            btn.on("click", function() {
                                this.socket.emit("select", this.selection); // Server will pick something, always.
                                this.selection = null;
                            }.bind(this));
                        } else {
                            btn.text(this.translate("Pick %n%!", { "n": count }));
                        }
                    } else {
                        if (this.playerInCharge["chose"]) {
                            btn.text(this.translate("Waiting for %name%...", { "name": this.playerInCharge["name"] }));
                        } else {
                            btn.text(this.translate("Waiting for other players..."));
                        }
                    }
                }
            } else {
                btn.text(this.translate("Waiting for the end of the world..."));
            }
        }
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
        return false;
    };

    /**
     * Sends a chat message.
     */
    Client.prototype.chat = function() {
        if (!this.isConnected()) {
            log("Failed to chat: Not connected");
            return;
        }
        if (!this.game) {
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

    /**
     * 
     */
    Client.prototype.selectLanguage = function() {
        if (this.languages.length > 0) {
            var elem = $('#selectlanguage-list');
            elem.empty();
            for (var i=0; i<this.languages.length; i++) {
                var lang = this.languages[i];
                // if (lang["lang"].length > 2) { // Skip generic
                    var le = $('<a class="lang"><img class="icon-globe" /> '+nohtml(lang['name'])+'</a>');
                    le.on("click", this.setLanguage.bind(this, lang['lang'], true));
                    elem.append(le);
                // }
            }
            $('#selectlanguage').modal('show');
       }
    };

    /**
     * Translates a string.
     * @param {string} s
     * @param {Object.<string,string>=} replace
     * @return {string}
     */
    Client.prototype.translate = function(s, replace) {
        $('#selectlanguage').modal('hide');
        if (this.i18n.translations[s]) {
            s = this.i18n.translations[s];
        }
        if (typeof replace == 'object' && replace) {
            for (var i in replace) {
                if (replace.hasOwnProperty(i)) s = s.replace("%"+i+"%", replace[i]);
            }
        }
        return s;
    };

    /**
     * Sets the language.
     * @param {string} key Language key
     * @param {boolean=} redirect
     */
    Client.prototype.setLanguage = function(key, redirect) {
        // Grep the language
        $.getJSON("/assets/i18n/"+key+".json", function(data) {
            if (!data || !data["translations"]) return;
            this.i18n = data;
            
            // Translate inline
            for (var i=0; i<Client.I18N_E.length; i++) {
                var e = Client.I18N_E[i];
                if (e.size() == 0) continue;
                if (!e.attr("i18n-text")) {
                    e.attr("i18n-text", e.text());
                }
                e.text(this.translate(e.attr("i18n-text")));
            }
            document.title = "___wildcards - "+this.translate("A party game for horrible people.");
            $('#chat-input').attr("placeholder", this.translate("Type something..."));
            
        }.bind(this));
    };

    /**
     * Makes a black card by formatting the blanks.
     * @param {string} s
     * @return {string}
     */
    Client.makeBlack = function(s) {
        return s.replace(/[_]+/g, "_____");
    };

    /**
     * Gets a query string parameter.
     * @param {string} name Parameter name
     * @return {?string} Parameter value
     */
    Client.getQuery = function(name) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regexS = "[\\?&]" + name + "=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.search);
        if(results == null)
            return "";
        else
            return decodeURIComponent(results[1].replace(/\+/g, " "));
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

    /**
     * Sounds.
     * @type {*}
     */
    Client.SOUNDS = {
        "message": global.document.getElementById("sound-message"),
        "nudge": global.document.getElementById("sound-nudge")
    }
    
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
        $('#lang-selectlang'),
        $('#lang-selectlanguage'),
        $('#lang-chat')
    ];
    
    return Client;
    
})(this, io);

var client;
$(document).ready(function() {
    client = new Client();
});

// Because messing around with the history would break it.
window.oncontextmenu = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
};
document.onmousedown = function(e) {
    return e.which != 3;
};