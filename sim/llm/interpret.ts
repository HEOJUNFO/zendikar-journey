// Free text from the player -> one Action the engine can run.
import { reactionSpell } from '../counter.ts';
import { z } from 'zod';
import { nearestTile, sameTile, tileCenter, tileLabel } from '../tiles.ts';
import { moveHours } from '../step.ts';
import { ActionSchema } from '../actions.ts';
import type { Action } from '../actions.ts';
import { isPerson, npcDef, player, present, ptOf, together } from '../state.ts';
import { hireBlocked, hirePrice } from '../allies.ts';
import { askOptions, askText } from '../asks.ts';
import type { InterpretInput } from '../run.ts';
import { travelBlocked } from '../step.ts';
import { shortName } from '../text.ts';
import { bondEffectText, placeName, region, TERRAINS } from '../world.ts';
import { itemsAt, itemOwner } from '../items.ts';
import { equipBlocked, equipmentOf, equipTargets } from '../equipment.ts';
import { loremastersOf, recallBlocked, recallCount } from '../loremaster.ts';
import { biteable, readyBiter } from '../bite.ts';
import { readyTapper, TAP_POWERS, tapAmount, tapBlocked, tapTargetable } from '../tapper.ts';
import { altarBlocked, altarOf, altarVictims } from '../altar.ts';
import { expeditionBlocked, expeditionOf, expeditionReward } from '../expedition.ts';
import { ascendBlocked, ascensionOf } from '../luminarch.ts';
import { trapsHeld } from '../snare.ts';
import { enteredToday, fetchTargets, fireTargets, growBlocked, growLand, landDropBlocked, targetedBondEffect } from '../abilities.ts';
import { topBlocked, topLand } from '../oracle.ts';
import { eonLand, spendBlocked, storeBlocked } from '../eons.ts';
import { spellsTaughtAt } from '../spells.ts';
import { chatCompletion, extractJson } from './chat.ts';
import { playerText } from './context.ts';

const AnswerSchema = z.object({ action: ActionSchema.nullable() });

const SYSTEM_PROMPT = `You translate what a player types in a text life-simulation into one game action.
The player writes in Korean. Pick the single action that best matches their intent.
If they speak to someone who is here, that is "talk" with their words in "say" (keep them in Korean).
If nothing fits, answer {"action": null}. Answer with JSON only, no prose.`;

