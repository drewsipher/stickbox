'use strict';
// colors.js — the paint box. Every definition gets a palette: a body colour plus role colours
// (skin, cloth, hat, window, wing...) that the drawing templates ask for with p.use('role').
// Items can also list `seq`: one colour per filled shape, in drawing order.
(function () {
  const K = {
    red: '#e63946', darkred: '#a4262c', orange: '#f4862c', yellow: '#f6d13b', gold: '#f2b632', green: '#4caf50', dkgreen: '#2e7d32', lime: '#9ccc65',
    teal: '#26a69a', blue: '#3d7ee8', ltblue: '#89c4f4', navy: '#2c3e73', purple: '#8e44ad', violet: '#b57edc', pink: '#f28cb1', hotpink: '#e84393',
    brown: '#8b5a2b', dkbrown: '#4a3728', tan: '#d9b382', ltbrown: '#c69c6d', gray: '#9aa5b1', ltgray: '#cfd6dc', dkgray: '#4d5560', black: '#222',
    white: '#fff', cream: '#f5efe0', skin: '#f6d3b0', peach: '#f8c9a4', olive: '#7d8c3a', sand: '#e6cf9a', ice: '#cfeeff', slate: '#6c7a89', maroon: '#7a2e2e'
  };
  // default colours for roles that templates ask for
  SB.ROLES = {
    skin: K.skin, hair: '#5b3a1a', cloth: '#4a8fd9', cloth2: '#e05d5d', cape: '#c0392b', hat: '#c9402b', metal: '#b8c2cc', armor: '#5d6d7e', item: '#8b5a2b', wood: '#a8743d', straw: '#e6cf9a',
    gold: K.gold, gem: '#7ec8e3', saber: '#4cc9f0', balloon: '#e0475b', leather: '#8b4513', orange: '#e8772e', window: '#bfe6f8', wheel: '#333', belly: '#f7f1e3', beak: '#f2a83b',
    wattle: '#e63946', wing: '#eef4f8', batwing: '#3a3a3a', fairywing: '#e8f4ff', teeth: '#fff', paper: '#fff', nose: '#e0475b', bag: '#a8743d', apron: '#fff', shield: '#c0392b',
    tail: '#3fb7a5', fur: '#b58c72', mane: '#c98a2f', wool: '#f4f1ea', spike: '#e8e0c8', horn: '#f0e6d2', snout: '#f2c9b0', mouth: '#5a2a2a', shell: '#8b5a2b', sail: '#fff',
    candy: '#e0475b', book: '#3f6fb5', fin: '#a83a30', hood: '#3f8f4a', hoof: '#222', far: '#555', leg: '#555', telson: '#e0a030', stinger: '#2a1a10', dark: '#2b1d08'
  };
  // per-category defaults
  const CAT = {
    person: { body: K.white, skin: K.skin, cloth: '#4a8fd9', cloth2: '#e05d5d', hat: '#c9402b', hair: '#5b3a1a' },
    creature: { body: '#b0c4a0', skin: K.skin, cloth: '#6c7a89', cloth2: '#8e44ad', hat: '#4d5560', hair: '#3a2a1a', fur: '#b58c72' },
    animal: { body: K.tan }, vehicle: { body: '#dfe6ec' }, item: { body: K.cream }, boss: { body: K.gray }
  };
  // palettes by name: a string is just the body colour; an object sets roles too
  const P = {
    // animals
    dog: K.ltbrown, puppy: K.ltbrown, cat: '#b9b9b9', kitten: '#e8a25a', mouse: '#b3b3b3', rabbit: '#eeeeee', horse: '#8b5a2b', pony: '#e8c8e0', zebra: K.white, donkey: '#a6a6a6', cow: K.white, bull: '#5a3a28',
    pig: '#f4b6c2', sheep: { body: '#e8dccb', wool: '#f7f3ea' }, lamb: { body: '#e8dccb', wool: '#fbf8f2' }, goat: '#d8d0c0', llama: '#e9dcc4', camel: '#d2a55a', lion: { body: '#e0b04a', mane: '#a0621e' }, tiger: '#f28c28', cheetah: '#e9c46a',
    wolf: '#8c8c8c', fox: '#e8772e', bear: '#6b4a2b', 'polar bear': '#f4f4f4', panda: K.white, koala: '#9aa5b1', sloth: '#b3a27f', elephant: '#a6a6a6', giraffe: { body: '#f0c05a', horn: '#a0621e' }, deer: '#a5713a', moose: '#5a3a28',
    rhino: '#8f9aa5', hippo: '#8a7f9a', monkey: '#a5713a', gorilla: { body: '#3a3a3a', skin: '#4d4d4d' }, kangaroo: '#c69c6d', squirrel: '#b5651d', hamster: '#e8b96f', hedgehog: '#8b6b4a', raccoon: '#8c8c8c', skunk: K.black,
    turtle: { body: '#7cb342', shell: '#5a7a2a' }, crocodile: '#4f8a3a', lizard: '#7cb342', dinosaur: '#4f8a3a', raptor: '#8a9a3a', stegosaurus: { body: '#6b8e4e', spike: '#e0a83a' }, brontosaurus: '#7fa86b', godzilla: { body: '#3f6b4a', spike: '#b8d0a0' },
    dragon: { body: '#3f8f4a', spike: '#c9d5a0', wing: '#a83a30', horn: '#f0e6d2' }, unicorn: { body: K.white, mane: '#f28cb1', horn: K.gold }, pegasus: { body: K.white, wing: '#f4f4f4' },
    bird: '#5aa9d6', crow: K.black, eagle: '#6b4a2b', owl: '#a5713a', parrot: { body: '#3fb44a', wing: '#e63946' }, duck: { body: '#f6d13b', beak: '#f4862c' }, chicken: { body: K.white, wattle: K.red }, rooster: { body: '#c0392b', wattle: K.red },
    chick: '#f6d13b', penguin: { body: K.black, belly: K.white }, flamingo: '#f28cb1', ostrich: '#4d4d4d', turkey: '#6b4a2b', peacock: { body: '#1f6fb2', wing: '#26a69a' }, hummingbird: '#26a69a', bat: { body: '#3a3a3a', batwing: '#3a3a3a' },
    bee: { body: '#f6d13b', wing: '#eef4f8' }, fly: '#6c7a89', mosquito: '#8c8c8c', butterfly: { body: '#4d4d4d', wing: '#f4862c' }, moth: { body: '#a58a5a', wing: '#d9c39a' }, spider: '#3a2a1a', ant: '#5a2a1a', ladybug: K.red, beetle: '#2e5a2e', scarab: '#2e7d5a',
    snail: { body: '#d9b382', shell: '#8b5a2b' }, worm: '#f4a6a6', caterpillar: '#7cb342', grasshopper: '#8bc34a', dragonfly: '#26a69a', scorpion: '#c69c6d',
    fish: '#5aa9d6', goldfish: '#f4862c', clownfish: '#f4862c', shark: '#8f9aa5', whale: '#4a6fa5', dolphin: '#7a9cc6', octopus: '#8e44ad', crab: K.red, lobster: '#c0392b', jellyfish: '#e8a2d8', starfish: '#f4862c', seahorse: '#f6d13b', pufferfish: '#e9c46a',
    snake: '#4f9b3f', cobra: '#c69c6d', rattlesnake: '#b58c5a', python: '#6b8e4e', frog: '#4caf50',
    // people (skin/cloth/hat overrides)
    police: { cloth: '#2c3e73', hat: '#2c3e73', cloth2: '#f2b632' }, doctor: { cloth: K.white, apron: K.white }, firefighter: { cloth: '#c9402b', hat: '#f6d13b' }, chef: { cloth: K.white, apron: K.white, hat: K.white },
    farmer: { hat: '#c69c6d', cloth: '#3d7ee8' }, cowboy: { hat: '#8b5a2b' }, astronaut: { cloth: K.white, hat: K.white, cloth2: K.white }, teacher: { cloth: '#8e44ad', book: '#c0392b' }, scientist: { apron: K.white, cloth: K.white },
    soldier: { hat: '#5a6b3a', cloth2: '#5a6b3a', cloth: '#5a6b3a' }, builder: { hat: '#f6d13b', cloth: '#f4862c' }, mailman: { hat: '#3d7ee8', bag: '#a8743d' }, clown: { hat: '#e63946', cloth2: '#3d7ee8', hair: '#e63946', balloon: '#f6d13b' },
    santa: { hat: '#e63946', cloth: '#e63946', hair: '#f4f4f4', bag: '#8b5a2b' }, king: { hat: K.gold, cloth: '#8e44ad', cape: '#8e44ad' }, queen: { hat: K.gold, cloth: '#8e44ad' }, prince: { hat: K.gold, cape: '#3d7ee8' }, princess: { hat: K.gold, cloth: '#f28cb1' },
    knight: { hat: '#b8c2cc', cloth: '#3b5ba5', shield: '#c0392b', metal: '#d0d8e0' }, ninja: { cloth: '#222', hat: '#222', hair: '#222' }, pirate: { hat: '#222', cloth: '#c0392b', hair: '#222' }, wizard: { hat: '#3f4fb5', cloth: '#3f4fb5', hair: '#e8e8e8' },
    witch: { hat: '#222', cloth: '#6a2c91', hair: '#222', skin: '#b8d8a0' }, superhero: { cloth: '#e63946', cape: '#3d7ee8', gold: K.gold }, detective: { hat: '#8b5a2b', cloth: '#8b5a2b' }, thief: { hat: '#222', cloth2: '#222', bag: '#8b5a2b' },
    dancer: { cloth: '#f28cb1', hair: '#5b3a1a' }, rockstar: { hair: '#e63946', cloth: '#222' }, 'football player': { hat: '#c0392b', cloth: '#c0392b' }, 'basketball player': { cloth: '#f4862c' }, 'soccer player': { hair: '#5b3a1a', cloth: '#3d7ee8' },
    'tennis player': { hat: K.white, cloth: K.white }, painter: { hat: '#222', cloth2: '#3d7ee8' }, viking: { hat: '#b8c2cc', hair: '#c69c6d', shield: '#a8743d' }, caveman: { hair: '#3a2a1a', cloth: '#a8743d' },
    'chicken suit': { hat: K.white }, elf: { hat: '#2e7d32', cloth: '#2e7d32' }, scarecrow: { hat: '#c69c6d', hair: '#e6cf9a', cloth: '#a8743d' }, robot: { metal: '#9aa5b1', body: '#9aa5b1' }, alien: { skin: '#7ed957', body: '#7ed957' },
    person: {}, woman: { cloth: '#e05d5d' }, boy: { hat: '#3d7ee8', cloth: '#3d7ee8' }, girl: { cloth: '#f28cb1' }, baby: { hair: '#e8b96f' }, grandma: { hair: '#e8e8e8', cloth: '#b57edc' }, grandpa: { hair: '#e8e8e8' }, dad: { cloth2: '#3d7ee8' },
    // creatures
    zombie: { skin: '#8fbf7a', hair: '#3a2a1a', cloth: '#6c7a89' }, ghost: '#f4f4ff', vampire: { skin: '#e8e8f0', cape: '#c0392b', cloth: '#222', cloth2: '#c0392b', hair: '#222' }, skeleton: { skin: '#f0ead6', body: '#f0ead6' },
    mummy: { skin: '#e6dcc4' }, monster: { fur: '#8e44ad', skin: '#8e44ad', body: '#8e44ad', horn: '#f0e6d2' }, werewolf: { body: '#6b5a4a', cloth: '#3b5ba5' }, ogre: { skin: '#7cb342', cloth: '#a8743d' }, giant: { cloth: '#a8743d', hair: '#8b5a2b' },
    cyclops: { skin: '#c69c6d' }, yeti: { fur: '#f4f4f4', skin: '#f4f4f4' }, devil: { skin: '#e63946', body: '#e63946' }, 'grim reaper': { cloth: '#222', skin: '#f0ead6' }, god: { cloth: K.white, hair: K.white, gold: K.gold },
    angel: { cloth: K.white, wing: '#fbfbfb', hair: '#f2b632', gold: K.gold }, fairy: { cloth: '#f28cb1', fairywing: '#e8f4ff', hair: '#f2b632' }, mermaid: { tail: '#3fb7a5', hair: '#e63946' }, genie: { skin: '#3d7ee8', body: '#3d7ee8', hair: '#222' },
    snowman: { body: K.white, hat: '#222' }, 'teddy bear': { fur: '#c69c6d', skin: '#c69c6d', body: '#c69c6d' },
    // vehicles
    car: '#e63946', 'race car': '#e63946', 'police car': K.white, taxi: '#f6d13b', limo: '#222', truck: '#3d7ee8', 'monster truck': '#2e7d32', 'fire truck': '#e63946', ambulance: K.white, bus: '#3d7ee8', 'school bus': '#f6d13b',
    'ice cream truck': '#f4f4f4', tractor: '#2e7d32', digger: '#f6d13b', tank: '#6b7a3a', train: '#c0392b', bike: '#e63946', motorcycle: '#222', scooter: '#26a69a', skateboard: '#8e44ad', plane: K.white, jet: '#6c7a89', helicopter: '#f4862c',
    rocket: { body: K.white, cloth2: '#e63946' }, ufo: '#9aa5b1', boat: { body: '#8b5a2b', sail: K.white }, ship: { body: '#5a3a28', sail: '#f5efe0' }, submarine: '#f6d13b', 'hot air balloon': { balloon: '#e63946', wood: '#a8743d' }, blimp: '#c0c0c0',
    // items (body colour unless a seq list gives one colour per shape)
    ball: '#e63946', 'soccer ball': K.white, basketball: '#e8772e', football: '#8b4513', 'tennis ball': '#c5e64a', 'bowling ball': '#222', 'beach ball': '#e63946', balloon: '#e63946', box: '#d9b382', rock: '#8c8c8c', brick: '#b5533c', anvil: '#4d5560',
    present: '#e63946', 'treasure chest': '#8b5a2b', coin: K.gold, diamond: '#a8e6ff', ring: K.gold, trophy: K.gold, crown: K.gold, key: K.gold, teddy: '#c69c6d', dice: K.white, kite: '#e63946', bubble: '#dff4ff', tire: '#333', barrel: '#8b5a2b',
    sword: '#c8d0d8', lightsaber: '#4cc9f0', shield: '#c0392b', hammer: '#9aa5b1', axe: '#9aa5b1', pickaxe: '#9aa5b1', shovel: '#9aa5b1', 'baseball bat': '#d9b382', wand: '#8b5a2b', stick: '#8b5a2b', bomb: '#333', dynamite: '#e63946', firework: '#e63946', cannon: '#4d5560',
    apple: '#e63946', banana: '#f6d13b', orange: '#f4862c', strawberry: '#e63946', watermelon: '#3fa34d', pizza: '#f4c542', cake: '#f28cb1', cupcake: '#f28cb1', cookie: '#c69c6d', 'ice cream': '#f28cb1', burger: '#d9a35a', 'hot dog': '#d9a35a', donut: '#f28cb1',
    candy: '#e63946', lollipop: '#e63946', carrot: '#f4862c', cheese: '#f6d13b', bone: K.cream, egg: K.white, bread: '#d9a35a', pie: '#d9a35a', sandwich: '#d9a35a', taco: '#f4c542', milk: K.white, honey: K.gold, acorn: '#8b5a2b', seed: '#8b5a2b',
    corn: '#f6d13b', grass: '#4caf50', mushroom: '#e63946', pumpkin: '#f4862c', bamboo: '#7cb342', tomato: '#e63946', coffee: '#6b4a2b', bottle: '#a8e6ff', flower: '#f28cb1', tree: '#4caf50', 'pine tree': '#2e7d32', 'palm tree': '#4caf50', bush: '#4caf50',
    cactus: '#4caf50', log: '#8b5a2b', leaf: '#4caf50', feather: K.white, snowball: K.white, ice: '#cfeeff', cloud: K.white, 'rain cloud': '#9aa5b1', sun: '#f6d13b', moon: '#f4e7a3', star: K.gold, rainbow: K.white, lightning: '#f6d13b', fire: '#ff8c1a',
    tornado: '#c0c8d0', 'black hole': '#222', planet: '#5aa9d6', meteor: '#8c8c8c', house: '#f3dcb8', castle: '#c9c9c9', barn: '#c0392b', tent: '#f4862c', igloo: '#e8f6ff', skyscraper: '#9aa5b1', school: '#e0a35a', temple: '#e8e0c8', trap: '#8c8c8c', fence: '#d9b382',
    door: '#8b5a2b', ladder: '#d9b382', sign: '#d9b382', flag: '#e63946', grave: '#8c8c8c', chair: '#a8743d', table: '#a8743d', bed: '#3d7ee8', couch: '#8e44ad', pillow: K.white, tv: '#4d5560', phone: '#222', computer: '#9aa5b1', clock: K.white,
    lamp: '#f6d13b', candle: K.cream, torch: '#8b5a2b', guitar: '#c0392b', drum: '#e63946', piano: '#222', radio: '#c0392b', camera: '#333', book: '#3f6fb5', pencil: '#f6d13b', umbrella: '#e63946', hat: '#8b5a2b', boot: '#8b5a2b', glasses: '#222',
    bucket: '#3d7ee8', toilet: K.white, bell: K.gold, fan: '#9aa5b1', magnet: '#e63946', trampoline: '#3d7ee8', potion: '#8e44ad', skull: K.cream, heart: '#e63946', 'soccer net': K.white, poop: '#6b4a2b', trash: '#9aa5b1', battery: '#f6d13b', 'spring toy': '#3d7ee8',
    fireball: '#ff8c1a', web: '#f4f4f4', icicle: '#cfeeff', venom: '#7bd88f', stinger: '#e0a030',
    // bosses
    kraken: { body: '#c94a3d', fin: '#a83a30', beak: '#3b2416' }, 'mega robot': { body: '#aab4be', armor: '#5d6d7e', metal: '#d0d8e0' }, 'king kong': { body: '#3d2b1f', skin: '#b58c72', gold: K.gold, mouth: '#5a2a2a' },
    hydra: { body: '#3f8f4a', spike: '#c9d5a0', horn: '#f0e6d2', mouth: '#7a2e2e' }, 'lava golem': { body: '#3d3d3d' }, 'giant spider': { body: '#3a2a22' }, 'giant moth': { body: '#b07d4a', wing: '#f2e2b0' }, 'ice golem': { body: '#cfeeff', spike: '#eef8ff' },
    'giant snake': { body: '#4f9b3f', belly: '#d8e8a0', hood: '#3f7d34', mouth: '#7a2e2e' },
    'giant angry bull': { body: '#4a2c1c', far: '#2e1b11', hoof: '#1b1b1b', horn: '#efe4cc', snout: '#7a5444', hair: '#24160d' },
    'beetle swarm': { body: '#1f5f45', dark: '#1a1a1a', horn: '#2a1a10', far: '#123a2a', gold: '#f2b632' },
    'wasp swarm': { body: '#f6c90e', dark: '#2b1d08', wing: '#eef6ff', gold: '#f2b632' },
    'giant scorpion': { body: '#7a3519', far: '#4f200e', leg: '#62290f', telson: '#e8a33a', stinger: '#2a1a10' }
  };
  // one colour per filled shape, in the order the item draws them
  const SEQ = {
    tree: ['#8b5a2b', '#4caf50'], house: ['#f3dcb8', '#c0392b', '#8b5a2b', '#8b5a2b', '#bfe6f8', '#bfe6f8'], flower: ['#4caf50', '#4caf50', '#f28cb1', '#f28cb1', '#f28cb1', '#f28cb1', '#f28cb1', '#f28cb1', '#f6d13b'],
    present: ['#e63946', '#f2b632', '#f2b632', '#f2b632'], bomb: ['#333', '#8c8c8c', '#f6d13b'], balloon: ['#e63946', '#e63946'], lamp: ['#6c7a89', '#f6d13b'], tent: ['#f4862c', '#8b3a0f'], bed: ['#8b5a2b', '#3d7ee8', '#fff'],
    tv: ['#4d5560', '#bfe6f8'], phone: ['#222', '#bfe6f8'], bucket: ['#3d7ee8', '#7ec8e3'], castle: ['#c9c9c9', '#c9c9c9', '#c9c9c9', '#8b5a2b'], 'soccer ball': ['#fff'], 'rain cloud': ['#9aa5b1'], 'ice cream': ['#e8b96f', '#f28cb1', '#fff'],
    fire: ['#ff8c1a'], mushroom: ['#e6dcc4', '#e63946'], cake: ['#f28cb1', '#fff', '#e63946'], trampoline: ['#3d7ee8'], 'treasure chest': ['#8b5a2b', '#f2b632'], flag: ['#8c8c8c', '#e63946']
  };
  for (const n of SB.ORDER) {
    const d = SB.DEFS[n];
    const own = P[n]; const cat = CAT[d.cat] || {};
    d.pal = Object.assign({}, cat, typeof own === 'string' ? { body: own } : (own || {}));
    if (!d.pal.body) d.pal.body = cat.body || '#fff';
    if (SEQ[n]) d.seq = SEQ[n];
  }
})();
