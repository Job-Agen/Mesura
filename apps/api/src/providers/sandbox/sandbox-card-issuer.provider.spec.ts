import { luhnValid, SandboxCardIssuerProvider } from './sandbox-card-issuer.provider';

describe('SandboxCardIssuerProvider.revealCard', () => {
  const issuer = new SandboxCardIssuerProvider();
  const expiresAt = new Date('2026-11-30T10:00:00.000Z');

  it('returns a Luhn-valid demo Visa number ending with the last4 shown in the app', async () => {
    const secrets = await issuer.revealCard('sbx_card_abc', '0421', expiresAt);
    expect(secrets.pan).toMatch(/^400000\d{6}0421$/);
    expect(luhnValid(secrets.pan)).toBe(true);
    expect(secrets.cvv).toMatch(/^\d{3}$/);
    expect(secrets).toMatchObject({ expiryMonth: 11, expiryYear: 2026, demo: true });
  });

  it('shows the same details every time for a card, and other details for another card', async () => {
    const a = await issuer.revealCard('sbx_card_abc', '0421', expiresAt);
    expect(await issuer.revealCard('sbx_card_abc', '0421', expiresAt)).toEqual(a);
    expect((await issuer.revealCard('sbx_card_xyz', '0421', expiresAt)).pan).not.toBe(a.pan);
  });

  it('stays Luhn-valid whatever the last4', async () => {
    for (const last4 of ['0000', '1234', '9999', '5050']) {
      expect(luhnValid((await issuer.revealCard(`sbx_card_${last4}`, last4, expiresAt)).pan)).toBe(true);
    }
  });
});
