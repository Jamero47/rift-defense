// Besondere Nächte mit Geschichte. Sie legen den Rift fest und schalten als Belohnung Gebäude frei.

export interface StoryNight {
  id: string;
  night: number;
  riftId: string;
  title: string;
  /** Wird vor dem Kampf gezeigt */
  intro: string;
  /** Wird nach dem Sieg gezeigt */
  outro: string;
  unlocksBuilding?: string;
}

export const STORY_NIGHTS: readonly StoryNight[] = [
  {
    id: 'hofmagier',
    night: 10,
    riftId: 'tech',
    title: 'Der entführte Hofmagier',
    intro: 'Roboter aus dem Rift haben den Hofmagier verschleppt! Besiege den Mech-Titan, um ihn zu befreien.',
    outro: 'Der Hofmagier ist frei! Zum Dank gründet er in deiner Stadt eine Magiergilde.',
    unlocksBuilding: 'akademie',
  },
];

export function storyForNight(night: number): StoryNight | undefined {
  return STORY_NIGHTS.find((s) => s.night === night);
}
