/**
 * Migraciones contra un ambiente concreto.
 *
 *   npm run db:status:dev   /  npm run db:status:prod
 *   npm run db:push:dev     /  npm run db:push:prod
 *
 * Antes de cada comando vuelve a vincular la CLI al proyecto del ambiente
 * pedido, así nunca se aplican migraciones al proyecto equivocado por haber
 * quedado vinculado otro. En producción pide confirmación escrita.
 */
import { spawnSync } from 'node:child_process';
import { confirmTyped, fail, loadEnv, parseEnvName } from './lib/env.ts';

const COMMANDS = {
  status: ['migration', 'list', '--linked'],
  push: ['db', 'push', '--linked'],
} as const;

type Command = keyof typeof COMMANDS;

function supabase(args: readonly string[], input?: string) {
  // Un solo string con shell (en Windows npx es un .cmd). Los argumentos son
  // fijos o el project ref, que loadEnv valida como alfanumérico.
  const res = spawnSync(`npx supabase ${args.join(' ')}`, {
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input,
    shell: true,
  });
  if (res.status !== 0) fail(`Falló: supabase ${args.join(' ')}`);
}

async function main() {
  const env = loadEnv(parseEnvName(process.argv[2]));
  const command = process.argv[3] as Command;
  if (!(command in COMMANDS)) fail('Comando inválido: usá "status" o "push".');

  console.log(`\n▶ Ambiente: ${env.label} (proyecto ${env.projectRef})\n`);

  if (command === 'push' && env.name === 'production') {
    await confirmTyped(
      'PRODUCCION',
      '⚠️  Vas a aplicar migraciones en PRODUCCIÓN (la base que usan tus amigos).',
    );
  }

  supabase(['link', '--project-ref', env.projectRef]);
  // db push pregunta "¿Aplicar estas migraciones? [Y/n]": ya confirmamos arriba.
  supabase(COMMANDS[command], command === 'push' ? 'Y\n' : undefined);
}

main();
