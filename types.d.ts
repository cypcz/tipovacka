export interface Tip {
  joker: boolean;
  playerRow: number;
  playerEmail: string;
  matchNumber: number;
  scoreOne: number;
  scoreTwo: number;
}

export type TipWithRange = Tip & { range: string };

export interface Match {
  range: string;
  start: string;
}
