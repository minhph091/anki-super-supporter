import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ClipboardImageCaptured {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

const WIN_CLIPBOARD_HELPER_COMMON = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try { Add-Type -AssemblyName PresentationCore } catch {}
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AssClipboardNative {
  [DllImport("user32.dll")]
  public static extern uint GetClipboardSequenceNumber();
}
"@

function Write-AssStreamOrBytes {
  param($Data, [string]$OutDir, [string]$Ext)
  if ($null -eq $Data) { return $null }
  $bytes = $null
  if ($Data -is [System.IO.MemoryStream] -and $Data.Length -gt 0) {
    $bytes = $Data.ToArray()
  } elseif ($Data -is [byte[]] -and $Data.Length -gt 0) {
    $bytes = $Data
  } elseif ($Data -is [System.IO.Stream]) {
    try {
      $ms = New-Object System.IO.MemoryStream
      if ($Data.CanSeek) { $Data.Position = 0 }
      $Data.CopyTo($ms)
      if ($ms.Length -gt 0) { $bytes = $ms.ToArray() }
      $ms.Dispose()
    } catch {}
  }
  if ($null -ne $bytes -and $bytes.Length -gt 0) {
    $fileName = "clip_" + [Guid]::NewGuid().ToString("N") + $Ext
    $outPath = Join-Path $OutDir $fileName
    [System.IO.File]::WriteAllBytes($outPath, $bytes)
    return $fileName
  }
  return $null
}

function Try-SaveAssClipboardImageOnce {
  param([string]$OutDir)

  foreach ($fmt in @('PNG', 'image/png')) {
    try {
      if ([System.Windows.Forms.Clipboard]::ContainsData($fmt)) {
        $saved = Write-AssStreamOrBytes -Data ([System.Windows.Forms.Clipboard]::GetData($fmt)) -OutDir $OutDir -Ext '.png'
        if ($saved) { return $saved }
      }
    } catch {}
  }

  foreach ($fmt in @('JFIF', 'image/jpeg')) {
    try {
      if ([System.Windows.Forms.Clipboard]::ContainsData($fmt)) {
        $saved = Write-AssStreamOrBytes -Data ([System.Windows.Forms.Clipboard]::GetData($fmt)) -OutDir $OutDir -Ext '.jpg'
        if ($saved) { return $saved }
      }
    } catch {}
  }

  try {
    if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
      $img = [System.Windows.Forms.Clipboard]::GetImage()
      if ($null -ne $img) {
        $fileName = "clip_" + [Guid]::NewGuid().ToString("N") + ".png"
        $outPath = Join-Path $OutDir $fileName
        try {
          $img.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
          return $fileName
        } finally {
          $img.Dispose()
        }
      }
    }
  } catch {}

  # Fallback via WPF PresentationCore (handles DIBV5 / transparent browser images that WinForms misses)
  try {
    if ([System.Windows.Clipboard]::ContainsImage()) {
      $bmpSrc = [System.Windows.Clipboard]::GetImage()
      if ($null -ne $bmpSrc) {
        $fileName = "clip_" + [Guid]::NewGuid().ToString("N") + ".png"
        $outPath = Join-Path $OutDir $fileName
        $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
        $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmpSrc))
        $fs = [System.IO.File]::Create($outPath)
        try {
          $encoder.Save($fs)
        } finally {
          $fs.Dispose()
        }
        if ((Test-Path -LiteralPath $outPath) -and (Get-Item -LiteralPath $outPath).Length -gt 0) {
          return $fileName
        }
      }
    }
  } catch {}

  try {
    if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
      $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
      if ($files.Count -eq 1) {
        $candidate = $files[0]
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
          $ext = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
          if ($ext -in @('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')) {
            $fileName = "clip_" + [Guid]::NewGuid().ToString("N") + $ext
            $outPath = Join-Path $OutDir $fileName
            [System.IO.File]::Copy($candidate, $outPath, $true)
            return $fileName
          }
        }
      }
    }
  } catch {}

  return $null
}

function Save-AssClipboardImage {
  param([string]$OutDir, [int]$Retries = 5)
  for ($attempt = 0; $attempt -lt $Retries; $attempt++) {
    $saved = Try-SaveAssClipboardImageOnce -OutDir $OutDir
    if ($saved) { return $saved }
    if ($attempt -lt ($Retries - 1)) {
      Start-Sleep -Milliseconds (120 + ($attempt * 80))
    }
  }
  return $null
}
`;

function mimeFromFilePath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'image/png';
}

function toEncodedPsCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/**
 * Lightweight, zero-dependency Windows Clipboard Image Watcher.
 * Uses a single persistent PowerShell STA process polling Win32 GetClipboardSequenceNumber()
 * every 400ms — virtually zero CPU until the user copies a new image.
 */
export class ClipboardImageWatcher {
  private proc: ChildProcess | null = null;
  private stagingDir: string;
  private lastHash = '';
  private lastEmitAt = 0;
  private stdoutBuffer = '';
  private shouldRun = false;
  private onImageCallback: ((captured: ClipboardImageCaptured) => void) | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(stagingDir?: string) {
    this.stagingDir = stagingDir || path.join(os.tmpdir(), 'ass-clipboard-staging');
  }

  isSupported(): boolean {
    return process.platform === 'win32';
  }

  isRunning(): boolean {
    return this.proc !== null && !this.proc.killed;
  }

  start(onImage: (captured: ClipboardImageCaptured) => void): void {
    if (!this.isSupported()) return;
    this.shouldRun = true;
    this.onImageCallback = onImage;
    if (this.isRunning()) return;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    this.spawnWatcherProcess();
  }

  private spawnWatcherProcess(): void {
    if (!this.shouldRun || !this.onImageCallback) return;

    fs.mkdirSync(this.stagingDir, { recursive: true });

    const escapedDir = this.stagingDir.replace(/'/g, "''");
    const script = `
