import { RECIPES } from '../src/models/recipes/index';
const want: Record<string, number[]> = { crow: [8, 9, 10], crane: [8, 9, 10], butterfly: [20, 21, 22] };
for (const make of RECIPES) {
  const m = make();
  if (!want[m.id]) continue;
  for (const k of want[m.id]) {
    const s = m.steps[k - 1];
    console.log(m.id, k, '|', s.title, '|', s.kind, '|', JSON.stringify((s as any).op)?.slice(0, 300));
    console.log('   ', s.text);
  }
}
