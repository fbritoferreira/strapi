import { describe, expect, it } from 'vitest';

import type { FieldDescription } from '../../../server/src/types';
import { autoMap, chunk, defaultMatchOn, failuresToCsv, mappingProblems, parseCsv, sameHeaders } from './csv';

const field = (name: string, extra: Partial<FieldDescription> = {}): FieldDescription => ({
  name,
  type: 'string',
  required: false,
  unique: false,
  ...extra,
});

const fields: FieldDescription[] = [
  field('documentId', { unique: true }),
  field('title', { required: true }),
  field('slug', { type: 'uid', unique: true }),
  field('publishedOn', { type: 'date' }),
  field('category', { type: 'relation', relation: { target: 'api::category.category', multiple: false } }),
];

describe('parseCsv', () => {
  it('reads headers and rows as strings, stripping a UTF-8 BOM and header whitespace', () => {
    expect(parseCsv('﻿title , slug\r\n"Hello, world",hello\r\n\r\n')).toEqual({
      headers: ['title', 'slug'],
      rows: [{ title: 'Hello, world', slug: 'hello' }],
    });
  });

  it('fills missing trailing cells with empty strings', () => {
    expect(parseCsv('a,b\n1')).toEqual({ headers: ['a', 'b'], rows: [{ a: '1', b: '' }] });
  });

  it('rejects duplicate headers, blank headers and empty files', () => {
    expect(parseCsv('a,a\n1,2')).toEqual({ error: 'column "a" appears more than once' });
    expect(parseCsv('a,\n1,2')).toEqual({ error: 'column 2 has no header' });
    expect(parseCsv('a,b\n')).toEqual({ error: 'the file has no data rows' });
  });

  it('rejects rows with more cells than headers', () => {
    expect(parseCsv('a,b\n1,2,3')).toEqual({ error: 'row 1 has more cells than there are columns' });
  });
});

describe('autoMap', () => {
  it('matches headers to fields ignoring case, spaces, _ and -', () => {
    expect(autoMap(['Title', 'SLUG', 'published_on', 'Category', 'Notes'], fields)).toEqual({
      Title: 'title',
      SLUG: 'slug',
      published_on: 'publishedOn',
      Category: 'category',
      Notes: '',
    });
  });

  it('never maps two columns to the same field', () => {
    expect(autoMap(['slug', 'Slug'], fields)).toEqual({ slug: 'slug', Slug: '' });
  });
});

describe('defaultMatchOn', () => {
  it('prefers a unique field other than documentId, else documentId', () => {
    expect(defaultMatchOn([field('documentId', { unique: true }), field('name'), field('slug', { unique: true })])).toBe(
      'slug'
    );
    expect(defaultMatchOn([field('documentId', { unique: true }), field('name')])).toBe('documentId');
  });
});

describe('mappingProblems', () => {
  const base = {
    mapping: { Title: 'title', Slug: 'slug', Cat: 'category' },
    matchField: 'slug',
    relations: { category: { matchOn: 'slug' } },
  };

  it('has no errors for a complete mapping', () => {
    expect(mappingProblems(fields, base)).toEqual({ errors: [], warnings: [] });
  });

  it('requires the match field to be mapped', () => {
    expect(mappingProblems(fields, { ...base, matchField: 'documentId' }).errors).toEqual([
      'Map a column to documentId, the field used to find existing entries.',
    ]);
  });

  it('rejects a field mapped twice', () => {
    expect(mappingProblems(fields, { ...base, mapping: { ...base.mapping, Other: 'slug' } }).errors).toEqual([
      'slug is mapped from more than one column.',
    ]);
  });

  it('requires a match field for every mapped relation', () => {
    expect(mappingProblems(fields, { ...base, relations: {} }).errors).toEqual([
      'Choose which category field the Cat column matches.',
    ]);
  });

  it('warns, without blocking, when a required field is unmapped', () => {
    expect(mappingProblems(fields, { ...base, mapping: { Slug: 'slug' } })).toEqual({
      errors: [],
      warnings: ['title is required: rows that create new entries will fail without it.'],
    });
  });
});

describe('sameHeaders', () => {
  it('compares header sets regardless of order', () => {
    expect(sameHeaders(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameHeaders(['a', 'b'], ['a'])).toBe(false);
  });
});

describe('chunk', () => {
  it('splits rows into fixed-size batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('failuresToCsv', () => {
  it('writes the row number and message before the original columns', () => {
    expect(failuresToCsv(['title', 'slug'], [{ row: 3, data: { title: 'x', slug: 'y' }, message: 'bad, really' }])).toBe(
      'row,error,title,slug\r\n3,"bad, really",x,y'
    );
  });

  it('escapes formula-looking cells, since another admin may open the file', () => {
    expect(failuresToCsv(['title'], [{ row: 1, data: { title: '=HYPERLINK("x")' }, message: 'm' }])).toBe(
      'row,error,title\r\n1,m,"\'=HYPERLINK(""x"")"'
    );
  });
});
