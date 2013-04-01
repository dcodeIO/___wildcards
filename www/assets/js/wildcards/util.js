/**
 * Makes a black card by formatting the blanks.
 * @param {string} s
 * @return {string}
 */
function makeblack(s) {
    return s.replace(/[_]+[ ]?/g, "_____ ");
}

/**
 * Gets a query string parameter.
 * @param {string} name Parameter name
 * @return {?string} Parameter value
 */
function getquery(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(location.search);
    if(results == null)
        return null;
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "));
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
 * Logs a message if debugging is enabled.
 * @param {...string} var_args
 */
function log(var_args) {
    if (typeof DEBUG != 'undefined' && DEBUG && typeof console != 'undefined' && console.log)
        console.log.apply(console, arguments);
}

// Make it feel more like an app
/* window.oncontextmenu = function(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }
    return false;
}; */