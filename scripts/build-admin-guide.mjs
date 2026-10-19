// Regenerates docs/ADMIN_GUIDE.md from the in-admin guide slides, so the written
// guide and the tour can never drift apart.
import { writeFileSync } from 'node:fs';
import { SLIDES } from '../src/admin-app/guide/guideContent.js';

let out = '# Alta Seminary admin guide\n\nA short guide for new admins. The same content is in the admin itself: open **Guide** in the left menu, or press the small (i) buttons beside features and choose "Demonstrate for me".\n\n> Generated from `src/admin-app/guide/guideContent.js`. Edit that file, then run `node scripts/build-admin-guide.mjs`.\n\n';
SLIDES.forEach((s, i) => {
  out += `## ${i + 1}. ${s.title}\n\n${s.what}\n\n${s.steps.map((x) => `- ${x}`).join('\n')}\n\n${s.tip ? `**Tip:** ${s.tip}\n\n` : ''}`;
});
writeFileSync(new URL('../docs/ADMIN_GUIDE.md', import.meta.url), out);
