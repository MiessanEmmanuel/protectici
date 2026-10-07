import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  totpCodeSchema,
  twoFactorSchema,
  validate,
} from '@/lib/validation';

const validRegister = {
  first_name: 'Awa',
  last_name: 'Koné',
  email: 'awa@example.test',
  phone: '',
  password: 'motdepasse12',
  password_confirmation: 'motdepasse12',
  consent: true,
};

describe('validation Zod (UX)', () => {
  it('accepte une inscription valide', () => {
    expect(validate(registerSchema, validRegister).ok).toBe(true);
  });

  it('refuse sans consentement, avec message français', () => {
    const r = validate(registerSchema, { ...validRegister, consent: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.consent).toMatch(/accepter/);
  });

  it('exige 10 caractères et la confirmation identique', () => {
    const short = validate(registerSchema, {
      ...validRegister,
      password: 'court',
      password_confirmation: 'court',
    });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.errors.password).toMatch(/10 caractères/);
    const mismatch = validate(registerSchema, {
      ...validRegister,
      password_confirmation: 'autrechose12',
    });
    if (!mismatch.ok) expect(mismatch.errors.password_confirmation).toMatch(/identiques/);
    else throw new Error('devait échouer');
  });

  it('valide e-mail et téléphone', () => {
    const r = validate(registerSchema, { ...validRegister, email: 'pas-un-email', phone: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toMatch(/valide/);
      expect(r.errors.phone).toMatch(/valide/);
    }
  });

  it('connexion : champs requis', () => {
    const r = validate(loginSchema, { email: '', password: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['email', 'password']);
  });

  it('2FA : 6 chiffres ou code de secours', () => {
    expect(validate(twoFactorSchema, { code: '123456' }).ok).toBe(true);
    expect(validate(twoFactorSchema, { code: '12ab' }).ok).toBe(false);
    expect(validate(twoFactorSchema, { recovery_code: 'AAAA-1111' }).ok).toBe(true);
    expect(validate(twoFactorSchema, {}).ok).toBe(false);
    expect(validate(totpCodeSchema, { code: '000000' }).ok).toBe(true);
  });

  it('mot de passe oublié, réinitialisation, changement', () => {
    expect(validate(forgotPasswordSchema, { email: 'a@b.co' }).ok).toBe(true);
    expect(validate(forgotPasswordSchema, { email: 'x' }).ok).toBe(false);
    expect(
      validate(resetPasswordSchema, {
        token: 't',
        email: 'a@b.co',
        password: 'motdepasse12',
        password_confirmation: 'motdepasse12',
      }).ok,
    ).toBe(true);
    expect(
      validate(changePasswordSchema, {
        current_password: '',
        password: 'motdepasse12',
        password_confirmation: 'motdepasse12',
      }).ok,
    ).toBe(false);
  });
});
