'use client';
import { create } from 'zustand';

export type HangmanPhase = 'config' | 'ready' | 'countdown' | 'reveal' | 'won' | 'lost';

export interface HangmanConfig {
  timePerRound: number;
  lives: number;
  hardcore: boolean;
  turbo: boolean;
  hint: string;
  allowNumbersSymbols: boolean;
  category: string;
}

const DEFAULT_CONFIG: HangmanConfig = {
  timePerRound: 10,
  lives: 6,
  hardcore: false,
  turbo: false,
  hint: '',
  allowNumbersSymbols: false,
  category: '',
};

interface HangmanStore {
  phase: HangmanPhase;
  word: string;
  guessedLetters: string[];
  wrongLetters: string[];
  lastChosenLetter: string | null;
  lastWasCorrect: boolean | null;
  config: HangmanConfig;
  setConfig: (c: Partial<HangmanConfig>) => void;
  startGame: (word: string) => void;
  setPhase: (p: HangmanPhase) => void;
  processGuess: (letter: string) => void;
  resetGame: () => void;
}

export const useHangmanStore = create<HangmanStore>((set, get) => ({
  phase: 'config',
  word: '',
  guessedLetters: [],
  wrongLetters: [],
  lastChosenLetter: null,
  lastWasCorrect: null,
  config: DEFAULT_CONFIG,

  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),

  startGame: (word) =>
    set({
      word: word.toUpperCase().trim(),
      guessedLetters: [],
      wrongLetters: [],
      lastChosenLetter: null,
      lastWasCorrect: null,
      phase: 'ready',
    }),

  setPhase: (p) => set({ phase: p }),

  processGuess: (letter) => {
    const { word, guessedLetters, wrongLetters, config } = get();
    const upper = letter.toUpperCase();
    const isInWord = word.includes(upper);
    const newGuessed = isInWord ? [...guessedLetters, upper] : guessedLetters;
    const newWrong = !isInWord ? [...wrongLetters, upper] : wrongLetters;

    const needsGuessing = (c: string) =>
      /[A-Z]/.test(c) || (config.allowNumbersSymbols && /[0-9]/.test(c));
    const wordChars = [...new Set(word.split('').filter(needsGuessing))];
    const allGuessed = wordChars.every((l) => newGuessed.includes(l));
    const noLives = newWrong.length >= config.lives;

    set({
      lastChosenLetter: upper,
      lastWasCorrect: isInWord,
      guessedLetters: newGuessed,
      wrongLetters: newWrong,
      phase: allGuessed ? 'won' : noLives ? 'lost' : 'reveal',
    });
  },

  resetGame: () =>
    set({
      phase: 'config',
      word: '',
      guessedLetters: [],
      wrongLetters: [],
      lastChosenLetter: null,
      lastWasCorrect: null,
    }),
}));