$ErrorActionPreference = 'Continue'
${WIN_CLIPBOARD_HELPER_COMMON}
$outDir = '${escapedDir}'
$lastSeq = [AssClipboardNative]::GetClipboardSequenceNumber()
while ($true) {
  Start-Sleep -Milliseconds 400
  $seq = [AssClipboardNative]::GetClipboardSequenceNumber()
  if ($seq -ne $lastSeq) {
    $lastSeq = $seq
    Start-Sleep -Milliseconds 120
    $savedName = Save-AssClipboardImage -OutDir $outDir -Retries 5
    if ($savedName) {
      [Console]::Out.WriteLine("CLIP_IMG:" + $savedName)
      [Console]::Out.Flush()
    }
  }
}
`;

    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-OutputFormat',
        'Text',
        '-WindowStyle',
        'Hidden',
        '-STA',
        '-EncodedCommand',
        toEncodedPsCommand(script),
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    this.proc = child;
    this.stdoutBuffer = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString('utf-8');
      let newlineIdx = this.stdoutBuffer.indexOf('\n');
      while (newlineIdx !== -1) {
        const line = this.stdoutBuffer.slice(0, newlineIdx).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);

        if (line.startsWith('CLIP_IMG:')) {
          const rawRef = line.slice('CLIP_IMG:'.length).trim();
          const tempPath = path.isAbsolute(rawRef)
            ? rawRef
            : path.join(this.stagingDir, path.basename(rawRef));
          if (this.onImageCallback) {
            this.consumeStagedFile(tempPath, this.onImageCallback);
          }
        }
        newlineIdx = this.stdoutBuffer.indexOf('\n');
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString('utf-8').trim();
      if (msg && !msg.startsWith('#< CLIXML')) {
        console.warn('[ClipboardWatcher]', msg.slice(0, 300));
      }
    });

    const handleTermination = () => {
      if (this.proc === child) {
        this.proc = null;
      }
      if (this.shouldRun && !this.restartTimer) {
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          this.spawnWatcherProcess();
        }, 2000);
      }
    };

    child.on('exit', handleTermination);
    child.on('error', handleTermination);
  }

  private consumeStagedFile(
    tempPath: string,
    onImage: (captured: ClipboardImageCaptured) => void,
  ): void {
    if (!tempPath || !fs.existsSync(tempPath)) return;
    try {
      const buffer = fs.readFileSync(tempPath);
      if (buffer.length === 0) return;

      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const now = Date.now();
      // Only suppress rapid duplicate sequence fires for the same copy action (< 2s)
      if (hash === this.lastHash && now - this.lastEmitAt < 2000) return;
      this.lastHash = hash;
      this.lastEmitAt = now;

      const ext = path.extname(tempPath).toLowerCase() || '.png';
      onImage({
        buffer,
        mimeType: mimeFromFilePath(tempPath),
        filename: `clipboard_${now}${ext}`,
      });
    } catch {
      // ignore transient read error
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        // ignore cleanup failure
      }
    }
  }

  stop(): void {
    this.shouldRun = false;
    this.onImageCallback = null;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {
        // ignore
      }
      this.proc = null;
    }
  }
}

/**
 * One-shot helper to grab whatever image is currently in the Windows clipboard.
 */
export async function grabCurrentClipboardImage(): Promise<ClipboardImageCaptured | null> {
  if (process.platform !== 'win32') return null;

  const stagingDir = path.join(os.tmpdir(), 'ass-clipboard-staging');
  fs.mkdirSync(stagingDir, { recursive: true });
  const escapedDir = stagingDir.replace(/'/g, "''");

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
${WIN_CLIPBOARD_HELPER_COMMON}
$savedName = Save-AssClipboardImage -OutDir '${escapedDir}' -Retries 3
if ($savedName) {
  [Console]::Out.WriteLine("CLIP_IMG:" + $savedName)
}
`;

  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-STA',
        '-EncodedCommand',
        toEncodedPsCommand(script),
      ],
      {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );

    let out = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      resolve(null);
    }, 6000);

    child.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf-8');
    });

    child.on('close', () => {
      clearTimeout(timer);
      const line = out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.startsWith('CLIP_IMG:'));
      if (!line) {
        resolve(null);
        return;
      }
      const rawRef = line.slice('CLIP_IMG:'.length).trim();
      const tempPath = path.isAbsolute(rawRef)
        ? rawRef
        : path.join(stagingDir, path.basename(rawRef));
      if (!tempPath || !fs.existsSync(tempPath)) {
        resolve(null);
        return;
      }
      try {
        const buffer = fs.readFileSync(tempPath);
        if (buffer.length === 0) {
          resolve(null);
          return;
        }
        const ext = path.extname(tempPath).toLowerCase() || '.png';
        resolve({
          buffer,
          mimeType: mimeFromFilePath(tempPath),
          filename: `clipboard_${Date.now()}${ext}`,
        });
      } catch {
        resolve(null);
      } finally {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}
