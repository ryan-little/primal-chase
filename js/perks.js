// Instincts: the cat grows harder to kill the longer it lives. One choice of three each dawn,
// and another at every secret the land gives up.

export const PERKS = [
  { id: 'coat', name: 'Thick Coat', icon: '☀', max: 3, text: 'All heat you build is 15% lower.' },
  { id: 'stride', name: 'Long Stride', icon: '»', max: 3, text: 'Trot 7% faster.' },
  { id: 'lungs', name: 'Deep Lungs', icon: '≈', max: 3, text: 'Sprinting drains 15% less stamina; it refills 20% faster.' },
  { id: 'camel', name: 'Dry Throat', icon: '○', max: 3, text: 'Thirst grows 18% slower.' },
  { id: 'softpaws', name: 'Soft Paws', icon: '‧', max: 3, text: 'Your prints are 25% fainter. The band loses the trail more often.' },
  { id: 'ghost', name: 'Ghost', icon: '◌', max: 3, text: 'Hunters see you from 12% less far.' },
  { id: 'pounce', name: 'Killing Leap', icon: '↗', max: 2, text: 'Pounces fly 25% farther and cost 20% less.' },
  { id: 'hide', name: 'Scarred Hide', icon: '■', max: 3, text: 'Take 15% less damage.' },
  { id: 'river', name: 'River Cat', icon: '∿', max: 1, text: 'Move 40% faster in water. Crocodiles notice you half as often.' },
  { id: 'night', name: 'Night Stalker', icon: '☾', max: 1, text: 'At night: 12% faster, stamina refills 50% faster.' },
  { id: 'scavenger', name: 'Scavenger', icon: '✦', max: 2, text: 'Kills carry 40% more meat, and you eat 40% faster.' },
  { id: 'wind', name: 'Second Wind', icon: '↻', max: 1, text: 'Once a day, running dry refills your stamina and sheds 30 heat.' },
  { id: 'sense', name: 'Sixth Sense', icon: '◎', max: 1, text: 'Spear throws take longer to wind up. You see runners coming sooner.' },
  { id: 'apex', name: 'Apex', icon: '✕', max: 2, text: 'Knocked-down hunters stay down twice as long. Each takedown heals you.' },
  { id: 'nose', name: 'Keen Nose', icon: '❧', max: 1, text: 'Always sense water, prey and nearby secrets, from farther away.' },
  { id: 'marathon', name: 'Marathon', icon: '∞', max: 2, text: 'Trotting builds 25% less heat.' },
];

export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));
