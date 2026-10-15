export function reportedValues(sides, count, results) {
  if (!results?.sets) return null;
  if (sides === 100) {
    const tens = results.sets.find((set) => set.type === 'd100');
    const units = results.sets.find((set) => set.type === 'd10');
    if (!tens || !units) return null;
    return Array.from({ length: count }, (_, index) => {
      const rawTens = tens.rolls[index]?.value;
      const rawUnits = units.rolls[index]?.value;
      if (rawTens == null || rawUnits == null) return null;
      const t = rawTens <= 9 ? rawTens : rawTens === 100 ? 0 : rawTens / 10;
      const u = rawUnits === 10 ? 0 : rawUnits;
      return t === 0 && u === 0 ? 100 : t * 10 + u;
    });
  }
  const set = results.sets.find((entry) => entry.type === `d${sides}`);
  if (!set || set.rolls.length !== count) return null;
  return set.rolls.map((entry) => sides === 10 && entry.value === 0 ? 10 : entry.value);
}
