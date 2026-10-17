import { describe, expect, it } from 'vitest';
import { createTestDb, rpc } from './helpers/db';

describe('ping (despertador del proyecto gratuito)', () => {
  it('cualquiera, incluso sin sesión, puede llamarla y devuelve true', async () => {
    const db = await createTestDb();
    expect(await rpc(db, null, 'ping')).toEqual([{ ping: true }]);
  });
});
