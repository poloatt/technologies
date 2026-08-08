import { signOAuthState, verifyOAuthState } from '../oauthState.js';

describe('oauthState', () => {
  const prev = process.env.ALLOW_LEGACY_OAUTH_STATE;

  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOW_LEGACY_OAUTH_STATE;
    else process.env.ALLOW_LEGACY_OAUTH_STATE = prev;
  });

  test('sign and verify tasks state', () => {
    process.env.ALLOW_LEGACY_OAUTH_STATE = 'false';
    const state = signOAuthState({ userId: '507f1f77bcf86cd799439011', kind: 'tasks' });
    const verified = verifyOAuthState(state);
    expect(verified).toEqual({
      userId: '507f1f77bcf86cd799439011',
      kind: 'tasks',
    });
  });

  test('sign and verify calendar state', () => {
    const state = signOAuthState({ userId: 'abc123', kind: 'cal' });
    expect(verifyOAuthState(state)).toEqual({ userId: 'abc123', kind: 'cal' });
  });

  test('rejects tampered signature', () => {
    const state = signOAuthState({ userId: 'u1', kind: 'tasks' });
    const tampered = `${state.slice(0, -4)}dead`;
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  test('rejects raw userId unless legacy flag', () => {
    delete process.env.ALLOW_LEGACY_OAUTH_STATE;
    expect(verifyOAuthState('507f1f77bcf86cd799439011')).toBeNull();
    process.env.ALLOW_LEGACY_OAUTH_STATE = 'true';
    expect(verifyOAuthState('507f1f77bcf86cd799439011')).toEqual({
      userId: '507f1f77bcf86cd799439011',
      kind: 'tasks',
    });
    expect(verifyOAuthState('cal:user99')).toEqual({ userId: 'user99', kind: 'cal' });
  });
});
