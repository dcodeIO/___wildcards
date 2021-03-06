/*
 wildcards build script (c) 2013 Daniel Wirtz <dcode@dcode.io>

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
 * @license wildcardsgame Build Script (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Creative Commons Attribution-NonCommercial-ShareAlike 2.0 License
 * see: https://github.com/dcodeIO/wildcardsgame for details
 */

// Includes
var fs = require("fs");

/**
 * Data base directory.
 * @type {string}
 */
var BASEDIR = __dirname+"/../data";

/**
 * I18n base directory.
 * @type {string}
 */
var I18NDIR = __dirname+"/../www/assets/i18n";

/**
 * Parses a language file (.txt).
 * @param {string} filename
 * @param {boolean=} black true if black cards, false for white cards
 * @return {Array.<string>}
 */
function parse(filename, black) {
    var data = fs.readFileSync(filename);
    
    data = (""+data).
        replace(/\r/g, ""). // rm CR
        replace(/^\s+|\s+$/g, ""); // Trim
    if (data.length == 0) {
        return [];
    }
    data = data.split(/\n/g);
    var res = [];
    for (var i=0; i<data.length; i++) {
        var line = data[i];
        line = line.replace(/^\s+|\s+$/g, ""); // Trim
        if (line.length == 0 || line.charAt(0) == ';') continue; // Skip empty lines and comments
        if (black) {
            if (line.indexOf("_") < 0) {
                line += " _ ."; // Clean format
            }
            line = line.replace(/[_]+[ ]?/g, "_ "); // Format blanks
        }
        res.push(line);
    }
    return res;
}

/**
 * Merges two objects.
 * @param {Object} a
 * @param {Object} b
 * @return {Object}
 */
function merge(a, b) {
    a = a || {};
    b = b || {};
    var c = {}, i;
    for (i in a) if (a.hasOwnProperty(i)) c[i] = a[i];
    for (i in b) if (b.hasOwnProperty(i)) c[i] = b[i];
    return c;
}

// Process everything in /data
var files = fs.readdirSync(BASEDIR);
var i18n = {};
for (var i=0; i<files.length; i++) {
    var lang = files[i];
    if (lang.charAt(0) == '_') continue; // Skip
    var dirname = BASEDIR+"/"+lang;
    var stat = fs.statSync(dirname);
    if (stat.isDirectory()) {
        try {
            var data = JSON.parse(fs.readFileSync(dirname+"/info.json"));
            data["black"] =  parse(dirname+"/black.txt", true);
            data["white"] =  parse(dirname+"/white.txt", false);
            i18n[lang] = {
                "name": data["name"],
                "extends": data["extends"],
                "translations": data["translations"]
            };
            delete data["translations"];
            fs.writeFileSync(dirname+".json", JSON.stringify(data, null, 4));
            console.log("OK: "+files[i]);
        } catch (e) {
            console.log("ERROR: "+files[i]+" "+e);
        }
    }
}
console.log("Done.");

// Build i18n files
for (var lang in i18n) {
    process.stdout.write("i18n "+lang+": ");
    var l = i18n[lang];
    if (l["extends"]) {
        process.stdout.write("extends "+l["extends"]+", ");
        l["translations"] = merge(i18n[l["extends"]]["translations"], l["translations"]);
    }
    process.stdout.write("writing...");
    delete l["extends"];
    l["lang"] = lang;
    var data = JSON.stringify(l, null, 4);
    fs.writeFileSync(I18NDIR+"/"+lang+".json", data);
    console.log("done.");
}
