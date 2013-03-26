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

// Includes
var Server = require(__dirname+"/../server/Server.js"),
    fs = require("fs"),
    pkg = require(__dirname+"/../package.json");

// Super banner :-)
console.log(
    ".-.-.-..-..-.   .--. .---..---..---. .--. .---.\n"+
    "| | | || || |__ | \\ \\| |  | | || |-< | \\ \\ \\ \\    by dcode.io\n"+
    "`-----'`-'`----'`-'-'`---'`-^-'`-'`-'`-'-'`---'   v "+pkg.version
);

// Setup
var keys = "dev", // SSL/TLS key pair to use
    server = new Server({
        "key"  : fs.readFileSync(__dirname+"/../certs/"+keys+"_key.pem"),
        "cert" : fs.readFileSync(__dirname+"/../certs/"+keys+"_cert.pem")
    });

// Configuration
server.listen(8000, "0.0.0.0"). // HTTP
       listen(8001, "0.0.0.0", true). // HTTPS
       start(); // And start...

// Reload languages every 10 minutes
setInterval(function() {
    server.reload();
}, 10*60000);
