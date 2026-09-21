import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, SUPABASE_HOME: join(homedir(), '.supabase-cerise') };
for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROFILE', 'SUPABASE_DB_PASSWORD']) delete env[key];
const args = process.argv.slice(2);
if (args.some(value => /--(?:profile|workdir|project-ref|db-url|token)(?:=|$)/.test(value))) {
  throw new Error('Connection overrides are not permitted in the Cerise wrapper.');
}
if (!['db', 'config', 'projects'].includes(args[0]) || (args[0] === 'db' && args[1] !== 'query') || (args[0] === 'config' && args[1] !== 'push') || (args[0] === 'projects' && args[1] !== 'list')) {
  throw new Error('Only db query, config push and projects list are supported.');
}
if (args[0] !== 'projects') args.push('--project-ref', 'tmmsfazjravormkwnmji');
if (args[0] === 'db') args.push('--linked');
const result = spawnSync(process.execPath, [join(root, 'node_modules/supabase/dist/supabase.js'), ...args,
  '--profile', join(env.SUPABASE_HOME, 'profile.json'), '--workdir', root, '--output-format', 'text',
], { env, cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;