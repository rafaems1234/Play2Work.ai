import React from 'react';
import {
  Briefcase,
  Robot,
  Sparkle,
  Fire,
  Target,
  Trophy,
  MapPin,
  Buildings,
  Warning,
  MagicWand,
  FileText,
  Clipboard,
  LinkedinLogo,
  List,
  X,
  Exam,
} from '@phosphor-icons/react';

const wrap = (PhosphorIcon) => (props) => (
  <PhosphorIcon weight="fill" size="1em" {...props} />
);

export const IconBriefcase = wrap(Briefcase);
export const IconRobot = wrap(Robot);
export const IconSparkle = wrap(Sparkle);
export const IconFire = wrap(Fire);
export const IconTarget = wrap(Target);
export const IconTrophy = wrap(Trophy);
export const IconPin = wrap(MapPin);
export const IconBuilding = wrap(Buildings);
export const IconWarning = wrap(Warning);
export const IconWand = wrap(MagicWand);
export const IconDocument = wrap(FileText);
export const IconClipboard = wrap(Clipboard);
export const IconLinkedIn = wrap(LinkedinLogo);
export const IconMenu = wrap(List);
export const IconClose = wrap(X);
export const IconQuiz = wrap(Exam);
