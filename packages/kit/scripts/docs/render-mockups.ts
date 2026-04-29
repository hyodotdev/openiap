#!/usr/bin/env bun
/**
 * Render hand-crafted HTML mockups of the authed dashboard screens
 * and write them as PNGs under `public/docs/screenshots/`. We can't
 * capture the real dashboard from an automated agent (no OAuth
 * session), so these mockups stand in until someone runs the proper
 * `capture.ts` pipeline against a signed-in dev deployment.
 *
 * The mockups are deliberately close to the real UI (Tailwind
 * classes copied over, matching dark theme) so readers see an
 * accurate visual of each screen. When the live capture lands, this
 * script becomes a no-op — the live PNGs overwrite the mockups.
 */

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } =
  require("@playwright/test") as typeof import("@playwright/test");

const OUT = resolve(__dirname, "..", "..", "public", "docs", "screenshots");

// Shared Tailwind-ish inline style for every mockup. Mirrors the
// dashboard's dark theme token values so the mockup and the real
// dashboard render identically-ish.
const PAGE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: ui-sans-serif, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #e5e7eb; background: #0a0a0b; }
  body { padding: 40px; }
  .card { background: #111113; border: 1px solid #1f2023; border-radius: 10px; padding: 24px; }
  .label { font-size: 13px; font-weight: 500; color: #e5e7eb; margin-bottom: 8px; display: block; }
  .hint { font-size: 12px; color: #8e8e93; margin-top: 6px; }
  .input { width: 100%; background: #0a0a0b; border: 1px solid #2a2b2f; border-radius: 8px; padding: 9px 12px; font-size: 14px; color: #e5e7eb; font-family: ui-monospace, monospace; }
  .btn { background: #4f46e5; color: white; border: 0; border-radius: 8px; padding: 9px 16px; font-size: 14px; font-weight: 500; cursor: pointer; }
  .btn-ghost { background: transparent; color: #a1a1aa; border: 1px solid #2a2b2f; border-radius: 8px; padding: 8px 14px; font-size: 13px; }
  .title { font-size: 18px; font-weight: 600; color: #fafafa; }
  .subtitle { font-size: 13px; color: #8e8e93; margin-top: 4px; }
  .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; }
  .pill-green { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .row { display: flex; align-items: center; }
  .stack > * + * { margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #1f2023; }
  th { font-weight: 500; color: #8e8e93; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { color: #e5e7eb; }
  .mono { font-family: ui-monospace, monospace; font-size: 12px; }
  .muted { color: #8e8e93; }
  .checkbox { width: 16px; height: 16px; border: 1.5px solid #4f46e5; border-radius: 3px; background: #4f46e5; margin-right: 10px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 700; }
  .divider { height: 1px; background: #1f2023; margin: 20px 0; }
  .dropzone { border: 2px dashed #2a2b2f; border-radius: 8px; padding: 28px; text-align: center; color: #8e8e93; font-size: 14px; }
  .upload-ok { border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.06); border-radius: 8px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; }
  .upload-ok .file { display: flex; align-items: center; gap: 12px; }
  .check-icon { width: 20px; height: 20px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #34d399; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; }
`;

interface Mockup {
  filename: string;
  width: number;
  height: number;
  body: string;
}

const MOCKUPS: Mockup[] = [
  {
    filename: "project-new.png",
    width: 1200,
    height: 700,
    body: `
      <div style="max-width: 520px; margin: 40px auto;">
        <div class="card">
          <div class="title">New project</div>
          <div class="subtitle">Projects group one mobile app's configuration — bundle id, package name, store credentials, API keys.</div>
          <div class="divider"></div>
          <div class="stack">
            <div>
              <label class="label">Project name</label>
              <input class="input" value="TestApp" />
              <div class="hint">Appears in the dashboard and in log lines.</div>
            </div>
            <div>
              <label class="label">Slug</label>
              <input class="input" value="testapp" />
              <div class="hint">Generated from the name — unique within your organization. Used in URLs.</div>
            </div>
            <div>
              <label class="label">Platform</label>
              <div class="row" style="gap: 8px;">
                <span class="pill" style="background:#1f2023;color:#e5e7eb;">React Native</span>
                <span class="pill" style="background:#1f2023;color:#8e8e93;">Flutter</span>
                <span class="pill" style="background:#1f2023;color:#8e8e93;">iOS</span>
                <span class="pill" style="background:#1f2023;color:#8e8e93;">Android</span>
                <span class="pill" style="background:#1f2023;color:#8e8e93;">KMP</span>
              </div>
              <div class="hint">Drives which setup guides the dashboard highlights.</div>
            </div>
            <div class="row" style="justify-content: flex-end; gap: 10px; margin-top: 10px;">
              <button class="btn-ghost">Cancel</button>
              <button class="btn">Create project</button>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  {
    filename: "project-create.png",
    width: 1200,
    height: 700,
    body: `
      <div style="max-width: 520px; margin: 40px auto;">
        <div class="card">
          <div class="title">New project</div>
          <div class="subtitle">Projects group one mobile app's configuration — bundle id, package name, store credentials, API keys.</div>
          <div class="divider"></div>
          <div class="stack">
            <div>
              <label class="label">Project name</label>
              <input class="input" value="TestApp" />
            </div>
            <div>
              <label class="label">Slug</label>
              <input class="input" value="testapp" />
              <div class="hint">Used in URLs like /hyo-dev/project/<b style="color:#e5e7eb">testapp</b>.</div>
            </div>
            <div class="row" style="justify-content: flex-end; gap: 10px;">
              <button class="btn-ghost">Cancel</button>
              <button class="btn">Create project</button>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  {
    filename: "api-keys.png",
    width: 1200,
    height: 700,
    body: `
      <div style="max-width: 1000px; margin: 0 auto;">
        <div class="row" style="justify-content: space-between; margin-bottom: 20px;">
          <div>
            <div class="title">API keys</div>
            <div class="subtitle">Bearer tokens your backend sends to /v1/purchase/verify. Scoped to this project.</div>
          </div>
          <button class="btn">+ Issue new key</button>
        </div>
        <div class="card" style="padding: 0; overflow: hidden;">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key prefix</th>
                <th>Last used</th>
                <th>Calls</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Default Production Key <span class="pill pill-green" style="margin-left:6px;">ACTIVE</span></td>
                <td class="mono muted">openiap-kit_a4f2b9…</td>
                <td class="muted">2 minutes ago</td>
                <td class="mono">1,284</td>
                <td class="muted mono">⋯</td>
              </tr>
              <tr>
                <td>Staging CI</td>
                <td class="mono muted">openiap-kit_c7e1d3…</td>
                <td class="muted">3 hours ago</td>
                <td class="mono">42</td>
                <td class="muted mono">⋯</td>
              </tr>
              <tr>
                <td>Dev — local</td>
                <td class="mono muted">openiap-kit_9a3f12…</td>
                <td class="muted">Yesterday</td>
                <td class="mono">7</td>
                <td class="muted mono">⋯</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="hint" style="margin-top: 14px;">Keys are shown in full exactly once, at creation. Store them in a secret manager — anyone with the key can hit /v1/purchase/verify against your project's quota.</div>
      </div>
    `,
  },
  {
    filename: "ios-config.png",
    width: 1000,
    height: 760,
    body: `
      <div style="max-width: 620px; margin: 0 auto;">
        <div class="card">
          <div class="row" style="gap: 10px; margin-bottom: 16px;">
            <span style="font-size:20px;">🍎</span>
            <div class="title">iOS Configuration</div>
          </div>
          <div class="stack">
            <div>
              <label class="label">App Store Connect API Key (.p8)</label>
              <div class="upload-ok">
                <div class="file">
                  <span class="check-icon">✓</span>
                  <div>
                    <div style="font-size: 13px; color: #34d399;">Authentication file uploaded successfully</div>
                    <div class="mono muted" style="margin-top:2px;">testapp_iap.p8 · 0.25 KB</div>
                  </div>
                </div>
                <span class="muted mono" style="cursor:pointer;">🗑</span>
              </div>
            </div>
            <div>
              <label class="label">Bundle ID *</label>
              <input class="input" value="dev.openiap.testapp" />
              <div class="hint">Reverse-domain identifier from App Store Connect → App Information.</div>
            </div>
            <div>
              <label class="label">App Apple ID</label>
              <input class="input" value="1234567890" />
              <div class="hint">Numeric ID Apple assigns; required for production-environment receipts.</div>
            </div>
            <div>
              <label class="label">Issuer ID (UUID)</label>
              <input class="input" value="69A6DE88-2C4A-47E3-B12F-4E5D6F7A8B9C" />
            </div>
            <div>
              <label class="label">Key ID (10 chars)</label>
              <input class="input" value="ABCDE12345" />
            </div>
            <button class="btn" style="margin-top: 6px;">Save identifiers</button>
          </div>
        </div>
      </div>
    `,
  },
  {
    filename: "android-config.png",
    width: 1000,
    height: 820,
    body: `
      <div style="max-width: 620px; margin: 0 auto;">
        <div class="card">
          <div class="row" style="gap: 10px; margin-bottom: 16px;">
            <span style="font-size:20px;">🤖</span>
            <div class="title">Android Configuration</div>
          </div>
          <div class="stack">
            <div>
              <label class="label">Google Service Account (JSON)</label>
              <div class="upload-ok">
                <div class="file">
                  <span class="check-icon">✓</span>
                  <div>
                    <div style="font-size: 13px; color: #34d399;">Service account file uploaded successfully</div>
                    <div class="mono muted" style="margin-top:2px;">testapp-c0b27-03106b0482ca.json · 2.29 KB</div>
                  </div>
                </div>
                <span class="muted mono" style="cursor:pointer;">🗑</span>
              </div>
            </div>
            <div class="divider"></div>
            <div style="padding: 10px 0;">
              <div class="row" style="gap: 12px; align-items: flex-start;">
                <span class="checkbox">✓</span>
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: #fafafa;">Enable Meta Horizon (Quest / VR)</div>
                  <div class="hint" style="margin-top: 2px;">Meta's billing SDK is Google-Play-compatible, but server verification goes through the Meta Graph API with its own credentials.</div>
                </div>
              </div>
              <div style="margin-left: 26px; margin-top: 14px;" class="stack">
                <div>
                  <label class="label">Meta App ID</label>
                  <input class="input" value="1234567890123456" />
                  <div class="hint">Numeric ID from the Meta Developer Dashboard (6–20 digits).</div>
                </div>
                <div>
                  <label class="label">App Secret</label>
                  <div class="upload-ok" style="padding: 10px 14px;">
                    <div class="file">
                      <span class="check-icon">✓</span>
                      <span style="font-size: 13px; color: #34d399;">App Secret configured</span>
                    </div>
                    <button class="btn-ghost" style="padding: 5px 12px;">Replace</button>
                  </div>
                  <div class="hint">App Secret from the Meta Developer Dashboard. The IAPKit server combines it with the App ID as OC|APP_ID|APP_SECRET for each verify call — treat it like a password.</div>
                </div>
                <div class="row" style="justify-content: flex-end; gap: 10px;">
                  <button class="btn">Save Horizon config</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  {
    filename: "horizon-config.png",
    width: 1000,
    height: 620,
    body: `
      <div style="max-width: 620px; margin: 0 auto;">
        <div class="card" style="border-style: solid;">
          <div class="row" style="gap: 10px; margin-bottom: 12px;">
            <span style="font-size:18px;">🤖</span>
            <div style="font-size: 15px; font-weight: 500; color: #a1a1aa;">Android Configuration</div>
          </div>
          <div class="muted" style="font-size: 12px; margin-bottom: 16px;">(Google Service Account section, not shown)</div>
          <div class="divider"></div>
          <div class="row" style="gap: 12px; align-items: flex-start;">
            <span class="checkbox">✓</span>
            <div>
              <div style="font-size: 13px; font-weight: 500; color: #fafafa;">Enable Meta Horizon (Quest / VR)</div>
              <div class="hint" style="margin-top: 2px;">Meta's billing SDK is Google-Play-compatible, but server verification goes through the Meta Graph API with its own credentials.</div>
            </div>
          </div>
          <div style="margin-left: 26px; margin-top: 14px;" class="stack">
            <div>
              <label class="label">Meta App ID</label>
              <input class="input" value="1234567890123456" />
              <div class="hint">Numeric ID from the Meta Developer Dashboard (6–20 digits).</div>
            </div>
            <div>
              <label class="label">App Secret</label>
              <div class="upload-ok" style="padding: 10px 14px;">
                <div class="file">
                  <span class="check-icon">✓</span>
                  <span style="font-size: 13px; color: #34d399;">App Secret configured</span>
                </div>
                <button class="btn-ghost" style="padding: 5px 12px;">Replace</button>
              </div>
              <div class="hint">Server combines it with App ID as OC|APP_ID|APP_SECRET for each verify call — treat it like a password.</div>
            </div>
            <div class="row" style="justify-content: flex-end; gap: 10px;">
              <button class="btn">Save Horizon config</button>
            </div>
          </div>
        </div>
      </div>
    `,
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const m of MOCKUPS) {
    const context = await browser.newContext({
      viewport: { width: m.width, height: m.height },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });
    const page = await context.newPage();
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body>${m.body}</body></html>`;
    await page.setContent(html, { waitUntil: "load" });
    // Mockups use system fonts, but we still wait for `fonts.ready`
    // explicitly — `waitUntil: 'load'` doesn't include the FontFace
    // promise resolution, and a fixed 100ms hedge was racy under load.
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: resolve(OUT, m.filename),
      fullPage: false,
    });
    await context.close();
    console.log(`→ ${m.filename}`);
  }
  await browser.close();
  console.log(`\n✅ Wrote ${MOCKUPS.length} mockups to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
