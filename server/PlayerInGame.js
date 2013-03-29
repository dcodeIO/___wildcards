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

var Player = require(__dirname+"/Player.js");

/**
 * Constructs a new PlayerInGame.
 * @class Represents a Player participating in a Game.
 * @param {Player|{id: string, name: string}} player Player instance if connected, else an id/name pair
 * @constructor
 */
var PlayerInGame = function(player) {
    
    /**
     * Player id.
     * @type {string}
     */
    this.id = player["id"];
    
    /**
     * Player name
     * @type {string}
     */
    this.name = player["name"];
    
    
    /**
     * Player instance. Set only if connected.
     * @type {Player|null}
     */
    this.player = (player instanceof Player) ? player : null;
    
    /**
     * Number of black cards received (score).
     * @type {number}
     * */
    this.score = 0;

    /**
     * White cards to select from.
     * @type {Array.<string>}
     */
    this.whites = [];
};

/**
 * Tests if the player is connected.
 * @returns {boolean}
 */
PlayerInGame.prototype.isConnected = function() {
    if (this.player !== null) return this.player.isConnected();
    return false;
};

/**
 * Sends an event to this player.
 * @param {string} name Event name
 * @param {*} data Event data
 * @return {boolean} true if successfully sent, false if not connected
 */
PlayerInGame.prototype.send = function(name, data) {
    if (!this.isConnected()) {
        return false;
    }
    this.player.socket.emit(name, data);
    return true;
};

/**
 * Gets the JSON payload of this PlayerInGame.
 * @return {{id: string, name: string, connected: boolean}}
 */
PlayerInGame.prototype.toJSON = function() {
    // Mimics Player#toJSON
    return {
        "id": this.id,
        "name": this.player ? this.player["name"] : this.name,
        "score": this.score,
        "connected": this.isConnected()
    };
};

/**
 * Gets a string representation of this instance.
 * @returns {string}
 */
PlayerInGame.prototype.toString = function() {
    return this.id+"/"+this.name+"["+this.isConnected()+"]";
};

module.exports = PlayerInGame;
