var Teaser = (function(global) {

    /**
     * Constructs a new Teaser.
     * @param {HTMLElement} container
     * @param {Object.<string,Array.<string>>=} cards
     * @constructor
     */
    var Teaser = function(container, cards) {
        /** @type {HTMLElement} */
        this.container = container;
        
        /** @type {Object.<string, Array.<string>>} */
        this.cards = cards || Teaser.DEFAULT_CARDS;
        
        /** @type {Array.<string>} */
        this.blacks = [];
        for (var i in this.cards) { // Object.keys
            if (this.cards.hasOwnProperty(i)) {
                this.blacks.push(i);
            }
        }
        
        /** @type {number} */
        this.blackIndex = 0;
        
        /** @type {number} */
        this.whiteIndex = 0;
        
        /** @type {*} */
        this.timer = null;
    };

    /**
     * Default cards.
     * @type {Object.<string,Array.<string>>=}
     */
    Teaser.DEFAULT_CARDS = {
        "Next from J.K. Rowling: Harry Potter and the Chamber of _____ .":
            ["A sausage festival.", "Raping and pillaging.", "Laying an egg.", "BATMAN!!!", "Alcoholism."]
    };

    /**
     * Starts animating.
     */
    Teaser.prototype.start = function() {
        this.stop();
        this.timer = setTimeout(this.animate.bind(this), 1);
    };

    /**
     * Stops animating.
     */
    Teaser.prototype.stop = function() {
        if (this.timer != null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    };

    /**
     * Animates the cards.
     */
    Teaser.prototype.animate = function() {
        // Current black card and white cards belonging to it
        var black = this.blacks[this.blackIndex];
        var whites = this.cards[black];
        // Display elements
        var b = $('<div class="card card-black"></div>').text(Client.translate(black));
        var w = $('<div class="card card-white"></div>').text(Client.translate(whites[this.whiteIndex]));
        this.container.empty().append(b, w);
        w.transition({ "perspective": '1024px', "rotateY": '90deg', "duration": 0 }).
          transition({ "perspective": '1024px', "rotateY": '0deg', "duration": 200 }).
          transition({ "perspective": '1024px', "rotateY": '-90deg', "delay": 1700, "duration": 100 });
        if (whites.length > this.whiteIndex+1) {
            this.whiteIndex++; // Next white
        } else {
            // Actually incomplete, not yet used.
            this.blackIndex = (this.blackIndex+1)%this.blacks.length;
            this.whiteIndex = 0;
        }
        if (this.timer != null) {
            this.timer = setTimeout(this.animate.bind(this), 2050);
        }
    };
    
    return Teaser;
    
})(this);
