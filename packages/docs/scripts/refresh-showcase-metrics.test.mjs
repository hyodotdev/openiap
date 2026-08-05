// Fixtures for the Google Play scrape in refresh-showcase-metrics.mjs.
//
// The parser must never turn a selector drift into a zero: ordering metrics are
// written straight into showcase-apps.json, so a silent zero demotes a real app.
// Play does omit the review element for apps with few or no reviews, though, so
// "absent" and "broken" have to stay distinguishable.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePlayMetrics } from './refresh-showcase-metrics.mjs';

const installBlock = (value = '1K+') =>
  `<div class="wVqUob"><div class="ClM7O">${value}</div><div class="g1rdde">Downloads</div></div>`;

const reviewBlock = (value = '55') =>
  `<div class="g1rdde">${value} reviews</div>`;

const heading = '<h2 class="XfZNbf">Ratings and reviews</h2>';

test('reads review count and install floor from a populated page', () => {
  const html = `${heading}${reviewBlock('55')}${installBlock('1K+')}`;
  assert.deepEqual(parsePlayMetrics(html, 'com.example.app'), {
    ratings: 55,
    installs: 1000,
  });
});

test('parses compact review counts', () => {
  const html = `${reviewBlock('1.2K')}${installBlock('500K+')}`;
  assert.deepEqual(parsePlayMetrics(html, 'com.example.app'), {
    ratings: 1200,
    installs: 500000,
  });
});

test('treats an absent review element as a real zero', () => {
  // Newly released apps render the heading and install block but no count.
  const html = `${heading}${installBlock('1+')}`;
  assert.deepEqual(parsePlayMetrics(html, 'com.example.new'), {
    ratings: 0,
    installs: 1,
  });
});

test('throws when the install block is missing', () => {
  const html = `${heading}${reviewBlock('55')}`;
  assert.throws(
    () => parsePlayMetrics(html, 'com.example.app'),
    /install count not found/
  );
});

test('throws when a review element exists but its count cannot be read', () => {
  // Play kept the element and changed the number format underneath us.
  const html = `${heading}<div class="g1rdde">many reviews</div><div class="EHUI5b">1 234 reviews</div>${installBlock('1K+')}`;
  assert.throws(
    () => parsePlayMetrics(html, 'com.example.app'),
    /could not read its count/
  );
});

test('does not mistake review chrome for a count', () => {
  const html = `${heading}<span class="VfPpkd-vQzf8d">Ratings and reviews</span>${installBlock('10K+')}`;
  assert.deepEqual(parsePlayMetrics(html, 'com.example.app'), {
    ratings: 0,
    installs: 10000,
  });
});