export async function interpret({ world, state, text }: InterpretInput): Promise<Action | null> {
  const p = player(state);
  if (!p) return null;
  const here = region(world, p.region);
  const places = world.regions
    .filter((r) => r.id !== p.region && !TERRAINS[r.terrain].sea)
    .map((r) => {
      const why = travelBlocked(state, world, p, r.id);
      return `- ${r.id}: ${placeName(world, r)} (${r.summary}) — ${why ? `갈 수 없음: ${why}` : `${moveHours(world, p, r.id, nearestTile(world, r.id, p.tile && tileCenter(p.tile)))}시간`}`;
    });
  const taught = spellsTaughtAt(world, p.region).filter((s) => !p.spells?.includes(s.id));
  // Not those cast only in answer to someone joining another (Summoner's Bane): a pick then.
  const known = world.spells.filter((s) => p.spells?.includes(s.id) && !reactionSpell(s));
  const items = itemsAt(state, world, p.region).filter((x) => !itemOwner(state, x.id));
  const fetches = world.regions
    .filter((r) => r.fetch && p.bonds?.includes(r.id))
    .flatMap((r) => fetchTargets(state, world, p, r.id).map((to) => `- {"type":"fetch","from":"${r.id}","to":"${to.id}"}  (give up ${r.name} and ${r.fetch!.life} life to bond with ${placeName(world, to)} from afar)`));
  // The land on top of their library (Oracle of Mul Daya).
  const top = topLand(state, p, state.minutes);
  if (top && !topBlocked(state, world, p, top, state.minutes, (t) => landDropBlocked(state, world, p, t)))
    fetches.push(`- {"type":"fetch","from":"top","to":"${top}"}  (bond with ${placeName(world, region(world, top))}, revealed on top of their library by their oracle, from afar: their land for the day)`);
  const keeper = eonLand(world, p);
  const days = keeper
    ? [
        !storeBlocked(state, world, p, keeper.id, state.minutes) &&
          `- {"type":"store_day","land":"${keeper.id}"}  (pay ${keeper.eon!.costText} and leave a day in ${keeper.name}: tomorrow is lost to them, out of time; 1 hour)`,
        !spendBlocked(state, world, p, keeper.id, state.minutes) &&
          `- {"type":"spend_day","land":"${keeper.id}"}  (take back a day left in ${keeper.name}, which leaves them: tomorrow the world stands still and only they move; 1 hour)`,
      ].filter(Boolean)
    : [];
  const grower = growLand(world, p);
  if (grower && !growBlocked(state, world, p, grower.id, state.minutes)) {
    const who = enteredToday(state, world, grower.growEntered!.color, state.minutes).map((x) => shortName(x.name));
    days.push(`- {"type":"grow","land":"${grower.id}"}  (call on ${grower.name}: a +1/+1 counter on each creature of its color that came into the world today, whoever they belong to: ${who.join(', ')}; 1 hour)`);
  }
  // Equipment they hold: put it on themselves or a retainer here.
  for (const x of equipmentOf(state, world, p)) {
    for (const to of equipTargets(state, p).filter((y) => !equipBlocked(state, world, p, x.id, y.id, state.minutes))) {
      days.push(`- {"type":"equip","item":"${x.id}","to":"${to.id}"}  (pay ${x.equip!.costText} to put ${x.name} on ${to.id === p.id ? 'themselves' : shortName(to.name)}: they have ${x.equip!.abilities.join(', ')}${x.equip!.lure ? ', and whoever they fall on cannot fly off' : ''}; 1 hour)`);
    }
  }
  // A Sea Gate Loremaster they control: draw a spell per Ally of their party.
  if (!recallBlocked(state, world, p, state.minutes)) {
    days.push(`- {"type":"recall"}  (tap ${shortName(loremastersOf(state, world, p)[0].name)}: come to know ${recallCount(state, world, p)} hidden secret(s) of the world, one per Ally of their party; 1 hour)`);
  }
  // A Carnage Altar they own, standing before it: offer one of theirs.
  for (const ev of trapsHeld(world, p)) days.push(`- {"type":"set_trap","trap":"${ev.id}"}  (hide ${ev.name} where they stand: ${ev.summary}; costs ${ev.cardCost?.text}; 1 hour)`);
  if (!ascendBlocked(state, world, p, state.minutes)) days.push(`- {"type":"ascend"}  (call down a token with ${ascensionOf(state, world, p)!.name}: pay its cost, it serves them; 1 hour)`);
  if (!expeditionBlocked(state, world, p)) days.push(`- {"type":"expedition"}  (end ${expeditionOf(state, world, p)!.name}: it is gone, they ${expeditionReward(state, world, p).en}; 1 hour)`);
  const altar = altarOf(state, world, p);
  if (altar) {
    const victims = altarVictims(state, p, state.minutes).filter((x) => !altarBlocked(state, world, p, x.id, state.minutes));
    if (victims.length) days.push(`- {"type":"altar","to":"<retainer id>"}  (offer one who serves them on ${altar.name}: that one dies, they come to know a hidden secret; 1 hour. Who: ${victims.map((x) => `${x.id} (${shortName(x.name)})`).join(', ')})`);
  }
  // A Noble Vestige or a Reckless Scholar they control: its power on one standing with it.
  if (!tapBlocked(state, world, p, 'scout', p.id, state.minutes))
    days.push(`- {"type":"scout"}  (tap ${shortName(readyTapper(state, world, p, 'scout', state.minutes)!.name)}, paying its cost: bond from afar with a basic land they don't hold yet, no mana from it today; 1 hour)`);
  for (const power of TAP_POWERS) {
    if (power === 'scout') continue;
    const w = readyTapper(state, world, p, power, state.minutes);
    if (!w) continue;
    const near = Object.values(state.actors).filter((x) => (x.id === w.id || together(w, x)) && tapTargetable(state, world, w, x, state.minutes));
    const what = power === 'shield' ? `the next ${tapAmount(state, world, w, power)} damage that one would take today is prevented` : 'that one comes to know a hidden secret, then forgets a spell they hold';
    if (near.length) days.push(`- {"type":"${power}","to":"<person id>"}  (tap ${shortName(w.name)}: ${what}; leave "to" out for themselves; once a day; 1 hour. Who: ${near.map((x) => `${x.id} (${shortName(x.name)})`).join(', ')})`);
  }
  // One they control bearing Predatory Urge: bite someone standing with them.
  const biter = readyBiter(state, p, state.minutes);
  if (biter) {
    const prey = Object.values(state.actors).filter((x) => together(biter, x) && biteable(state, world, biter, x, state.minutes));
    if (prey.length)
      days.push(`- {"type":"bite","to":"<person id>"}  (${biter.id === p.id ? 'they themselves' : shortName(biter.name)}, seized by a predatory urge, bite one standing there: each deals the other damage equal to their power (${ptOf(biter)[0]} against theirs), then the biter is tapped, bound until midnight, and the one bitten turns foe; once a day; 1 hour. Who: ${prey.map((x) => `${x.id} (${shortName(x.name)}, ${ptOf(x).join('/')})`).join(', ')})`);
  }
  // A Valakut they hold: bonding with (or seeking out) a mountain may wake it.
  const valakut = world.regions.find((r) => r.mountainFire && p.bonds?.includes(r.id));
  if (valakut) {
    const burnable = fireTargets(state, world, p, valakut).map((x) => `${x.id} (${shortName(x.name)})`);
    days.push(
      `- (${valakut.name}: if they bond with or seek out a mountain while holding ${valakut.mountainFire!.others} others, they may add "target":"<id>" to that bond or fetch action to send ${valakut.mountainFire!.damage} damage of fire at someone in ${valakut.name}'s land${burnable.length ? `: ${burnable.join(', ')}` : ' (no one there now)'})`,
    );
  }
  const people = present(state, p.region, p.tile)
    .filter(isPerson)
    .map((a) => `- ${a.id}: ${shortName(a.name)} (power/toughness ${ptOf(a).join('/')})`);
  // Those elsewhere in this land (on other tiles): reached by seeking them out.
  const away = present(state, p.region, null)
    .filter((a) => isPerson(a) && a.id !== p.id && !sameTile(a.tile, p.tile))
    .map((a) => `- ${a.id}: ${shortName(a.name)}, at ${a.tile ? tileLabel(world, a.region, a.tile) : here.name}`);
  // Mercenaries here they could hire.
  for (const x of present(state, p.region, p.tile)) {
    const def = npcDef(state, world, x.id);
    if (def?.hireable && !hireBlocked(state, world, p, x.id)) days.push(`- {"type":"hire","to":"${x.id}"}  (hire ${shortName(x.name)} for ${hirePrice(def)} coin: they serve the player for good; 1 hour)`);
  }
  // A pick they owe comes before anything else: the only action now.
  const ask = state.asks?.[0];
  if (ask) {
    const options = askOptions(state, world, ask).map((o) => `- {"type":"choose","pick":${o.pick ? `"${o.pick}"` : 'null'}}  (${o.label})`);
    const content = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `The player must first pick: ${askText(state, world, ask)}\n\nActions:\n${options.join('\n')}\n\nPlayer typed: ${text}\n\nAnswer: {"action": {...}}` },
      ],
      300,
    );
    const parsed = AnswerSchema.safeParse(extractJson(content));
    return parsed.success ? parsed.data.action : null;
  }
  const content = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Player: ${playerText(state)}
