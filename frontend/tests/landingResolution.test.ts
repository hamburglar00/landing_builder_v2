import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { captureLandingResolution } from '../lib/landing/resolution';

function browser(href: string) {
  const window = {
    location: { href },
    history: { state: null, replaceState(_state: unknown, _title: string, target: string) {
      window.location.href = new URL(target, window.location.href).href;
    } },
  };
  const capture = runInNewContext(`(${captureLandingResolution.toString()})`, { window, URL });
  return { window, capture: (classic = false) => capture('chosen', classic) };
}

test('parameter selection wins over root, path and automatic marker in both engines', () => {
  for (const classic of [false, true]) for (const path of ['/', '/other', '/l/other']) {
    const fixture = browser(`https://landing.test${path}?landing=chosen&__landing_auto=chosen&facebook=Original#form`);
    assert.equal(fixture.capture(classic), 'url_parameter');
    assert.equal(new URL(fixture.window.location.href).searchParams.has('__landing_auto'), false);
    assert.equal(new URL(fixture.window.location.href).searchParams.get('facebook'), 'Original');
    assert.equal(new URL(fixture.window.location.href).hash, '#form');
    assert.equal(fixture.capture(classic), 'url_parameter');
  }
});

test('direct links and blank query parameters use the route', () => {
  for (const classic of [false, true]) {
    const path = classic ? '/chosen' : '/l/chosen';
    for (const suffix of ['', '/', '?landing=', '?landing=%20']) {
      assert.equal(browser(`https://landing.test${path}${suffix}`).capture(classic), 'path');
    }
  }
});

test('automatic selection survives repeated captures but not copying/reloading the clean route', () => {
  const fixture = browser('https://landing.test/chosen?__landing_auto=chosen&cp=00123');
  assert.equal(fixture.capture(true), 'automatic');
  assert.equal(fixture.capture(true), 'automatic');
  assert.equal(browser(fixture.window.location.href).capture(true), 'path');
  assert.equal(browser('https://landing.test/chosen?__landing_auto=other').capture(true), 'path');
  assert.equal(browser('https://landing.test/l/chosen?__landing_auto=chosen').capture(), 'path');
});

test('missing or inconsistent selections stay unknown instead of guessing from an unrelated route', () => {
  for (const suffix of ['/', '/l/other', '/?landing=other', '/l/chosen?landing=chosen&landing=other']) {
    assert.equal(browser(`https://landing.test${suffix}`).capture(), null);
  }
});
