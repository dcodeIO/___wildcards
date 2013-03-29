var teaser_cards = {
    "Next from J.K. Rowling: Harry Potter and the Chamber of _____ .":
        ["A sausage festival.", "Raping and pillaging.", "Laying an egg.", "BATMAN!!!", "Alcoholism."]
};
var teaser_blacks = Object.keys(teaser_cards);
var teaser_black = 0;
var teaser_white = 0;

function teaser_animate(elem) {
    var black = teaser_blacks[teaser_black];
    var whites = teaser_cards[black];
    var b = $('<div class="card card-black"></div>').text(client.translate(black));
    var w = $('<div class="card card-white"></div>').text(client.translate(whites[teaser_white]));
    elem.empty().append(b, w);
    w.transition({
        perspective: '1024px',
        rotateY: '90deg',
        duration: 0
    }).transition({
        perspective: '1024px',
        rotateY: '0deg',
        duration: 200
    }).transition({
            perspective: '1024px',
            rotateY: '-90deg',
            delay: 1700,
            duration: 100
        });
    if (whites.length > teaser_white+1) {
        // Next white card
        teaser_white++;
    } else {
        // Next black card
        teaser_black = 
        teaser_white = 0;
    }
    setTimeout(function() {
        teaser_animate(elem);
    }.bind(window), 2050);
}

$(document).ready(function() {
    teaser_animate($('#teaser-cards'));
});