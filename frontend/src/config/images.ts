import childrenPlaying from '../assets/African_children_smiling_playing_together.jpg';
import femaleSocialWorker from '../assets/African_female_social_worker.jpg';
import socialWorkerHelpingMother from '../assets/African_social_worker_helping_mother.jpg';
import communityChildDevelopment from '../assets/community_child_development.jpg';
import diverseKids from '../assets/Diverse_kids_playing_togther.jpg';
import familySupport from '../assets/family_support.jpg';
import governmentLogo from '../assets/government_logo.png';
import parentAndChild from '../assets/parent_and_child.jpg';

export interface SiteImage {
  src: string;
  alt: string;
  // Intrinsic size of the file, so browsers can reserve space before it loads.
  width: number;
  height: number;
}

// Every photo used on the site, imported once from src/assets so Vite bundles and hashes it.
// Nothing here points at a local path or a localhost URL, so the images work after deployment.
export const IMAGES = {
  childrenPlaying: {
    src: childrenPlaying,
    alt: 'African children laughing and running together across a grass field at sunset',
    width: 700,
    height: 350,
  },
  diverseKids: {
    src: diverseKids,
    alt: 'A group of children from different backgrounds running and playing together in a park',
    width: 522,
    height: 383,
  },
  familySupport: {
    src: familySupport,
    alt: 'A smiling mother and father holding their young son outdoors',
    width: 1288,
    height: 860,
  },
  parentAndChild: {
    src: parentAndChild,
    alt: 'A mother in a colourful headwrap laughing with her young child',
    width: 614,
    height: 543,
  },
  socialWorker: {
    src: femaleSocialWorker,
    alt: 'A social worker in a blazer smiling while taking notes during a meeting with a client',
    width: 1125,
    height: 803,
  },
  socialWorkerHelpingMother: {
    src: socialWorkerHelpingMother,
    alt: 'A social worker crouching to speak with a mother and her children at their home',
    width: 1440,
    height: 960,
  },
  communityDevelopment: {
    src: communityChildDevelopment,
    alt: 'Community volunteers handing school bags and books to smiling children and a parent',
    width: 1200,
    height: 900,
  },
  governmentLogo: {
    src: governmentLogo,
    alt: 'South African national Coat of Arms',
    width: 395,
    height: 506,
  },
} satisfies Record<string, SiteImage>;
