# PRIMAL CHASE
## Title Screens

```
____________ ________  ___  ___   _       _____  _   _   ___   _____ _____
| ___ \ ___ \_   _|  \/  | / _ \ | |     /  __ \| | | | / _ \ /  ___|  ___|
| |_/ / |_/ / | | | .  . |/ /_\ \| |     | /  \/| |_| |/ /_\ \\ `--.| |__
|  __/|    /  | | | |\/| ||  _  || |     | |    |  _  ||  _  | `--. \  __|
| |   | |\ \ _| |_| |  | || | | || |____ | \__/\| | | || | | |/\__/ / |___
\_|   \_| \_|\___/\_|  |_/\_| |_/\_____/  \____/\_| |_/\_| |_/\____/\____/

````

![Primal Chase Logo](primalchaselogo.png)

## Vision

A 2D, top-down, sprite-based turn based strategy game in which the player is an apex predator in an environment that is being hunted by persistence human hunters in prehistoric ages. The game is trying to escape from the human hunters for as long as possible or for however many days you can while balancing multiple status bars, similar to what an animal being run down in real life would have to balance.

## Gameplay and Mechanics
### The Player

Limited movement per day, perhaps tile-based movement like Civilization. The movement is usually less or equal to that of the human persistence hunters as that is their main advantage to catch up and kill the player. The player has two or three bars to balance as they are escaping from the human hunters, these bars are some kind of mix of health, food, and water. Health is general, so when a player attacks another animal in order to get more food or scavenges it, they may take some damage which will require the food and water bars to decrease at a faster rate versus when the health bar is totally full. Food goes down over time, with more food allowing for more maximum movement per day and the healing of the health bar. Water is similar to food, but instead of attacking animals (which does grant limited water) the player must drink from water sources they pass by while running from the hunters. The water mechanic is more a way to determine the player’s path through the map so they cannot wander into a desert for too long. It may make sense to also include a fatigue/heat bar so one cannot continue to run forever as long as they do not take much damage and must rest to some degree.

### The Hunters

*Version 1*: The hunters are essentially another player with all of the same bars but with different weights to their bars of food and water decrease and fatigue/heat increase. The hunters will largely fatigue/heat up at a hugely decreased weight than the player (sweating vs panting), allowing for them to travel further than the player in most situations when the bars are more or less equal. The hunters can also hunt and kill other animals in order to refill their bars and must also travel next to water to fill their water bars, however the hunters are also able to oversaturate their bars since humans are likely able to carry supplemental food and water with them whereas the player as an animal cannot.

*Version 2*: The hunters begin by tracking the player over the course of the first few days, however once the trail has been picked up, they are relentless persistence hunters unless put off the trail by certain random events by the player, such as getting water at a river or some other event which would mask a scent or hide your tracks. The hunters do not have the same bars as the player, they just move at a constant rate, slightly slower when tracking but the same distance when on the hunt, and hunting rate will actually also increase when visiting a river as they are able to fill their water skins and can therefore travel faster and further. A constant grind.

### The World

Contains various biomes, notably mountains, plains, jungle, forest, and deserts which all have different movement penalties depending on if the player is moving through them or the hunters. For example, mountainous terrain would likely be more difficult for both the player and the humans, jungle terrain the player as an animal may likely be easier to traverse than the hunters, etc. Biomes will also have different rates of neutral animal spawns and waterhole or waterbody spawn rates. The world itself may be procedurally generated or may be pre-created and will generally be the main way to determine how long the player will be able to survive. There will be a day/night cycle, where humans move only during the day and will camp at night, and the player may choose to continue to run for a lesser energy cost since it is cooler at night, but will not receive any kind of relief when it comes to fatigue/heat.

### The Status Bars
#### Heat

The most important of the status bars as every action taken detracts some amount of heat with daytime causing higher heat build up than actions taken at night. The player should be striving for the least amount of heat buildup as possible.

#### Stamina

The second most important status bar, as every movement requires some degree of stamina and farther movements requires more stamina. Stamina does not change regardless of day or night.

#### Thirst

Thirst is essentially a half heat status bar, with movement during the day causing three-fourths (75%) normal thirst and night causing half (50%) as much thirst than heat. Thirst must be depleted by finding water, which will completely reset thirst level, or eating food, which will reduce thirst by half as much.

#### Hunger

Hunger is a constant drain across both day and night, with the action of pushing causing double hunger loss versus the usual constant drain.

### The Actions

The three available actions for every day and night cycle are Pushing, Trotting, and Resting. Drinking and Eating are situation based.

#### Pushing

Pushing allows the player to travel double the distance they typically could by trotting at large detriment to their status bars.

#### Trotting

Trotting is the main normal speed at which you run from the hunters with normal detriment to your status bars. However, trotting does not outrun the hunters in the long run, requiring the player to push in order to stay ahead.

#### Resting

Resting covers zero distance but allows for greater heat decrease and stamina recovery, essentially trading distance to the hunters for recovery.

#### Drinking

Fully resets thirst status bar at the cost of covering zero distance. Drinking is not always the name of this action in game but it is the core of the action.

Aliases: Dig

#### Eating

Fully resets hunger status bar and half of the thirst status bar at the cost of covering zero distance. Eating is not always the name of this action but it is the core of the action.

Aliases: Scavenge

## Version Zero Ideation
### Main Screen

**HUNTED HUNTER/PRIMAL CHASE**
*Run Like Your Reign Depends On It/Outrun Their Speed, Outlast Their Stride*

Under the white glare of the midday sun, the savanna has grown quiet. These golden plains, once your unchallenged throne, now echo with a sound you cannot outrun: the rhythmic, relentless footfalls of a new kind of killer. They do not possess your speed, nor your teeth, but they carry the endurance of the Earth itself.

Your breath is heavy, your blood is simmering, and the shade is no longer a sanctuary. Every time you stop to pant, they draw closer. Every time you kill to eat, they gain ground. In the territory where you once ruled the hunt, you are now the one being run to exhaustion.

***You were born to kill, but they were born to endure. How long can a King outrun a shadow?***

[**START THE HUNT**]	[**LEARN TO RUN**]	[**THE LONGEST STRIDES**]

---
### Play Screens
#### ***EXAMPLE DAY PLAY SCREEN***:

**DAY 4**

***VITALS***
[ | | | | | | | . . . ] 70% *HEAT*
[ | | | | . . . . . . ] 40% *STAMINA*
[ | | | | | | | | . . ] 80% *THIRST*
[ | | . . . . . . . . ] 20% *HUNGER*

***THE HUNT***
The Hunters are located **5 miles** from your location. You think they have slowed down, but they’re too far away for you to be sure.

***THE CURRENT SITUATION***
You have reached a **dry riverbed**. To your left you see a **vulture** circling overhead. To your right you see some **scrub trees** offering a little bit of **shade**. You are getting warm and will need to rest soon. You are parched and need to find water as soon as you can.

**TIME TO DECIDE:**
[1] **PUSH** forward and gain **3 miles** at the cost of *20 heat* and *15 stamina*.
[2] **TROT** at a steady pace and gain **1.5 miles** at the cost of *5 heat* and *5 stamina*.
[3] **REST** under the **shade** of the **scrub trees** and gain *10 stamina* and lose *20 heat* at the cost of losing **1.5 miles** to the hunters.
[4] **DIG** into the **dry riverbed** in search of water with a *50% chance* to reset *THIRST* at the cost of *10 heat* and losing **1.5 miles** to the hunters.
[5] **SCAVENGE** whatever is making that **vulture** circle overhead to reset *HUNGER* at the cost of *20 heat* and losing **2.5 miles** to the hunters.

\>**TODAY I CHOOSE TO**: *(Enter a number)*

---
#### ***EXAMPLE NIGHT PLAY SCREEN***:

> Player selected [4] from the Example Day Play Screen

**NIGHT 4**

***VITALS***
[ | | | | | | | | . . ] 80% *HEAT*
[ | | | | . . . . . . ] 40% *STAMINA*
[ . . . . . . . . . . ] 0% *THIRST*
[ | | | . . . . . . . ] 30% *HUNGER*

***THE HUNT***
The Hunters are located **3.5 miles** from your location. You can see the fire of the hunter’s camp tonight, with the scent of the smoke traveling with the breeze.

***THE CURRENT SITUATION***
You managed to **DIG** some water out of the **dry riverbed** and reduce your *THIRST* for now, improving your *HEAT* dissipation and *STAMINA* recovery. You are now getting hot and must stop to rest as soon as possible.

**TIME TO DECIDE:**
[1] **PUSH** forward and gain **3 miles** at the cost of *15 heat* and *15 stamina*.
[2] **TROT** at a steady pace and gain **1 mile** at the cost of *5 stamina*.
[3] **REST** under the stars and gain *15 stamina* and lose *25 heat* at the cost of losing **0.5 miles** to the hunters.

\>**TONIGHT I CHOOSE TO**: *(Enter a number)*

---
### Death Screens
#### CAUGHT DEATH SCREEN

**THE CHASE HAS ENDED**

The rhythm of the footfalls has finally stopped. You tried to find a lead, but their stride was unbroken. Your muscles seized, your lungs burned like the midday sun, and as you looked back one final time, the shadow of the spear was already long upon the dust.

The savanna has a new master.

**FINAL SCORE: 8 Days Survived**
**DISTANCE COVERED: 42.5 Miles**

[**SUBMIT TO THE LONGEST STRIDES**] [**TRY TO OUTLAST THEM AGAIN**]

---
#### THIRST/HEAT DEATH SCREEN

**THE KING HAS FALLEN**

The world shimmers and fades into a blinding white. You didn't fall to a spear or a blade; you fell to the weight of your own blood. The Earth you once ruled is now pulling you down into the heat of the salt pans.

Somewhere behind you, the steady footfalls continue. They don't need to hurry now. They only need to find where you lay.

**FINAL SCORE: 8 Days Survived**
**DISTANCE COVERED: 42.5 Miles**

[**SUBMIT TO THE LONGEST STRIDES**] [**RECLAIM YOUR REIGN**]

### Actions and Status Bar Math

Let’s assume we begin at perfect and ideal conditions initially, this could be an “easy mode” in the full game but makes life easier as we figure out the best math for balancing.

Initial ideal conditions:
0% heat
100% stamina
0% thirst
0% hunger
25 mile distance to hunters

3 mile trot, 6 mile push, 5 mile hunter speed
Only days for now

Day 1
Pushing in this scenario:
++ heat, -- stamina, +++ thirst, ++ hunger

20% heat
80% stamina
15% thirst
10% hunger
26 mile distance to hunters

Trotting in this scenario:
\+ heat, - stamina, ++ thirst, + hunger

10% heat
90% stamina
10% thirst
5% hunger
23 mile distance to hunters

Day 2
Pushing in this scenario:
++ heat, -- stamina, +++ thirst, ++ hunger

40% heat
60% stamina
30% thirst
20% hunger
27 mile distance to hunters

Trotting in this scenario:
\+ heat, - stamina, ++ thirst, + hunger

20% heat
80% stamina
20% thirst
10% hunger
21 mile distance to hunters

Day 3
Pushing in this scenario:
++ heat, -- stamina, +++ thirst, ++ hunger

60% heat
40% stamina
45% thirst
30% hunger
28 mile distance to hunters

Trotting in this scenario:
\+ heat, - stamina, ++ thirst, + hunger

30% heat
70% stamina
30% thirst
15% hunger
19 mile distance to hunters

Day 4
Pushing in this scenario:
++ heat, -- stamina, +++ thirst, ++ hunger

80% heat
20% stamina
60% thirst
40% hunger
29 mile distance to hunters

Trotting in this scenario:
\+ heat, - stamina, ++ thirst, + hunger

40% heat
60% stamina
40% thirst
20% hunger
17 mile distance to hunters

Day 5
Pushing in this scenario:
++ heat, -- stamina, +++ thirst, ++ hunger

100% heat DEATH
0% stamina
80% thirst
50% hunger
30 mile distance to hunters

Trotting in this scenario:
\+ heat, - stamina, ++ thirst, + hunger

50% heat
50% stamina
50% thirst
30% hunger
15 mile distance to hunters