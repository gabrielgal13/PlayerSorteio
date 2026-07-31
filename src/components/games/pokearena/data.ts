/* ============================================================================
 * POKÉARENA LIVE — dados estáticos
 *
 * Roster (Kanto completo + lendários de outras gerações), tabela de tipos,
 * golpes por tipo, itens, bosses, climas e eventos especiais.
 *
 * Nenhum sprite é embarcado no projeto: as imagens vêm do CDN público de
 * sprites da PokeAPI em runtime (ver spriteUrl/artworkUrl).
 * ========================================================================== */

export type PType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric' | 'ice' | 'fighting'
  | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost'
  | 'dragon' | 'dark' | 'steel' | 'fairy';

export const TYPE_COLOR: Record<PType, string> = {
  normal: '#A8A878', fire: '#FF7A3C', water: '#4FA3FF', grass: '#5FD068',
  electric: '#FFD24A', ice: '#8FE3F0', fighting: '#E0553F', poison: '#B45CD8',
  ground: '#DFBE6F', flying: '#9EB2F5', psychic: '#FF6FA5', bug: '#A9CB3B',
  rock: '#B8A038', ghost: '#8B6FD6',
  dragon: '#8B5CF6', dark: '#6D5C52', steel: '#B8C2D9', fairy: '#FF9EC4',
};

export const TYPE_LABEL: Record<PType, string> = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', grass: 'Planta', electric: 'Elétrico',
  ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso', ground: 'Terrestre',
  flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma',
  dragon: 'Dragão', dark: 'Sombrio', steel: 'Aço', fairy: 'Fada',
};

