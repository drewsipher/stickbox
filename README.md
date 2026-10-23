# Stickbox

A Scribblenauts-style sandbox drawn in hand-drawn, full-colour stick figures.
Type a word, it appears. Drag it, throw it, poke it, or drop it in the trash.

## Run it

No build step and no dependencies. Either:

* open `index.html` directly in any modern browser, or
* serve the folder with `python3 tools/serve.py` (a tiny no-cache server, so reloads always get the latest files) and visit http://localhost:8000, or use any static server (`python3 -m http.server 8000`)

## Play

* **Type** a word and press Enter (or click *Create!*). Autocomplete chips appear as you type; Tab accepts the first one.
* **Adjectives** work: `giant dog`, `tiny flying pig`, `angry robot`, `sleepy cat`, `fast zombie horse`, `bouncy invisible ball`.
* **Drag** anything with the mouse or a finger. Let go while moving to **throw** it.
* **Click** something to poke it (creatures talk and hop; bombs, rockets, cannons, presents, chests, potions, cameras and graves do their thing).
* **Delete** by dropping something on the trash can in the bottom-right corner, or hover and press Delete.
* **Random** makes a surprise, **Bosses** summons a giant boss, **Clear** empties the world, **? Words** lists every word and adjective.

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

## Bosses

The **Bosses** button opens a panel with thirteen giant, powerful monsters. Click one to summon it (or just type its
name). Bosses have lots of health (a big bar with their name floats over them), shake the ground when they walk or
land, hit much harder than ordinary creatures, and each has a signature attack:

