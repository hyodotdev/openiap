#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') {
  console.error(
    'Error: render:mcp-video requires macOS because it uses the macOS-only sips utility for SVG-to-PNG conversion.'
  );
  process.exit(1);
}

const width = 1600;
const height = 900;
const fps = 15;
const durationSeconds = 24;
const frameCount = fps * durationSeconds;
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/docs/videos/openiap-mcp-expo-test.webm'
);

function requireCommand(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
  } catch {
    throw new Error(`Missing required command: ${command}`);
  }
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function fade(time, start, duration = 0.55) {
  return ease((time - start) / duration);
}

function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function text(value, x, y, options = {}) {
  const {
    size = 24,
    weight = 500,
    fill = '#f5f7fb',
    opacity = 1,
    anchor = 'start',
    baseline = 'central',
    family = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, Arial, sans-serif",
  } = options;

  return `<text x="${x}" y="${y}" fill="${fill}" opacity="${opacity}" font-size="${size}" font-weight="${weight}" font-family="${family}" text-anchor="${anchor}" dominant-baseline="${baseline}" letter-spacing="0">${escapeText(value)}</text>`;
}

function roundedRect(x, y, w, h, options = {}) {
  const {
    rx = 18,
    fill = 'none',
    stroke = 'none',
    strokeWidth = 1,
    opacity = 1,
  } = options;

  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

function badge(label, x, y, w, fill, stroke) {
  const h = 40;

  return [
    roundedRect(x, y, w, h, {
      rx: h / 2,
      fill,
      stroke,
      strokeWidth: 1.4,
    }),
    text(label, x + w / 2, y + h / 2, {
      size: 15,
      weight: 720,
      fill: '#eef6ff',
      anchor: 'middle',
    }),
  ].join('');
}

function promptBlock(time) {
  const opacity = fade(time, 0.4, 0.8);
  const x = 86;
  const y = 268;
  const h = 156;
  const lines = [
    ['Use OpenIAP MCP to wire IAP in this Expo app.', 0.6],
    ['Load Premium, 10 Bulbs, and 30 Bulbs.', 1.25],
    ['Connect Buy, then validate the purchase on dev.', 1.9],
  ];

  return `
    <g opacity="${opacity}">
      ${roundedRect(x, y, 990, h, {
        rx: 20,
        fill: '#151923',
        stroke: '#2c3445',
        strokeWidth: 1.4,
      })}
      <rect x="${x}" y="${y + 26}" width="4" height="100" rx="2" fill="#77bdfb"/>
      ${text('Prompt', x + 30, y + 31, {
        size: 26,
        weight: 760,
        fill: '#8fc9ff',
      })}
      ${lines
        .map(([line, start], index) =>
          text(line, x + 30, y + 73 + index * 35, {
            size: 27,
            weight: 530,
            fill: '#edf4ff',
            opacity: fade(time, start, 0.5),
          })
        )
        .join('')}
    </g>`;
}

const steps = [
  {
    start: 2.4,
    label: 'initialize + tools/list',
    result: '13 iapkit_* tools',
  },
  {
    start: 5.2,
    label: 'iapkit_setup',
    result: 'Expo hook generated',
  },
  {
    start: 8.0,
    label: 'list subscription',
    result: 'Premium loaded',
  },
  {
    start: 11.2,
    label: 'list in-app products',
    result: '10 Bulbs loaded',
  },
  {
    start: 14.2,
    label: 'list in-app products',
    result: '30 Bulbs loaded',
  },
  {
    start: 17.1,
    label: 'requestPurchase',
    result: 'purchase sheet opened',
  },
  {
    start: 20.4,
    label: 'receipt validation',
    result: 'dev Kit wired',
  },
];

function stepRows(time) {
  const rowStartY = 452;
  const rowGap = 48;
  const rowHeight = 40;

  return steps
    .map((step, index) => {
      const y = rowStartY + index * rowGap;
      const centerY = y + rowHeight / 2;
      const show = fade(time, step.start, 0.5);
      const done = time >= step.start + 1.6;
      const active = time >= step.start && time < step.start + 1.6;
      const fill = active ? '#1a4e73' : '#151923';
      const stroke = active ? '#4aa9e9' : '#2b3444';
      const resultOpacity = fade(time, step.start + 0.6, 0.45);

      return `
        <g opacity="${show}" transform="translate(0 ${Math.round((1 - show) * 10)})">
          ${roundedRect(86, y, 990, rowHeight, {
            rx: 15,
            fill,
            stroke,
            strokeWidth: active ? 2 : 1.2,
          })}
          <circle cx="118.5" cy="${centerY}" r="12.5" fill="${active ? '#79beff' : '#53637a'}"/>
          ${text(String(index + 1), 118.5, centerY, {
            size: 13,
            weight: 800,
            fill: active ? '#0c1c2b' : '#c9d5e8',
            anchor: 'middle',
          })}
          ${text(step.label, 150, centerY, {
            size: 20,
            weight: 760,
            fill: '#f1f6ff',
          })}
          ${text(`${step.result}${done ? ' OK' : ''}`, 610, centerY, {
            size: 20,
            weight: 720,
            fill: done || active ? '#b8f1ce' : '#cbd4e3',
            opacity: resultOpacity,
          })}
        </g>`;
    })
    .join('');
}

function productCard({
  y,
  name,
  price,
  color = '#2e9cff',
  opacity = 1,
  pressed = false,
}) {
  return `
    <g opacity="${opacity}">
      ${roundedRect(1226, y, 318, 108, {
        rx: 13,
        fill: '#242321',
        stroke: '#3a3936',
        strokeWidth: 1.2,
      })}
      ${text(name, 1246, y + 33, {
        size: 25,
        weight: 780,
        fill: '#fafafa',
      })}
      ${text(price, 1527, y + 33, {
        size: 24,
        weight: 780,
        fill: '#f5f5f5',
        anchor: 'end',
      })}
      ${roundedRect(1245, y + 60, 280, 44, {
        rx: 5,
        fill: pressed ? '#0f75d8' : color,
        stroke: pressed ? '#ffcf45' : 'none',
        strokeWidth: pressed ? 3 : 0,
      })}
      ${text('Buy', 1385, y + 83, {
        size: 14,
        weight: 650,
        fill: color === '#ffffff' ? '#1d1d1f' : '#09213a',
        anchor: 'middle',
      })}
    </g>`;
}

function phone(time) {
  const storeOpacity = fade(time, 5.2, 0.7);
  const premiumOpacity = fade(time, 8.0, 0.7);
  const bulb10Opacity = fade(time, 11.2, 0.7);
  const bulb30Opacity = fade(time, 14.2, 0.7);
  const pressed = time >= 17.1 && time < 18.2;
  const sheet = fade(time, 18.2, 0.7);

  return `
    <g>
      ${roundedRect(1178, 50, 390, 806, {
        rx: 48,
        fill: '#0b0d10',
        stroke: '#263242',
        strokeWidth: 2,
      })}
      ${roundedRect(1195, 66, 356, 774, {
        rx: 39,
        fill: '#20201f',
        stroke: '#373839',
        strokeWidth: 1.4,
      })}
      <circle cx="1232" cy="116" r="23" fill="#171717" stroke="#303030" stroke-width="1.2"/>
      ${text('3:08', 1230, 86, {
        size: 17,
        weight: 760,
        fill: '#f1f1f1',
      })}
      ${text('...', 1454, 85, {
        size: 17,
        weight: 700,
        fill: '#9a9a9a',
      })}
      ${text('Wi-Fi', 1498, 86, {
        size: 10,
        weight: 700,
        fill: '#f0f0f0',
        anchor: 'middle',
      })}
      ${roundedRect(1513, 78, 28, 13, {
        rx: 4,
        fill: '#75e38b',
        stroke: '#e6e6e6',
        strokeWidth: 1,
      })}
      ${text('Example App', 1374, 119, {
        size: 18,
        weight: 780,
        fill: '#f6f6f6',
        anchor: 'middle',
      })}
      <line x1="1196" y1="154" x2="1551" y2="154" stroke="#2a2a2a" stroke-width="1"/>
      ${
        storeOpacity > 0.02
          ? text('Store', 1226, 206, {
              size: 36,
              weight: 850,
              fill: '#f8f8f8',
              opacity: storeOpacity,
            })
          : ''
      }
      ${
        premiumOpacity > 0.02
          ? `${text('Subscriptions', 1226, 286, {
              size: 26,
              weight: 820,
              fill: '#f8f8f8',
              opacity: premiumOpacity,
            })}
          ${productCard({
            y: 309,
            name: 'Premium',
            price: '₩14,000',
            color: '#ffffff',
            opacity: premiumOpacity,
          })}`
          : ''
      }
      ${
        bulb10Opacity > 0.02
          ? `${text('Products', 1226, 468, {
              size: 26,
              weight: 820,
              fill: '#f8f8f8',
              opacity: bulb10Opacity,
            })}
          ${productCard({
            y: 492,
            name: '10 Bulbs',
            price: '₩1,100',
            opacity: bulb10Opacity,
            pressed,
          })}`
          : ''
      }
      ${
        bulb30Opacity > 0.02
          ? productCard({
              y: 638,
              name: '30 Bulbs',
              price: '₩4,400',
              opacity: bulb30Opacity,
            })
          : ''
      }
      ${purchaseSheet(sheet)}
    </g>`;
}

function purchaseSheet(opacity) {
  if (opacity <= 0.01) {
    return '';
  }

  return `
    <g opacity="${opacity}">
      <rect x="1196" y="154" width="355" height="686" fill="#000000" opacity="0.58"/>
      ${roundedRect(1206, 356, 336, 408, {
        rx: 36,
        fill: '#1f1f1f',
        stroke: '#393939',
        strokeWidth: 1.2,
      })}
      ${text('Sandbox', 1230, 395, {
        size: 22,
        weight: 780,
        fill: '#ffffff',
      })}
      <circle cx="1508" cy="393" r="22" fill="#3a3a3a"/>
      ${text('x', 1508, 392, {
        size: 27,
        weight: 360,
        fill: '#f4f4f4',
        anchor: 'middle',
      })}
      ${roundedRect(1228, 427, 292, 180, {
        rx: 20,
        fill: '#4c4c4a',
        stroke: 'none',
      })}
      <rect x="1243" y="443" width="61" height="61" fill="#f5f5f5"/>
      ${text('E', 1273.5, 473.5, {
        size: 32,
        weight: 850,
        fill: '#1d1d1f',
        anchor: 'middle',
      })}
      ${text('10 Bulbs', 1317, 451, {
        size: 15,
        weight: 780,
        fill: '#ffffff',
      })}
      ${text('Example App', 1317, 470, {
        size: 12,
        weight: 520,
        fill: '#d8d8d8',
      })}
      ${text('In-App Purchase', 1317, 489, {
        size: 12,
        weight: 520,
        fill: '#d8d8d8',
      })}
      <line x1="1243" y1="532" x2="1505" y2="532" stroke="#5b5b59" stroke-width="1"/>
      ${text('₩1,100', 1243, 565, {
        size: 17,
        weight: 800,
        fill: '#ffffff',
      })}
      ${text('One-time charge', 1243, 587, {
        size: 13,
        weight: 520,
        fill: '#d8d8d8',
      })}
      ${text('For testing purposes only. You will not be charged', 1243, 628, {
        size: 12,
        weight: 640,
        fill: '#ffffff',
      })}
      ${text('for confirming this purchase.', 1243, 645, {
        size: 12,
        weight: 640,
        fill: '#ffffff',
      })}
      <line x1="1243" y1="681" x2="1505" y2="681" stroke="#5b5b59" stroke-width="1"/>
      ${text('Account: sandbox@example.com', 1243, 707, {
        size: 12,
        weight: 520,
        fill: '#d8d8d8',
      })}
      <circle cx="1374" cy="733" r="17" fill="none" stroke="#0a84ff" stroke-width="3"/>
      ${text('Confirm with Side Button', 1374, 760, {
        size: 15,
        weight: 580,
        fill: '#c6c6c6',
        anchor: 'middle',
      })}
    </g>`;
}

function renderFrame(time) {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#10131a"/>
        <stop offset="0.58" stop-color="#0c0f15"/>
        <stop offset="1" stop-color="#090a0d"/>
      </linearGradient>
      <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#131a24"/>
        <stop offset="1" stop-color="#11151d"/>
      </linearGradient>
      <radialGradient id="glow" cx="56%" cy="8%" r="58%">
        <stop offset="0" stop-color="#1b222d" stop-opacity="0.62"/>
        <stop offset="1" stop-color="#0b0d10" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
    ${roundedRect(24, 24, 1552, 852, {
      rx: 28,
      fill: '#0b0d10',
      stroke: '#272e3a',
      strokeWidth: 1.6,
    })}
    ${roundedRect(58, 54, 1084, 786, {
      rx: 30,
      fill: 'url(#panel)',
      stroke: '#2d3748',
      strokeWidth: 1.8,
    })}
    <g transform="translate(92 64)">
      ${badge('Local MCP', 0, 0, 142, '#123f64', '#2c8cca')}
      ${badge('Dev Kit', 158, 0, 142, '#104b36', '#2c936a')}
      ${badge('Real iPhone', 316, 0, 156, '#4d390d', '#bd8a17')}
    </g>
    ${text('OpenIAP MCP + Example App', 92, 176, {
      size: 55,
      weight: 850,
      fill: '#ffffff',
    })}
    ${text(
      'Prompt to Expo hook to live products to sandbox purchase sheet',
      92,
      226,
      {
        size: 26,
        weight: 500,
        fill: '#aeb8c7',
      }
    )}
    ${promptBlock(time)}
    ${stepRows(time)}
    ${phone(time)}
  </svg>`;
}

requireCommand('sips');
requireCommand('ffmpeg');

mkdirSync(dirname(outputPath), { recursive: true });
const workdir = mkdtempSync(join(tmpdir(), 'openiap-mcp-video-'));

try {
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / fps;
    const svgPath = join(
      workdir,
      `frame-${String(frame).padStart(4, '0')}.svg`
    );
    const pngPath = join(
      workdir,
      `frame-${String(frame).padStart(4, '0')}.png`
    );
    writeFileSync(svgPath, renderFrame(time));
    try {
      execFileSync('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath], {
        stdio: 'pipe',
      });
    } catch (error) {
      const stderr =
        error && typeof error === 'object' && 'stderr' in error
          ? String(error.stderr)
          : error instanceof Error
            ? error.message
            : String(error);
      console.error(
        `Failed to render frame ${frame} at ${time.toFixed(2)}s: ${stderr}`
      );
      throw error;
    }
  }

  if (existsSync(outputPath)) {
    rmSync(outputPath);
  }

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      join(workdir, 'frame-%04d.png'),
      '-vf',
      'fps=30,format=yuv420p',
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      '37',
      '-deadline',
      'good',
      '-row-mt',
      '1',
      '-an',
      outputPath,
    ],
    { stdio: 'inherit' }
  );
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
