import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function getPersistentConfigDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'AnkiSuperSupporter');
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'AnkiSuperSupporter');
}

interface EncryptedEnvelope {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

export function cleanSecretValue(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]/g, '');
}

export function maskSecretKey(secret: string): string {
  const clean = cleanSecretValue(secret);
  if (!clean) return '';
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••`;
  const prefix = clean.startsWith('sk-proj-') ? clean.slice(0, 10) : clean.slice(0, 5);
  return `${prefix}••••${clean.slice(-4)}`;
}

export class LocalSecretVault {
  private readonly dir: string;
  private readonly keyPath: string;
  private readonly vaultPath: string;

  constructor(baseDir: string = getPersistentConfigDir()) {
    this.dir = baseDir;
    this.keyPath = path.join(baseDir, 'vault.key');
    this.vaultPath = path.join(baseDir, 'vault.enc');
  }

  getDirectory(): string {
    return this.dir;
  }

  private ensureDir(): void {
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private getOrCreateMasterKey(): Buffer {
    this.ensureDir();
    if (fs.existsSync(this.keyPath)) {
      const hex = fs.readFileSync(this.keyPath, 'utf-8').trim();
      if (/^[a-f0-9]{64}$/i.test(hex)) {
        return Buffer.from(hex, 'hex');
      }
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(this.keyPath, key.toString('hex'), { encoding: 'utf-8', mode: 0o600 });
    return key;
  }

  private readAll(): Record<string, string> {
    if (!fs.existsSync(this.vaultPath)) return {};
    try {
      const env = JSON.parse(fs.readFileSync(this.vaultPath, 'utf-8')) as EncryptedEnvelope;
      if (env.v !== 1 || !env.iv || !env.tag || !env.data) return {};
      const key = this.getOrCreateMasterKey();
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(env.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(env.data, 'base64')),
        decipher.final(),
      ]).toString('utf-8');
      return JSON.parse(decrypted) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private writeAll(secrets: Record<string, string>): void {
    this.ensureDir();
    const key = this.getOrCreateMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(secrets), 'utf-8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const envelope: EncryptedEnvelope = {
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };
    fs.writeFileSync(this.vaultPath, JSON.stringify(envelope, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }

  get(name: string): string {
    const all = this.readAll();
    return all[name] ?? '';
  }

  set(name: string, value: string): void {
    const clean = cleanSecretValue(value);
    const all = this.readAll();
    if (!clean) {
      delete all[name];
    } else {
      all[name] = clean;
    }
    this.writeAll(all);
  }

  delete(name: string): void {
    const all = this.readAll();
    if (name in all) {
      delete all[name];
      this.writeAll(all);
    }
  }
}

export const secretVault = new LocalSecretVault();
