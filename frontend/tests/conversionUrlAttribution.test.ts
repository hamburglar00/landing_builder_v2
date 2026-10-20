import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_COLUMNS, columnLabel, columnsForTableView, conversionMatchesTableSearch } from '../components/conversiones/conversionPageShared';

test('new attribution columns are visible and searchable in friendly and technical views', () => {
  const keys = ['landing', 'facebook', 'portofolio', 'cp', 'campana', 'conjunto', 'anuncio'] as const;
  for (const view of ['friendly', 'technical'] as const) {
    const columns = columnsForTableView([...ALL_COLUMNS], view);
    for (const key of keys) assert.ok(columns.includes(key));
    assert.deepEqual(columns.slice(columns.indexOf('landing'), columns.indexOf('campana') + 1), ['landing', 'facebook', 'portofolio', 'cp', 'campana']);
  }
  assert.equal(columnLabel('campana', 'friendly'), 'Campaña');
  assert.equal(columnLabel('facebook', 'friendly'), 'Facebook');
  assert.equal(columnLabel('portofolio', 'friendly'), 'Portofolio');
  assert.equal(columnLabel('cp', 'friendly'), 'Cuenta publicitaria');
  assert.equal(columnLabel('conjunto', 'friendly'), 'Conjunto de anuncios');
  for (const key of keys) assert.equal(conversionMatchesTableSearch({ [key]: 'Octubre único' }, 'único'), true);
  assert.ok(ALL_COLUMNS.includes('utm_campaign'));
});

test('numeric advertising identifiers remain searchable without broadening phone matching', () => {
  for (const key of ['facebook', 'portofolio', 'cp']) {
    assert.equal(conversionMatchesTableSearch({ [key]: '001234567890123456789' }, '001234567890123456789'), true);
    assert.equal(conversionMatchesTableSearch({ [key]: '001234567890123456789' }, '1234567890123456789'), false);
  }
  assert.equal(conversionMatchesTableSearch({ phone: '5491123456789' }, '+54 9 11 2345-6789'), true);
  assert.equal(conversionMatchesTableSearch({ phone: '5491123456789' }, '1123456789'), false);
});
