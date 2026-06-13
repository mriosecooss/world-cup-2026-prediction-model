// Converts martj42 international_results CSV → model-compatible JSON
// Applies team-name normalization and filters to post-2000 matches
import { readFileSync, writeFileSync } from 'node:fs';

// Map team names from the CSV to model slugs
const NAME_TO_SLUG = {
  'United States': 'usa', 'USA': 'usa',
  'Argentina': 'argentina', 'Brazil': 'brazil', 'France': 'france',
  'Spain': 'spain', 'England': 'england', 'Germany': 'germany',
  'Portugal': 'portugal', 'Netherlands': 'netherlands', 'Belgium': 'belgium',
  'Italy': 'italy', 'Colombia': 'colombia', 'Uruguay': 'uruguay',
  'Croatia': 'croatia', 'Morocco': 'morocco', 'Switzerland': 'switzerland',
  'Mexico': 'mexico', 'Japan': 'japan', 'Senegal': 'senegal',
  'Denmark': 'denmark', 'Ecuador': 'ecuador', 'Australia': 'australia',
  'South Korea': 'south-korea', 'Iran': 'iran', 'Poland': 'poland',
  'Canada': 'canada', 'Serbia': 'serbia', 'Wales': 'wales',
  'Ghana': 'ghana', 'Tunisia': 'tunisia', 'Ivory Coast': 'ivory-coast',
  "Côte d'Ivoire": 'ivory-coast', 'Nigeria': 'nigeria',
  'Saudi Arabia': 'saudi-arabia', 'Qatar': 'qatar', 'Egypt': 'egypt',
  'Algeria': 'algeria', 'Scotland': 'scotland', 'Cameroon': 'cameroon',
  'Paraguay': 'paraguay', 'Venezuela': 'venezuela', 'Chile': 'chile',
  'Peru': 'peru', 'Czech Republic': 'czech-republic', 'Czechia': 'czech-republic',
  'Bosnia and Herzegovina': 'bosnia-and-herzegovina',
  'Bosnia-Herzegovina': 'bosnia-and-herzegovina',
  'South Africa': 'south-africa', 'New Zealand': 'new-zealand',
  'Panama': 'panama', 'Jamaica': 'jamaica', 'Honduras': 'honduras',
  'Jordan': 'jordan', 'Haiti': 'haiti', 'El Salvador': 'el-salvador',
  'Trinidad and Tobago': 'trinidad-and-tobago', 'Guatemala': 'guatemala',
  'Norway': 'norway', 'Sweden': 'sweden', 'Austria': 'austria',
  'Turkey': 'turkey', 'Uzbekistan': 'uzbekistan', 'Iraq': 'iraq',
  'DR Congo': 'dr-congo', 'Cape Verde': 'cape-verde',
  'Curacao': 'curacao', 'Curaçao': 'curacao',
};

// Map tournament names to league names the model uses
function mapTournament(t) {
  const l = t.toLowerCase();
  if (l.includes('fifa world cup qualification')) return 'World Cup Qualification';
  if (l.includes('fifa world cup')) return 'FIFA World Cup';
  if (l.includes('copa america')) return 'Copa America';
  if (l.includes('uefa euro') || l.includes('european championship')) return 'Euro Championship';
  if (l.includes('africa cup') || l.includes('afcon')) return 'Africa Cup of Nations';
  if (l.includes('asian cup')) return 'Asian Cup';
  if (l.includes('gold cup')) return 'Gold Cup';
  if (l.includes('nations league')) return 'Nations League';
  if (l.includes('friendly')) return 'Friendlies';
  return t;
}

const csv = readFileSync('./data/results-full.csv', 'utf8').split('\n').slice(1); // skip header
const matches = [];
let id = 1;

for (const line of csv) {
  if (!line.trim()) continue;
  const cols = line.split(',');
  // CSV: date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
  const [date, homeName, awayName, hgStr, agStr, tournament] = cols;
  const hg = parseInt(hgStr), ag = parseInt(agStr);
  if (isNaN(hg) || isNaN(ag)) continue;

  // Only post-2000 to keep dataset manageable and relevant
  const year = parseInt(date.slice(0, 4));
  if (year < 2000) continue;

  const homeSlug = NAME_TO_SLUG[homeName.trim()] ?? null;
  const awaySlug = NAME_TO_SLUG[awayName.trim()] ?? null;
  const ts = Math.floor(new Date(date).getTime() / 1000);

  matches.push({
    id: id++, ts, date,
    homeSlug, awaySlug,
    homeName: homeName.trim(), awayName: awayName.trim(),
    hg, ag,
    leagueName: mapTournament(tournament?.trim() ?? 'Friendlies'),
  });
}

const out = { generatedAt: new Date().toISOString(), source: 'martj42/international_results', matches };
writeFileSync('./data/results-full.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Converted ${matches.length} matches (post-2000) → data/results-full.json`);

// Stats
const byLeague = {};
for (const m of matches) byLeague[m.leagueName] = (byLeague[m.leagueName] || 0) + 1;
Object.entries(byLeague).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([l,c])=>console.log(`  ${c.toString().padStart(5)}  ${l}`));
