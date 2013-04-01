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
 * Constructs a new Cards database.
 * @class Represents Cards for a specific language.
 * @param {string} lang Language key
 * @param {string|null} ext Extended language
 * @param {string} name Language name
 * @param {Array.<string>} black Black cards
 * @param {Array.<string>} white White cards
 * @constructor
 */
var Cards = function(lang, ext, name, black, white) {

    /**
     * Language key.
     * @type {string}
     */
    this.lang = lang;

    /**
     * Extended language.
     * @type {string|null}
     */
    this.ext = ext;

    /**
     * Language name.
     * @type {string}
     */
    this.name = name;

    /**
     * Black cards available.
     * @type {Array.<string>}
     */
    this.black = black;

    /**
     * White cards available.
     * @type {Array.<string>}
     */
    this.white = white;
};

/**
 * Data base directory.
 * @type {string}
 */
Cards.BASEDIR = __dirname+"/../data";

/**
 * Picks a black card and removes it from the database.
 * @return {string|null} Null if there are no more black cards
 */
Cards.prototype.pickBlack = function() {
    if (this.black.length == 0) return null;
    var r; do { r = Math.random(); } while (r == 1.0);
    var i = parseInt(r*this.black.length);
    var card = this.black[i];
    this.black.splice(i, 1);
    return card;
};

/**
 * Picks a white card and removes it from the database.
 * @return {string|null} Null if there are no more white cards
 */
Cards.prototype.pickWhite = function() {
    if (this.white.length == 0) return null;
    var r; do { r = Math.random(); } while (r == 1.0);
    var i = parseInt(r*this.white.length);
    var card = this.white[i];
    this.white.splice(i, 1);
    return card;
};

/**
 * Clones the Cards.
 * @return {!Cards}
 */
Cards.prototype.clone = function() {
    return new Cards(this.lang, this.ext, this.name, this.black.slice(), this.white.slice());
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
 * Shuffles the Cards.
 * @return {!Cards} this
 */
Cards.prototype.shuffle = function() {
    this.black.shuffle();
    this.white.shuffle();
    return this;
};

/**
 * Returns a string representation of this instance.
 * @returns {string}
 */
Cards.prototype.toString = function() {
    return this.lang+"/"+this.black.length+":"+this.white.length;
};

/**
 * Loads the Cards database of the given language.
 * @param {string} lang Language key
 * @param {function(Error|null, Cards=)} callback Callback
 */
Cards.load = function(lang, callback) {
    var fs = require("fs");
    fs.readFile(Cards.BASEDIR+"/"+lang+".json", function(err, data) {
        if (err) {
            callback(err);
            return;
        }
        try {
            data = JSON.parse(data);
            callback(null, new Cards(lang, data["extends"] || null, data["name"], data["black"], data["white"]));
        } catch (err) {
            callback(err);
        }
    });
};

/**
 * Loads cards of all languages.
 * @param {function(Error|null, Object.<string,Cards>=)} callback Callback
 */
Cards.loadAll = function(callback) {
    var fs = require("fs");
    
    var running = 0; // Number of running tasks
    var all = {}; // Loaded Cards by language key
    var errors = 0; // Number of errors
    var to = null;
    
    fs.readdir(Cards.BASEDIR, function(err, files) {
        if (err) {
            callback(err);
            return;
        }
        for (var i=0; i<files.length; i++) {
            if (/\.json$/.test(files[i])) {
                (function(name) {
                    running++;
                    if (to != null) {
                        clearTimeout(to);
                        to = null;
                    }
                    Cards.load(name, function(err, cards) {
                        running--;
                        if (running == 0) {
                            setTimeout(done, 250);
                        }
                        if (err) {
                            errors++;
                            return;
                        }
                        all[name] = cards;
                    });
                })(files[i].substring(0, files[i].length-5));
            }
        }
    });
    
    // Done callback
    function done() {
        console.info("[Cards] Loaded "+Object.keys(all).length+" languages ("+errors+" failed)");
        callback(null, all);
    }
};

module.exports = Cards;
