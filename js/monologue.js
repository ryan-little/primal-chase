// ============================================================
// MONOLOGUE.JS — Internal Monologue System
// Tagged fragments selected by mood, trigger, day range, vitals
// ============================================================

const Monologue = {

  // Track recently used fragments to avoid repeats
  recentlyUsed: [],
  maxRecent: 15,

  // ============================================================
  // FRAGMENT POOL
  // Each fragment tagged with:
  //   mood: 'confident' | 'concerned' | 'desperate' | 'haunted'
  //   triggers: optional array of specific triggers
  //   minDay / maxDay: optional day range
  // ============================================================

  fragments: [

    // ===================== CONFIDENT (Days 1-3) =====================

    // General confident
    { mood: 'confident', text: 'They will tire before I do. They always do.' },
    { mood: 'confident', text: 'I was built for this land. Every sinew, every claw. This is my world.' },
    { mood: 'confident', text: 'Let them follow. The plains are wide and I know every shadow.' },
    { mood: 'confident', text: 'My legs have outrun everything this land has ever sent after me.' },
    { mood: 'confident', text: 'The sun is high but the ground is familiar. I have hunted here. I have ruled here.' },
    { mood: 'confident', text: 'They are slow. Clumsy. They stumble where I glide.' },
    { mood: 'confident', text: 'I can feel the earth through my paws. It tells me where to go.' },
    { mood: 'confident', text: 'The wind carries their scent — heavy, sour. They do not belong here.' },
    { mood: 'confident', text: 'I have seen their kind before. They come, they fail, the hyenas laugh.' },
    { mood: 'confident', text: 'This body was forged in fire and dust. It will not break today.' },
    { mood: 'confident', text: 'Distance is my ally. Speed is my birthright.' },
    { mood: 'confident', text: 'I am the fastest thing beneath this sun. What can they hope to do?' },

    // Confident — after push
    { mood: 'confident', triggers: ['after_push'], text: 'The burst of speed felt good. Natural. I was made for this.' },
    { mood: 'confident', triggers: ['after_push'], text: 'Ground devoured. Let them try to match that.' },
    { mood: 'confident', triggers: ['after_push'], text: 'The wind in my ears drowns out everything. I am alive.' },

    // Confident — after rest
    { mood: 'confident', triggers: ['after_rest'], text: 'The shade accepts me. A brief peace before I run again.' },
    { mood: 'confident', triggers: ['after_rest'], text: 'Rest is not weakness. Even the river pauses before the falls.' },

    // Confident — after drink
    { mood: 'confident', triggers: ['after_drink'], text: 'Water. The world makes sense again when your throat is cool.' },
    { mood: 'confident', triggers: ['after_drink'], text: 'I drink and the fire inside dims. I can run again.' },

    // Confident — after eat
    { mood: 'confident', triggers: ['after_eat'], text: 'Meat in my belly. Strength returning. I am still the predator.' },
    { mood: 'confident', triggers: ['after_eat'], text: 'A full stomach makes the world smaller. Manageable. Mine.' },

    // Confident — night
    { mood: 'confident', triggers: ['night'], text: 'The night is mine. They huddle by their fire while I move through darkness.' },
    { mood: 'confident', triggers: ['night'], text: 'Stars above, earth below. The night cools what the day has burned.' },
    { mood: 'confident', triggers: ['night'], text: 'I can see in this dark. They cannot. Advantage: mine.' },

    // Confident — hunters far
    { mood: 'confident', triggers: ['hunters_far'], text: 'I can barely sense them. Perhaps they have given up. Perhaps.' },
    { mood: 'confident', triggers: ['hunters_far'], text: 'The distance between us is growing. Maybe this time they will turn back.' },

    // ===================== CONCERNED (Days 4-6) =====================

    // General concerned
    { mood: 'concerned', text: 'Why do they not stop when the sun is at its peak?' },
    { mood: 'concerned', text: 'Something is different about these ones. They do not tire as the others did.' },
    { mood: 'concerned', text: 'I have been running since dawn and they are no further behind.' },
    { mood: 'concerned', text: 'My legs know this pace. But my lungs are beginning to argue.' },
    { mood: 'concerned', text: 'The ground feels harder today. Or perhaps my paws have grown softer.' },
    { mood: 'concerned', text: 'I stopped to pant and they did not. How is that possible?' },
    { mood: 'concerned', text: 'Their rhythm never changes. Step, step, step. Like the heartbeat of the earth itself.' },
    { mood: 'concerned', text: 'I outran a lion once. In three bursts I was gone. These things are not lions.' },
    { mood: 'concerned', text: 'The heat builds inside me faster than the air can carry it away.' },
    { mood: 'concerned', text: 'Every time I look back, they are there. Not closer, not further. Just there.' },
    { mood: 'concerned', text: 'I killed to eat and they gained a mile. Was the meal worth the ground?' },
    { mood: 'concerned', text: 'There was a time when this land answered to me. Now it just watches.' },
    { mood: 'concerned', text: 'I pant. They do not. Something about their skin lets them bleed the heat away.' },

    // Concerned — after push
    { mood: 'concerned', triggers: ['after_push'], text: 'The burst bought distance but the cost... my sides heave like bellows.' },
    { mood: 'concerned', triggers: ['after_push'], text: 'I pushed hard and opened a gap. But the gap closes. It always closes.' },

    // Concerned — after rest
    { mood: 'concerned', triggers: ['after_rest'], text: 'I rest and hear them growing closer. Is there no peace in stillness?' },
    { mood: 'concerned', triggers: ['after_rest'], text: 'The body demands rest while the mind screams to run. I am at war with myself.' },

    // Concerned — high heat
    { mood: 'concerned', triggers: ['high_heat'], text: 'The heat inside me is a living thing. It grows with every stride.' },
    { mood: 'concerned', triggers: ['high_heat'], text: 'I need to pant but panting means stopping and stopping means dying.' },
    { mood: 'concerned', triggers: ['high_heat'], text: 'My blood feels thick. Slow. Like it is learning to boil.' },

    // Concerned — low stamina
    { mood: 'concerned', triggers: ['low_stamina'], text: 'My legs are not what they were this morning. Something has gone out of them.' },
    { mood: 'concerned', triggers: ['low_stamina'], text: 'Each stride costs more than the last. The debt is compounding.' },

    // Concerned — high thirst
    { mood: 'concerned', triggers: ['high_thirst'], text: 'Water. The word itself is a cruelty when the land is this dry.' },
    { mood: 'concerned', triggers: ['high_thirst'], text: 'My tongue is sandpaper. Every breath steals moisture I cannot spare.' },

    // Concerned — hunters closer
    { mood: 'concerned', triggers: ['hunters_medium'], text: 'Their dust is visible now. A brown smudge that will not wash from the horizon.' },
    { mood: 'concerned', triggers: ['hunters_medium'], text: 'I can smell them on the wind. Closer than yesterday. Closer than this morning.' },

    // Concerned — night
    { mood: 'concerned', triggers: ['night'], text: 'I see their fire. It is closer than last night.' },
    { mood: 'concerned', triggers: ['night'], text: 'They sleep by their fire while I cannot sleep at all.' },

    // Concerned — lost hunters
    { mood: 'concerned', triggers: ['lost_hunters'], text: 'I lost them. But the silence behind me feels temporary, like a held breath.' },
    { mood: 'concerned', triggers: ['lost_hunters'], text: 'The trail is broken. For now. But they found me before. They will find me again.' },

    // ===================== DESPERATE (Days 7-10) =====================

    // General desperate
    { mood: 'desperate', text: 'My legs remember speed, but my lungs have forgotten air.' },
    { mood: 'desperate', text: 'I cannot stop the panting. Each breath is a small surrender.' },
    { mood: 'desperate', text: 'The world has become very simple: run, or die. And running is becoming dying.' },
    { mood: 'desperate', text: 'How many days now? The count blurs. There is only the running.' },
    { mood: 'desperate', text: 'I was the king of this land. Now I am just meat that has not yet stopped moving.' },
    { mood: 'desperate', text: 'My paws bleed and the blood dries before it can reach the ground.' },
    { mood: 'desperate', text: 'I stagger where I used to glide. The grace is gone. Only will remains.' },
    { mood: 'desperate', text: 'They are built wrong — too slow, too soft, too strange. And yet they are winning.' },
    { mood: 'desperate', text: 'Every dawn is the same: run. Every dusk is the same: still running.' },
    { mood: 'desperate', text: 'The prey I used to chase never looked this tired. Now I understand their eyes.' },
    { mood: 'desperate', text: 'I keep running because I do not know what else to do. Instinct has replaced thought.' },
    { mood: 'desperate', text: 'There is a fire in my chest that no river can quench.' },
    { mood: 'desperate', text: 'I have crossed mountains and they climbed them too. I have forded rivers and they swam behind.' },

    // Desperate — after push
    { mood: 'desperate', triggers: ['after_push'], text: 'That push took something from me that I will not get back.' },
    { mood: 'desperate', triggers: ['after_push'], text: 'The burst is shorter now. Where once I flew, now I merely lurch.' },

    // Desperate — after rest
    { mood: 'desperate', triggers: ['after_rest'], text: 'I rest and the ground pulls at me. It would be easy to stay.' },
    { mood: 'desperate', triggers: ['after_rest'], text: 'Getting up is the hardest part now. Harder than the running.' },
    { mood: 'desperate', triggers: ['after_rest'], text: 'My body screams for more rest. My blood screams to move. The screaming never stops.' },

    // Desperate — high heat
    { mood: 'desperate', triggers: ['high_heat'], text: 'I am cooking from the inside. The heat has nowhere to go.' },
    { mood: 'desperate', triggers: ['high_heat'], text: 'My vision swims. The world melts at the edges like a fever dream.' },

    // Desperate — near death
    { mood: 'desperate', triggers: ['near_death'], text: 'I can feel the edge. One more wrong step and it is over.' },
    { mood: 'desperate', triggers: ['near_death'], text: 'My body is a cage of warnings. Every nerve screams the same word: stop.' },
    { mood: 'desperate', triggers: ['near_death'], text: 'The line between running and falling has never been thinner.' },

    // Desperate — hunters close
    { mood: 'desperate', triggers: ['hunters_close'], text: 'I can hear their breathing. It is steady. Calm. They are not even trying hard.' },
    { mood: 'desperate', triggers: ['hunters_close'], text: 'Their footsteps are a drumbeat that never varies. How do they not tire?' },
    { mood: 'desperate', triggers: ['hunters_close'], text: 'Close. So close I could turn and fight. But I know how that ends.' },

    // Desperate — night
    { mood: 'desperate', triggers: ['night'], text: 'The stars offer no counsel. The moon offers no escape.' },
    { mood: 'desperate', triggers: ['night'], text: 'Night used to mean safety. Now it is just darkness that does not slow them.' },

    // Desperate — high hunger
    { mood: 'desperate', triggers: ['high_hunger'], text: 'My stomach has stopped complaining. It has given up on me, as I am giving up on it.' },
    { mood: 'desperate', triggers: ['high_hunger'], text: 'I would eat anything now. Anything. The hunger has consumed my pride.' },

    // ===================== HAUNTED (Days 10+) =====================

    // General haunted
    { mood: 'haunted', text: 'I have crossed rivers, scaled ridges, bled into the dust. And still they come.' },
    { mood: 'haunted', text: 'What did I take from them? Why is my death worth more than all the others on this plain?' },
    { mood: 'haunted', text: 'Perhaps I was never the king. Perhaps I was always just the last prey they saved for the greatest hunt.' },
    { mood: 'haunted', text: 'They sing at night. I have heard their song carried on the wind. It sounds like inevitability.' },
    { mood: 'haunted', text: 'I begin to wonder if there is a world beyond the running. I cannot remember what stillness felt like.' },
    { mood: 'haunted', text: 'The animal I was on the first day is dead. Whatever I am now runs on something deeper than muscle.' },
    { mood: 'haunted', text: 'My territory, my kills, my shade trees — all of it behind me. All of it meaningless now.' },
    { mood: 'haunted', text: 'They do not hate me. That is the worst part. For them, I am simply a task to be completed.' },
    { mood: 'haunted', text: 'I have outlasted everything this land has sent before. But these are not of this land. They are something new.' },
    { mood: 'haunted', text: 'There is a word for what they do, but I do not have words. I only have the feeling of being slowly, patiently, unmade.' },
    { mood: 'haunted', text: 'Sometimes I forget I am running. My legs move without me. I am just a passenger now.' },
    { mood: 'haunted', text: 'I dream of the place where I was born. The smell of my mother. The warmth of the den. It was so small and so safe.' },
    { mood: 'haunted', text: 'The vultures follow me now. Not circling — just following. Patient as stone.' },
    { mood: 'haunted', text: 'If I stop, it ends. The thought is not as terrifying as it was yesterday.' },
    { mood: 'haunted', text: 'I wonder if they will tell stories about me. The one that ran the longest. The one that almost escaped.' },
    { mood: 'haunted', text: 'My ancestors ruled this land for a thousand generations. It took theirs one generation to end us.' },
    { mood: 'haunted', text: 'Something has changed in the world. The old contract between predator and prey has been rewritten, and I was not consulted.' },
    { mood: 'haunted', text: 'I see their spear-tips in my dreams. Not with fear anymore. With a kind of resigned understanding.' },

    // Haunted — lore/mystery
    { mood: 'haunted', triggers: ['lore'], text: 'They carved my shape in the dirt by their fire. I am not just prey to them. I am something more.' },
    { mood: 'haunted', triggers: ['lore'], text: 'Why me? There are easier kills on this plain. Slower. Weaker. Why does my death matter so much to them?' },
    { mood: 'haunted', triggers: ['lore'], text: 'I caught one looking at me once, across the shimmer of the heat. There was no hunger in that gaze. There was reverence.' },
    { mood: 'haunted', triggers: ['lore'], text: 'Perhaps my death is a door they need to walk through. A test. A proving. My end is their beginning.' },
    { mood: 'haunted', triggers: ['lore'], text: 'The old stories — if we had stories — would speak of a time when the two-legs were small and afraid. Those times are over.' },
    { mood: 'haunted', triggers: ['lore'], text: 'They are patient because they know something I do not. Something about what my death means.' },

    // Haunted — after push
    { mood: 'haunted', triggers: ['after_push'], text: 'I pushed, and the world went gray at the edges. I am running on fumes of what I used to be.' },
    { mood: 'haunted', triggers: ['after_push'], text: 'The push bought yards, not miles. My body is reaching the end of what it can give.' },

    // Haunted — after rest
    { mood: 'haunted', triggers: ['after_rest'], text: 'I rested and for a moment I thought: what if I just stayed? What if I just lay down?' },
    { mood: 'haunted', triggers: ['after_rest'], text: 'Rising from rest feels like tearing myself from the earth\'s embrace. It wants me to stay.' },

    // Haunted — lost hunters (again)
    { mood: 'haunted', triggers: ['lost_hunters'], text: 'I lost them again. But the relief is hollow now. A reprieve is not an escape.' },
    { mood: 'haunted', triggers: ['lost_hunters'], text: 'Gone. For now. But the silence is not peace. It is the silence between heartbeats.' },

    // Haunted — hunters very close
    { mood: 'haunted', triggers: ['hunters_close'], text: 'I can see their faces now. Young. Determined. They have been raised for this. Trained for me.' },
    { mood: 'haunted', triggers: ['hunters_close'], text: 'So close. If I turned now, I could see the whites of their eyes. But I will not turn. Not yet.' },

    // Haunted — night
    { mood: 'haunted', triggers: ['night'], text: 'The stars are the same as the first night. I am not.' },
    { mood: 'haunted', triggers: ['night'], text: 'Their fire is close enough to warm my fur. We are almost companions now, predator and prey, running the same road to its end.' },
    { mood: 'haunted', triggers: ['night'], text: 'I used to own the night. Now I just borrow it, one hour at a time.' },

    // Haunted — near death
    { mood: 'haunted', triggers: ['near_death'], text: 'The end is near. I can feel it the way you feel a storm before it breaks.' },
    { mood: 'haunted', triggers: ['near_death'], text: 'My body is telling me something my mind does not want to hear.' },
    { mood: 'haunted', triggers: ['near_death'], text: 'If this is the last day, let me run it well. Let them say I did not stop.' },

    // Haunted — exceptional survival (day 15+)
    { mood: 'haunted', minDay: 15, text: 'Fifteen days. Fifteen suns and fifteen moons and still my legs carry me. I am beyond what I was built for.' },
    { mood: 'haunted', minDay: 15, text: 'I have run further than any of my kind. I know this in my bones. There is no map for where I am now.' },
    { mood: 'haunted', minDay: 15, text: 'The hunters look tired too now. For the first time, I see something in their stride that might be doubt.' },

    // Haunted — legendary survival (day 20+)
    { mood: 'haunted', minDay: 20, text: 'Twenty days. I have become something else. Not the animal that began this run. Something forged by the running itself.' },
    { mood: 'haunted', minDay: 20, text: 'They have sent more hunters. I saw new ones join the line yesterday. My survival has become an insult they cannot bear.' },
    { mood: 'haunted', minDay: 20, text: 'If they catch me after twenty days, what will they have proved? That patience beats everything? I already knew that.' },

    // Haunted — mythic survival (day 30+)
    { mood: 'haunted', minDay: 30, text: 'Thirty days. I am a myth now, running on the edge of what is possible. Not even the vultures believed I would last this long.' },
    { mood: 'haunted', minDay: 30, text: 'I wonder if they still want to kill me, or if they just want to see how this ends. I wonder the same thing.' },

    // ===================== ADDITIONAL FRAGMENTS =====================

    // Confident — after push (additions)
    { mood: 'confident', triggers: ['after_push'], text: 'The ground vanished beneath me. That is what speed is — the earth giving way to will.' },
    { mood: 'confident', triggers: ['after_push'], text: 'My heart drums and the dust rises behind me like a curtain drawn shut.' },
    { mood: 'confident', triggers: ['after_push'], text: 'Every stride a declaration. I am not prey. I am a force the land must answer to.' },

    // Confident — after rest (additions)
    { mood: 'confident', triggers: ['after_rest'], text: 'The stillness fills me. Muscle unknotting, heat draining into cool earth.' },
    { mood: 'confident', triggers: ['after_rest'], text: 'To rest is not to surrender. The river pools before it runs.' },
    { mood: 'confident', triggers: ['after_rest'], text: 'I lie in the shade and my body remembers what it is. Not tired. Not yet.' },

    // Confident — after drink (additions)
    { mood: 'confident', triggers: ['after_drink'], text: 'Water on the tongue. The world shrinks to this one perfect thing.' },
    { mood: 'confident', triggers: ['after_drink'], text: 'Cold and clean. The thirst folds inward and is gone, like a bad dream at dawn.' },
    { mood: 'confident', triggers: ['after_drink'], text: 'I drink and something ancient in me sighs. The land provides, as it always has.' },

    // Confident — after eat (additions)
    { mood: 'confident', triggers: ['after_eat'], text: 'The weight in my belly is armor. I am fueled. I am whole.' },
    { mood: 'confident', triggers: ['after_eat'], text: 'Blood and sinew. The old transaction between predator and land, honored once more.' },
    { mood: 'confident', triggers: ['after_eat'], text: 'The hunger retreats like something ashamed. Strength fills the space it leaves.' },

    // Confident — lost hunters (additions)
    { mood: 'confident', triggers: ['lost_hunters'], text: 'They stumble in circles while I cut straight lines. This is what it means to belong here.' },
    { mood: 'confident', triggers: ['lost_hunters'], text: 'Gone. The land swallowed my trail and they are left groping at empty earth.' },
    { mood: 'confident', triggers: ['lost_hunters'], text: 'I feel the absence of their pressure like a weight lifted from my spine. The air tastes different without them.' },

    // Confident — night (additions)
    { mood: 'confident', triggers: ['night'], nightOnly: true, text: 'The dark wraps around me like a second skin. This is my element. Let them cling to their fire.' },
    { mood: 'confident', triggers: ['night'], nightOnly: true, text: 'Moonlight on my back and cool sand beneath my paws. The night was made for creatures like me.' },

    // Concerned — after push (additions)
    { mood: 'concerned', triggers: ['after_push'], text: 'The legs still answer. Somehow. But the conversation is getting shorter.' },
    { mood: 'concerned', triggers: ['after_push'], text: 'I ran hard and gained ground, but the cost rises each time. My body keeps accounts I cannot see.' },
    { mood: 'concerned', triggers: ['after_push'], text: 'The burst leaves me gasping. Once, I could do this three times before noon. Now once is a bargain with pain.' },

    // Concerned — after rest (additions)
    { mood: 'concerned', triggers: ['after_rest'], text: 'Rest, and listen to them grow closer. This is the arithmetic that will kill me.' },
    { mood: 'concerned', triggers: ['after_rest'], text: 'My muscles cool but my mind does not. Every moment still is a moment they gain.' },
    { mood: 'concerned', triggers: ['after_rest'], text: 'The shade is a mercy I can barely afford. The debt grows with every breath I take lying down.' },

    // Concerned — after drink (additions)
    { mood: 'concerned', triggers: ['after_drink'], text: 'Water, but the relief is briefer now. The thirst returns before the memory of drinking fades.' },
    { mood: 'concerned', triggers: ['after_drink'], text: 'I drink and wonder how many more times this land will offer its palm before it closes into a fist.' },

    // Concerned — after eat (additions)
    { mood: 'concerned', triggers: ['after_eat'], text: 'Food in my belly, but the taste of it has changed. Less triumph, more transaction.' },
    { mood: 'concerned', triggers: ['after_eat'], text: 'I eat, but the time it cost me sits heavier than the meal. Everything has a price now.' },

    // Concerned — night (additions)
    { mood: 'concerned', triggers: ['night'], nightOnly: true, text: 'Their fire flickers on the horizon like a second heartbeat. It never goes out.' },
    { mood: 'concerned', triggers: ['night'], nightOnly: true, text: 'The dark should comfort me. Instead I strain at every sound, parsing the wind for footfalls.' },

    // Desperate — after drink (additions)
    { mood: 'desperate', triggers: ['after_drink'], text: 'Water. I almost wept. Can animals weep? Something in me tried.' },
    { mood: 'desperate', triggers: ['after_drink'], text: 'I drink and the world reassembles itself from the blur. Not whole, but enough. Enough to run.' },

    // Desperate — after eat (additions)
    { mood: 'desperate', triggers: ['after_eat'], text: 'I ate like something feral, without grace, without the old precision. Survival has no dignity.' },
    { mood: 'desperate', triggers: ['after_eat'], text: 'The meal sits in me like a stone. My body has almost forgotten what to do with food.' },

    // Desperate — near death (additions)
    { mood: 'desperate', triggers: ['near_death'], text: 'I am a wire pulled taut. One more vibration and it snaps.' },
    { mood: 'desperate', triggers: ['near_death'], text: 'My vision darkens at the edges. The world is a tunnel now, and at its end — them.' },
    { mood: 'desperate', triggers: ['near_death'], text: 'Every breath costs more than the last. The air itself has turned against me.' },

    // Desperate — lost hunters
    { mood: 'desperate', triggers: ['lost_hunters'], text: 'Lost them. But the relief is animal and brief — I know they will find the trail again. They always do.' },
    { mood: 'desperate', triggers: ['lost_hunters'], text: 'The silence where they were is not peace. It is the silence of a predator repositioning.' },

    // Desperate — night (additions)
    { mood: 'desperate', triggers: ['night'], nightOnly: true, text: 'I move in the dark and my body creaks like old timber. The night hears everything.' },
    { mood: 'desperate', triggers: ['night'], nightOnly: true, text: 'Darkness behind me. I cannot tell if it holds them or hides me.' },

    // Haunted — after drink (additions)
    { mood: 'haunted', triggers: ['after_drink'], text: 'Water. I almost did not recognize the sensation. My body has been dry for so long it flinched at the wet.' },
    { mood: 'haunted', triggers: ['after_drink'], text: 'I drank and for one breath the chase did not exist. Then the world came back.' },

    // Haunted — after eat (additions)
    { mood: 'haunted', triggers: ['after_eat'], text: 'I ate. The act felt ancient — something from a life I can no longer reach.' },
    { mood: 'haunted', triggers: ['after_eat'], text: 'Food in my belly and it makes no difference. You cannot eat your way out of this.' },

    // Haunted — near death (additions)
    { mood: 'haunted', triggers: ['near_death'], text: 'I can feel the place where my body will stop. It is very close now. Just ahead, like a door left open.' },
    { mood: 'haunted', triggers: ['near_death'], text: 'The ground is pulling at me. Not gravity — something older. The earth wants me back.' },

    // Night-specific fragments (various moods)
    { mood: 'confident', nightOnly: true, text: 'The night air cools the furnace in my chest. I breathe deep and the dark tastes like freedom.' },
    { mood: 'concerned', nightOnly: true, text: 'I move by starlight and memory. The ground is uncertain beneath paws that can no longer see.' },
    { mood: 'desperate', nightOnly: true, text: 'The stars are indifferent. Billions of cold eyes watching me falter and offering nothing.' },
    { mood: 'haunted', nightOnly: true, text: 'Another night. I have stopped counting them. The dark is just the space between one suffering and the next.' }
  ],

  // ============================================================
  // SELECTION METHODS
  // ============================================================

  reset() {
    this.recentlyUsed = [];
  },

  getMood(day) {
    if (day <= 3) return 'confident';
    if (day <= 6) return 'concerned';
    if (day <= 10) return 'desperate';
    return 'haunted';
  },

  getTriggers(gameState, lastAction) {
    const triggers = [];

    // Action triggers
    if (lastAction === 'push') triggers.push('after_push');
    if (lastAction === 'rest') triggers.push('after_rest');
    if (lastAction === 'drink' || lastAction === 'cross' || lastAction === 'wade' ||
        lastAction === 'drink_elephants' || lastAction === 'plunge_pool' ||
        lastAction === 'dig_deep' || lastAction === 'risk_drink' ||
        lastAction === 'drink_rest' || lastAction === 'drink_go' ||
        lastAction === 'wallow') {
      triggers.push('after_drink');
    }
    if (lastAction === 'eat' || lastAction === 'hunt' || lastAction === 'scavenge' ||
        lastAction === 'fight' || lastAction === 'steal' || lastAction === 'feast' ||
        lastAction === 'gorge' || lastAction === 'raid' || lastAction === 'dominate' ||
        lastAction === 'kill_python') {
      triggers.push('after_eat');
    }

    // State triggers
    if (gameState.heat >= 70) triggers.push('high_heat');
    if (gameState.stamina <= 30) triggers.push('low_stamina');
    if (gameState.thirst >= 60) triggers.push('high_thirst');
    if (gameState.hunger >= 60) triggers.push('high_hunger');
    if (gameState.phase === 'night') triggers.push('night');
    if (gameState.hunterState === 'tracking') triggers.push('lost_hunters');

    // Hunter distance triggers
    if (gameState.hunterDistance > 20) triggers.push('hunters_far');
    if (gameState.hunterDistance >= 8 && gameState.hunterDistance <= 20) triggers.push('hunters_medium');
    if (gameState.hunterDistance < 8) triggers.push('hunters_close');

    // Near death
    if (gameState.heat >= 85 || gameState.stamina <= 15 ||
        gameState.thirst >= 85 || gameState.hunger >= 85 ||
        gameState.hunterDistance <= 3) {
      triggers.push('near_death');
    }

    // Lore — occasional, more likely at higher days
    if (Math.random() < 0.15 + (gameState.day * 0.02)) {
      triggers.push('lore');
    }

    return triggers;
  },

  select(gameState, lastAction) {
    if (!gameState) return '';

    const mood = this.getMood(gameState.day);
    const triggers = this.getTriggers(gameState, lastAction);

    // Filter fragments by mood, day, and night restriction
    let candidates = this.fragments.filter(f => {
      if (f.mood !== mood) return false;
      if (f.minDay && gameState.day < f.minDay) return false;
      if (f.maxDay && gameState.day > f.maxDay) return false;
      if (f.nightOnly && gameState.phase !== 'night') return false;
      if (this.recentlyUsed.includes(f.text)) return false;
      return true;
    });

    // Try to find a fragment matching a specific trigger (prioritize these)
    let triggered = candidates.filter(f =>
      f.triggers && f.triggers.some(t => triggers.includes(t))
    );

    // If we have triggered matches, strongly prefer them
    let selected;
    if (triggered.length > 0 && Math.random() < 0.75) {
      // Among triggered, prioritize rarer/more specific triggers
      selected = triggered[Math.floor(Math.random() * triggered.length)];
    } else {
      // Fall back to general mood fragments
      let general = candidates.filter(f => !f.triggers);
      if (general.length === 0) general = candidates;
      if (general.length === 0) {
        // Absolute fallback — clear recents and try again
        this.recentlyUsed = [];
        general = this.fragments.filter(f => f.mood === mood && !f.triggers && !(f.nightOnly && gameState.phase !== 'night'));
      }
      selected = general[Math.floor(Math.random() * general.length)];
    }

    if (selected) {
      this.recentlyUsed.push(selected.text);
      if (this.recentlyUsed.length > this.maxRecent) {
        this.recentlyUsed.shift();
      }
      return selected.text;
    }

    return '';
  }
};
