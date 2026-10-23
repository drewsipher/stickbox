'use strict';
// words-vehicles.js — cars, trucks, planes, boats and other machines.
(function () {
  const D = SB.D, M = SB.merge;
  const V = (name, spec) => SB.def(name, M({ cat: 'vehicle', creature: false, move: 'drive', speed: 160, temper: 'neutral', mass: 15, tags: ['vehicle', 'machine', 'metal'], bounce: 0.15, friction: 2, say: ['Honk!', 'Beep beep!'], hunts: [], fears: [], eats: [] }, spec));

  V('car', { t: D.vehicle('car'), aliases: ['auto', 'automobile', 'sedan', 'jeep', 'van', 'minivan', 'hatchback', 'vehicle', 'suv', 'convertible', 'toy car'], say: ['Honk!', 'Beep beep!', 'Vroom!'] });
  V('race car', { t: D.vehicle('racecar'), aliases: ['racecar', 'racing car', 'sports car', 'formula one', 'f1 car', 'ferrari', 'lamborghini', 'supercar'], speed: 400, say: ['VROOOM!', 'Zoom!'] });
  V('police car', { t: D.vehicle('police'), aliases: ['cop car', 'squad car', 'patrol car', 'police cruiser'], speed: 260, tags: ['hero'], hunts: ['villain', 'thief'], say: ['Wee-woo wee-woo!', 'Pull over!'] });
  V('taxi', { t: D.vehicle('taxi'), aliases: ['cab', 'taxi cab', 'taxicab', 'uber'], speed: 170, say: ['Where to?', 'Honk!', 'Meter\'s running!'] });
  V('limo', { t: D.vehicle('limo'), aliases: ['limousine', 'stretch limo'], speed: 120, mass: 25, say: ['Honk!', 'Very fancy!'] });
  V('truck', { t: D.vehicle('truck'), aliases: ['lorry', 'garbage truck', 'pickup', 'pickup truck', 'semi', 'delivery truck', 'moving truck', 'big rig', 'trash truck', 'dump truck', '18 wheeler'], speed: 130, mass: 40, say: ['HONK HONK!', 'Rumble rumble'] });
  V('monster truck', { t: D.vehicle('monstertruck'), aliases: ['bigfoot truck', 'monster car'], speed: 220, mass: 35, bounce: 0.5, jumpy: 0.5, jump: 500, say: ['VROOOOM!', 'CRUSH!', 'GRAAAVE DIGGER!'] });
  V('fire truck', { t: D.vehicle('firetruck'), aliases: ['firetruck', 'fire engine', 'fire engine truck'], speed: 200, mass: 45, tags: ['hero'], hunts: ['fire'], special: 'extinguish', say: ['Wee-oo wee-oo!', 'Coming through!', 'Psssh!'] });
  V('ambulance', { t: D.vehicle('ambulance'), aliases: ['emergency vehicle'], speed: 220, mass: 30, tags: ['hero'], hunts: ['dizzy'], special: 'heal', say: ['Wee-oo wee-oo!', 'Make way!'] });
  V('bus', { t: D.vehicle('bus'), aliases: ['coach', 'city bus', 'double decker', 'tour bus'], speed: 120, mass: 60, say: ['Honk!', 'All aboard!', 'Next stop!'] });
  V('school bus', { t: D.vehicle('bus', { school: true }), aliases: ['schoolbus'], speed: 120, mass: 60, say: ['Honk!', 'All aboard!', 'Wheels on the bus!'] });
  V('ice cream truck', { t: D.vehicle('icecreamtruck'), aliases: ['icecream truck', 'ice cream van'], speed: 70, mass: 30, tags: ['food truck'], say: ['Ding ding ding!', '♪ Ice cream! ♪', 'Get your ice cream!'] });
  V('tractor', { t: D.vehicle('tractor'), aliases: ['farm tractor'], speed: 50, mass: 30, tags: ['farm'], special: 'smoke', say: ['Putt putt putt', 'Chug chug'] });
  V('digger', { t: D.vehicle('digger'), aliases: ['excavator', 'bulldozer', 'backhoe', 'construction vehicle', 'crane'], speed: 40, mass: 50, special: 'smoke', say: ['Rumble!', 'Dig dig dig'] });
  V('tank', { t: D.vehicle('tank'), aliases: ['army tank', 'panzer'], speed: 60, mass: 100, special: 'cannon', say: ['*rumble*', 'Clank clank', 'BOOM!'], hint: 'Click it to fire!' });
  V('train', { t: D.vehicle('train'), aliases: ['choo choo', 'locomotive', 'steam train', 'steam engine', 'engine', 'railway', 'thomas', 'choo choo train'], speed: 200, mass: 120, special: 'smoke', say: ['Choo choo!', 'Toot toot!', 'All aboard!', 'Chugga chugga'] });
  V('bike', { t: D.vehicle('bike'), aliases: ['bicycle', 'cycle', 'bmx', 'mountain bike', 'tricycle', 'cyclist'], speed: 180, mass: 4, tags: ['human'], fears: ['scary', 'predator'], say: ['Ring ring!', 'On your left!', 'Wheee!'] });
  V('motorcycle', { t: D.vehicle('motorcycle'), aliases: ['motorbike', 'motor bike', 'dirt bike', 'harley', 'moped', 'biker'], speed: 320, mass: 8, tags: ['human'], say: ['VROOOM!', 'Braaap!'] });
  V('scooter', { t: D.vehicle('scooter'), aliases: ['kick scooter', 'push scooter'], speed: 140, mass: 3, tags: ['human'], say: ['Wheee!', 'Ring ring!'] });
  V('skateboard', { t: D.vehicle('skateboard'), aliases: ['skater', 'skate board', 'longboard'], speed: 170, mass: 3, tags: ['human'], jumpy: 0.4, jump: 380, say: ['Radical!', 'Kickflip!', 'Gnarly!'] });
  V('plane', { t: D.vehicle('plane'), aliases: ['airplane', 'aeroplane', 'aircraft', 'propeller plane', 'passenger plane', 'jumbo jet', 'airliner', 'biplane'], move: 'fly', cruise: true, speed: 300, mass: 25, say: ['Nyoooom!', 'Fasten your seatbelts!'], flyMin: 0.08, flyMax: 0.5 });
  V('jet', { t: D.vehicle('jet'), aliases: ['fighter jet', 'jet plane', 'fighter plane', 'f16', 'jet fighter', 'stealth jet', 'warplane'], move: 'fly', cruise: true, speed: 460, mass: 20, say: ['WHOOOSH!', 'Mach 1!'], flyMin: 0.05, flyMax: 0.45 });
  V('helicopter', { t: D.vehicle('helicopter'), aliases: ['chopper', 'heli', 'copter', 'whirlybird'], move: 'fly', speed: 160, mass: 20, say: ['Whup whup whup', 'Chopper inbound!'], flyMin: 0.08, flyMax: 0.55 });
  V('rocket', { t: D.vehicle('rocket'), aliases: ['rocket ship', 'rocketship', 'space rocket', 'missile', 'space shuttle', 'shuttle'], move: 'none', speed: 0, mass: 15, bounce: 0.3, special: 'rocket', say: ['3... 2... 1...', 'BLAST OFF!', 'To the moon!'], hint: 'Click it to launch!' });
  V('ufo', { t: D.vehicle('ufo'), aliases: ['flying saucer', 'spaceship', 'space ship', 'spacecraft', 'saucer', 'alien ship', 'mothership'], creature: true, move: 'fly', speed: 130, mass: 12, temper: 'curious', special: 'beam', say: ['Bzzzt', '*beep boop*', 'Greetings'], flyMin: 0.1, flyMax: 0.45 });
  V('boat', { t: D.vehicle('boat'), aliases: ['sailboat', 'sail boat', 'yacht', 'dinghy', 'canoe', 'kayak', 'raft', 'rowboat'], move: 'none', speed: 0, mass: 20, bounce: 0.1, say: ['Ahoy!', 'Land ho!'] });
  V('ship', { t: D.vehicle('ship'), aliases: ['pirate ship', 'galleon', 'cruise ship', 'battleship', 'warship', 'steamship', 'titanic'], move: 'none', speed: 0, mass: 80, bounce: 0.05, say: ['Ahoy!', 'Yo ho ho!', 'Arrr!'] });
  V('submarine', { t: D.vehicle('submarine'), aliases: ['sub', 'u boat'], move: 'none', speed: 0, mass: 40, say: ['Dive dive dive!', 'Ping... ping...'] });
  V('hot air balloon', { t: D.vehicle('hotairballoon'), aliases: ['hotair balloon', 'air balloon', 'hot-air balloon'], move: 'float', speed: 30, mass: 5, gravity: 0, say: ['Up we go!', 'What a view!'], flyMin: 0.05, flyMax: 0.4 });
  V('blimp', { t: D.vehicle('blimp'), aliases: ['zeppelin', 'airship', 'dirigible'], move: 'float', speed: 40, mass: 8, gravity: 0, say: ['*drift*', 'Oh, the humanity!'], flyMin: 0.05, flyMax: 0.35 });
})();
