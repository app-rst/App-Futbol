import { describe, expect, it } from 'vitest';
import { asUser, createTestDb, createUser } from './helpers/db';

describe('harness de tests (PGlite)', () => {
  it('aplica las migraciones y simula usuarios autenticados', async () => {
    const db = await createTestDb();
    const uid = await createUser(db);
    const who = await asUser(db, uid, async (tx) => {
      const r = await tx.query<{ uid: string; role: string }>('select auth.uid() as uid, current_user as role');
      return r.rows[0];
    });
    expect(who).toEqual({ uid, role: 'authenticated' });
  });
});
