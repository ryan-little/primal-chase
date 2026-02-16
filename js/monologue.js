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
    { mood: 'desperate', triggers: ['after_drink'], text: 'Water. Something wet ran from my eyes that was not sweat. I do not have a word for what my body did.' },
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
    { mood: 'haunted', nightOnly: true, text: 'Another night. I have stopped counting them. The dark is just the space between one suffering and the next.' },

    // ===================== TERRAIN-REACTIVE =====================

    // terrain_water — water awareness
    { mood: 'confident', triggers: ['terrain_water'], text: 'I smell water on the air. The land still offers its palm to those who know where to look.' },
    { mood: 'confident', triggers: ['terrain_water'], text: 'The ground is damp here. The earth remembers rain even when the sky has forgotten.' },
    { mood: 'confident', triggers: ['terrain_water'], text: 'Water nearby. My nose reads its signature in the dust like a language only we speak.' },
    { mood: 'concerned', triggers: ['terrain_water'], text: 'Water close — I can taste it in the air. But water draws everything. Prey, predator, hunter.' },
    { mood: 'concerned', triggers: ['terrain_water'], text: 'The pull of water is almost pain. But drinking means stopping, and stopping means they gain.' },
    { mood: 'concerned', triggers: ['terrain_water'], text: 'Damp earth underfoot. A promise and a trap in the same breath.' },
    { mood: 'desperate', triggers: ['terrain_water'], text: 'Water. The smell of it is a knife in my throat. Every instinct screams to drink.' },
    { mood: 'desperate', triggers: ['terrain_water'], text: 'I can hear water moving somewhere beneath the cracked earth. So close. So dangerous to stop.' },
    { mood: 'desperate', triggers: ['terrain_water'], text: 'The wet ground mocks me. Water everywhere and every moment spent drinking is a moment they close.' },
    { mood: 'haunted', triggers: ['terrain_water'], text: 'Water. I remember when it meant life. Now it is just another choice between slow death and fast death.' },
    { mood: 'haunted', triggers: ['terrain_water'], text: 'The stream does not care who drinks from it — the hunted or the hunter. Water has no loyalty.' },

    // terrain_open — exposure, vulnerability
    { mood: 'confident', triggers: ['terrain_open'], text: 'Open ground. I can see everything and everything can see me. But I am fastest in the open.' },
    { mood: 'confident', triggers: ['terrain_open'], text: 'The flat stretches before me like an invitation. No obstacles. Just speed and distance.' },
    { mood: 'concerned', triggers: ['terrain_open'], text: 'Nowhere to hide out here. The land is a table and I am served upon it.' },
    { mood: 'concerned', triggers: ['terrain_open'], text: 'The openness presses down on me. Every direction is escape and exposure both.' },
    { mood: 'concerned', triggers: ['terrain_open'], text: 'I feel their eyes on me across this flat ground. No cover. No shadow. Just the naked run.' },
    { mood: 'desperate', triggers: ['terrain_open'], text: 'The open ground offers nothing — no shade, no water, no mercy. Just distance to be covered or died upon.' },
    { mood: 'desperate', triggers: ['terrain_open'], text: 'I am a mark on an empty page out here. Visible. Exposed. Running in plain sight.' },
    { mood: 'haunted', triggers: ['terrain_open'], text: 'The emptiness is total. No tree, no stone, no shadow. Just the sky pressing down and the earth offering nothing.' },
    { mood: 'haunted', triggers: ['terrain_open'], text: 'The flat ground stretches in every direction like a promise with no end. I have been running across nothing for days.' },

    // terrain_dense — cover, difficulty, hiding
    { mood: 'confident', triggers: ['terrain_dense'], text: 'Thick cover. I vanish into it like a shadow returning home.' },
    { mood: 'confident', triggers: ['terrain_dense'], text: 'The undergrowth closes around me. In here I am invisible. In here I am what I was born to be.' },
    { mood: 'confident', triggers: ['terrain_dense'], text: 'Let them try to track me through this. I was made to move where others stumble.' },
    { mood: 'concerned', triggers: ['terrain_dense'], text: 'Dense cover slows me but it slows them too. At least I can breathe without being watched.' },
    { mood: 'concerned', triggers: ['terrain_dense'], text: 'The thorns catch at my sides. Cover has its costs.' },
    { mood: 'desperate', triggers: ['terrain_dense'], text: 'I crash through the brush like something wounded. Grace is a memory. Survival is a tangle of branches.' },
    { mood: 'desperate', triggers: ['terrain_dense'], text: 'The thicket holds me and hinders me. I cannot tell if it is shelter or a cage.' },
    { mood: 'haunted', triggers: ['terrain_dense'], text: 'The vegetation closes in like the walls of a shrinking world. I push through because stopping is not an option.' },
    { mood: 'haunted', triggers: ['terrain_dense'], text: 'Deep in the cover where nothing can see me. But they do not need to see. They only need to follow.' },

    // terrain_rocky — stone, footing, permanence
    { mood: 'confident', triggers: ['terrain_rocky'], text: 'Stone underfoot. The rock leaves no prints for them to read.' },
    { mood: 'confident', triggers: ['terrain_rocky'], text: 'I leap from boulder to boulder. My paws know stone the way theirs know earth.' },
    { mood: 'concerned', triggers: ['terrain_rocky'], text: 'The rocks slow my stride but swallow my tracks. A fair trade, for now.' },
    { mood: 'concerned', triggers: ['terrain_rocky'], text: 'Hard ground. My pads ache where they used to grip. The stone is patient and I am not.' },
    { mood: 'desperate', triggers: ['terrain_rocky'], text: 'I stumble on the rocks. My paws slip where once they gripped. Even the stone has turned against me.' },
    { mood: 'desperate', triggers: ['terrain_rocky'], text: 'The rocks cut into my pads. I leave blood on the stone and pray the rain comes before they do.' },
    { mood: 'haunted', triggers: ['terrain_rocky'], text: 'These rocks have been here since before my kind existed. They will be here long after.' },
    { mood: 'haunted', triggers: ['terrain_rocky'], text: 'Stone and bone. The oldest materials. I feel both of them grinding together inside me.' },

    // terrain_shelter — rest potential, hiding tension
    { mood: 'confident', triggers: ['terrain_shelter'], text: 'Shelter. The land offers a place to pause, to gather what the running has scattered.' },
    { mood: 'concerned', triggers: ['terrain_shelter'], text: 'A place to hide. The temptation to curl up and disappear is almost overwhelming.' },
    { mood: 'desperate', triggers: ['terrain_shelter'], text: 'Shelter here. The urge to stop, to hide, to simply cease — it pulls like gravity.' },
    { mood: 'haunted', triggers: ['terrain_shelter'], text: 'A place to rest. Or a place to end. The two have become difficult to tell apart.' },

    // ===================== PRESSURE-REACTIVE =====================

    // pressure_injury — pain, body failing
    { mood: 'confident', triggers: ['pressure_injury'], text: 'Pain is information. My body speaks and I listen. It says: keep moving.' },
    { mood: 'confident', triggers: ['pressure_injury'], text: 'A small hurt. My body has weathered worse. This will not slow me.' },
    { mood: 'concerned', triggers: ['pressure_injury'], text: 'The pain is a constant companion now. It walks beside me like a second shadow.' },
    { mood: 'concerned', triggers: ['pressure_injury'], text: 'Every step sends a jolt through me. The body keeps count of debts the mind tries to ignore.' },
    { mood: 'concerned', triggers: ['pressure_injury'], text: 'I favor the leg without thinking. The limp will cost me distance. Distance I cannot spare.' },
    { mood: 'desperate', triggers: ['pressure_injury'], text: 'The pain has become the landscape. I run through it the way I run through dust.' },
    { mood: 'desperate', triggers: ['pressure_injury'], text: 'My body is failing in small ways, one piece at a time, like a thing coming unstitched.' },
    { mood: 'desperate', triggers: ['pressure_injury'], text: 'I cannot feel the injured leg anymore. I do not know if this is healing or dying.' },
    { mood: 'haunted', triggers: ['pressure_injury'], text: 'The pain has stopped being a warning. It is just the sound my body makes now.' },
    { mood: 'haunted', triggers: ['pressure_injury'], text: 'I carry the injury the way the land carries scars — silently, permanently, without complaint.' },

    // pressure_weather — storm, sun, wind
    { mood: 'confident', triggers: ['pressure_weather'], text: 'The sky shifts. Weather is neither friend nor enemy — it simply is.' },
    { mood: 'confident', triggers: ['pressure_weather'], text: 'I have outrun storms before. The sky does not hunt with purpose.' },
    { mood: 'concerned', triggers: ['pressure_weather'], text: 'The air is changing. Pressure building. Even the sky is restless today.' },
    { mood: 'concerned', triggers: ['pressure_weather'], text: 'The weather turns. One more variable in a world that has too many.' },
    { mood: 'desperate', triggers: ['pressure_weather'], text: 'The sky presses down like a hand on my back. Even the air wants me to stop.' },
    { mood: 'desperate', triggers: ['pressure_weather'], text: 'Storm or sun, it does not matter. The weather is just another thing that will not let me rest.' },
    { mood: 'haunted', triggers: ['pressure_weather'], text: 'The sky darkens and I do not care. When everything is a threat, nothing is.' },

    // pressure_hunter_sign — scent, tracks, dread
    { mood: 'confident', triggers: ['pressure_hunter_sign'], text: 'Their scent on the wind. Closer than I would like, but I have widened worse gaps.' },
    { mood: 'concerned', triggers: ['pressure_hunter_sign'], text: 'I feel them closing. Not a sound, not a sight — just a pressure in the air that was not there before.' },
    { mood: 'concerned', triggers: ['pressure_hunter_sign'], text: 'The ground carries their vibration. A rhythm that does not belong to this land.' },
    { mood: 'desperate', triggers: ['pressure_hunter_sign'], text: 'Their presence is a weight I carry. Even when I cannot see them, I feel them gaining.' },
    { mood: 'desperate', triggers: ['pressure_hunter_sign'], text: 'Every gust brings their smell. Sweat and smoke and something cold and deliberate.' },
    { mood: 'haunted', triggers: ['pressure_hunter_sign'], text: 'I sense them the way bone knows cold. Not thought, not sight. Just the certainty of approach.' },
    { mood: 'haunted', triggers: ['pressure_hunter_sign'], text: 'Their sign is everywhere now. In the bent grass, the disturbed dust, the silence of birds. They are close.' },

    // pressure_decay — vultures, flies, death
    { mood: 'concerned', triggers: ['pressure_decay'], text: 'The flies find the weak. They have found me.' },
    { mood: 'concerned', triggers: ['pressure_decay'], text: 'Wings circling above. The scavengers have placed their wager on my death.' },
    { mood: 'desperate', triggers: ['pressure_decay'], text: 'The vultures descend lower with each passing hour. They can smell what I refuse to admit.' },
    { mood: 'desperate', triggers: ['pressure_decay'], text: 'Flies on my wounds. The land is already claiming me in small ways.' },
    { mood: 'haunted', triggers: ['pressure_decay'], text: 'The vultures do not circle anymore. They follow in a straight line. They know where this ends.' },
    { mood: 'haunted', triggers: ['pressure_decay'], text: 'Death attends me patiently — in the buzz of flies, the drift of wings. It is in no hurry. Neither are they.' },

    // ===================== COMBINED TRIGGERS =====================

    // terrain_open + hunters_close — exposed with threat nearby
    { mood: 'concerned', triggers: ['terrain_open', 'hunters_medium'], text: 'Open ground and their dust on the horizon. I am a dark mark on a bright page and they can read me.' },
    { mood: 'desperate', triggers: ['terrain_open', 'hunters_close'], text: 'No cover and they are so close. The open ground is an arena now, not an escape.' },
    { mood: 'haunted', triggers: ['terrain_open', 'hunters_close'], text: 'The flat earth offers no mercy. They can see me as clearly as I can see them. We run in plain view of each other\'s fate.' },

    // terrain_water + high_thirst — desire vs danger
    { mood: 'concerned', triggers: ['terrain_water', 'high_thirst'], text: 'Water so close and my throat so dry. The cruelest kindness the land can offer.' },
    { mood: 'desperate', triggers: ['terrain_water', 'high_thirst'], text: 'The smell of water and my body screams for it. Every instinct against every calculation. Drink and lose ground. Run and wither.' },
    { mood: 'haunted', triggers: ['terrain_water', 'high_thirst'], text: 'Water. My cracked tongue knows it is there before my eyes confirm. To drink is to die slowly. To not drink is to die faster.' },

    // terrain_dense + lost_hunters — relief in cover
    { mood: 'confident', triggers: ['terrain_dense', 'lost_hunters'], text: 'Lost them in the thicket. The land conspires with me today — cover and silence and vanishing trails.' },
    { mood: 'concerned', triggers: ['terrain_dense', 'lost_hunters'], text: 'Deep in the brush and they have lost the trail. But cover that hides me also blinds me.' },

    // terrain_shelter + near_death — final rest
    { mood: 'desperate', triggers: ['terrain_shelter', 'near_death'], text: 'Shelter and the end of what my body can give. The two arrive together like old friends.' },
    { mood: 'haunted', triggers: ['terrain_shelter', 'near_death'], text: 'A place to rest. Perhaps the last place. The stone overhead would make a fine ceiling for a final sleep.' },

    // terrain_rocky + hunters_close — tactical advantage
    { mood: 'concerned', triggers: ['terrain_rocky', 'hunters_close'], text: 'Rocks slow them more than me. I know these surfaces. Their flat feet do not.' },
    { mood: 'desperate', triggers: ['terrain_rocky', 'hunters_close'], text: 'The rocks are my last advantage. Their feet blister on what my paws grip. But the advantage shrinks.' },

    // ===================== ADDITIONAL GENERAL MOOD =====================

    // Extra confident
    { mood: 'confident', text: 'The horizon is a dare and I accept it with every stride.' },
    { mood: 'confident', text: 'My shadow stretches long behind me. It cannot keep up either.' },
    { mood: 'confident', text: 'I have survived droughts, rivals, and the lean seasons. This is just another test.' },
    { mood: 'confident', text: 'The ground knows me. It yields where I land and springs where I push. We are partners, the earth and I.' },
    { mood: 'confident', text: 'There is a joy in running that they will never understand. For me it is not flight — it is flight itself, the art of it.' },

    // Extra concerned
    { mood: 'concerned', text: 'I pant more than I move. The ratio has shifted and not in my favor.' },
    { mood: 'concerned', text: 'The land offers less each day. Drier. Harder. As if it is retreating from me too.' },
    { mood: 'concerned', text: 'My ribs are showing. I can feel them with each breath, like bars of a cage closing in.' },
    { mood: 'concerned', text: 'I used to choose my path. Now I take whatever the land leaves open.' },
    { mood: 'concerned', text: 'The distance between rest and ruin grows thinner with each sunrise.' },

    // Extra desperate
    { mood: 'desperate', text: 'I run because my body still remembers how, even when my mind has forgotten why.' },
    { mood: 'desperate', text: 'The land has become a blur. Terrain changes and I barely notice. All ground is the same ground now — the ground between me and them.' },
    { mood: 'desperate', text: 'There is something beyond exhaustion. A place where the body moves and the self watches from somewhere far away. I am there now.' },
    { mood: 'desperate', text: 'I have become a single purpose wrapped in failing muscle. Run. Just run.' },
    { mood: 'desperate', text: 'My joints creak like the hinges of something long abandoned. But they hold. For now, they hold.' },

    // Extra haunted
    { mood: 'haunted', text: 'I have crossed this land from one horizon to the other and found no edge to escape beyond.' },
    { mood: 'haunted', text: 'The world has shrunk to the space between my paws and their footsteps. Everything else is decoration.' },
    { mood: 'haunted', text: 'I used to know what I was. Predator. King. Now I am just the distance between two points that are slowly becoming one.' },
    { mood: 'haunted', text: 'Every landscape I cross becomes a eulogy. The riverbed where I drank. The ridge where I rested. Places that knew me alive.' },
    { mood: 'haunted', text: 'They will not stop. I have accepted this. The question is no longer whether, but when, and whether I will be running when it happens.' },

    // ===================== TERRAIN-REACTIVE (EXPANDED) =====================

    // terrain_water — additional
    { mood: 'confident', triggers: ['terrain_water'], text: 'The rivers are mine. I was born to this wet season, raised on flood plains that swallowed the horizon.' },
    { mood: 'confident', triggers: ['terrain_water'], text: 'Where there is water there is life, and where there is life I am at the top of it. This is still my world.' },
    { mood: 'confident', triggers: ['terrain_water'], text: 'I hear the water before I see it. My ears know the sound the way my paws know the earth — without thinking.' },
    { mood: 'concerned', triggers: ['terrain_water'], text: 'So much water and yet drinking means stopping. The cruelty of abundance.' },
    { mood: 'concerned', triggers: ['terrain_water'], text: 'The banks are trampled with tracks. Everything comes to drink. I am no different. I hate that I am no different.' },
    { mood: 'concerned', triggers: ['terrain_water'], text: 'Water ahead. But water draws everything to the same narrow ground. I can smell what else has come.' },
    { mood: 'desperate', triggers: ['terrain_water'], text: 'I wade through shallows and my body begs me to collapse into them. Just lie down. Just drink until the burning stops.' },
    { mood: 'desperate', triggers: ['terrain_water'], text: 'The water runs cool over my paws and the relief is so sharp it hurts. I could die here and call it mercy.' },
    { mood: 'desperate', triggers: ['terrain_water'], text: 'Wet earth. Wet air. My tongue cracks at the taste of it in the wind. So close. So costly.' },
    { mood: 'haunted', triggers: ['terrain_water'], text: 'Water everywhere. I have crossed three rivers in as many days and they are still behind me. What did I do to earn this?' },
    { mood: 'haunted', triggers: ['terrain_water'], text: 'The river does not know it is beautiful. It does not know I am dying beside it. It runs because that is what rivers do. So do I.' },

    // terrain_open — additional
    { mood: 'confident', triggers: ['terrain_open'], text: 'The open plain is my kingdom. No walls, no ceiling — just the honest conversation between speed and earth.' },
    { mood: 'confident', triggers: ['terrain_open'], text: 'Nothing between me and the horizon but heat and will. I was made for this distance.' },
    { mood: 'concerned', triggers: ['terrain_open'], text: 'The flatness goes on forever. Nowhere to rest, nowhere to vanish. Just the long, honest run.' },
    { mood: 'concerned', triggers: ['terrain_open'], text: 'Every step out here is visible. I might as well be leaving a trail of fire across the sky.' },
    { mood: 'desperate', triggers: ['terrain_open'], text: 'Nowhere to hide. The sky presses down and the earth offers nothing. I am a mark on an empty page.' },
    { mood: 'desperate', triggers: ['terrain_open'], text: 'The plain offers only distance and distance is not enough anymore. I need a miracle. The open ground does not deal in those.' },
    { mood: 'haunted', triggers: ['terrain_open'], text: 'The emptiness feels personal. As if the land has cleared itself to give them a better view of me dying.' },
    { mood: 'haunted', triggers: ['terrain_open'], text: 'I have been crossing open ground for so long that I have forgotten what shelter looks like. Was there ever shade?' },

    // terrain_dense — additional
    { mood: 'confident', triggers: ['terrain_dense'], text: 'I vanish into cover like water into sand. This is what they do not understand — I am not lost, I am hidden.' },
    { mood: 'confident', triggers: ['terrain_dense'], text: 'The branches close behind me like a door. In here my scent disperses, my prints disappear. I am smoke.' },
    { mood: 'confident', triggers: ['terrain_dense'], text: 'Thick bush. My body remembers how to flow through gaps that would stop anything walking upright.' },
    { mood: 'concerned', triggers: ['terrain_dense'], text: 'The cover hides me but it slows me too. I trade speed for invisibility and hope the exchange rate holds.' },
    { mood: 'concerned', triggers: ['terrain_dense'], text: 'Branches scrape my ribs as I push through. Every thorn is a small tax on a dwindling treasury.' },
    { mood: 'desperate', triggers: ['terrain_dense'], text: 'I crash through the brush and leave fur on every thorn. A trail of myself, torn and scattered. They will not need to track me. They can just follow the pieces.' },
    { mood: 'desperate', triggers: ['terrain_dense'], text: 'The thicket holds me like a net. Every direction costs something — skin, breath, time I do not have.' },
    { mood: 'haunted', triggers: ['terrain_dense'], text: 'The thicket closes around me and I wonder: am I seeking shelter or a grave?' },
    { mood: 'haunted', triggers: ['terrain_dense'], text: 'Deep in the green dark where nothing watches. But the silence here is not peace. It is the held breath before the hand closes.' },

    // terrain_rocky — additional
    { mood: 'confident', triggers: ['terrain_rocky'], text: 'Stone leaves no story. I cross the rock and behind me — nothing. Not a print. Not a scent. Ghost.' },
    { mood: 'confident', triggers: ['terrain_rocky'], text: 'My claws find grip in stone that their flat feet slide across. The rock is my ally today.' },
    { mood: 'concerned', triggers: ['terrain_rocky'], text: 'The rocks remember nothing. No scent, no track, no story. But my pads are bleeding and the stone keeps its own account.' },
    { mood: 'concerned', triggers: ['terrain_rocky'], text: 'Hard footing. My ankles ache with the impact of it. Stone does not forgive a bad step.' },
    { mood: 'desperate', triggers: ['terrain_rocky'], text: 'I slip on the rocks and for a moment think: this is it. The fall will be faster than them. But my legs catch me. They always do.' },
    { mood: 'desperate', triggers: ['terrain_rocky'], text: 'Blood on the stone from my torn pads. A map of my suffering painted on ancient rock. The stone does not care.' },
    { mood: 'haunted', triggers: ['terrain_rocky'], text: 'These stones were here when my kind first walked this land. They will be here when the last of us falls.' },
    { mood: 'haunted', triggers: ['terrain_rocky'], text: 'The rock endures. I do not. Between the two of us, the stone has the better argument for patience.' },

    // terrain_shelter — additional
    { mood: 'confident', triggers: ['terrain_shelter'], text: 'Cover, shade, a place to gather myself. The land remembers that I am its highest work.' },
    { mood: 'concerned', triggers: ['terrain_shelter'], text: 'The urge to hide is growing louder than the urge to run. That is a dangerous shift.' },
    { mood: 'desperate', triggers: ['terrain_shelter'], text: 'Shelter. The word alone makes something collapse inside me. I could stop. I could finally, finally stop.' },
    { mood: 'haunted', triggers: ['terrain_shelter'], text: 'Is this shelter or a resting place for the last night? I cannot tell anymore. The two look the same.' },

    // ===================== PRESSURE-REACTIVE (EXPANDED) =====================

    // pressure_injury — additional
    { mood: 'confident', triggers: ['pressure_injury'], text: 'The wound stings but the sting keeps me alert. Pain is just the body paying attention.' },
    { mood: 'confident', triggers: ['pressure_injury'], text: 'I have taken worse from rivals and mating fights. A thorn? A cut? This is nothing.' },
    { mood: 'concerned', triggers: ['pressure_injury'], text: 'The thorn works deeper with every stride. Pain is just information, I tell myself. But the information is getting louder.' },
    { mood: 'concerned', triggers: ['pressure_injury'], text: 'The limp is settling in. My body routes around the hurt automatically, but each workaround costs something else.' },
    { mood: 'desperate', triggers: ['pressure_injury'], text: 'I cannot remember what running felt like without pain. Was there ever a time my body moved without screaming?' },
    { mood: 'desperate', triggers: ['pressure_injury'], text: 'The wound has its own heartbeat now. It pulses in time with my stride, a counter-rhythm of ruin.' },
    { mood: 'haunted', triggers: ['pressure_injury'], text: 'The injury has stopped being a wound and started being a companion. It travels with me, patient as they are.' },
    { mood: 'haunted', triggers: ['pressure_injury'], text: 'My body is a ledger of damage. Every page another hurt. I have stopped reading it.' },

    // pressure_weather — additional
    { mood: 'confident', triggers: ['pressure_weather'], text: 'The wind picks up and I angle into it. Weather is just terrain that moves — you learn to read it or you learn to suffer.' },
    { mood: 'confident', triggers: ['pressure_weather'], text: 'Storm air. I can taste the rain before it falls. Let it come. The wet will erase my trail.' },
    { mood: 'concerned', triggers: ['pressure_weather'], text: 'The pressure drops and my ears flatten. Something is building in the sky that has nothing to do with me and everything to do with my survival.' },
    { mood: 'concerned', triggers: ['pressure_weather'], text: 'The air tastes of iron and ozone. The sky is choosing sides and I do not know which one it will take.' },
    { mood: 'desperate', triggers: ['pressure_weather'], text: 'The sky breaks and I cannot tell if the water on my face is rain or the last of what my body can give.' },
    { mood: 'desperate', triggers: ['pressure_weather'], text: 'Heat or cold, sun or storm — the sky has become another predator. It does not chase but it does not help.' },
    { mood: 'haunted', triggers: ['pressure_weather'], text: 'The sky darkens and I welcome it. Let the world turn to water. Let everything dissolve. At least the rain is honest.' },
    { mood: 'haunted', triggers: ['pressure_weather'], text: 'I have run through every kind of weather this land can make. None of it has killed me. None of it has saved me.' },

    // pressure_hunter_sign — additional
    { mood: 'confident', triggers: ['pressure_hunter_sign'], text: 'I smell them and my stride lengthens without thinking. The body knows what to do with threat.' },
    { mood: 'confident', triggers: ['pressure_hunter_sign'], text: 'Their sign in the grass. Broken stems, the print of a flat foot. Clumsy. I read their passage like a language written by children.' },
    { mood: 'concerned', triggers: ['pressure_hunter_sign'], text: 'The grass bends where they have passed. They are getting better at this. Learning my patterns.' },
    { mood: 'concerned', triggers: ['pressure_hunter_sign'], text: 'Ash from their fire, still warm. They rested here. They did not rest for long.' },
    { mood: 'desperate', triggers: ['pressure_hunter_sign'], text: 'Their scent is so close I can taste the smoke on my tongue. Woodfire and iron and the salt of working bodies.' },
    { mood: 'desperate', triggers: ['pressure_hunter_sign'], text: 'I see where they sharpened their spears against a rock. The stone is still scratched white. Fresh. Eager.' },
    { mood: 'haunted', triggers: ['pressure_hunter_sign'], text: 'Their sign is everywhere now. In the bent grass, the cold fire pits, the worn earth. This land belongs to them already. I am just the last thing that has not admitted it.' },
    { mood: 'haunted', triggers: ['pressure_hunter_sign'], text: 'I found a print so fresh the mud was still settling. They are right behind me. They have always been right behind me.' },

    // pressure_decay — additional
    { mood: 'confident', triggers: ['pressure_decay'], text: 'The scavengers watch. Let them. I am not done yet, and they are terrible judges of the living.' },
    { mood: 'concerned', triggers: ['pressure_decay'], text: 'A vulture lands nearby and folds its wings. It does not circle. It waits. The distinction is not comforting.' },
    { mood: 'desperate', triggers: ['pressure_decay'], text: 'The flies cluster at my eyes, my wounds, the corners of my mouth. They taste death before it arrives.' },
    { mood: 'desperate', triggers: ['pressure_decay'], text: 'The smell coming off my own body has changed. I know this smell. I have followed it to kills. It is the smell of something ending.' },
    { mood: 'haunted', triggers: ['pressure_decay'], text: 'The vultures have stopped circling. They just follow now, a patient escort to whatever comes next.' },
    { mood: 'haunted', triggers: ['pressure_decay'], text: 'I am attended by flies and followed by vultures. My court has assembled. The only ceremony left is the one I am trying to outrun.' },

    // ===================== NIGHT-ONLY (EXPANDED) =====================

    { mood: 'confident', nightOnly: true, text: 'The darkness is a cloak I was born to wear. I see what they cannot, move where they stumble.' },
    { mood: 'confident', nightOnly: true, text: 'The stars are so many tonight they cast shadows. I run by their ancient light and feel invincible.' },
    { mood: 'confident', nightOnly: true, text: 'Cool air in my lungs, dark earth beneath my paws. The night was made for this. For me.' },
    { mood: 'confident', nightOnly: true, text: 'Owls call in the dark and I answer with silence. The nocturnal understand each other.' },
    { mood: 'confident', nightOnly: true, text: 'Their fire is a weakness, not a strength. It blinds them to everything beyond its circle. I live in the everything beyond.' },

    { mood: 'concerned', nightOnly: true, text: 'The dark hides the ground and I trip on roots I cannot see. The night that sheltered me now demands its price.' },
    { mood: 'concerned', nightOnly: true, text: 'I strain to hear their footsteps but the night insects drown everything in clicking song.' },
    { mood: 'concerned', nightOnly: true, text: 'The moon is thin tonight. A sliver. Not enough light to run by, not enough dark to hide in.' },
    { mood: 'concerned', nightOnly: true, text: 'Hyenas laugh in the distance. They hunt at night too. I am not the only danger in this dark — nor the greatest.' },
    { mood: 'concerned', nightOnly: true, text: 'I used to rule the night. Now I merely survive it, one careful step at a time.' },

    { mood: 'desperate', nightOnly: true, text: 'The darkness is no longer a friend. It hides the ground, hides my wounds, hides how close they are.' },
    { mood: 'desperate', nightOnly: true, text: 'I stumble through black nothing and each fall takes longer to rise from. The night is eating me.' },
    { mood: 'desperate', nightOnly: true, text: 'I cannot see my own paws. I run on memory and prayer, and both are running out.' },
    { mood: 'desperate', nightOnly: true, text: 'Somewhere in this dark there is a rock or a root with my name on it. I will find it with my face.' },
    { mood: 'desperate', nightOnly: true, text: 'The night stretches like something alive. Each hour is longer than the last. Dawn is a rumor I no longer believe.' },

    { mood: 'haunted', nightOnly: true, text: 'I have run through so many nights they blur into one endless darkness between two bright terrors.' },
    { mood: 'haunted', nightOnly: true, text: 'The stars look down and I look up and neither of us has an answer for the other.' },
    { mood: 'haunted', nightOnly: true, text: 'The dark is not empty. It is full of sounds I used to know — the bush at night, alive and indifferent. I am part of it now. The dying part.' },
    { mood: 'haunted', nightOnly: true, text: 'Their fire is closer tonight than any night before. I can see it without turning my head. We are almost walking together now.' },
    { mood: 'haunted', nightOnly: true, text: 'The night used to feel infinite. Now it feels like a closing fist. Dawn will come, and with it, them.' },

    // ===================== COMBINED TRIGGERS (EXPANDED) =====================

    // terrain_dense + pressure_injury — pain in cover
    { mood: 'concerned', triggers: ['terrain_dense', 'pressure_injury'], text: 'The thorns catch at my wounded leg. Every snag sends fire up my spine and I bite back a sound they might hear.' },
    { mood: 'desperate', triggers: ['terrain_dense', 'pressure_injury'], text: 'The brush tears at my wounds and the wounds tear at my will. Everything in here wants a piece of me.' },

    // terrain_rocky + near_death — final footing
    { mood: 'desperate', triggers: ['terrain_rocky', 'near_death'], text: 'I slip on the stones and for a moment think: this is it. The fall will be faster than them. But my legs catch me. Somehow they always catch me.' },
    { mood: 'haunted', triggers: ['terrain_rocky', 'near_death'], text: 'The stone is warm where I lie. If I close my eyes, I could believe this is just a nap on a sun-baked kopje. In better days. In another life.' },

    // terrain_water + pressure_hunter_sign — water betrays
    { mood: 'concerned', triggers: ['terrain_water', 'pressure_hunter_sign'], text: 'Water ahead and their scent on the wind. They know I need to drink. They are waiting where the water is.' },
    { mood: 'haunted', triggers: ['terrain_water', 'pressure_hunter_sign'], text: 'I crossed the river to lose them. Then I caught their scent on the far bank. They swam. Of course they swam.' },

    // terrain_open + pressure_weather — exposed and battered
    { mood: 'desperate', triggers: ['terrain_open', 'pressure_weather'], text: 'Open ground and the sky bearing down. No shelter from above, no cover on the ground. Just the run and whatever the sky decides to do to me.' },
    { mood: 'haunted', triggers: ['terrain_open', 'pressure_weather'], text: 'The flat stretches forever and the weather comes from every direction. I am the tallest thing for miles. The lightning knows it.' },

    // terrain_shelter + pressure_decay — resting with death
    { mood: 'desperate', triggers: ['terrain_shelter', 'pressure_decay'], text: 'I crawl into shade and the flies follow me in. Even shelter cannot keep the dying away.' },
    { mood: 'haunted', triggers: ['terrain_shelter', 'pressure_decay'], text: 'I rest in the overhang and the vultures land on the rock above. They roost. They make themselves comfortable. They plan to be here a while.' },

    // terrain_dense + pressure_hunter_sign — hidden but tracked
    { mood: 'concerned', triggers: ['terrain_dense', 'pressure_hunter_sign'], text: 'I hide in the brush but I can smell them. Close. If the wind shifts, they will smell me too.' },
    { mood: 'desperate', triggers: ['terrain_dense', 'pressure_hunter_sign'], text: 'The cover hides me but their scent finds me anyway, seeping through the branches like smoke. There is no hiding from what follows by smell.' }
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

    // Terrain-based triggers
    if (gameState.currentEncounter?.terrain?.id) {
      const terrainId = gameState.currentEncounter.terrain.id;
      const cats = CONFIG.terrainCategories || {};
      for (const [category, ids] of Object.entries(cats)) {
        if (ids.includes(terrainId)) triggers.push('terrain_' + category);
      }
    }

    // Pressure-based triggers
    if (gameState.currentEncounter?.pressure?.id) {
      const pressureId = gameState.currentEncounter.pressure.id;
      const cats = CONFIG.pressureCategories || {};
      for (const [category, ids] of Object.entries(cats)) {
        if (ids.includes(pressureId)) triggers.push('pressure_' + category);
      }
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