| Boss | Attack | Weak to |
| --- | --- | --- |
| **kraken** (giant octopus, sea monster) | grabs anything in reach with a tentacle and flings it across the sky; eats boats and ships | fire and anything hot |
| **mega robot** (giant robot, mech) | locks on, charges up and fires an eye laser that zaps and burns everything along its line | water, magnets, lightning |
| **king kong** (giant ape, giant gorilla) | beats its chest, leaps and ground-pounds, launching everything nearby; swats planes out of the sky | planes, jets, helicopters |
| **hydra** (three headed dragon) | breathes fire from all three heads and slowly heals itself | snow, ice, anything cold |
| **lava golem** (lava monster, rock monster) | sets everything it touches on fire and lobs exploding fireballs | water, rain, snow, ice |
| **giant spider** (huge spider, spider queen) | spits sticky webs that wrap prey so it can't move (click to free it), bites with dizzying venom, hatches spiderlings | fire, and a stomp from a boot or shoe |
| **giant moth** (mothra, moth queen) | flies; fires prism beams from its antennae at long range and beats its wings into a gale of poison scales that sweeps the ground | fire and cold (it's drawn to lamps and torches) |
| **ice golem** (frost giant, ice monster) | hurls icicle volleys that freeze whatever they hit and breathes a blizzard; fireproof, snuffs out fires and burning things on touch, and its cold hurts the lava golem, hydra and moth | hammers, pickaxes, bats and bowling balls (cannonballs) |
| **giant snake** (giant cobra, basilisk) | spits venom at long range, breathes a poison cloud up close, and every bite poisons: poisoned creatures turn green, slow down and lose health until it wears off (doctors, ambulances and water cure it) | cold, eagles, and music (snake charmers) |
| **giant angry bull** (angry bull, raging bull, bull boss) | paws the ground and snorts steam, then charges across the screen tossing everything in its path; rears up and stomps anything close | charging into trees, houses and walls (it knocks itself silly), and cowboys |
| **giant scorpion** (three tailed scorpion, scorpion king) | pincer snap that flings enemies over its back, a triple sting from its three tails, and poison stingers at long range; every sting poisons | a stomp with a boot or shoe, cold, and chickens |
| **wasp swarm** (wasps, swarm, killer bees, hornets) | a crowned queen leads a swarm of individually flying wasps that splits up to mob up to three enemies, stinging over and over; the queen hatches new wasps | fire, smoke, water and rain (wasps die flying into them), cold, fans, explosions, and **clicking on wasps swats them** |
| **beetle swarm** (beetles, bugs, cockroaches, beetle king) | a king rhinoceros beetle leads a carpet of armored beetles that crawl across the ground, climb up their victims and bite, mob up to three enemies, and fly after anything in the air | stomps (boots, shoes, ground-pounds), chickens, birds and frogs (they eat beetles), water, rain and fire; a click cracks a beetle's shell, a second click squashes it |

Typing `boss` (or `bosses`) summons a random one. A boss that gets knocked out poops itself: a stinky pile flies out behind it with a big PLOP! The **Poop** button switches this off for younger players: no boss poop, the word `poop` makes nothing, and any poop on screen is cleaned up (remembered per browser). `angry bull` is the boss; `giant bull` is still an ordinary bull made bigger, and the boss is larger. Touching a boss's weakness deals heavy damage and stuns it ("WEAKNESS!"). Explosions (bombs, meteors, fireballs)
now damage creatures too, so cannons and bombs are a fair way to fight a boss, as is an army of knights. Bosses fight
each other in Battle mode. Adjectives still work (`tiny kraken`, `angry hydra`), but a boss never grows past 1.5×.
`fireball`, `web` and `icicle` are also words: the fireball explodes when it lands, the web traps whatever touches it, the icicle freezes whoever it hits. A **frozen** creature is stuck in a block of ice for a few seconds (click it to shatter the ice, or fire thaws it); hitting it while frozen does extra damage.

Boss drawings, definitions and attacks live in `js/bosses.js`; attacks are registered in `SB.SPECIALS` and run by
the game loop, and `def.weak` lists the tags that hurt each boss.

## Fights and sound

Hits land with comic-book punch: the attacker lunges (people swing their arm or weapon), a swing arc flashes, the
victim flashes red, shakes and squashes, a damage number pops up, and a starburst says POW!, BAM! or WHAM! on big
hits. Big hits and knockouts freeze the action for a split second. Health bars show the damage just taken as a yellow
strip that drains away, and creatures knocked flying leave speed lines.

Every action has a sound effect, all synthesized live in the browser (no audio files): punches, heavy blows, knockouts,
explosions, lasers, fire, freezing and shattering, venom, webs, boss roars and footsteps, the bull's snort, bellow and
thundering charge, the scorpion's screech, pinch and sting, and more. Sounds pan left and right with the action.
The **Sound** button turns them on or off (remembered per browser). Browsers only allow sound after the first click or
key press, so the game is silent until you interact with it. Code: `js/sound.js`.

## Wish list (unknown words)

Anything typed that the game doesn't recognize becomes a labeled box **and** is recorded, with a count and the full
phrases people typed, so it can be added to the dictionary later. The list lives in the browser's localStorage
(per browser, survives reloads) and is shown under **? Words → Words I don't know yet**, with *Copy*, *Download*
(`stickbox-wishlist.txt`) and *Clear* buttons. Words that later get added to the dictionary drop off the list automatically.

From the browser console: `SB.unknownWords()`, `SB.exportUnknown()`, `SB.clearUnknown()`.

If the list is in Chrome on this machine, `python3 tools/wishlist_from_chrome.py` prints every saved list (per profile and per
origin, e.g. `file://`, `http://localhost:8000` or a LAN host) straight from Chrome's storage files, no browser needed.

## Code layout

| File | What it does |
| --- | --- |
| `js/pen.js` | Sketchy hand-drawn line renderer with a "boiling" wobble |
| `js/draw.js`, `js/draw2.js` | Procedural stick-figure templates (people, animals, birds, bugs, fish, vehicles) |
| `js/dictionary.js` | Word registry, adjectives, plural/typo handling, autocomplete |
| `js/words-*.js` | The ~350 definitions (animals, people & creatures, vehicles, items) |
| `js/sound.js` | Synthesized sound effects (Web Audio) and the Sound on/off switch |
| `js/colors.js` | The paint box: a palette (body colour plus role colours like skin, cloth, hat, window, wing) for every definition |
| `js/bosses.js` | The thirteen giant bosses: drawings, definitions, signature attacks and weaknesses |
| `js/entity.js` | Entity state and the AI brain (temperaments, hunting, fleeing, wander/hop/fly/flop) |
| `js/game.js` | Physics, collisions, specials (bombs, fire, tornado, UFO beam...), particles, input, trash bin, UI, render loop |

Adding a word is one line in a `words-*.js` file, e.g.

```js
A('otter', M(prey, { t: D.quad({ bodyW: 30, bodyH: 12, legLen: 8, tail: 'thick', whiskers: true }), speed: 120, say: ['Squeak!'] }));
```
