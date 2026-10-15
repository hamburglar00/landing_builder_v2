import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_COLUMNS, columnLabel, columnsForTableView, conversionMatchesTableSearch } from '../components/conversiones/conversionPageShared';

test('new attribution columns are visible and searchable in friendly and technical views', () => {
  const keys = ['landing', 'campana', 'conjunto', 'anuncio'] as const;
  for (const view of ['friendly', 'technical'] as const) {
    const columns = columnsForTableView([...ALL_COLUMNS], view);
    for (const key of keys) assert.ok(columns.includes(key));
  }
  assert.equal(columnLabel('campana', 'friendly'), 'Campaña');
  assert.equal(columnLabel('conjunto', 'friendly'), 'Conjunto de anuncios');
  for (const key of keys) assert.equal(conversionMatchesTableSearch({ [key]: 'Octubre único' }, 'único'), true);
  assert.ok(ALL_COLUMNS.includes('utm_campaign'));
});