/* ---------------------------------------------------------------- tipos --- */
/** Multiplicadores do tipo ATACANTE contra o tipo DEFENSOR (ausente = 1x). */
const CHART: Partial<Record<PType, Partial<Record<PType, number>>>> = {
  normal:   { rock: .5, ghost: 0, steel: .5 },
  fire:     { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water:    { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass:    { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice:      { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison:   { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying:   { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic:  { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug:      { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock:     { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon:   { dragon: 2, steel: .5, fairy: 0 },
  dark:     { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel:    { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy:    { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
};

/** Efetividade de um golpe contra um alvo de um ou dois tipos. */
export function effectiveness(move: PType, defender: PType[]): number {
  let m = 1;
  for (const d of defender) m *= CHART[move]?.[d] ?? 1;
  return m;
}

/* -------------------------------------------------------------- espécies --- */
export interface Species {
  id: number;              // número da dex — também define o sprite
  name: string;
  types: PType[];
  evolvesTo: number[];     // vazio = estágio final; >1 = evolução ramificada (Eevee)
  evolveLevel: number;     // 0 = não evolui por nível
  rarity: 1 | 2 | 3 | 4 | 5; // 5 = lendário
  gen: number;
  stage: number;           // 0 = base, 1 = 1ª evolução, 2 = 2ª (calculado)
  power: number;           // força base agregada (calculada)
  legendary: boolean;
}

/** [id, nome, "tipo/tipo", evoluiPara(0=nenhum, "a|b|c" p/ ramificada), nível, raridade, geração] */
type Row = [number, string, string, number | string, number, number, number];

const RAW: Row[] = [
  [1, 'Bulbasaur', 'grass/poison', 2, 16, 2, 1],
  [2, 'Ivysaur', 'grass/poison', 3, 32, 3, 1],
  [3, 'Venusaur', 'grass/poison', 0, 0, 4, 1],
  [4, 'Charmander', 'fire', 5, 16, 2, 1],
  [5, 'Charmeleon', 'fire', 6, 36, 3, 1],
  [6, 'Charizard', 'fire/flying', 0, 0, 4, 1],
  [7, 'Squirtle', 'water', 8, 16, 2, 1],
  [8, 'Wartortle', 'water', 9, 36, 3, 1],
  [9, 'Blastoise', 'water', 0, 0, 4, 1],
  [10, 'Caterpie', 'bug', 11, 7, 1, 1],
  [11, 'Metapod', 'bug', 12, 10, 1, 1],
  [12, 'Butterfree', 'bug/flying', 0, 0, 2, 1],
  [13, 'Weedle', 'bug/poison', 14, 7, 1, 1],
  [14, 'Kakuna', 'bug/poison', 15, 10, 1, 1],
  [15, 'Beedrill', 'bug/poison', 0, 0, 2, 1],
  [16, 'Pidgey', 'normal/flying', 17, 18, 1, 1],
  [17, 'Pidgeotto', 'normal/flying', 18, 36, 2, 1],
  [18, 'Pidgeot', 'normal/flying', 0, 0, 3, 1],
  [19, 'Rattata', 'normal', 20, 20, 1, 1],
  [20, 'Raticate', 'normal', 0, 0, 2, 1],
  [21, 'Spearow', 'normal/flying', 22, 20, 1, 1],
  [22, 'Fearow', 'normal/flying', 0, 0, 2, 1],
  [23, 'Ekans', 'poison', 24, 22, 1, 1],
  [24, 'Arbok', 'poison', 0, 0, 2, 1],
  [25, 'Pikachu', 'electric', 26, 24, 3, 1],
  [26, 'Raichu', 'electric', 0, 0, 4, 1],
  [27, 'Sandshrew', 'ground', 28, 22, 1, 1],
  [28, 'Sandslash', 'ground', 0, 0, 2, 1],
  [29, 'Nidoran♀', 'poison', 30, 16, 1, 1],
  [30, 'Nidorina', 'poison', 31, 26, 2, 1],
  [31, 'Nidoqueen', 'poison/ground', 0, 0, 3, 1],
  [32, 'Nidoran♂', 'poison', 33, 16, 1, 1],
  [33, 'Nidorino', 'poison', 34, 26, 2, 1],
  [34, 'Nidoking', 'poison/ground', 0, 0, 3, 1],
  [35, 'Clefairy', 'fairy', 36, 28, 2, 1],
  [36, 'Clefable', 'fairy', 0, 0, 3, 1],
  [37, 'Vulpix', 'fire', 38, 28, 2, 1],
  [38, 'Ninetales', 'fire', 0, 0, 3, 1],
  [39, 'Jigglypuff', 'normal/fairy', 40, 28, 2, 1],
  [40, 'Wigglytuff', 'normal/fairy', 0, 0, 3, 1],
  [41, 'Zubat', 'poison/flying', 42, 22, 1, 1],
  [42, 'Golbat', 'poison/flying', 0, 0, 2, 1],
  [43, 'Oddish', 'grass/poison', 44, 21, 1, 1],
  [44, 'Gloom', 'grass/poison', 45, 30, 2, 1],
  [45, 'Vileplume', 'grass/poison', 0, 0, 3, 1],
  [46, 'Paras', 'bug/grass', 47, 24, 1, 1],
  [47, 'Parasect', 'bug/grass', 0, 0, 2, 1],
  [48, 'Venonat', 'bug/poison', 49, 31, 1, 1],
  [49, 'Venomoth', 'bug/poison', 0, 0, 2, 1],
  [50, 'Diglett', 'ground', 51, 26, 1, 1],
  [51, 'Dugtrio', 'ground', 0, 0, 2, 1],
  [52, 'Meowth', 'normal', 53, 28, 1, 1],
  [53, 'Persian', 'normal', 0, 0, 2, 1],
  [54, 'Psyduck', 'water', 55, 33, 1, 1],
  [55, 'Golduck', 'water', 0, 0, 2, 1],
  [56, 'Mankey', 'fighting', 57, 28, 1, 1],
  [57, 'Primeape', 'fighting', 0, 0, 2, 1],
  [58, 'Growlithe', 'fire', 59, 30, 2, 1],
  [59, 'Arcanine', 'fire', 0, 0, 4, 1],
  [60, 'Poliwag', 'water', 61, 25, 1, 1],
  [61, 'Poliwhirl', 'water', 62, 35, 2, 1],
  [62, 'Poliwrath', 'water/fighting', 0, 0, 3, 1],
  [63, 'Abra', 'psychic', 64, 16, 2, 1],
  [64, 'Kadabra', 'psychic', 65, 32, 3, 1],
  [65, 'Alakazam', 'psychic', 0, 0, 4, 1],
  [66, 'Machop', 'fighting', 67, 28, 1, 1],
  [67, 'Machoke', 'fighting', 68, 40, 2, 1],
  [68, 'Machamp', 'fighting', 0, 0, 3, 1],
  [69, 'Bellsprout', 'grass/poison', 70, 21, 1, 1],
  [70, 'Weepinbell', 'grass/poison', 71, 30, 2, 1],
  [71, 'Victreebel', 'grass/poison', 0, 0, 3, 1],
  [72, 'Tentacool', 'water/poison', 73, 30, 1, 1],
  [73, 'Tentacruel', 'water/poison', 0, 0, 2, 1],
  [74, 'Geodude', 'rock/ground', 75, 25, 1, 1],
  [75, 'Graveler', 'rock/ground', 76, 40, 2, 1],
  [76, 'Golem', 'rock/ground', 0, 0, 3, 1],
  [77, 'Ponyta', 'fire', 78, 40, 2, 1],
  [78, 'Rapidash', 'fire', 0, 0, 3, 1],
  [79, 'Slowpoke', 'water/psychic', 80, 37, 1, 1],
  [80, 'Slowbro', 'water/psychic', 0, 0, 3, 1],
  [81, 'Magnemite', 'electric/steel', 82, 30, 1, 1],
  [82, 'Magneton', 'electric/steel', 0, 0, 2, 1],
  [83, "Farfetch'd", 'normal/flying', 0, 0, 2, 1],
  [84, 'Doduo', 'normal/flying', 85, 31, 1, 1],
  [85, 'Dodrio', 'normal/flying', 0, 0, 2, 1],
  [86, 'Seel', 'water', 87, 34, 1, 1],
  [87, 'Dewgong', 'water/ice', 0, 0, 2, 1],
  [88, 'Grimer', 'poison', 89, 38, 1, 1],
  [89, 'Muk', 'poison', 0, 0, 2, 1],
  [90, 'Shellder', 'water', 91, 30, 1, 1],
  [91, 'Cloyster', 'water/ice', 0, 0, 3, 1],
  [92, 'Gastly', 'ghost/poison', 93, 25, 2, 1],
  [93, 'Haunter', 'ghost/poison', 94, 35, 3, 1],
  [94, 'Gengar', 'ghost/poison', 0, 0, 4, 1],
  [95, 'Onix', 'rock/ground', 0, 0, 2, 1],
  [96, 'Drowzee', 'psychic', 97, 26, 1, 1],
  [97, 'Hypno', 'psychic', 0, 0, 2, 1],
  [98, 'Krabby', 'water', 99, 28, 1, 1],
  [99, 'Kingler', 'water', 0, 0, 2, 1],
  [100, 'Voltorb', 'electric', 101, 30, 1, 1],
  [101, 'Electrode', 'electric', 0, 0, 2, 1],
  [102, 'Exeggcute', 'grass/psychic', 103, 32, 1, 1],
  [103, 'Exeggutor', 'grass/psychic', 0, 0, 3, 1],
  [104, 'Cubone', 'ground', 105, 28, 1, 1],
  [105, 'Marowak', 'ground', 0, 0, 2, 1],
  [106, 'Hitmonlee', 'fighting', 0, 0, 3, 1],
  [107, 'Hitmonchan', 'fighting', 0, 0, 3, 1],
  [108, 'Lickitung', 'normal', 0, 0, 2, 1],
  [109, 'Koffing', 'poison', 110, 35, 1, 1],
  [110, 'Weezing', 'poison', 0, 0, 2, 1],
  [111, 'Rhyhorn', 'ground/rock', 112, 42, 1, 1],
  [112, 'Rhydon', 'ground/rock', 0, 0, 3, 1],
  [113, 'Chansey', 'normal', 0, 0, 4, 1],
  [114, 'Tangela', 'grass', 0, 0, 2, 1],
  [115, 'Kangaskhan', 'normal', 0, 0, 3, 1],
  [116, 'Horsea', 'water', 117, 32, 1, 1],
  [117, 'Seadra', 'water', 0, 0, 2, 1],
  [118, 'Goldeen', 'water', 119, 33, 1, 1],
  [119, 'Seaking', 'water', 0, 0, 2, 1],
  [120, 'Staryu', 'water', 121, 30, 1, 1],
  [121, 'Starmie', 'water/psychic', 0, 0, 3, 1],
  [122, 'Mr. Mime', 'psychic/fairy', 0, 0, 3, 1],
  [123, 'Scyther', 'bug/flying', 0, 0, 3, 1],
  [124, 'Jynx', 'ice/psychic', 0, 0, 3, 1],
  [125, 'Electabuzz', 'electric', 0, 0, 3, 1],
  [126, 'Magmar', 'fire', 0, 0, 3, 1],
  [127, 'Pinsir', 'bug', 0, 0, 3, 1],
  [128, 'Tauros', 'normal', 0, 0, 3, 1],
  [129, 'Magikarp', 'water', 130, 20, 1, 1],
  [130, 'Gyarados', 'water/flying', 0, 0, 4, 1],
  [131, 'Lapras', 'water/ice', 0, 0, 4, 1],
  [132, 'Ditto', 'normal', 0, 0, 3, 1],
  [133, 'Eevee', 'normal', '134|135|136', 25, 3, 1],
  [134, 'Vaporeon', 'water', 0, 0, 3, 1],
  [135, 'Jolteon', 'electric', 0, 0, 3, 1],
  [136, 'Flareon', 'fire', 0, 0, 3, 1],
  [137, 'Porygon', 'normal', 0, 0, 3, 1],
  [138, 'Omanyte', 'rock/water', 139, 40, 2, 1],
  [139, 'Omastar', 'rock/water', 0, 0, 3, 1],
  [140, 'Kabuto', 'rock/water', 141, 40, 2, 1],
  [141, 'Kabutops', 'rock/water', 0, 0, 3, 1],
  [142, 'Aerodactyl', 'rock/flying', 0, 0, 4, 1],
  [143, 'Snorlax', 'normal', 0, 0, 4, 1],
  [144, 'Articuno', 'ice/flying', 0, 0, 5, 1],
  [145, 'Zapdos', 'electric/flying', 0, 0, 5, 1],
  [146, 'Moltres', 'fire/flying', 0, 0, 5, 1],
  [147, 'Dratini', 'dragon', 148, 30, 2, 1],
  [148, 'Dragonair', 'dragon', 149, 55, 3, 1],
  [149, 'Dragonite', 'dragon/flying', 0, 0, 4, 1],
  [150, 'Mewtwo', 'psychic', 0, 0, 5, 1],
  [151, 'Mew', 'psychic', 0, 0, 5, 1],
  // lendários de outras gerações (bosses e eventos)
  [243, 'Raikou', 'electric', 0, 0, 5, 2],
  [244, 'Entei', 'fire', 0, 0, 5, 2],
  [245, 'Suicune', 'water', 0, 0, 5, 2],
  [249, 'Lugia', 'psychic/flying', 0, 0, 5, 2],
  [250, 'Ho-Oh', 'fire/flying', 0, 0, 5, 2],
  [251, 'Celebi', 'psychic/grass', 0, 0, 5, 2],
  [382, 'Kyogre', 'water', 0, 0, 5, 3],
  [383, 'Groudon', 'ground', 0, 0, 5, 3],
  [384, 'Rayquaza', 'dragon/flying', 0, 0, 5, 3],
];

function buildSpecies(): Map<number, Species> {
  const map = new Map<number, Species>();
  for (const [id, name, types, evo, lvl, rarity, gen] of RAW) {
    const evolvesTo = evo === 0 ? []
      : typeof evo === 'number' ? [evo]
        : evo.split('|').map(Number);
    map.set(id, {
      id, name,
      types: types.split('/') as PType[],
      evolvesTo, evolveLevel: lvl,
      rarity: rarity as Species['rarity'],
      gen, stage: 0, power: 0,
      legendary: rarity === 5,
    });
  }
  // estágio = quantos ancestrais a espécie tem
  const parentOf = new Map<number, number>();
  for (const s of map.values()) for (const t of s.evolvesTo) parentOf.set(t, s.id);
  for (const s of map.values()) {
    let stage = 0, cur = s.id;
    while (parentOf.has(cur) && stage < 4) { cur = parentOf.get(cur)!; stage++; }
    s.stage = stage;
    // poder base: raridade manda, estágio e lendário reforçam
    s.power = 28 + s.rarity * 12 + s.stage * 9 + (s.legendary ? 26 : 0);
  }
  return map;
}

export const SPECIES = buildSpecies();
export const ALL_SPECIES: Species[] = [...SPECIES.values()];
export const CAPTURABLE: Species[] = ALL_SPECIES.filter(s => !s.legendary);
export const LEGENDARIES: Species[] = ALL_SPECIES.filter(s => s.legendary);

export function species(id: number): Species {
  return SPECIES.get(id) ?? ALL_SPECIES[0];
}

/* --------------------------------------------------------------- sprites --- */
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

/** GIF animado (Black & White). Existe para as gerações 1–5 — todo o nosso roster. */
export function spriteUrl(id: number, shiny = false): string {
  return `${SPRITE_BASE}/versions/generation-v/black-white/animated/${shiny ? 'shiny/' : ''}${id}.gif`;
}
/** PNG estático — fallback caso o GIF animado não exista/não carregue. */
export function staticSpriteUrl(id: number, shiny = false): string {
  return `${SPRITE_BASE}/${shiny ? 'shiny/' : ''}${id}.png`;
}
/** Arte oficial em alta — usada em banners de captura, boss e evolução. */
export function artworkUrl(id: number): string {
  return `${SPRITE_BASE}/other/official-artwork/${id}.png`;
}

/* --------------------------------------------------------------- golpes --- */
export interface Move { name: string; power: number; type: PType; slot: 'basic' | 'skill1' | 'skill2' | 'ult'; }

/** Cada tipo tem seu conjunto: básico, duas skills e uma ultimate. */
const MOVES_BY_TYPE: Record<PType, [string, string, string, string]> = {
  normal: ['Investida', 'Rapidez', 'Bola Trapaça', 'Hiper Raio'],
  fire: ['Brasa', 'Presas de Fogo', 'Lança-Chamas', 'Explosão de Fogo'],
  water: ['Jato d\'Água', 'Aqua Cauda', 'Surfar', 'Hidro Bomba'],
  grass: ['Chicote de Cipó', 'Folha Navalha', 'Raio Solar', 'Tempestade de Folhas'],
  electric: ['Choque do Trovão', 'Presas do Trovão', 'Raio', 'Trovão'],
  ice: ['Vento Gelado', 'Presas de Gelo', 'Raio de Gelo', 'Nevasca'],
  fighting: ['Golpe Baixo', 'Chute Duplo', 'Soco Dinâmico', 'Impacto Fechado'],
  poison: ['Ácido', 'Presas Venenosas', 'Bomba de Lodo', 'Onda Tóxica'],
  ground: ['Ataque de Areia', 'Escavar', 'Terremoto', 'Fissura'],
  flying: ['Rajada de Vento', 'Bico Perfurante', 'Asa de Aço', 'Pássaro Bravo'],
  psychic: ['Confusão', 'Onda Mental', 'Psíquico', 'Psico-Impacto'],
  bug: ['Picada', 'Ataque Rápido', 'Broca Ferrão', 'Megachifre'],
  rock: ['Lançar Pedra', 'Avalanche de Rochas', 'Deslizamento', 'Golpe de Meteoro'],
  ghost: ['Lambida', 'Bola Sombria', 'Garra Sombria', 'Grito Fantasma'],
  dragon: ['Fúria do Dragão', 'Garra do Dragão', 'Dança do Dragão', 'Meteoro Dracônico'],
  dark: ['Perseguir', 'Mordida', 'Pulso Sombrio', 'Investida Noturna'],
  steel: ['Garra de Metal', 'Cabeçada de Ferro', 'Rajada Metálica', 'Canhão Blindado'],
  fairy: ['Beijo Doce', 'Brisa Encantada', 'Voz Angelical', 'Fulgor Lunar'],
};

const MOVE_POWER = { basic: 24, skill1: 38, skill2: 52, ult: 86 } as const;

export function movesFor(types: PType[]): Move[] {
  const primary = types[0];
  const names = MOVES_BY_TYPE[primary];
  const secondary = types[1];
  const out: Move[] = [
    { name: names[0], power: MOVE_POWER.basic, type: primary, slot: 'basic' },
    { name: names[1], power: MOVE_POWER.skill1, type: primary, slot: 'skill1' },
    { name: secondary ? MOVES_BY_TYPE[secondary][2] : names[2], power: MOVE_POWER.skill2, type: secondary ?? primary, slot: 'skill2' },
    { name: names[3], power: MOVE_POWER.ult, type: primary, slot: 'ult' },
  ];
  return out;
}

/* -------------------------------------------------------------- estilos --- */
export type StyleKey = 'attack' | 'defense' | 'support' | 'speed';

export interface StyleDef {
  key: StyleKey; label: string; emoji: string; color: string; desc: string;
  atk: number; def: number; spd: number; heal: number; ultBias: number;
}

export const STYLES: Record<StyleKey, StyleDef> = {
  attack:  { key: 'attack',  label: 'ATAQUE',  emoji: '⚔️', color: '#FF6B6B', desc: 'Dano alto, defesa baixa. Usa a ultimate assim que carrega.', atk: 1.35, def: 0.82, spd: 1.0,  heal: 0,    ultBias: 1.5 },
  defense: { key: 'defense', label: 'DEFESA',  emoji: '🛡️', color: '#4FA3FF', desc: 'Aguenta muito mais pancada, mas bate menos.',              atk: 0.78, def: 1.55, spd: 0.9,  heal: 0.15, ultBias: 0.7 },
  support: { key: 'support', label: 'SUPORTE', emoji: '💚', color: '#7CFFB2', desc: 'Cura os aliados feridos a cada turno.',                    atk: 0.85, def: 1.15, spd: 1.0,  heal: 0.9,  ultBias: 0.8 },
  speed:   { key: 'speed',   label: 'VELOZ',   emoji: '⚡', color: '#FFD24A', desc: 'Ataca com muito mais frequência, mas é frágil.',          atk: 0.92, def: 0.88, spd: 1.75, heal: 0,    ultBias: 1.1 },
};

export const STYLE_ALIASES: Record<string, StyleKey> = {
  attack: 'attack', ataque: 'attack', atk: 'attack', dano: 'attack',
  defense: 'defense', defesa: 'defense', def: 'defense', tank: 'defense',
  support: 'support', suporte: 'support', sup: 'support', cura: 'support', healer: 'support',
  speed: 'speed', velocidade: 'speed', veloz: 'speed', spd: 'speed', rapido: 'speed',
};

/* ---------------------------------------------------------------- itens --- */
export type ItemKey =
  | 'pokeball' | 'greatball' | 'ultraball' | 'masterball'
  | 'candy' | 'stone' | 'potion';

export interface ItemDef {
  key: ItemKey; label: string; emoji: string; color: string; desc: string;
  /** Peso na hora de sortear o vencedor da captura (0 = não é bola). */
  weight: number;
}

export const ITEMS: Record<ItemKey, ItemDef> = {
  pokeball:   { key: 'pokeball',   label: 'Pokébola',    emoji: '🔴', color: '#FF6B6B', desc: 'Bola básica — todo mundo tem infinitas.', weight: 1 },
  greatball:  { key: 'greatball',  label: 'Great Ball',  emoji: '🔵', color: '#4FA3FF', desc: 'Dobra a chance de vencer a captura.',     weight: 2.2 },
  ultraball:  { key: 'ultraball',  label: 'Ultra Ball',  emoji: '🟡', color: '#FFD24A', desc: 'Chance de captura muito maior.',          weight: 4.5 },
  masterball: { key: 'masterball', label: 'Master Ball', emoji: '🟣', color: '#B45CD8', desc: 'Captura garantida. Não erra nunca.',      weight: 999 },
  candy:      { key: 'candy',      label: 'Doce Raro',   emoji: '🍬', color: '#FF9EC4', desc: 'Sobe 1 nível do Pokémon favorito.',       weight: 0 },
  stone:      { key: 'stone',      label: 'Pedra Evolutiva', emoji: '💎', color: '#8FE3F0', desc: 'Força a evolução do favorito.',       weight: 0 },
  potion:     { key: 'potion',     label: 'Poção',       emoji: '🧪', color: '#7CFFB2', desc: 'Revive o Pokémon caído numa batalha.',    weight: 0 },
};

export const BALL_KEYS: ItemKey[] = ['pokeball', 'greatball', 'ultraball', 'masterball'];

/** Comando de chat → item. */
export const BALL_COMMANDS: Record<string, ItemKey> = {
  pokeball: 'pokeball', pokebola: 'pokeball', bola: 'pokeball', ball: 'pokeball',
  greatball: 'greatball', greatbola: 'greatball', great: 'greatball',
  ultraball: 'ultraball', ultrabola: 'ultraball', ultra: 'ultraball',
  masterball: 'masterball', masterbola: 'masterball', master: 'masterball',
};

/* ---------------------------------------------------------------- climas --- */
export type WeatherKey = 'clear' | 'rain' | 'night' | 'storm' | 'fullmoon' | 'blizzard' | 'sandstorm';

export interface WeatherDef {
  key: WeatherKey; label: string; emoji: string; color: string; desc: string;
  /** Tipos favorecidos no spawn (peso ×4). */
  favors: PType[];
  /** Multiplicador na chance de shiny. */
  shiny: number;
  /** Multiplicador no HP do boss. */
  bossHp: number;
  /** Multiplicador na janela de captura (menor = mais difícil). */
  capture: number;
  dark: boolean;
}

export const WEATHER: Record<WeatherKey, WeatherDef> = {
  clear:     { key: 'clear',     label: 'LIMPO',      emoji: '☀️', color: '#FFD24A', desc: 'Dia comum. Nenhum bônus.',                                   favors: [], shiny: 1, bossHp: 1, capture: 1, dark: false },
  rain:      { key: 'rain',      label: 'CHUVA',      emoji: '🌧️', color: '#4FA3FF', desc: 'Pokémon de Água e Planta aparecem muito mais.',              favors: ['water', 'grass'], shiny: 1.2, bossHp: 1, capture: 1, dark: false },
  night:     { key: 'night',     label: 'NOITE',      emoji: '🌙', color: '#8B6FD6', desc: 'Fantasma, Sombrio e Venenoso dominam a noite.',              favors: ['ghost', 'dark', 'poison'], shiny: 1.3, bossHp: 1.1, capture: 0.9, dark: true },
  storm:     { key: 'storm',     label: 'TEMPESTADE', emoji: '⛈️', color: '#8FE3F0', desc: 'Elétricos e Voadores em peso. Bosses ficam mais fortes.',    favors: ['electric', 'flying'], shiny: 1.4, bossHp: 1.25, capture: 0.85, dark: true },
  fullmoon:  { key: 'fullmoon',  label: 'LUA CHEIA',  emoji: '🌕', color: '#FF9EC4', desc: 'Psíquicos e Fadas acordam. Shiny com chance dobrada.',       favors: ['psychic', 'fairy'], shiny: 2, bossHp: 1.15, capture: 1, dark: true },
  blizzard:  { key: 'blizzard',  label: 'NEVASCA',    emoji: '❄️', color: '#BFE9FF', desc: 'Gelo por todo lado — capturar fica mais difícil.',           favors: ['ice', 'water'], shiny: 1.35, bossHp: 1.1, capture: 0.75, dark: false },
  sandstorm: { key: 'sandstorm', label: 'AREIA',      emoji: '🏜️', color: '#DFBE6F', desc: 'Pedra, Terra e Aço saem das dunas.',                        favors: ['rock', 'ground', 'steel'], shiny: 1.25, bossHp: 1.15, capture: 0.85, dark: false },
};

/* -------------------------------------------------------- eventos especiais */
export type EventKey =
  | 'fire' | 'water' | 'dragon' | 'ghost' | 'kanto' | 'shiny' | 'legendary' | 'swarm';

export interface EventDef {
  key: EventKey; label: string; emoji: string; color: string; desc: string;
  /** Só espécies desses tipos aparecem (vazio = sem filtro). */
  onlyTypes: PType[];
  onlyGen: number;         // 0 = todas
  shiny: number;           // multiplicador de shiny
  legendaryChance: number; // chance extra de spawn lendário
  spawnSpeed: number;      // multiplicador no intervalo de spawn (0.5 = 2× mais rápido)
}

export const EVENTS: Record<EventKey, EventDef> = {
  fire:      { key: 'fire',      label: 'EVENTO FOGO',    emoji: '🔥', color: '#FF7A3C', desc: 'Só aparecem Pokémon de Fogo.',                       onlyTypes: ['fire'], onlyGen: 0, shiny: 1, legendaryChance: 0, spawnSpeed: 0.8 },
  water:     { key: 'water',     label: 'EVENTO ÁGUA',    emoji: '🌊', color: '#4FA3FF', desc: 'Só aparecem Pokémon de Água.',                       onlyTypes: ['water'], onlyGen: 0, shiny: 1, legendaryChance: 0, spawnSpeed: 0.8 },
  dragon:    { key: 'dragon',    label: 'EVENTO DRAGÃO',  emoji: '🐉', color: '#8B5CF6', desc: 'Dragões raros aparecem sem parar.',                   onlyTypes: ['dragon'], onlyGen: 0, shiny: 1.5, legendaryChance: 0.05, spawnSpeed: 0.9 },
  ghost:     { key: 'ghost',     label: 'EVENTO FANTASMA',emoji: '👻', color: '#8B6FD6', desc: 'Assombração: só Fantasma e Sombrio.',                onlyTypes: ['ghost', 'dark'], onlyGen: 0, shiny: 1.3, legendaryChance: 0, spawnSpeed: 0.8 },
  kanto:     { key: 'kanto',     label: 'EVENTO KANTO',   emoji: '🗺️', color: '#7CFFB2', desc: 'Só Pokémon da 1ª geração.',                          onlyTypes: [], onlyGen: 1, shiny: 1, legendaryChance: 0, spawnSpeed: 0.85 },
  shiny:     { key: 'shiny',     label: 'EVENTO SHINY',   emoji: '✨', color: '#FFD24A', desc: 'Chance de shiny multiplicada por 8.',                 onlyTypes: [], onlyGen: 0, shiny: 8, legendaryChance: 0, spawnSpeed: 0.7 },
  legendary: { key: 'legendary', label: 'CAÇA LENDÁRIA',  emoji: '👑', color: '#FF9EC4', desc: 'Lendários podem aparecer em qualquer spawn.',        onlyTypes: [], onlyGen: 0, shiny: 2, legendaryChance: 0.22, spawnSpeed: 1 },
  swarm:     { key: 'swarm',     label: 'REVOADA',        emoji: '🌪️', color: '#A9CB3B', desc: 'Spawns em rajada — o dobro da velocidade.',           onlyTypes: [], onlyGen: 0, shiny: 1.2, legendaryChance: 0.02, spawnSpeed: 0.35 },
};

/* --------------------------------------------------------------- bosses --- */
export interface BossDef { id: number; name: string; emoji: string; hpMult: number; desc: string; }

export const BOSSES: BossDef[] = [
  { id: 150, name: 'Mewtwo',   emoji: '🧬', hpMult: 1.00, desc: 'O psíquico definitivo. Ataques mentais em área.' },
  { id: 384, name: 'Rayquaza', emoji: '🐉', hpMult: 1.25, desc: 'Senhor dos céus. Muito HP e dano dracônico.' },
  { id: 383, name: 'Groudon',  emoji: '🌋', hpMult: 1.20, desc: 'Continente vivo. Terremotos que atingem todo mundo.' },
  { id: 382, name: 'Kyogre',   emoji: '🌊', hpMult: 1.15, desc: 'Mar em fúria. Dilúvio que castiga o time inteiro.' },
  { id: 249, name: 'Lugia',    emoji: '🕊️', hpMult: 1.10, desc: 'Guardião das marés. Defesa altíssima.' },
  { id: 250, name: 'Ho-Oh',    emoji: '🔥', hpMult: 1.12, desc: 'Fênix eterna. Se cura enquanto luta.' },
  { id: 243, name: 'Raikou',   emoji: '⚡', hpMult: 0.85, desc: 'Trovão em forma de fera. Ataca muito rápido.' },
  { id: 245, name: 'Suicune',  emoji: '💧', hpMult: 0.90, desc: 'Vento do norte. Rápido e resistente.' },
];

/* ------------------------------------------------------------ progressão --- */
export const XP = {
  capture: 50,
  battle: 30,
  boss: 150,
  event: 80,
  dungeon: 120,
  tournament: 200,
  assist: 15,
} as const;

/** XP necessário para sair do nível `lvl` para o próximo. */
export function xpToNext(lvl: number): number {
  return Math.round(45 + lvl * 22 + Math.pow(lvl, 1.55) * 3.2);
}

export const SHINY_BASE_CHANCE = 1 / 340;
export const MAX_LEVEL = 100;
export const TEAM_LIMIT = 60;
