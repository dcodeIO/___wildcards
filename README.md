___wildcards - A party game for horrible people.
================================================
Whether you already know the original [Cards Against Humanity](http://www.cardsagainsthumanity.com/) or not, you should
have played it at least once. Played with the right people, it's a real blast.

So I've decided to implement a cross-platform version of it just for the thrill of it. And you are invited to contribute!

* [Try out the game!](http://www.wildcardsgame.com)

How to contribute
-----------------
Each language is defined inside a subdirectory of the form "language[-COUNTRY]" in the data/ directory and contains the
following UTF8-encoded files:

* info.json - General information about the language, including its name and optionally UI translations
* black.txt - Black cards, one per line, blanks defined through a single "_"
* white.txt - White cards, one per line

#### info.json ####
This file contains the general information about the language:

* name - Language name
* extends - Another language that is extended by this one (e.g. "de-DE" with special "de" cards for Germany)
* translations - An object containing UI translations

* Example: [de-DE](https://github.com/dcodeIO/wildcardsgame/blob/master/data/de-DE/info.json), [de](https://github.com/dcodeIO/wildcardsgame/blob/master/data/de/info.json)

Later on these files are compiled down to a single JSON file for usage with the server and an i18n file used for
inline-translating the client. Therefore, it's super simple to create or extend a language with even more fun. Simply
send a pull request.

What can I say, that's quite everything about it :-)

License
-------
Creative Commons BY-NC-SA 2.0 - http://creativecommons.org/licenses/by-nc-sa/2.0/
