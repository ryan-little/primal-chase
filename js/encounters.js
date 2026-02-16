// ============================================================
// ENCOUNTERS.JS — Hybrid Encounter System
// Combinatorial generator + hand-crafted signatures + rare events
// ============================================================

const Encounters = {

  // Track used signatures this run
  usedSignatures: new Set(),

  // Track recently used combinatorial pieces (avoid immediate repeats)
  recentTerrains: [],
  recentOpportunities: [],

  // ============================================================
  // LAYER 1: COMBINATORIAL BUILDING BLOCKS
  // ============================================================

  // ~20 TERRAIN FEATURES
  terrains: [
    {
      id: 'dry_riverbed',
      name: 'a dry riverbed',
      text: 'The cracked earth of a dry riverbed stretches before you, pale veins splitting the dust like old bones.',
      nightText: 'The riverbed is a pale scar in the moonlight, its cracked surface glowing faintly. Shadows pool in the deepest channels.',
      actions: [{ key: 'drink', name: 'Dig', description: 'Dig into the dry riverbed in search of water', chance: 0.5 }],
      modifiers: {},
      compatible: ['vulture', 'shade_scrub', 'animal_tracks', 'bones', 'termite_mound', 'lizard', 'dust_devil', 'dried_carcass', 'loose_stones', 'thorn_bush', 'beetle_trail', 'cracked_mud', 'wind_shift', 'hawk_shadow', 'snake_den']
    },
    {
      id: 'acacia_grove',
      name: 'a stand of acacia trees',
      text: 'Twisted acacias claw at the sky, their canopy throwing spotted shade across the red earth.',
      nightText: 'The acacias are black silhouettes against the stars, their twisted branches like frozen lightning overhead.',
      actions: [],
      modifiers: { rest: { heat: -5 } },
      compatible: ['shade_scrub', 'bird_alarm', 'animal_tracks', 'termite_mound', 'weaver_nests', 'fallen_branch', 'monkey_troop', 'beetle_trail', 'thorn_bush', 'fig_tree', 'wind_shift', 'hawk_shadow', 'leopard_cache']
    },
    {
      id: 'salt_flat',
      name: 'a vast salt flat',
      text: 'The ground turns white and blinding. Salt crystals crunch beneath your paws, and the horizon dissolves into shimmering nothing.',
      nightText: 'The salt flat reflects the moonlight like a frozen sea, white and ghostly in every direction. Your paws leave dark prints in the luminous crust.',
      actions: [],
      modifiers: { push: { heat: 5 }, trot: { heat: 3 } },
      compatible: ['dust_devil', 'bones', 'mirage', 'cracked_mud', 'wind_shift', 'vulture', 'loose_stones', 'dried_carcass']
    },
    {
      id: 'rocky_outcrop',
      name: 'a rocky outcrop',
      text: 'Dark stone juts from the earth like the spine of something buried. The rocks are warm but offer vantage.',
      nightText: 'The rocks loom dark against the stars, still radiating the day\'s stored heat. The stone is warm beneath your paws.',
      actions: [],
      modifiers: { rest: { heat: -3 }, push: { stamina: -5 } },
      compatible: ['shade_scrub', 'lizard', 'snake_den', 'loose_stones', 'hawk_shadow', 'animal_tracks', 'wind_shift', 'bones', 'hyrax_colony']
    },
    {
      id: 'tall_grass',
      name: 'a sea of tall grass',
      text: 'Golden grass rises to your shoulders, swaying in waves. The world narrows to what is immediately before you.',
      nightText: 'The grass is a dark ocean, whispering in waves you cannot see. Anything could be hiding within arm\'s reach.',
      actions: [],
      modifiers: { trot: { heat: -2 } },
      compatible: ['animal_tracks', 'bird_alarm', 'snake_den', 'beetle_trail', 'wind_shift', 'grasshopper_swarm', 'hidden_burrow', 'mouse_nest', 'thorn_bush']
    },
    {
      id: 'watering_hole',
      name: 'a muddy watering hole',
      text: 'Brown water pools in a shallow depression, its edges trampled by a hundred hooves. Flies drone in lazy circles.',
      nightText: 'Moonlight glints on still water. The watering hole is a dark mirror reflecting stars, its edges muddied by the traffic of the day.',
      actions: [{ key: 'drink', name: 'Drink', description: 'Drink from the watering hole', chance: 1.0 }],
      modifiers: {},
      compatible: ['animal_tracks', 'bird_alarm', 'vulture', 'mud_wallow', 'hippo_territory', 'crocodile_risk', 'fresh_tracks', 'weaver_nests']
    },
    {
      id: 'kopje',
      name: 'a weathered kopje',
      text: 'Rounded boulders stack like a giant\'s cairn, smoothed by millennia of wind. Lizards scatter as your shadow falls across the stone.',
      nightText: 'The boulder pile rises like a crouching giant in the darkness, its stone still warm from the day. The crevices between rocks are pools of black.',
      actions: [],
      modifiers: { rest: { heat: -8, stamina: 5 } },
      compatible: ['shade_scrub', 'lizard', 'hyrax_colony', 'hawk_shadow', 'snake_den', 'loose_stones', 'wind_shift', 'leopard_cache']
    },
    {
      id: 'burned_ground',
      name: 'a stretch of burned ground',
      text: 'Black earth and charred stubble — a fire passed through here recently. The air still tastes of ash and the ground radiates heat.',
      nightText: 'The burned earth smells sharper at night, acrid and recent. Embers still glow in places, orange pinpricks scattered across the dark ground.',
      actions: [{ key: 'eat', name: 'Scavenge', description: 'Search the burn for small animals caught in the fire', chance: 0.6 }],
      modifiers: { push: { heat: 8 }, trot: { heat: 4 } },
      compatible: ['bones', 'vulture', 'dried_carcass', 'dust_devil', 'beetle_trail', 'wind_shift', 'cracked_mud', 'regrowth_shoots']
    },
    {
      id: 'termite_cathedral',
      name: 'a field of termite mounds',
      text: 'Red clay towers rise from the plain like ancient sentinels, some taller than you. The air hums with the industry of millions.',
      nightText: 'The termite mounds stand like pale sentries in the darkness, their clay towers catching the faint light. The hum of millions continues unseen.',
      actions: [],
      modifiers: {},
      compatible: ['termite_mound', 'aardvark_hole', 'bird_alarm', 'animal_tracks', 'shade_scrub', 'beetle_trail', 'lizard', 'hawk_shadow']
    },
    {
      id: 'dry_ravine',
      name: 'a narrow ravine',
      text: 'The earth splits open into a steep-sided gully, carved by waters that haven\'t flowed in seasons. The walls are crumbling sandstone.',
      nightText: 'The ravine is a black gash in the earth, its depths invisible. Cool air rises from below, carrying the scent of damp stone.',
      actions: [{ key: 'drink', name: 'Dig', description: 'Dig at the ravine bottom for trapped moisture', chance: 0.4 }],
      modifiers: { push: { stamina: -8 }, rest: { heat: -5 } },
      compatible: ['shade_scrub', 'loose_stones', 'snake_den', 'bones', 'hidden_burrow', 'animal_tracks', 'wind_shift', 'cracked_mud']
    },
    {
      id: 'baobab',
      name: 'an enormous baobab tree',
      text: 'An impossibly thick trunk rises before you, branches bare against the sky like roots reaching into heaven. It has stood here longer than memory.',
      nightText: 'The baobab is a massive dark shape against the stars, its trunk a column of shadow wider than memory. The bark is cool and rough.',
      actions: [],
      modifiers: { rest: { heat: -10, stamina: 8 } },
      compatible: ['shade_scrub', 'bird_alarm', 'weaver_nests', 'monkey_troop', 'beetle_trail', 'fig_tree', 'bark_water', 'animal_tracks', 'wind_shift']
    },
    {
      id: 'elephant_path',
      name: 'an old elephant trail',
      text: 'A wide path beaten flat by generations of elephants cuts through the brush. The going is easier here, packed earth beneath your paws.',
      nightText: 'The elephant trail is a pale ribbon in the darkness, the packed earth easier to follow by feel than by sight.',
      actions: [],
      modifiers: { push: { stamina: 5 }, trot: { stamina: 3 } },
      compatible: ['animal_tracks', 'fresh_tracks', 'bones', 'dung_pile', 'bird_alarm', 'fallen_branch', 'wind_shift', 'mud_wallow']
    },
    {
      id: 'sandy_wash',
      name: 'a sandy wash',
      text: 'Fine sand fills a wide, shallow channel. Your paws sink with each step, and the heat rises in visible waves from the pale ground.',
      nightText: 'The sand gleams silver in the moonlight. Each footprint is a dark well in the luminous ground, a trail you cannot hide.',
      actions: [{ key: 'drink', name: 'Dig', description: 'Dig in the sand for subsurface water', chance: 0.35 }],
      modifiers: { push: { stamina: -5, heat: 3 }, trot: { stamina: -3 } },
      compatible: ['animal_tracks', 'lizard', 'beetle_trail', 'loose_stones', 'wind_shift', 'dust_devil', 'cracked_mud', 'snake_den']
    },
    {
      id: 'fever_trees',
      name: 'a grove of fever trees',
      text: 'Yellow-green bark glows in the light, ghostly and beautiful. These trees mean water is near — or was, once.',
      nightText: 'The fever trees glow faintly in the dark, their pale bark catching what little light the stars provide. A spectral grove.',
      actions: [{ key: 'drink', name: 'Search', description: 'Search the roots for seeping groundwater', chance: 0.55 }],
      modifiers: { rest: { heat: -4 } },
      compatible: ['bird_alarm', 'monkey_troop', 'weaver_nests', 'animal_tracks', 'shade_scrub', 'wind_shift', 'mosquito_swarm', 'fig_tree']
    },
    {
      id: 'ridge_line',
      name: 'a long ridge',
      text: 'You climb a ridge that runs like a scar across the landscape. From here you can see far — the land spread out in amber and rust.',
      nightText: 'From the ridge, the night spreads in every direction — a dark sea broken by the occasional gleam of distant water or the faint glow of fire.',
      actions: [],
      modifiers: { push: { stamina: -8 }, trot: { stamina: -4 }, rest: { heat: -3 } },
      compatible: ['hawk_shadow', 'wind_shift', 'loose_stones', 'bird_alarm', 'animal_tracks', 'vulture', 'distant_smoke']
    },
    {
      id: 'clay_pan',
      name: 'a dried clay pan',
      text: 'A wide depression of cracked gray clay, baked hard as pottery. Every step echoes. There is no shade and no shelter.',
      nightText: 'The clay pan is a pale void in the darkness, crackling softly as it contracts in the cooling air. Your steps ring hollow.',
      actions: [],
      modifiers: { push: { heat: 5 }, trot: { heat: 3 } },
      compatible: ['mirage', 'dust_devil', 'cracked_mud', 'bones', 'vulture', 'wind_shift', 'dried_carcass', 'loose_stones']
    },
    {
      id: 'thorn_thicket',
      name: 'a dense thorn thicket',
      text: 'A wall of hooked thorns bars your path, each branch armed with curved spines that catch fur and flesh alike.',
      nightText: 'The thorns are invisible in the dark but not unfelt. Every step is a gamble against hooked spines that snag and tear.',
      actions: [],
      modifiers: { push: { stamina: -10, heat: 5 }, trot: { stamina: -5 } },
      compatible: ['hidden_burrow', 'bird_alarm', 'snake_den', 'beetle_trail', 'animal_tracks', 'thorn_bush', 'shade_scrub']
    },
    {
      id: 'seasonal_stream',
      name: 'a seasonal stream',
      text: 'A thin trickle threads over smooth stones, barely a hand\'s width but moving, alive. The sound is almost forgotten music.',
      nightText: 'Water murmurs in the dark, its sound a guide when your eyes fail. The stream catches starlight in broken silver lines.',
      actions: [{ key: 'drink', name: 'Drink', description: 'Drink from the stream', chance: 1.0 }],
      modifiers: {},
      compatible: ['animal_tracks', 'fresh_tracks', 'bird_alarm', 'frog_chorus', 'mud_wallow', 'dragonfly', 'monkey_troop', 'crocodile_risk']
    },
    {
      id: 'open_plain',
      name: 'an open plain',
      text: 'Nothing but grass and sky in every direction. You are exposed here, visible, but the ground is flat and the running is easy.',
      nightText: 'The plain stretches into darkness without end. The sky is enormous above, the ground is nothing below, and you are somewhere between.',
      actions: [],
      modifiers: { push: { stamina: 5 }, trot: { stamina: 3 }, rest: { heat: 5 } },
      compatible: ['dust_devil', 'vulture', 'mirage', 'animal_tracks', 'grasshopper_swarm', 'wind_shift', 'hawk_shadow', 'herd_distant']
    },
    {
      id: 'overhang_cave',
      name: 'a shallow overhang',
      text: 'A lip of stone juts from the hillside, creating a pocket of deep shade. The rock is cool to the touch, almost damp.',
      nightText: 'The overhang is a pocket of absolute darkness, the rock above a cool ceiling that blocks the stars. Shelter in its truest form.',
      actions: [],
      modifiers: { rest: { heat: -15, stamina: 10 } },
      compatible: ['shade_scrub', 'lizard', 'snake_den', 'bones', 'bat_colony', 'hyrax_colony', 'animal_tracks', 'loose_stones', 'wind_shift']
    },
    {
      id: 'dried_marsh',
      name: 'a dried marsh',
      text: 'The earth here is pockmarked and uneven, the memory of standing water written in brittle reeds and cracked clay. Pale stalks rattle in the wind like the ribs of something long dead.',
      nightText: 'The dead reeds whisper against each other in the dark, a dry chorus without melody. The ground is treacherous with hidden channels and soft pockets.',
      actions: [{ key: 'drink', name: 'Dig', description: 'Dig into the soft clay for trapped water', chance: 0.4 }],
      modifiers: { push: { stamina: -5 }, trot: { stamina: -3 } },
      compatible: ['animal_tracks', 'bird_alarm', 'cracked_mud', 'snake_den', 'beetle_trail', 'wind_shift', 'fresh_tracks', 'hidden_burrow', 'grasshopper_swarm']
    },
    {
      id: 'granite_plateau',
      name: 'a granite plateau',
      text: 'Flat stone stretches before you, gray and featureless, baked to a shimmer by the sun. Nothing grows here. The rock throws heat back at the sky like a forge.',
      nightText: 'The plateau is a dark slab under the stars, still breathing the day\'s heat upward in waves you can feel through your pads. The stone ticks and groans as it cools.',
      actions: [],
      modifiers: { push: { heat: 5 }, trot: { heat: 3 }, rest: { heat: -3 } },
      compatible: ['loose_stones', 'wind_shift', 'hawk_shadow', 'lizard', 'vulture', 'dust_devil', 'bones', 'hyrax_colony']
    },
    {
      id: 'bamboo_grove',
      name: 'a bamboo grove',
      text: 'Green stalks rise in dense columns, creaking and swaying overhead. The air here is cooler, filtered through a thousand leaves, and the light falls in shifting coins on the ground.',
      nightText: 'The bamboo grove is a cathedral of darkness, the stalks groaning against each other like old doors. The air is cool and close, heavy with the scent of green.',
      actions: [{ key: 'drink', name: 'Split Stem', description: 'Bite open a bamboo stalk for the water stored inside', chance: 0.6 }],
      modifiers: { rest: { heat: -8, stamina: 5 }, push: { stamina: -5 } },
      compatible: ['shade_scrub', 'bird_alarm', 'monkey_troop', 'animal_tracks', 'snake_den', 'beetle_trail', 'hidden_burrow', 'wind_shift', 'fallen_branch']
    },
    {
      id: 'red_dunes',
      name: 'a field of red sand dunes',
      text: 'The earth rises in waves of deep rust, sculpted by wind into ridges and troughs that shift with every gust. Each step sinks to the ankle. The sky is enormous above the nothing.',
      nightText: 'The dunes are dark swells against the stars, their crests edged with faint silver. The sand hisses as it slides in the night wind, erasing your tracks even as you make them.',
      actions: [],
      modifiers: { push: { stamina: -8, heat: 5 }, trot: { stamina: -5, heat: 3 } },
      compatible: ['dust_devil', 'wind_shift', 'bones', 'lizard', 'beetle_trail', 'loose_stones', 'snake_den', 'mirage']
    },
    {
      id: 'fallen_tree_grove',
      name: 'a grove of fallen trees',
      text: 'Some storm or drought has toppled a stand of old trees. They lie like felled giants, their root discs clawing at the sky, the spaces between them thick with new growth and decay.',
      nightText: 'The fallen trunks are dark shapes in the gloom, each one a wall or a bridge depending on your nerve. Fungi glow faintly on the rotting wood, pale green and unearthly.',
      actions: [{ key: 'eat', name: 'Forage', description: 'Search the rotting wood for grubs and trapped animals', chance: 0.7 }],
      modifiers: { push: { stamina: -5 }, rest: { heat: -5, stamina: 5 } },
      compatible: ['fallen_branch', 'beetle_trail', 'snake_den', 'hidden_burrow', 'shade_scrub', 'bird_alarm', 'animal_tracks', 'monkey_troop', 'bat_colony']
    },
    {
      id: 'volcanic_rock',
      name: 'a field of volcanic rock',
      text: 'Black stone lies in jagged heaps, sharp-edged and brittle, the frozen vomit of some ancient eruption. The rock cuts and the heat it stores is fierce.',
      nightText: 'The lava field is a landscape of black teeth in the darkness, still radiating the day\'s heat like a fever. Each step must be chosen or it draws blood.',
      actions: [],
      modifiers: { push: { stamina: -10, heat: 5 }, trot: { stamina: -5, heat: 3 }, rest: { heat: -5 } },
      compatible: ['loose_stones', 'lizard', 'wind_shift', 'bones', 'hawk_shadow', 'snake_den', 'hyrax_colony', 'vulture']
    },
    {
      id: 'dry_lake_bed',
      name: 'a dry lake bed',
      text: 'The ground turns white and flat — a lake that died seasons ago. Mineral deposits crust the surface in spirals and rings, and the air tastes of alkali and old salt.',
      nightText: 'The lake bed glows bone-white under the moon, a ghostly plain where nothing moves and nothing grows. Your shadow is the only dark thing for miles.',
      actions: [],
      modifiers: { push: { heat: 5 }, trot: { heat: 3 }, rest: { heat: 3 } },
      compatible: ['mirage', 'dust_devil', 'cracked_mud', 'bones', 'vulture', 'wind_shift', 'dried_carcass', 'beetle_trail']
    },
    {
      id: 'whistling_caves',
      name: 'a hillside of whistling caves',
      text: 'Wind pours through a honeycomb of small openings in the rock face, producing a low, keening sound that rises and falls like breathing. The caves exhale cool air that smells of deep stone.',
      nightText: 'The caves moan in the dark, each opening a mouth singing its own note. The sound carries for miles — a warning or an invitation, depending on what you are.',
      actions: [],
      modifiers: { rest: { heat: -12, stamina: 8 } },
      compatible: ['bat_colony', 'shade_scrub', 'hyrax_colony', 'snake_den', 'loose_stones', 'wind_shift', 'animal_tracks', 'hawk_shadow', 'bones']
    },
    {
      id: 'reed_bed',
      name: 'a dense reed bed',
      text: 'Tall reeds crowd together in a rustling wall, their roots in mud that has not fully dried. The air is thick with moisture and the hum of insects. Something splashes unseen.',
      nightText: 'The reeds are a dark curtain, impenetrable to sight. Water gurgles somewhere beneath the roots and frogs call from every direction, masking all other sound.',
      actions: [{ key: 'drink', name: 'Drink', description: 'Drink from the water pooled among the reed roots', chance: 0.85 }],
      modifiers: { push: { stamina: -5 }, trot: { stamina: -3 } },
      compatible: ['animal_tracks', 'bird_alarm', 'fresh_tracks', 'snake_den', 'crocodile_risk', 'hidden_burrow', 'wind_shift', 'grasshopper_swarm']
    },
    {
      id: 'mopane_woodland',
      name: 'a mopane woodland',
      text: 'Stunted trees with butterfly-shaped leaves grow in orderly rows, their canopy thin but wide. The leaf litter crunches underfoot and the air smells of turpentine and warm bark.',
      nightText: 'The mopane trees stand in dark ranks, their thin canopy letting starlight through in patches. The leaves have folded closed for the night, and the woodland is still as held breath.',
      actions: [{ key: 'eat', name: 'Hunt', description: 'Hunt the mopane worms clustered on the bark', chance: 0.75 }],
      modifiers: { rest: { heat: -5 }, trot: { stamina: 3 } },
      compatible: ['shade_scrub', 'bird_alarm', 'animal_tracks', 'beetle_trail', 'fallen_branch', 'weaver_nests', 'wind_shift', 'hawk_shadow', 'monkey_troop', 'fig_tree']
    },
    {
      id: 'ash_field',
      name: 'a grassfire ash field',
      text: 'The land has been scoured by recent fire. Black ash blankets everything, and the charred skeletons of grass and scrub stand like wire. Small green shoots already push through the ruin.',
      nightText: 'The ash field is a void — darker than the night around it, as if the fire burned a hole in the world itself. Embers still pulse in the deepest roots, orange stars in black earth.',
      actions: [{ key: 'eat', name: 'Scavenge', description: 'Search the ash for animals killed in the blaze', chance: 0.55 }],
      modifiers: { push: { heat: 5 }, trot: { heat: 3 } },
      compatible: ['bones', 'vulture', 'dried_carcass', 'beetle_trail', 'wind_shift', 'dust_devil', 'animal_tracks', 'hawk_shadow']
    },
    {
      id: 'sandstone_arches',
      name: 'a gallery of sandstone arches',
      text: 'Wind and water have carved the stone into bridges and windows, rust-red against the blue sky. Light pours through the openings like something sacred. The shade beneath is deep and cool.',
      nightText: 'The arches frame the stars in windows of stone, each opening a portal to a different piece of sky. The rock still holds warmth but the shade beneath has gone cold.',
      actions: [],
      modifiers: { rest: { heat: -10, stamina: 8 }, push: { stamina: -5 } },
      compatible: ['shade_scrub', 'hawk_shadow', 'loose_stones', 'hyrax_colony', 'lizard', 'bat_colony', 'wind_shift', 'animal_tracks', 'snake_den', 'bones']
    }
  ],

  // ~30 OPPORTUNITY ELEMENTS
  opportunities: [
    {
      id: 'vulture',
      name: 'vultures circling',
      text: 'Vultures wheel in slow circles overhead, patient as the sun itself.',
      actions: [{ key: 'eat', name: 'Scavenge', description: 'Investigate what the vultures are circling', chance: 0.75 }],
      modifiers: {}
    },
    {
      id: 'shade_scrub',
      name: 'patches of shade',
      text: 'Scattered patches of shade offer brief respite from the punishing heat.',
      actions: [],
      modifiers: { rest: { heat: -5 } }
    },
    {
      id: 'animal_tracks',
      name: 'animal tracks',
      text: 'Tracks cross the ground — hooves, paws, the drag marks of a tail. Life has passed through here recently.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'bird_alarm',
      name: 'alarm calls',
      text: 'A burst of frantic bird calls erupts from the brush. Something has disturbed them.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'bones',
      name: 'old bones',
      text: 'Sun-bleached bones lie scattered in the dust, picked clean long ago. Something large died here.',
      actions: [{ key: 'eat', name: 'Scavenge', description: 'Crack the bones for marrow', chance: 0.4 }],
      modifiers: {}
    },
    {
      id: 'termite_mound',
      name: 'an active termite mound',
      text: 'A cathedral of red clay hums with life, its surface crawling with pale workers.',
      actions: [{ key: 'eat', name: 'Feed', description: 'Break into the mound for a protein-rich meal', chance: 0.65 }],
      modifiers: {}
    },
    {
      id: 'lizard',
      name: 'basking lizards',
      text: 'Fat lizards sun themselves on the warm stones, too lazy or too confident to flee.',
      actions: [{ key: 'eat', name: 'Hunt', description: 'Snatch the lizards for a quick meal', chance: 0.8 }],
      modifiers: {}
    },
    {
      id: 'dust_devil',
      name: 'a dust devil',
      text: 'A column of spinning dust dances across the landscape, scattering grit and confusion.',
      actions: [],
      modifiers: { push: { heat: 3 } }
    },
    {
      id: 'dried_carcass',
      name: 'a dried carcass',
      text: 'The remains of something once large lie desiccated in the sun, skin pulled tight over jutting ribs.',
      actions: [{ key: 'eat', name: 'Scavenge', description: 'Tear what you can from the carcass', chance: 0.55 }],
      modifiers: {}
    },
    {
      id: 'loose_stones',
      name: 'loose footing',
      text: 'The ground is treacherous with loose stones and shifting gravel.',
      actions: [],
      modifiers: { push: { stamina: -3 } }
    },
    {
      id: 'thorn_bush',
      name: 'thorn bushes',
      text: 'Dense thorns line the path, forcing you to pick your way carefully.',
      actions: [],
      modifiers: { push: { stamina: -2, heat: 2 } }
    },
    {
      id: 'beetle_trail',
      name: 'dung beetles',
      text: 'Dung beetles roll their prizes across the path, oblivious to anything but their ancient work.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'cracked_mud',
      name: 'cracked earth',
      text: 'The mud has dried into a jigsaw of curled plates, each one a tiny broken promise of rain.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'wind_shift',
      name: 'a shift in the wind',
      text: 'The wind changes direction, carrying new scents — dust, distant green, and something else.',
      actions: [],
      modifiers: { trot: { heat: -2 } }
    },
    {
      id: 'hawk_shadow',
      name: 'a raptor\'s shadow',
      text: 'A shadow glides over you — a martial eagle, riding the thermals, watching everything with cold precision.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'snake_den',
      name: 'snake holes',
      text: 'Dark openings pock the ground, each one a potential viper\'s lair.',
      actions: [],
      modifiers: { rest: { stamina: -3 } }
    },
    {
      id: 'mud_wallow',
      name: 'a mud wallow',
      text: 'A depression of thick, cool mud beckons. Wallowing would cool you but slow you down.',
      actions: [{ key: 'drink', name: 'Wallow', description: 'Roll in the mud to cool down and coat your skin', chance: 0.9 }],
      modifiers: {}
    },
    {
      id: 'fresh_tracks',
      name: 'fresh prey tracks',
      text: 'Deep, recent prints — something heavy and alive passed through not long ago.',
      actions: [{ key: 'eat', name: 'Hunt', description: 'Follow the tracks and attempt a kill', chance: 0.5 }],
      modifiers: {}
    },
    {
      id: 'weaver_nests',
      name: 'weaver bird nests',
      text: 'Hundreds of woven grass nests hang from the branches, a city of chattering industry.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'mirage',
      name: 'a shimmering mirage',
      text: 'The horizon liquefies into false water, taunting you with an oasis that does not exist.',
      actions: [],
      modifiers: { push: { thirst: 3 } }
    },
    {
      id: 'fallen_branch',
      name: 'fallen timber',
      text: 'A massive branch has fallen, creating a natural barrier and a pocket of decay.',
      actions: [{ key: 'eat', name: 'Forage', description: 'Search the rotting wood for grubs and insects', chance: 0.7 }],
      modifiers: {}
    },
    {
      id: 'monkey_troop',
      name: 'a troop of monkeys',
      text: 'Baboons bark warnings from the treetops, their alarm calls carrying far across the bush.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'hidden_burrow',
      name: 'a burrow entrance',
      text: 'A dark hole in the earth, wide enough to enter, its edges worn smooth by repeated passage.',
      actions: [{ key: 'eat', name: 'Dig', description: 'Dig out whatever lives in this burrow', chance: 0.45 }],
      modifiers: {}
    },
    {
      id: 'hyrax_colony',
      name: 'hyrax colony',
      text: 'Small furry shapes watch you from the rocks with round, unblinking eyes.',
      actions: [{ key: 'eat', name: 'Hunt', description: 'Attempt to catch one of the hyrax', chance: 0.6 }],
      modifiers: {}
    },
    {
      id: 'fig_tree',
      name: 'a wild fig tree',
      text: 'A fig tree heavy with fruit — half-eaten by birds, the rest fermenting in the heat.',
      actions: [{ key: 'eat', name: 'Eat', description: 'Eat the fallen figs for moisture and energy', chance: 1.0 }],
      modifiers: {}
    },
    {
      id: 'grasshopper_swarm',
      name: 'a cloud of grasshoppers',
      text: 'Grasshoppers erupt from the grass in crackling waves, each step sending up a new burst.',
      actions: [{ key: 'eat', name: 'Feed', description: 'Snap up grasshoppers as you move', chance: 0.9 }],
      modifiers: {}
    },
    {
      id: 'distant_smoke',
      name: 'smoke on the horizon',
      text: 'A thin column of smoke rises in the distance. Brush fire, or something more deliberate.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'bat_colony',
      name: 'roosting bats',
      text: 'Hundreds of small shapes hang from the rock above, wings folded like dark fruit.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'crocodile_risk',
      name: 'movement in the water',
      text: 'Something long and dark shifts beneath the surface. The water here is not safe.',
      actions: [],
      modifiers: { drink: { chance: -0.3 } }
    },
    {
      id: 'leopard_cache',
      name: 'a cached kill',
      text: 'High in a branch, wedged into a fork, hangs the remains of a kill — another predator\'s larder.',
      actions: [{ key: 'eat', name: 'Steal', description: 'Climb and steal the cached kill', chance: 0.65 }],
      modifiers: {}
    },
    {
      id: 'warthog_burrow',
      name: 'a warthog burrow',
      text: 'A wide hole torn in the earth, ringed with fresh digging and coarse bristles. Something large backs into this den each night.',
      actions: [{ key: 'eat', name: 'Ambush', description: 'Wait beside the burrow for its occupant to emerge', chance: 0.5 }],
      modifiers: {}
    },
    {
      id: 'dung_pile',
      name: 'a fresh dung pile',
      text: 'A mound of dark dung, still steaming — elephant, by the size. The scent tells a story of what has passed and where it went.',
      actions: [],
      modifiers: { trot: { stamina: 2 } }
    },
    {
      id: 'dragonfly',
      name: 'a swarm of dragonflies',
      text: 'The air shimmers with dragonflies, hundreds of them, their wings catching the light like thrown glass. Where they gather, water is near.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'secretary_bird',
      name: 'a secretary bird',
      text: 'A tall bird strides through the grass on impossibly long legs, stamping at something in the dust. It kills with its feet — a predator disguised as a clerk.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'pangolin',
      name: 'a curled pangolin',
      text: 'An armored shape lies curled beside a termite mound, its scales interlocked like a fist of bronze. It is alive but unreachable — a meal locked in a vault.',
      actions: [{ key: 'eat', name: 'Pry', description: 'Attempt to pry the pangolin open', chance: 0.25 }],
      modifiers: {}
    },
    {
      id: 'jackal_pack',
      name: 'a jackal pack',
      text: 'Three jackals trot in a loose formation, pausing to yip at one another. They watch you with the casual wariness of animals that know exactly where they stand.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'wildebeest_calf',
      name: 'a stranded calf',
      text: 'A wildebeest calf stands alone, legs trembling, separated from its herd. It bleats into the emptiness. Easy prey — if you can afford to stop.',
      actions: [{ key: 'eat', name: 'Take', description: 'Bring down the calf for a full meal', chance: 0.85 }],
      modifiers: {}
    },
    {
      id: 'honey_guide',
      name: 'a honey guide bird',
      text: 'A small brown bird chatters insistently, flitting from branch to branch ahead of you, leading you somewhere. The old pact — follow the bird, find the hive.',
      actions: [{ key: 'eat', name: 'Follow', description: 'Follow the honey guide to a beehive', chance: 0.7 }],
      modifiers: {}
    },
    {
      id: 'puff_adder',
      name: 'a coiled puff adder',
      text: 'A thick body lies coiled in the path, patterned like the earth itself. It does not move because it does not need to. Everything that steps too close learns.',
      actions: [],
      modifiers: { push: { stamina: -3 }, rest: { stamina: -3 } }
    },
    {
      id: 'ground_hornbill',
      name: 'a ground hornbill',
      text: 'A massive black bird walks the earth ahead of you, its red throat pouch swaying, probing the soil for insects. It regards you without fear.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'spring_hare',
      name: 'spring hares',
      text: 'Small shapes explode from the grass in erratic leaps, zigzagging away on powerful hind legs. Quick and unpredictable — but not faster than instinct.',
      actions: [{ key: 'eat', name: 'Pounce', description: 'Snatch a spring hare from its leap', chance: 0.55 }],
      modifiers: {}
    },
    {
      id: 'buffalo_skull',
      name: 'a buffalo skull',
      text: 'A massive skull rests half-buried in the soil, horns curving outward like a crown. The bone is polished by sun and wind to the color of old ivory.',
      actions: [],
      modifiers: {}
    },
    {
      id: 'mouse_nest',
      name: 'a nest of field mice',
      text: 'A small mound of woven grass hides a nest alive with movement. Tiny shapes scatter at your approach, but not all of them escape.',
      actions: [{ key: 'eat', name: 'Raid Nest', description: 'Dig into the nest for an easy meal', chance: 0.8 }],
      modifiers: {}
    },
    {
      id: 'hippo_territory',
      name: 'hippo territory',
      text: 'Massive shapes loom in the shallows, ears twitching, eyes just above the waterline. The mud is carved with their trails. This water belongs to them.',
      actions: [],
      modifiers: { push: { stamina: -5 }, trot: { stamina: -3 }, rest: { heat: 4 } }
    },
    {
      id: 'regrowth_shoots',
      name: 'new green shoots',
      text: 'Bright green pushes through the blackened earth — life returning already, impossibly quick. Small creatures have come to graze on the new growth.',
      actions: [{ key: 'eat', name: 'Hunt Grazers', description: 'Stalk the small animals feeding on new growth', chance: 0.6 }],
      modifiers: { rest: { heat: -3 } }
    },
    {
      id: 'aardvark_hole',
      name: 'an aardvark burrow',
      text: 'A deep hole opens in the red clay, its edges polished smooth by nightly use. Cool air rises from the darkness below.',
      actions: [],
      modifiers: { rest: { heat: -8, stamina: 5 } }
    },
    {
      id: 'bark_water',
      name: 'water pooled in bark',
      text: 'Rainwater has gathered in the deep folds of the trunk, a cupped palm of clear water held high above the ground. A small, private gift.',
      actions: [{ key: 'drink', name: 'Drink', description: 'Lap water from the bark hollow', chance: 1.0 }],
      modifiers: {}
    },
    {
      id: 'mosquito_swarm',
      name: 'a cloud of mosquitoes',
      text: 'They rise from the damp ground in a whining curtain, finding every fold of skin, every soft place. There is no fighting them — only enduring.',
      actions: [],
      modifiers: { rest: { stamina: -4 }, trot: { stamina: -2 }, push: { stamina: -2 } }
    },
    {
      id: 'frog_chorus',
      name: 'a chorus of frogs',
      text: 'Dozens of voices rise from the water\'s edge in overlapping song, a sound older than anything with legs. Where frogs sing, the water runs clean.',
      actions: [],
      modifiers: { rest: { stamina: 3 } }
    },
    {
      id: 'herd_distant',
      name: 'a distant herd',
      text: 'Dark shapes move across the far plain like a slow river — wildebeest or zebra, too far to tell. They drift with the grass, unconcerned.',
      actions: [{ key: 'eat', name: 'Stalk', description: 'Close the distance and attempt a hunt', chance: 0.35 }],
      modifiers: { push: { stamina: 3 } }
    }
  ],

  // ~15 PRESSURE MODIFIERS
  pressures: [
    {
      id: 'overheating',
      name: 'overheating',
      text: 'Your breath comes in ragged pants. The heat inside you is building faster than the air can pull it away.',
      condition: (state) => state.heat >= 60,
      fallbackCondition: true,
      modifiers: { push: { heat: 5 } }
    },
    {
      id: 'hunters_gaining',
      name: 'the hunters gaining',
      text: 'You can sense them — closer than yesterday, closer than this morning. The gap is shrinking.',
      condition: (state) => state.hunterDistance < 10,
      fallbackCondition: true,
      modifiers: {}
    },
    {
      id: 'storm_approaching',
      name: 'a storm building',
      text: 'Dark clouds pile on the horizon, their bellies bruised purple. The air thickens with electricity.',
      condition: () => Math.random() < 0.15,
      fallbackCondition: true,
      modifiers: { push: { heat: -5 }, trot: { heat: -3 }, rest: { heat: -8 } },
      special: 'storm'
    },
    {
      id: 'injured_paw',
      name: 'a thorn in your paw',
      text: 'A sharp pain lances through your foreleg with every step. Something is embedded deep.',
      condition: () => Math.random() < 0.12,
      fallbackCondition: true,
      modifiers: { push: { stamina: -8 }, trot: { stamina: -4 } }
    },
    {
      id: 'scent_on_wind',
      name: 'their scent on the wind',
      text: 'The breeze carries the unmistakable scent of them — sweat, smoke, and something metallic.',
      condition: (state) => state.hunterDistance < 15 && state.hunterState === 'pursuit',
      fallbackCondition: true,
      modifiers: {}
    },
    {
      id: 'dehydrated',
      name: 'deepening thirst',
      text: 'Your tongue is thick and rough. Each breath pulls more moisture from your body than the air returns.',
      condition: (state) => state.thirst >= 50,
      fallbackCondition: true,
      modifiers: { push: { thirst: 5 } }
    },
    {
      id: 'exhausted',
      name: 'heavy legs',
      text: 'Your legs feel like they belong to something else. Each stride is a negotiation between will and muscle.',
      condition: (state) => state.stamina <= 40,
      fallbackCondition: true,
      modifiers: { push: { stamina: -5 } }
    },
    {
      id: 'starving',
      name: 'a hollow gut',
      text: 'Your stomach has stopped growling. It\'s past complaint now — just a cold, empty weight.',
      condition: (state) => state.hunger >= 50,
      fallbackCondition: true,
      modifiers: { push: { hunger: 5 } }
    },
    {
      id: 'trail_lost',
      name: 'silence behind you',
      text: 'For the first time in days, you cannot sense them. The air behind you is empty. But for how long?',
      condition: (state) => state.hunterState === 'tracking',
      fallbackCondition: false,
      modifiers: {}
    },
    {
      id: 'midday_sun',
      name: 'the peak of the sun',
      text: 'The sun hangs directly overhead, a white disc that erases all shadows. There is nowhere to hide from it.',
      condition: (state) => state.phase === 'day',
      fallbackCondition: true,
      modifiers: { push: { heat: 3 }, trot: { heat: 2 } }
    },
    {
      id: 'cool_breeze',
      name: 'a merciful breeze',
      text: 'A breath of cooler air moves across the land, carrying the smell of distant rain.',
      condition: () => Math.random() < 0.2,
      fallbackCondition: true,
      modifiers: { push: { heat: -3 }, trot: { heat: -2 }, rest: { heat: -5 } }
    },
    {
      id: 'ground_vibrations',
      name: 'something in the earth',
      text: 'The ground trembles faintly beneath your paws — a large herd moving somewhere beyond sight.',
      condition: () => Math.random() < 0.1,
      fallbackCondition: true,
      modifiers: {}
    },
    {
      id: 'flies_swarming',
      name: 'biting flies',
      text: 'A swarm of tsetse flies finds you, each bite a hot needle that drives you forward.',
      condition: () => Math.random() < 0.15,
      fallbackCondition: true,
      modifiers: { rest: { heat: 5, stamina: -5 } }
    },
    {
      id: 'old_territory',
      name: 'familiar ground',
      text: 'You recognize this place — a scent mark, a scratched tree. This was your territory, once.',
      condition: (state) => state.day >= 5 && !Encounters._usedOldTerritory,
      fallbackCondition: false,
      modifiers: { trot: { stamina: 3 } },
      oneTime: true
    },
    {
      id: 'dusk_light',
      name: 'the fading light',
      text: 'The sun sinks toward the earth, painting everything in copper and long shadow. The heat begins to relent.',
      condition: (state) => state.phase === 'day',
      fallbackCondition: true,
      modifiers: { rest: { heat: -5 } }
    },
    {
      id: 'cramps',
      name: 'knotting muscles',
      text: 'A coil of pain tightens in your haunch without warning, locking the muscle into a fist. Each stride sends a bolt of white through the leg.',
      condition: (state) => state.stamina <= 50 && state.day >= 3,
      fallbackCondition: true,
      modifiers: { push: { stamina: -5 }, trot: { stamina: -3 } }
    },
    {
      id: 'blurred_vision',
      name: 'blurring sight',
      text: 'The world softens at the edges, shapes bleeding into shapes. You blink and blink but the clarity will not return. The heat has found your eyes.',
      condition: (state) => state.heat >= 65 || state.thirst >= 60,
      fallbackCondition: true,
      modifiers: { push: { stamina: -3 } }
    },
    {
      id: 'bleeding_paw',
      name: 'a torn pad',
      text: 'Something sharp has opened a cut in your forepaw. Not deep, but the blood comes with each step and the sting will not fade.',
      condition: () => Math.random() < 0.1,
      fallbackCondition: true,
      modifiers: { push: { stamina: -5 }, trot: { stamina: -3 } }
    },
    {
      id: 'moonless_night',
      name: 'a moonless dark',
      text: 'There is no moon. The darkness is total, a black so deep that the ground and sky are the same void. You navigate by scent and memory alone.',
      condition: (state) => state.phase === 'night',
      fallbackCondition: false,
      modifiers: { push: { stamina: -3 }, trot: { stamina: -2 } }
    },
    {
      id: 'second_wind',
      name: 'a second wind',
      text: 'Something shifts in your chest — a loosening, a sudden flush of strength from a place you did not know existed. The legs find a rhythm that has been hiding.',
      condition: (state) => state.stamina <= 35 && state.day >= 4,
      fallbackCondition: false,
      modifiers: { push: { stamina: 5, heat: -3 }, trot: { stamina: 3, heat: -2 } }
    },
    {
      id: 'circling_vultures_personal',
      name: 'vultures overhead',
      text: 'They are circling you now. Not the kill ahead or the carcass behind — you. They have read the story in your stride and they know the ending.',
      condition: (state) => (state.heat >= 70 || state.stamina <= 25 || state.thirst >= 70) && state.day >= 5,
      fallbackCondition: false,
      modifiers: {}
    },
    {
      id: 'muscle_spasm',
      name: 'a spasm',
      text: 'Your shoulder locks without warning, a tremor that ripples down the foreleg and drops your stride into a stumble. The body is sending signals you cannot ignore.',
      condition: (state) => state.stamina <= 30,
      fallbackCondition: true,
      modifiers: { push: { stamina: -8 }, trot: { stamina: -3 } }
    }
  ],

  // ============================================================
  // LAYER 2: HAND-CRAFTED SIGNATURE ENCOUNTERS (~50)
  // ============================================================

  signatures: [
    // --- TUTORIAL ENCOUNTERS (Day 1 only) ---
    {
      id: 'tutorial_day',
      name: 'The Ridge',
      text: 'The savanna stretches before you from this high ridge — an ocean of gold and rust beneath a merciless sun. The air shimmers with heat. Somewhere behind you, faint as a half-remembered sound, is the steady rhythm of footfall. They are far away. But they are there. Your body is strong, your senses sharp. You must choose how to spend this daylight. Push hard and open the gap, or move steady and save your strength. The land ahead offers both distance and danger.',
      minDay: 1,
      maxDay: 1,
      dayOnly: true,
      choices: [
        { key: 'push', name: 'Push', description: 'Sprint hard — cover ground but burn through stamina and heat', effects: null },
        { key: 'trot', name: 'Trot', description: 'Move at a steady pace — moderate distance, manageable cost', effects: null },
        { key: 'rest', name: 'Rest', description: 'Hold position — recover strength, but the hunters close in', effects: null }
      ]
    },
    {
      id: 'tutorial_night',
      name: 'First Darkness',
      text: 'The sun bleeds out across the horizon and the world cools. Shadows stretch long, then swallow everything. The heat that pressed against you all day lifts like a hand removed from your throat. Somewhere behind you, the hunters have stopped. They make camp at night — you can feel the absence of their pressure. The darkness is yours. You move slower, see less, but the night is merciful. This is when you recover. This is when you plan.',
      minDay: 1,
      maxDay: 1,
      nightOnly: true,
      choices: [
        { key: 'push', name: 'Push', description: 'Press on through darkness — slower, but the hunters are camped', effects: null },
        { key: 'trot', name: 'Trot', description: 'Move carefully through the night — less heat, less thirst', effects: null },
        { key: 'rest', name: 'Rest', description: 'Rest and recover — the safest time to restore your body', effects: null }
      ]
    },

    // --- WATER/TRAIL EVENTS (can lose hunters) ---
    {
      id: 'sig_river_crossing',
      name: 'The River',
      minDay: 2,
      text: 'A river blocks your path — wide, brown, and moving with quiet power. The far bank is thick with reeds. Crossing would mask your scent entirely, but the current is strong and there is no telling what waits beneath.',
      choices: [
        { key: 'cross', name: 'Cross the River', description: 'Swim across — mask your scent and lose the hunters, but risk the current', effects: { heat: -20, stamina: -25, thirst: -100, hunger: 10 }, distance: 1, loseHunters: true, risk: { chance: 0.2, penalty: { stamina: -20 }, text: 'The current pulls you under briefly. You emerge on the far bank, gasping, bruised against the stones.' } },
        { key: 'follow', name: 'Follow the Bank', description: 'Follow the river downstream — safer, find a crossing, drink along the way', effects: { heat: 5, stamina: -10, thirst: -100, hunger: 5 }, distance: 2, loseHunters: false },
        { key: 'push', name: 'Push Past', description: 'Ignore the river and keep running', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_flash_flood',
      name: 'The Flood',
      minDay: 4,
      text: 'Without warning, the ground ahead turns to rushing brown water. A flash flood tears through the channel, churning mud and debris. It will pass, but while it rages, nothing can follow your path through it.',
      choices: [
        { key: 'wade', name: 'Wade Through', description: 'Push through the floodwater before it deepens — dangerous but erases your trail', effects: { heat: -15, stamina: -30, thirst: -100, hunger: 5 }, distance: 0, loseHunters: true, risk: { chance: 0.3, penalty: { stamina: -25 }, text: 'The water hits harder than you expected. You are tumbled, scraped raw against hidden rocks, but you keep your feet.' } },
        { key: 'wait', name: 'Wait It Out', description: 'Rest until the flood passes — safe but the hunters close in', effects: { heat: -15, stamina: 15, thirst: -50, hunger: 5 }, distance: 0, loseHunters: false },
        { key: 'push', name: 'Push Along the Edge', description: 'Run along the flood\'s edge to find dry ground', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_rainstorm',
      name: 'The Rains',
      minDay: 3,
      text: 'The sky splits. Rain hammers down in sheets so thick you cannot see your own paws. The world turns to mud and streaming water. Your tracks dissolve behind you as fast as you make them.',
      choices: [
        { key: 'run_rain', name: 'Run in the Rain', description: 'Push through the downpour — your tracks wash away, cool your body', effects: { heat: -30, stamina: -15, thirst: -100, hunger: 5 }, distance: 4, loseHunters: true },
        { key: 'shelter', name: 'Find Shelter', description: 'Wait out the storm under cover — rest and drink', effects: { heat: -25, stamina: 20, thirst: -100, hunger: 5 }, distance: 0, loseHunters: false },
        { key: 'trot', name: 'Trot Steadily', description: 'Move at a careful pace through the rain', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_mud_crossing',
      name: 'The Mud Flat',
      minDay: 2,
      text: 'A vast expanse of sticky mud stretches before you — the remains of a seasonal lake. Your tracks would sink deep and be unreadable. But each step is a battle against the sucking earth.',
      choices: [
        { key: 'cross_mud', name: 'Cross the Mud', description: 'Struggle through — exhausting but confuses the trail', effects: { heat: 15, stamina: -30, thirst: 10, hunger: 10 }, distance: 1, loseHunters: true },
        { key: 'skirt', name: 'Go Around', description: 'Skirt the edge — slower but easier going', effects: { heat: 10, stamina: -10, thirst: 5, hunger: 5 }, distance: 2, loseHunters: false },
        { key: 'rest', name: 'Rest at the Edge', description: 'Rest here before deciding', effects: null, distance: null }
      ]
    },

    // --- FOOD ENCOUNTERS ---
    {
      id: 'sig_rival_predator',
      name: 'The Rival',
      minDay: 3,
      text: 'A hyena clan has brought down a zebra. They snarl and snap over the fresh kill, blood steaming in the morning air. There is enough meat there to fill your belly completely — if you are willing to fight for it.',
      choices: [
        { key: 'fight', name: 'Challenge Them', description: 'Drive the hyenas off and claim the kill — risk injury', effects: { heat: 20, stamina: -20, thirst: 10, hunger: -100 }, distance: 0, risk: { chance: 0.35, penalty: { stamina: -20, heat: 10 }, text: 'They don\'t give way easily. Teeth find your flank before they scatter, and the wound is hot and deep.' } },
        { key: 'wait_scraps', name: 'Wait for Scraps', description: 'Wait until they\'ve had their fill, then take what\'s left', effects: { heat: 5, stamina: 5, thirst: 5, hunger: -50 }, distance: 0 },
        { key: 'ignore', name: 'Keep Moving', description: 'You cannot afford to stop', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_wounded_animal',
      name: 'The Wounded',
      minDay: 1,
      text: 'An impala limps ahead of you, its hind leg dragging. Something has already wounded it — lion, perhaps, or a misstep on the rocks. Easy prey, if you have the energy to close the distance.',
      choices: [
        { key: 'hunt', name: 'Take the Kill', description: 'Sprint and bring it down — a full meal at significant energy cost', effects: { heat: 25, stamina: -25, thirst: -30, hunger: -100 }, distance: 0 },
        { key: 'stalk', name: 'Follow Until It Falls', description: 'Trail it patiently — less energy but the hunters gain ground', effects: { heat: 10, stamina: -5, thirst: 5, hunger: -100 }, distance: -2 },
        { key: 'leave', name: 'Leave It', description: 'You are the hunted now, not the hunter', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_beehive',
      name: 'The Hive',
      minDay: 2,
      text: 'A low humming draws your attention to a hollow in the trunk of a dead tree. Honey — dense with energy, sweet beyond reason. But the bees will not part with it willingly.',
      choices: [
        { key: 'raid', name: 'Raid the Hive', description: 'Tear it open and eat — stings are painful but honey is pure energy', effects: { heat: 15, stamina: -10, thirst: -20, hunger: -80 }, distance: 0, risk: { chance: 0.5, penalty: { heat: 15 }, text: 'The bees descend in a furious cloud. Every sting is a point of fire, swelling your muzzle and eyes.' } },
        { key: 'leave', name: 'Move On', description: 'Not worth the cost', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_ostrich_nest',
      name: 'The Nest',
      minDay: 3,
      text: 'A shallow depression in the sand holds three enormous eggs, each one a meal unto itself. But the parent bird is nearby — taller than you, and those legs can kill a lion.',
      choices: [
        { key: 'steal', name: 'Steal an Egg', description: 'Grab one and run — risk the ostrich\'s wrath', effects: { heat: 15, stamina: -15, thirst: -25, hunger: -90 }, distance: 1, risk: { chance: 0.4, penalty: { stamina: -20 }, text: 'The ostrich charges with terrifying speed. A kick catches your ribs before you can escape with the egg.' } },
        { key: 'leave', name: 'Give It Wide Berth', description: 'An ostrich kick can shatter bone', effects: null, distance: null }
      ]
    },

    // --- TERRAIN/NAVIGATION EVENTS ---
    {
      id: 'sig_canyon',
      name: 'The Canyon',
      minDay: 4,
      text: 'The earth opens into a deep canyon, its walls layered in red and orange stone. Going around will cost a full day. Going through is faster but the narrow passage is a chokepoint — if the hunters follow, you\'d have nowhere to run.',
      choices: [
        { key: 'through', name: 'Go Through', description: 'Risk the narrows — faster but dangerous if hunters are close', effects: { heat: -10, stamina: -15, thirst: 5, hunger: 5 }, distance: 4 },
        { key: 'around', name: 'Go Around', description: 'Safer but costs significant time', effects: { heat: 15, stamina: -20, thirst: 10, hunger: 10 }, distance: 1 },
        { key: 'rest', name: 'Rest at the Rim', description: 'Consider your options while you recover', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_brush_fire',
      name: 'The Fire',
      minDay: 3,
      text: 'A line of fire crawls across the grass ahead, driven by the wind. Smoke billows thick and dark. The fire is moving slowly but it stretches wide, a wall of orange between you and open ground. The hunters cannot follow through flame.',
      choices: [
        { key: 'through_fire', name: 'Run Through the Fire Line', description: 'Sprint through the thinnest point — extreme heat but total trail erasure', effects: { heat: 35, stamina: -20, thirst: 15, hunger: 5 }, distance: 3, loseHunters: true, risk: { chance: 0.25, penalty: { heat: 20 }, text: 'The flames lick higher than you expected. Your fur singes and the smoke fills your lungs like boiling water.' } },
        { key: 'flee_fire', name: 'Run Parallel', description: 'Follow the fire\'s edge — the smoke confuses tracking', effects: { heat: 15, stamina: -15, thirst: 10, hunger: 5 }, distance: 3, loseHunters: false },
        { key: 'wait_fire', name: 'Wait for it to Pass', description: 'Let the fire move on, then cross the burned ground', effects: { heat: 5, stamina: 10, thirst: 5, hunger: 5 }, distance: 0, loseHunters: false }
      ]
    },
    {
      id: 'sig_cliff_edge',
      name: 'The Edge',
      minDay: 5,
      text: 'The ground ends abruptly. A sheer cliff drops away into a valley thick with green — water, shade, food, all far below. There may be a way down, but the descent is treacherous.',
      choices: [
        { key: 'descend', name: 'Climb Down', description: 'Attempt the descent — the valley promises everything you need', effects: { heat: -20, stamina: -30, thirst: -50, hunger: -30 }, distance: 2, risk: { chance: 0.3, penalty: { stamina: -25 }, text: 'A ledge crumbles under your weight. You scramble, slide, and hit the next outcrop hard. Something in your shoulder screams.' } },
        { key: 'along_cliff', name: 'Follow the Cliff Edge', description: 'Look for an easier descent while moving', effects: { heat: 10, stamina: -10, thirst: 5, hunger: 5 }, distance: 2 },
        { key: 'turn_back', name: 'Turn Back', description: 'Find another way', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_cave_system',
      name: 'The Dark',
      minDay: 6,
      text: 'A cave mouth yawns in the hillside, breathing cool air. The darkness inside is absolute. You could rest here unseen, but you do not know what else considers this home.',
      choices: [
        { key: 'enter_cave', name: 'Enter and Rest', description: 'Deep rest in cool darkness — excellent recovery but the hunters gain ground', effects: { heat: -40, stamina: 30, thirst: 0, hunger: 5 }, distance: -3 },
        { key: 'entrance_only', name: 'Rest at the Entrance', description: 'Stay near the light — some shade benefit, less risk', effects: { heat: -20, stamina: 15, thirst: 0, hunger: 3 }, distance: 0 },
        { key: 'keep_going', name: 'Keep Running', description: 'You cannot afford to stop', effects: null, distance: null }
      ]
    },

    // --- HUNTER AWARENESS EVENTS ---
    {
      id: 'sig_hunters_camp',
      name: 'Their Camp',
      minDay: 5,
      text: 'You double back slightly and find it — their camp. Cold fire, stripped bones, the marks where their bodies pressed the grass flat. They are organized. They are patient. And carved into the dirt near the fire pit is the shape of an animal. Your shape.',
      choices: [
        { key: 'scatter', name: 'Scatter Your Trail', description: 'Circle the camp to confuse their tracking — costs time but sows doubt', effects: { heat: 15, stamina: -15, thirst: 5, hunger: 5 }, distance: -1, loseHunters: true },
        { key: 'flee', name: 'Run', description: 'The sight fills you with dread — push hard away', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_spear_found',
      name: 'The Spear',
      minDay: 4,
      text: 'Half-buried in the earth, you find a broken spear shaft. The stone point is still sharp, still stained dark. This was not dropped. It was thrown — at something that was running.',
      choices: [
        { key: 'push', name: 'Push Harder', description: 'The reminder drives you forward with renewed fear', effects: null, distance: null },
        { key: 'rest', name: 'Rest Despite the Fear', description: 'You need recovery more than speed right now', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_other_prey',
      name: 'The Others',
      minDay: 3,
      text: 'Ahead of you, a wildebeest herd grazes in nervous clusters. If you run through them, the stampede of hooves would obliterate your tracks for miles.',
      choices: [
        { key: 'stampede', name: 'Run Through the Herd', description: 'Trigger a stampede — your tracks vanish in the chaos', effects: { heat: 20, stamina: -20, thirst: 10, hunger: 5 }, distance: 4, loseHunters: true, risk: { chance: 0.2, penalty: { stamina: -15 }, text: 'A bull clips you as the herd wheels. The impact spins you sideways but you find your feet.' } },
        { key: 'skirt_herd', name: 'Go Around', description: 'Circle the herd quietly', effects: { heat: 10, stamina: -10, thirst: 5, hunger: 5 }, distance: 2, loseHunters: false },
        { key: 'rest', name: 'Rest in Their Shadow', description: 'Rest near the herd — their presence masks yours briefly', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_night_voices',
      name: 'The Voices',
      minDay: 6,
      nightOnly: true,
      text: 'On the wind, faint but unmistakable — human voices. Not words you understand, but the rhythm is clear: a chant, a song. They are singing as they hunt you. They sing because they know they will not lose.',
      choices: [
        { key: 'push', name: 'Push Through the Night', description: 'Their song drives you forward — pure flight instinct', effects: null, distance: null },
        { key: 'hide', name: 'Go Still', description: 'Freeze and hope they pass — movement in the dark is what they track', effects: { heat: -15, stamina: 15, thirst: 0, hunger: 3 }, distance: 0 }
      ]
    },
    {
      id: 'sig_tracking_sign',
      name: 'The Mark',
      minDay: 3,
      text: 'A branch has been broken at eye height. Not by wind — snapped deliberately, the white wood pointing in your direction. They are marking your path for those who follow behind.',
      choices: [
        { key: 'backtrack', name: 'Backtrack and Change Course', description: 'Double back to break the trail — costs energy and time', effects: { heat: 15, stamina: -20, thirst: 10, hunger: 5 }, distance: -2, loseHunters: true },
        { key: 'ignore', name: 'Keep Going', description: 'Changing course costs too much', effects: null, distance: null }
      ]
    },

    // --- LATE GAME SPECIALS (day 8+) ---
    {
      id: 'sig_old_bones',
      name: 'The Predecessor',
      minDay: 8,
      text: 'You find them in the shade of an acacia: the bones of a great cat. The skull is massive, the teeth still sharp. Around the ribcage, scratched into the bone by stone tools, are tally marks. Twelve of them. Someone counted the days this one survived.',
      choices: [
        { key: 'rest_bones', name: 'Rest Here', description: 'Rest beside the bones of the one who came before', effects: { heat: -20, stamina: 15, thirst: 0, hunger: 3 }, distance: 0 },
        { key: 'push', name: 'Outlast Them', description: 'You will not end up like this', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_watering_truce',
      name: 'The Truce',
      minDay: 5,
      text: 'You reach a large watering hole at the same time as a herd of elephants. Their massive bodies crowd the bank, trunks curling into the water. In the presence of the old ones, even predators are small. But the water is there, between their legs.',
      choices: [
        { key: 'drink_elephants', name: 'Drink Carefully', description: 'Slip between the elephants and drink — they tolerate you, barely', effects: { heat: -10, stamina: -5, thirst: -100, hunger: 0 }, distance: 0 },
        { key: 'wait_turn', name: 'Wait Your Turn', description: 'Wait until the elephants move on, then drink', effects: { heat: 5, stamina: 10, thirst: -100, hunger: 5 }, distance: -2 },
        { key: 'leave', name: 'Move On', description: 'No time to wait', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_termite_feast',
      name: 'The Emergence',
      minDay: 4,
      text: 'The ground splits and a column of flying termites erupts skyward — millions of them, fat with stored energy, filling the air like living rain. Every creature for miles is converging. It\'s a feast that costs nothing but time.',
      choices: [
        { key: 'feast', name: 'Gorge Yourself', description: 'Eat until your belly strains — free food from the sky', effects: { heat: 5, stamina: 5, thirst: -20, hunger: -100 }, distance: 0 },
        { key: 'eat_run', name: 'Eat While Moving', description: 'Snap them from the air as you trot', effects: { heat: 10, stamina: -10, thirst: -10, hunger: -50 }, distance: 2 },
        { key: 'ignore', name: 'Ignore Them', description: 'Every moment stopped is a moment they gain', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_quicksand',
      name: 'The Trap',
      minDay: 5,
      text: 'What looked like solid ground gives way. Your legs sink into sucking mud, thigh-deep, pulling harder the more you struggle. Panic floods your chest as the earth tries to swallow you.',
      choices: [
        { key: 'struggle', name: 'Fight Free', description: 'Thrash and claw until you pull loose — exhausting but fast', effects: { heat: 25, stamina: -30, thirst: 10, hunger: 10 }, distance: 0 },
        { key: 'slow_escape', name: 'Move Slowly', description: 'Ease out carefully — takes longer but costs less', effects: { heat: 10, stamina: -10, thirst: 5, hunger: 5 }, distance: -1 }
      ]
    },
    {
      id: 'sig_dawn_mist',
      name: 'The Mist',
      minDay: 3,
      text: 'Dawn breaks into a world of white. A thick mist has settled over the land, reducing the world to arm\'s length. You can barely see the ground beneath your paws. The hunters cannot track in this.',
      choices: [
        { key: 'run_blind', name: 'Run in the Mist', description: 'Move fast while you\'re invisible — risk of obstacles but hunters are blind', effects: { heat: 5, stamina: -15, thirst: -10, hunger: 5 }, distance: 5, loseHunters: true, risk: { chance: 0.2, penalty: { stamina: -15 }, text: 'You slam into a fallen trunk hidden in the white. The impact leaves you winded and limping.' } },
        { key: 'trot_mist', name: 'Trot Carefully', description: 'Move at a steady pace through the mist', effects: { heat: 3, stamina: -10, thirst: -5, hunger: 5 }, distance: 3, loseHunters: true },
        { key: 'rest_mist', name: 'Rest in the Cover', description: 'Let the mist hide you while you recover', effects: { heat: -15, stamina: 20, thirst: -5, hunger: 3 }, distance: 0, loseHunters: false }
      ]
    },

    // --- MORE SIGNATURE ENCOUNTERS ---
    {
      id: 'sig_hippo_pool',
      name: 'The Pool',
      minDay: 3,
      text: 'A deep pool, almost a small lake — but the water boils with the shapes of hippos. Their eyes watch you from just above the surface, and their jaws could snap you in half. The water you need is guarded by something worse than thirst.',
      choices: [
        { key: 'risk_drink', name: 'Drink at the Edge', description: 'Creep to the far edge and drink quickly — the hippos may charge', effects: { heat: 10, stamina: -10, thirst: -100, hunger: 0 }, distance: 0, risk: { chance: 0.3, penalty: { stamina: -30, heat: 15 }, text: 'A bull hippo surges from the water. You barely escape the massive jaws, the shockwave of displaced water knocking you sideways.' } },
        { key: 'move_on', name: 'Move On', description: 'Not worth the risk', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_scavenger_standoff',
      name: 'The Circle',
      minDay: 4,
      text: 'A fresh kill lies in the grass — recent, still warm. But you are not the only one who found it. A jackal, three vultures, and a honey badger have formed a tense circle around the meat. The badger hisses at everything that moves.',
      choices: [
        { key: 'dominate', name: 'Assert Dominance', description: 'You are the apex predator here — drive them all off', effects: { heat: 15, stamina: -15, thirst: 5, hunger: -100 }, distance: 0 },
        { key: 'share', name: 'Eat Alongside', description: 'Join the circle — there\'s enough for all', effects: { heat: 5, stamina: -5, thirst: 5, hunger: -60 }, distance: 0 },
        { key: 'leave', name: 'Keep Moving', description: 'The noise will attract attention', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_elephant_graveyard',
      name: 'The Graveyard',
      minDay: 7,
      text: 'You wander into a place of enormous bones. Ribcages arch like ruined cathedrals. Tusks curve from the earth like pale roots. This is where the old ones came to die, and the silence here is absolute and ancient.',
      choices: [
        { key: 'rest_graveyard', name: 'Rest Among the Bones', description: 'Something about this place brings deep calm — excellent rest', effects: { heat: -25, stamina: 25, thirst: 0, hunger: 5 }, distance: 0 },
        { key: 'scavenge_marrow', name: 'Crack Bones for Marrow', description: 'The old bones still hold sustenance', effects: { heat: 10, stamina: -10, thirst: 5, hunger: -50 }, distance: 0 },
        { key: 'move_on', name: 'Leave This Place', description: 'The dead have nothing for the living', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_sandstorm',
      name: 'The Sand',
      minDay: 4,
      text: 'The horizon turns brown and begins to move. A sandstorm bears down with terrifying speed, a wall of grit and darkness. There is no outrunning it.',
      choices: [
        { key: 'hunker', name: 'Hunker Down', description: 'Find the lowest ground and endure — the storm erases all tracks', effects: { heat: 5, stamina: 10, thirst: 15, hunger: 5 }, distance: 0, loseHunters: true },
        { key: 'run_with', name: 'Run With the Storm', description: 'Let the wind carry you — fast but brutal', effects: { heat: 20, stamina: -25, thirst: 20, hunger: 5 }, distance: 6, loseHunters: true },
        { key: 'shelter', name: 'Find Shelter', description: 'Search for a rock or depression to shield you', effects: { heat: -5, stamina: 15, thirst: 10, hunger: 3 }, distance: 0, loseHunters: true }
      ]
    },
    {
      id: 'sig_ancient_tree',
      name: 'The Ancient',
      minDay: 6,
      text: 'A tree stands alone that defies comprehension — its trunk wider than ten of you, its roots a landscape of their own. It has stood here since before the hunters\' grandfathers\' grandfathers drew breath. Water seeps from a hollow in its bark.',
      choices: [
        { key: 'drink_rest', name: 'Drink and Rest', description: 'Drink the bark water and rest in its shade — deep recovery', effects: { heat: -30, stamina: 20, thirst: -100, hunger: 0 }, distance: -2 },
        { key: 'drink_go', name: 'Drink and Go', description: 'Take the water and keep moving', effects: { heat: -5, stamina: -5, thirst: -100, hunger: 3 }, distance: 2 },
        { key: 'push', name: 'Push Past', description: 'No time for wonder', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_python',
      name: 'The Coil',
      minDay: 4,
      text: 'You nearly step on it — a rock python, thick as your leg, coiled in the shade. It raises its head slowly, tongue tasting the air. You are too large to be prey, but it does not know that immediately.',
      choices: [
        { key: 'kill_python', name: 'Kill and Eat', description: 'A python is a significant meal if you can pin its head', effects: { heat: 15, stamina: -15, thirst: -20, hunger: -90 }, distance: 0, risk: { chance: 0.2, penalty: { stamina: -15 }, text: 'The python strikes before you can pin it, coiling around your foreleg. You thrash free but the crush has left the muscle screaming.' } },
        { key: 'avoid', name: 'Give It Space', description: 'Not worth the risk', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_moonlit_plain',
      name: 'The Silver Plain',
      minDay: 4,
      nightOnly: true,
      text: 'The moon is full and enormous, turning the grassland to silver. You can see for miles in every direction. The world is beautiful and terrible — beautiful because it is vast and silver, terrible because you can see how far you still have to run.',
      choices: [
        { key: 'push_moon', name: 'Run Under the Moon', description: 'The visibility and cool air make for excellent running', effects: { heat: 5, stamina: -15, thirst: 5, hunger: 5 }, distance: 5 },
        { key: 'trot', name: 'Trot Steadily', description: 'Conserve energy under the silver light', effects: null, distance: null },
        { key: 'howl', name: 'Stop and Breathe', description: 'For one moment, just exist under the moon', effects: { heat: -20, stamina: 15, thirst: 0, hunger: 3 }, distance: 0 }
      ]
    },
    {
      id: 'sig_dried_lake',
      name: 'The Memory of Water',
      minDay: 5,
      text: 'You stand at the center of what was once a lake. The cracked bed stretches in every direction, white as bone. At the very center, a dark patch of mud still holds the ghost of moisture.',
      choices: [
        { key: 'dig_deep', name: 'Dig Deep', description: 'Dig into the mud for the last of the water — exhausting but possible', effects: { heat: 15, stamina: -20, thirst: -80, hunger: 5 }, distance: 0 },
        { key: 'cross', name: 'Cross Quickly', description: 'Get across this exposed ground fast', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_vulture_council',
      name: 'The Watchers',
      minDay: 7,
      text: 'A dozen vultures sit in a dead tree, watching you pass with patient, ancient eyes. They are not circling. They are waiting. They have been following you for days, and they know how this ends.',
      choices: [
        { key: 'push', name: 'Prove Them Wrong', description: 'Their patience fuels your defiance', effects: null, distance: null },
        { key: 'rest', name: 'Rest Beneath Their Gaze', description: 'You are still alive. That is what matters.', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_other_cat',
      name: 'The Mirror',
      minDay: 6,
      text: 'Movement in the grass — and then you see it. Another big cat, gaunt and wild-eyed, running in the same direction as you. It looks at you and you see your own desperation reflected back. It, too, is being hunted.',
      choices: [
        { key: 'run_together', name: 'Run Together', description: 'Two targets are harder to track than one — the confusion may buy time', effects: { heat: 10, stamina: -10, thirst: 5, hunger: 5 }, distance: 3, loseHunters: true },
        { key: 'separate', name: 'Split Apart', description: 'Go different ways — the hunters must choose', effects: { heat: 5, stamina: -5, thirst: 5, hunger: 5 }, distance: 2 },
        { key: 'ignore', name: 'Ignore It', description: 'You run alone', effects: null, distance: null }
      ]
    },

    // --- ADDITIONAL SIGNATURES TO ROUND OUT VARIETY ---
    {
      id: 'sig_ant_column',
      name: 'The Column',
      minDay: 2,
      text: 'A river of safari ants bisects your path — millions of them moving in a column two paws wide. Their mandibles can strip flesh. Going around means doubling back.',
      choices: [
        { key: 'jump_over', name: 'Leap Over', description: 'Gather yourself and jump — clear the column cleanly', effects: { heat: 5, stamina: -10, thirst: 3, hunger: 3 }, distance: 2, risk: { chance: 0.15, penalty: { heat: 10, stamina: -10 }, text: 'You misjudge the width. Ants swarm your hindquarters before you can shake them — each bite a tiny fire.' } },
        { key: 'go_around', name: 'Go Around', description: 'Follow the column until it narrows enough to cross', effects: { heat: 10, stamina: -5, thirst: 5, hunger: 3 }, distance: 1 },
        { key: 'wait', name: 'Wait for Them to Pass', description: 'Ant columns move on eventually', effects: { heat: -10, stamina: 10, thirst: 3, hunger: 5 }, distance: -1 }
      ]
    },
    {
      id: 'sig_waterfall',
      name: 'The Falls',
      minDay: 5,
      text: 'You hear it before you see it — a low roar that builds into thunder. A waterfall plunges from a rock shelf into a pool below, mist rising like breath. It is the most water you have seen since the chase began.',
      choices: [
        { key: 'plunge_pool', name: 'Bathe in the Pool', description: 'Submerge yourself — total heat and thirst reset, but the hunters hear it too', effects: { heat: -50, stamina: 5, thirst: -100, hunger: 0 }, distance: 0 },
        { key: 'drink_go', name: 'Drink and Move', description: 'Drink deep and keep running', effects: { heat: -10, stamina: -5, thirst: -100, hunger: 3 }, distance: 2 },
        { key: 'push', name: 'Push On', description: 'The sound will draw the hunters', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_porcupine',
      name: 'The Quills',
      minDay: 3,
      text: 'A porcupine rattles its quills at you from beside its burrow — a warning display from an animal that knows it cannot be eaten easily. But its burrow looks deep and cool.',
      choices: [
        { key: 'take_burrow', name: 'Drive It Off', description: 'Chase the porcupine away and use its burrow to rest — cool and hidden', effects: { heat: -25, stamina: 15, thirst: 0, hunger: 5 }, distance: 0, risk: { chance: 0.25, penalty: { stamina: -15 }, text: 'A quill catches you in the shoulder as it flees. The barb holds deep and every movement twists it further.' } },
        { key: 'ignore', name: 'Leave It', description: 'Not worth a mouthful of quills', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_drought_carcasses',
      name: 'The Die-Off',
      minDay: 6,
      text: 'The land opens onto a grim tableau — dozens of wildebeest and zebra lie dead or dying, victims of the drought. The smell is overpowering. But there is more meat here than you could eat in a lifetime.',
      choices: [
        { key: 'gorge', name: 'Eat Your Fill', description: 'Gorge on the freshest carcass — complete hunger and thirst reset', effects: { heat: 10, stamina: 5, thirst: -50, hunger: -100 }, distance: 0 },
        { key: 'eat_move', name: 'Eat Quickly and Go', description: 'Take what you can carry in your belly', effects: { heat: 5, stamina: -5, thirst: -20, hunger: -70 }, distance: 2 },
        { key: 'avoid', name: 'Skirt the Kill Zone', description: 'The smell will attract every predator and scavenger for miles — including the hunters', effects: null, distance: null }
      ]
    },
    {
      id: 'sig_high_ground',
      name: 'The Vantage',
      minDay: 4,
      text: 'You climb to a point where you can see everything — the rolling grassland, the distant treeline, the shimmer of heat on the horizon. And there, small but unmistakable, a column of dust. The hunters.',
      choices: [
        { key: 'observe', name: 'Watch and Plan', description: 'Study their movement pattern and choose your direction wisely', effects: { heat: 5, stamina: 10, thirst: 5, hunger: 3 }, distance: 0, special: 'reveals_hunter_speed' },
        { key: 'opposite', name: 'Run the Opposite Way', description: 'Now that you can see them, run directly away', effects: null, distance: null },
        { key: 'zigzag', name: 'Change Direction', description: 'Cut perpendicular to their path — may confuse tracking', effects: { heat: 10, stamina: -15, thirst: 5, hunger: 5 }, distance: 2, loseHunters: false }
      ]
    }
  ],

  // ============================================================
  // LAYER 3: RARE/LEGENDARY EVENTS (<1% chance)
  // ============================================================

  rares: [
    {
      id: 'rare_eclipse',
      name: 'The Eclipse',
      text: 'The sun begins to vanish. A black disc eats the light from the edge inward until the world goes dark at midday. Stars appear. The temperature plummets. Every living thing on the savanna goes silent, terrified. Even the hunters will stop and look up. For a few minutes, the world belongs to no one.',
      choices: [
        { key: 'run_eclipse', name: 'Run in the False Night', description: 'The darkness and cold are a gift — sprint while the world is stunned', effects: { heat: -40, stamina: -15, thirst: -10, hunger: 5 }, distance: 8, loseHunters: true },
        { key: 'rest_eclipse', name: 'Rest in the Dark', description: 'Let the impossible cold wash over you', effects: { heat: -50, stamina: 30, thirst: 0, hunger: 3 }, distance: 0, loseHunters: true }
      ]
    },
    {
      id: 'rare_stampede',
      name: 'The Great Crossing',
      text: 'The earth shakes. A sound like thunder that never ends. Over the ridge, an ocean of wildebeest pours across the landscape — the great migration. Hundreds of thousands of hooves churning the earth to dust. Nothing can stand in their path. Nothing can track through their wake.',
      choices: [
        { key: 'join_stampede', name: 'Run With the Herd', description: 'Join the migration — be carried by the tide of bodies', effects: { heat: 15, stamina: -20, thirst: 10, hunger: 5 }, distance: 10, loseHunters: true, risk: { chance: 0.15, penalty: { stamina: -25 }, text: 'A buffalo clips you. You stumble but the momentum of the herd pushes you forward, bruised but alive.' } },
        { key: 'wait_pass', name: 'Wait for Them to Pass', description: 'Let the herd obliterate every track between you and the hunters', effects: { heat: -10, stamina: 20, thirst: 5, hunger: 5 }, distance: 0, loseHunters: true }
      ]
    },
    {
      id: 'rare_lightning_fire',
      name: 'The Sky\'s Wrath',
      text: 'Lightning strikes the earth not fifty paces from where you stand. The impact is blinding, deafening. The grass catches instantly, a ring of fire expanding outward. And then the rain comes — not drops but a solid wall of water that extinguishes the fire and fills every depression within reach.',
      choices: [
        { key: 'embrace_storm', name: 'Embrace the Storm', description: 'Stand in the rain and drink from the sky — total reset of heat and thirst', effects: { heat: -60, stamina: 5, thirst: -100, hunger: 0 }, distance: 0, loseHunters: true },
        { key: 'run_storm', name: 'Run in the Deluge', description: 'Use the chaos — the lightning, the fire, the rain — to vanish', effects: { heat: -30, stamina: -15, thirst: -100, hunger: 5 }, distance: 6, loseHunters: true }
      ]
    },
    {
      id: 'rare_volcanic_ash',
      name: 'The Mountain\'s Breath',
      text: 'A distant mountain exhales. A plume of ash rises into the sky, spreading east on the wind. Within the hour, fine gray dust settles over everything — the ground, the trees, your fur. The world turns monochrome. Scent trails are buried. Tracks fill in as fast as they\'re made.',
      choices: [
        { key: 'push_ash', name: 'Push Through the Ashfall', description: 'Run while the world is erased — everything is hidden', effects: { heat: 10, stamina: -15, thirst: 15, hunger: 5 }, distance: 5, loseHunters: true },
        { key: 'shelter_ash', name: 'Find Shelter', description: 'The ash burns the lungs — find cover and wait', effects: { heat: -10, stamina: 15, thirst: 10, hunger: 3 }, distance: 0, loseHunters: true }
      ]
    },
    {
      id: 'rare_elephant_escort',
      name: 'The Matriarch',
      text: 'An elephant matriarch blocks your path. She is ancient, her skin a landscape of wrinkles and scars. She looks at you for a long moment — and then turns and walks. She is leading you. Her herd falls into formation around you, and for a time, you walk among giants. Nothing will follow through an elephant herd. Not even the hunters.',
      choices: [
        { key: 'follow_matriarch', name: 'Follow the Matriarch', description: 'Walk with the elephants — slow but completely safe and deeply restorative', effects: { heat: -30, stamina: 20, thirst: -30, hunger: 0 }, distance: 3, loseHunters: true },
        { key: 'break_away', name: 'Break Away', description: 'You cannot slow down, even for safety', effects: null, distance: null }
      ]
    },
    {
      id: 'rare_oasis',
      name: 'The Hidden Spring',
      text: 'Behind a wall of dense brush, invisible from any distance, lies an impossible thing: a spring of clear, cold water feeding a small pool ringed with green. Fruit trees hang heavy over the water. Birds sing. It is a place the drought forgot.',
      choices: [
        { key: 'paradise', name: 'Stay and Recover', description: 'Drink, eat, rest in paradise — massive recovery but the hunters close in', effects: { heat: -50, stamina: 40, thirst: -100, hunger: -100 }, distance: -4 },
        { key: 'drink_eat_go', name: 'Drink, Eat, and Go', description: 'Take what you need and keep running', effects: { heat: -20, stamina: 5, thirst: -100, hunger: -80 }, distance: 1 }
      ]
    },
    {
      id: 'rare_shooting_stars',
      name: 'The Falling Sky',
      nightOnly: true,
      text: 'The night sky ignites. Stars fall in streaks of white fire across the darkness, dozens at a time, the heavens emptying themselves in silence. The hunters will be staring upward. Every creature is frozen in wonder. For this one moment, the chase does not exist.',
      choices: [
        { key: 'run_stars', name: 'Run While They Watch the Sky', description: 'Seize the moment — the hunters are distracted', effects: { heat: 0, stamina: -10, thirst: 3, hunger: 3 }, distance: 6, loseHunters: true },
        { key: 'watch', name: 'Watch the Sky', description: 'You too are a creature of this world. Some things are worth stopping for.', effects: { heat: -20, stamina: 25, thirst: 0, hunger: 3 }, distance: 0 }
      ]
    },
    {
      id: 'rare_river_flood',
      name: 'The Great River',
      text: 'You reach a river in full flood — not a stream but a roaring brown torrent carrying entire trees in its current. On the far side, the land is green and untouched. The hunters cannot cross this. If you can survive the crossing, you buy days of freedom.',
      choices: [
        { key: 'swim', name: 'Swim the Flood', description: 'Risk everything on the crossing — the other side means safety', effects: { heat: -30, stamina: -35, thirst: -100, hunger: 10 }, distance: 2, loseHunters: true, risk: { chance: 0.35, penalty: { stamina: -30 }, text: 'The current seizes you like a fist. You are tumbled, dragged under, spat out downstream. When you crawl onto the bank, you are broken but alive.' } },
        { key: 'follow_bank', name: 'Follow the Bank', description: 'The river blocks the hunters too — follow it for protection', effects: { heat: 5, stamina: -10, thirst: -50, hunger: 5 }, distance: 3, loseHunters: false }
      ]
    },
    {
      id: 'rare_fog_bank',
      name: 'The White World',
      text: 'A fog so thick it has weight descends over the land. You cannot see your own tail. Sound is muffled, direction is meaningless, and scent hangs in the air like cobwebs. The hunters are as blind as you. The world has become a white room with no walls.',
      choices: [
        { key: 'vanish', name: 'Vanish Into the Fog', description: 'Zigzag through the white — impossible to track, impossible to follow', effects: { heat: -20, stamina: -10, thirst: -10, hunger: 3 }, distance: 4, loseHunters: true },
        { key: 'den_up', name: 'Den Up', description: 'Find a depression and rest — invisible and safe', effects: { heat: -30, stamina: 30, thirst: -5, hunger: 3 }, distance: 0, loseHunters: true }
      ]
    },
    {
      id: 'rare_predator_king',
      name: 'The Old King',
      minDay: 10,
      text: 'A lion stands in your path. Not a young challenger — an ancient male, mane silver with age, scars mapping a lifetime of violence. He looks at you with an expression that is not hostility. It is recognition. He, too, was chased once. He turns and walks into the tall grass, and where he walked, the grass closes behind him, erasing all trace of passage.',
      choices: [
        { key: 'follow_king', name: 'Follow His Path', description: 'Walk where the old king walked — the grass erases your trail', effects: { heat: -15, stamina: 5, thirst: 0, hunger: 3 }, distance: 3, loseHunters: true },
        { key: 'own_path', name: 'Forge Your Own Path', description: 'You are not him. You find your own way.', effects: null, distance: null }
      ]
    }
  ],

  // ============================================================
  // GENERATOR METHODS
  // ============================================================

  // Track old_territory one-time firing
  _usedOldTerritory: false,

  reset() {
    this.usedSignatures = new Set();
    this.recentTerrains = [];
    this.recentOpportunities = [];
    this.recentPressures = [];
    this._usedOldTerritory = false;
  },

  generate(gameState) {
    // Force tutorial encounters on Day 1
    if (gameState.day === 1) {
      const tutorialId = gameState.phase === 'day' ? 'tutorial_day' : 'tutorial_night';
      const tutorial = this.signatures.find(s => s.id === tutorialId);
      if (tutorial && !this.usedSignatures.has(tutorialId)) {
        this.usedSignatures.add(tutorialId);
        return this.formatSignatureEncounter(tutorial, gameState);
      }
    }

    // Try rare event first
    if (Math.random() < CONFIG.encounters.rareChancePerPhase) {
      const rare = this.tryRare(gameState);
      if (rare) return rare;
    }

    // Try signature encounter
    if (Math.random() < CONFIG.encounters.signatureChancePerPhase) {
      const sig = this.trySignature(gameState);
      if (sig) return sig;
    }

    // Fall back to combinatorial
    return this.buildCombinatorial(gameState);
  },

  tryRare(gameState) {
    const eligible = this.rares.filter(r => {
      if (r.minDay && gameState.day < r.minDay) return false;
      if (r.nightOnly && gameState.phase !== 'night') return false;
      return true;
    });
    if (eligible.length === 0) return null;
    const rare = eligible[Math.floor(Math.random() * eligible.length)];
    return this.formatSignatureEncounter(rare, gameState);
  },

  trySignature(gameState) {
    const eligible = this.signatures.filter(s => {
      if (this.usedSignatures.has(s.id)) return false;
      if (s.minDay && gameState.day < s.minDay) return false;
      if (s.maxDay && gameState.day > s.maxDay) return false;
      if (s.nightOnly && gameState.phase !== 'night') return false;
      if (s.dayOnly && gameState.phase !== 'day') return false;
      return true;
    });
    if (eligible.length === 0) return null;
    const sig = eligible[Math.floor(Math.random() * eligible.length)];
    this.usedSignatures.add(sig.id);
    return this.formatSignatureEncounter(sig, gameState);
  },

  formatSignatureEncounter(encounter, gameState) {
    const actions = [];
    for (const choice of encounter.choices) {
      if (choice.effects === null) {
        // This is a "use standard action" choice
        const standardKey = choice.key;
        if (CONFIG.actions[gameState.phase] && CONFIG.actions[gameState.phase][standardKey]) {
          actions.push({
            key: standardKey,
            name: choice.name,
            description: choice.description,
            effects: CONFIG.actions[gameState.phase][standardKey],
            isStandard: true
          });
        }
      } else {
        actions.push({
          key: choice.key,
          name: choice.name,
          description: choice.description,
          effects: choice.effects,
          distance: choice.distance,
          loseHunters: choice.loseHunters || false,
          risk: choice.risk || null,
          isStandard: false
        });
      }
    }

    return {
      type: encounter.id.startsWith('rare_') ? 'rare' : 'signature',
      id: encounter.id,
      name: encounter.name,
      text: encounter.text,
      actions: actions,
      loseHuntersAvailable: actions.some(a => a.loseHunters)
    };
  },

  buildCombinatorial(gameState) {
    // Pick terrain (avoid recent)
    let availableTerrains = this.terrains.filter(t => !this.recentTerrains.includes(t.id));
    if (availableTerrains.length < 3) {
      this.recentTerrains = [];
      availableTerrains = this.terrains;
    }
    const terrain = availableTerrains[Math.floor(Math.random() * availableTerrains.length)];
    this.recentTerrains.push(terrain.id);
    if (this.recentTerrains.length > 10) this.recentTerrains.shift();

    // Pick opportunity (compatible with terrain, avoid recent)
    let availableOpps = this.opportunities.filter(o =>
      terrain.compatible.includes(o.id) && !this.recentOpportunities.includes(o.id)
    );
    if (availableOpps.length === 0) {
      availableOpps = this.opportunities.filter(o => terrain.compatible.includes(o.id));
    }
    if (availableOpps.length === 0) {
      availableOpps = this.opportunities; // fallback
    }
    const opportunity = availableOpps[Math.floor(Math.random() * availableOpps.length)];
    this.recentOpportunities.push(opportunity.id);
    if (this.recentOpportunities.length > 12) this.recentOpportunities.shift();

    // Pick pressure (condition-based, avoid recent)
    let availablePressures = this.pressures.filter(p => {
      if (this.recentPressures.includes(p.id)) return false;
      try { return p.condition(gameState); } catch(e) { return p.fallbackCondition; }
    });
    if (availablePressures.length === 0) {
      availablePressures = this.pressures.filter(p => {
        try { return p.condition(gameState); } catch(e) { return p.fallbackCondition; }
      });
    }
    if (availablePressures.length === 0) {
      availablePressures = this.pressures.filter(p => p.fallbackCondition);
    }
    const pressure = availablePressures[Math.floor(Math.random() * availablePressures.length)];
    this.recentPressures.push(pressure.id);
    if (this.recentPressures.length > 7) this.recentPressures.shift();

    // Track one-time pressures
    if (pressure.oneTime) {
      this._usedOldTerritory = true;
    }

    // Use nightText when available and phase is night
    const terrainText = (gameState.phase === 'night' && terrain.nightText) ? terrain.nightText : terrain.text;

    // Compose narrative (no "You have reached" prefix)
    const text = `${terrainText} ${opportunity.text} ${pressure.text}`;

    // Build actions: always push/trot/rest + terrain actions + opportunity actions
    const actions = this.buildCombinatorialActions(terrain, opportunity, pressure, gameState);

    return {
      type: 'combinatorial',
      id: `${terrain.id}_${opportunity.id}_${pressure.id}`,
      name: terrain.name,
      text: text,
      terrain: terrain,
      opportunity: opportunity,
      pressure: pressure,
      actions: actions,
      loseHuntersAvailable: false
    };
  },

  buildCombinatorialActions(terrain, opportunity, pressure, gameState) {
    const phase = gameState.phase;
    const actions = [];

    // Standard actions (always available)
    ['push', 'trot', 'rest'].forEach(key => {
      if (!CONFIG.actions[phase] || !CONFIG.actions[phase][key]) return;
      const base = { ...CONFIG.actions[phase][key] };

      // Apply terrain modifiers
      if (terrain.modifiers && terrain.modifiers[key]) {
        for (const [stat, mod] of Object.entries(terrain.modifiers[key])) {
          base[stat] = (base[stat] || 0) + mod;
        }
      }
      // Apply pressure modifiers
      if (pressure.modifiers && pressure.modifiers[key]) {
        for (const [stat, mod] of Object.entries(pressure.modifiers[key])) {
          base[stat] = (base[stat] || 0) + mod;
        }
      }
      // Apply opportunity modifiers
      if (opportunity.modifiers && opportunity.modifiers[key]) {
        for (const [stat, mod] of Object.entries(opportunity.modifiers[key])) {
          base[stat] = (base[stat] || 0) + mod;
        }
      }

      const names = { push: 'Push', trot: 'Trot', rest: 'Rest' };
      const descs = {
        push: `Push forward hard and gain ${base.distance} miles`,
        trot: `Trot at a steady pace and gain ${base.distance} miles`,
        rest: 'Rest and recover your strength'
      };

      actions.push({
        key: key,
        name: names[key],
        description: descs[key],
        effects: base,
        distance: base.distance,
        isStandard: true
      });
    });

    // Situational actions from terrain
    if (terrain.actions) {
      for (const tAction of terrain.actions) {
        let effectiveChance = tAction.chance;
        // Crocodile risk reduces drink chance
        if (opportunity.modifiers && opportunity.modifiers.drink && tAction.key === 'drink') {
          effectiveChance += (opportunity.modifiers.drink.chance || 0);
        }
        if (effectiveChance > 0) {
          const effectsBase = this.getSituationalEffects(phase, tAction.key);

          actions.push({
            key: tAction.key,
            name: tAction.name,
            description: `${tAction.description} (${Math.round(effectiveChance * 100)}% chance)`,
            effects: effectsBase,
            distance: 0,
            chance: effectiveChance,
            isStandard: false,
            isSituational: true
          });
        }
      }
    }

    // Situational actions from opportunity
    if (opportunity.actions) {
      for (const oAction of opportunity.actions) {
        // Don't add duplicate drink/eat if terrain already provides it
        if (actions.some(a => a.key === oAction.key && a.isSituational)) continue;

        const effectsBase = this.getSituationalEffects(phase, oAction.key);

        actions.push({
          key: oAction.key,
          name: oAction.name,
          description: `${oAction.description} (${Math.round(oAction.chance * 100)}% chance)`,
          effects: effectsBase,
          distance: 0,
          chance: oAction.chance,
          isStandard: false,
          isSituational: true
        });
      }
    }

    return actions;
  },

  getSituationalEffects(phase, key) {
    // Try phase-specific config first
    if (CONFIG.actions[phase] && CONFIG.actions[phase][key]) {
      return { ...CONFIG.actions[phase][key] };
    }
    // Try day config as fallback (drink/eat always available)
    if (CONFIG.actions.day && CONFIG.actions.day[key]) {
      return { ...CONFIG.actions.day[key] };
    }
    // Absolute fallback
    return { heat: 10, stamina: -5, thirst: 0, hunger: 0 };
  },

  /**
   * Regenerate encounter for rest action — keeps same terrain, re-rolls opportunity/pressure
   * For signature/rare encounters, re-presents the same encounter
   * @param {Object} currentEncounter - the current encounter
   * @param {Object} gameState - current game state
   * @returns {Object} - regenerated encounter
   */
  regenerateSameLocation(currentEncounter, gameState) {
    // Signature/rare encounters: phase has already advanced via advancePhase(),
    // so re-presenting the same encounter would show wrong-phase text/descriptions.
    // Generate a fresh encounter for the new phase instead.
    if (currentEncounter.type === 'signature' || currentEncounter.type === 'rare') {
      return this.generate(gameState);
    }

    // Combinatorial: keep terrain, re-roll opportunity and pressure
    const terrain = currentEncounter.terrain;
    if (!terrain) return this.generate(gameState);

    // Pick new opportunity (compatible with terrain, avoid recent)
    let availableOpps = this.opportunities.filter(o =>
      terrain.compatible.includes(o.id) && !this.recentOpportunities.includes(o.id)
    );
    if (availableOpps.length === 0) {
      availableOpps = this.opportunities.filter(o => terrain.compatible.includes(o.id));
    }
    if (availableOpps.length === 0) {
      availableOpps = this.opportunities;
    }
    const opportunity = availableOpps[Math.floor(Math.random() * availableOpps.length)];
    this.recentOpportunities.push(opportunity.id);
    if (this.recentOpportunities.length > 12) this.recentOpportunities.shift();

    // Pick new pressure (condition-based, avoid recent)
    let availablePressures = this.pressures.filter(p => {
      if (this.recentPressures.includes(p.id)) return false;
      try { return p.condition(gameState); } catch(e) { return p.fallbackCondition; }
    });
    if (availablePressures.length === 0) {
      availablePressures = this.pressures.filter(p => {
        try { return p.condition(gameState); } catch(e) { return p.fallbackCondition; }
      });
    }
    if (availablePressures.length === 0) {
      availablePressures = this.pressures.filter(p => p.fallbackCondition);
    }
    const pressure = availablePressures[Math.floor(Math.random() * availablePressures.length)];
    this.recentPressures.push(pressure.id);
    if (this.recentPressures.length > 7) this.recentPressures.shift();

    if (pressure.oneTime) {
      this._usedOldTerritory = true;
    }

    // Use nightText when available and phase is night
    const terrainText = (gameState.phase === 'night' && terrain.nightText) ? terrain.nightText : terrain.text;

    const text = `${terrainText} ${opportunity.text} ${pressure.text}`;
    const actions = this.buildCombinatorialActions(terrain, opportunity, pressure, gameState);

    return {
      type: 'combinatorial',
      id: `${terrain.id}_${opportunity.id}_${pressure.id}`,
      name: terrain.name,
      text: text,
      terrain: terrain,
      opportunity: opportunity,
      pressure: pressure,
      actions: actions,
      loseHuntersAvailable: false
    };
  }
};