Now in: ${here.id} ${here.name} (${here.summary})

Other regions:
${places.join('\n') || '(none)'}

People here (on the same tile: only they can be talked to, attacked, cast on, hired):
${people.join('\n') || '(nobody)'}

Elsewhere in this land (other tiles, an hour's walk a tile):
${away.join('\n') || '(nobody)'}

Actions:
- {"type":"move","to":"<region id>"}
- {"type":"seek","to":"<person id>"}  (go to where that one stands, to meet them)
- {"type":"rest","hours":1-12}
- {"type":"explore","hours":1-8,"pace":"careful"|"normal"|"hasty"}
- {"type":"eat"}
- {"type":"wait","hours":1-24}
- {"type":"talk","to":"<person id>","say":"<what they say>"}
- {"type":"attack","to":"<person id>"}  (only when they clearly mean to fight; fights can be deadly)
${
          targetedBondEffect(here)
            ? `- {"type":"bond","target":"<id of someone here${targetedBondEffect(here)!.type !== 'lose_life' ? `, or ${p.id} for themselves` : ''}>"}  (bond with the land here, taking it as their own; 4 hours, one land a day. As they do: ${bondEffectText(targetedBondEffect(here)!)}; leave target out only if nobody is there to name)`
            : '- {"type":"bond"}  (bond with the land here, taking it as their own; 4 hours, one land a day)'
        }
${taught.length ? taught.map((s) => `- {"type":"learn","spell":"${s.id}"}  (learn ${s.name} here: ${s.summary}; ${s.learnHours} hours)`).join('\n') + '\n' : ''}${
          known.length
            ? known
                .map((s) =>
                  s.target === 'self'
                    ? `- {"type":"cast","spell":"${s.id}","to":"${p.id}","kick":false}  (cast ${s.name} ${s.costText}: ${s.summary}${s.kicker?.mana ? `; "kick":true pays ${s.kicker.manaText} more for the kicked effect` : ''})`
                    : `- {"type":"cast","spell":"${s.id}","to":"<person id${s.target === 'any_here' ? ` or ${p.id} for themselves` : ''}>","kick":false}  (cast ${s.name} ${s.costText} on someone here: ${s.summary})`,
                )
                .join('\n') + '\n'
            : ''
        }${[...items.map((x) => `- {"type":"claim","item":"${x.id}"}  (tame ${x.name} ${x.costText}, making it theirs: ${x.summary})`), ...fetches, ...days].join('\n')}
Player typed: ${text}

Answer: {"action": {...}}`,
      },
    ],
    800,
  );
  const parsed = AnswerSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    console.warn('Unusable action:', content);
    return null;
  }
  return parsed.data.action;
}
