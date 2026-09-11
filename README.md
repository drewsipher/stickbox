# Stickbox

A Scribblenauts-style sandbox drawn entirely in black-and-white stick figures.
Type a word, it appears. Drag it, throw it, poke it, or drop it in the trash.

## Run it

No build step and no dependencies. Either:

* open `index.html` directly in any modern browser, or
* serve the folder (e.g. `python3 -m http.server 8000`) and visit http://localhost:8000

## Play

* **Type** a word and press Enter (or click *Create!*). Autocomplete chips appear as you type; Tab accepts the first one.
* **Adjectives** work: `giant dog`, `tiny flying pig`, `angry robot`, `sleepy cat`, `fast zombie horse`, `bouncy invisible ball`.
* **Drag** anything with the mouse or a finger. Let go while moving to **throw** it.
* **Click** something to poke it (creatures talk and hop; bombs, rockets, cannons, presents, chests, potions, cameras and graves do their thing).
* **Delete** by dropping something on the trash can in the bottom-right corner, or hover and press Delete.
* **Random** makes a surprise, **Clear** empties the world, **? Words** lists every word and adjective.

Creatures react to your cursor: shy animals run from it, friendly ones follow it, monsters chase it, and everything watches it.

## Battle mode

The **Battle** button (on by default, remembered per browser) makes every creature attack everything that isn't its
own kind: a dog fights cats, knights, dragons and robots, but never another dog. Natural prey and whoever hit them last
are preferred targets, and victims fight back instead of running. Each hit deals damage based on the attacker's size
(a dinosaur flattens a person in a couple of stomps, a bee needs many stings); a creature with no health left is
**knocked out** and lies on the ground with a "K.O.!". Click a knocked-out creature to revive it at full health, let an
ambulance reach it, drop it in the trash, or press **Clear K.O.** (next to Battle, shows how many are down) to sweep
them all into the trash at once. Predators still eat things they'd normally eat.

Switch Battle off for the peaceful sandbox: animals hunt and flee each other naturally (cats chase mice, dogs chase
cats, knights fight dragons, zombies turn people into zombies) and nobody else picks fights.

## Fire

Campfires, torches, candles, lava and dragon breath hurt. Touching fire costs a point of health and sets the creature
**on fire**: it runs around in a panic with flames on it for a couple of seconds, losing more health, and can be
knocked out. Water (bucket, pool, hose), a rain cloud overhead, or anything cold (snow, ice, igloo) puts it out.
Dragons, ghosts, devils, gods and angels are fireproof; snowmen and ice cream melt instead. Pick up a torch and poke
things with it if you're feeling mean.

## Wish list (unknown words)

Anything typed that the game doesn't recognize becomes a labeled box **and** is recorded, with a count and the full
phrases people typed, so it can be added to the dictionary later. The list lives in the browser's localStorage
(per browser, survives reloads) and is shown under **? Words → Words I don't know yet**, with *Copy*, *Download*
(`stickbox-wishlist.txt`) and *Clear* buttons. Words that later get added to the dictionary drop off the list automatically.

From the browser console: `SB.unknownWords()`, `SB.exportUnknown()`, `SB.clearUnknown()`.

## Code layout

| File | What it does |
| --- | --- |
| `js/pen.js` | Sketchy hand-drawn line renderer with a "boiling" wobble |
| `js/draw.js`, `js/draw2.js` | Procedural stick-figure templates (people, animals, birds, bugs, fish, vehicles) |
| `js/dictionary.js` | Word registry, adjectives, plural/typo handling, autocomplete |
| `js/words-*.js` | The ~350 definitions (animals, people & creatures, vehicles, items) |
| `js/entity.js` | Entity state and the AI brain (temperaments, hunting, fleeing, wander/hop/fly/flop) |
| `js/game.js` | Physics, collisions, specials (bombs, fire, tornado, UFO beam...), particles, input, trash bin, UI, render loop |

Adding a word is one line in a `words-*.js` file, e.g.

```js
A('otter', M(prey, { t: D.quad({ bodyW: 30, bodyH: 12, legLen: 8, tail: 'thick', whiskers: true }), speed: 120, say: ['Squeak!'] }));
```
