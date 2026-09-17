/** Traditional Chinese still-life / landscape backgrounds for cellar cards. */

const BY_TYPE: Record<string, string> = {
  white: "/motifs/white.jpg",
  green: "/motifs/green.jpg",
  yellow: "/motifs/yellow.jpg",
  oolong: "/motifs/oolong.jpg",
  black: "/motifs/black.jpg",
  sheng: "/motifs/sheng.jpg",
  heicha: "/motifs/heicha.jpg",
  shou: "/motifs/heicha.jpg",
  herbal: "/motifs/herbal.jpg",
  unknown: "/motifs/unknown.jpg",
};

const BY_NAME: { test: RegExp; src: string }[] = [
  { test: /dancong|ya shi|yashi|milan|mi lan|honey orchid|orchid|蜜兰|鸭屎/i, src: "/motifs/orchid.jpg" },
  { test: /rou gui|rougui|cinnamon|cassia|肉桂/i, src: "/motifs/cinnamon.jpg" },
  { test: /tieguanyin|tie guan yin|iron goddess|铁观音/i, src: "/motifs/goddess.jpg" },
  { test: /longjing|lung ching|dragon well|龙井/i, src: "/motifs/longjing.jpg" },
  { test: /7542|8582|beeng|bing cha|tea cake|compressed cake/i, src: "/motifs/cake.jpg" },
  { test: /silver needle|baihao yinzhen|bai hao|白毫银针/i, src: "/motifs/white.jpg" },
  { test: /da hong pao|dahongpao|大红袍|wuyi|yancha|rock tea/i, src: "/motifs/oolong.jpg" },
  { test: /liu bao|liubao|六堡|fu brick|anhua/i, src: "/motifs/heicha.jpg" },
  { test: /jin jun mei|金骏眉|lapsang|keemun|dianhong/i, src: "/motifs/black.jpg" },
];

export function motifFor(tea: {
  type?: string;
  subtype?: string;
  name?: string;
  nameZh?: string;
  unknown?: boolean;
}): string {
  if (tea.unknown) return BY_TYPE.unknown;
  const hay = `${tea.name ?? ""} ${tea.nameZh ?? ""} ${tea.subtype ?? ""}`;
  for (const row of BY_NAME) {
    if (row.test.test(hay)) return row.src;
  }
  return BY_TYPE[tea.type ?? ""] ?? BY_TYPE.unknown;
}
