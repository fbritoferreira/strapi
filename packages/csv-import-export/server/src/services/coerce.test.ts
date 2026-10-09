import { describe, expect, it } from 'vitest';

import type { FieldDescription } from '../types';
import { coerce, splitMulti } from './coerce';

const field = (type: string, extra: Partial<FieldDescription> = {}): FieldDescription => ({
  name: 'f',
  type,
  required: false,
  unique: false,
  ...extra,
});

describe('coerce', () => {
  it('turns an empty or blank cell into null so the field is cleared', () => {
    expect(coerce(field('string'), '')).toEqual({ value: null });
    expect(coerce(field('integer'), '   ')).toEqual({ value: null });
  });

  it('keeps text as written and trims single-line string types', () => {
    expect(coerce(field('text'), '  two\nlines ')).toEqual({ value: '  two\nlines ' });
    expect(coerce(field('richtext'), ' x ')).toEqual({ value: ' x ' });
    expect(coerce(field('string'), ' hello ')).toEqual({ value: 'hello' });
    expect(coerce(field('uid'), ' my-slug ')).toEqual({ value: 'my-slug' });
    expect(coerce(field('email'), 'a@b.co')).toEqual({ value: 'a@b.co' });
  });

  it('parses integers and rejects anything else', () => {
    expect(coerce(field('integer'), '-42')).toEqual({ value: -42 });
    expect(coerce(field('integer'), '4.2')).toEqual({ error: '"4.2" is not an integer' });
    expect(coerce(field('integer'), 'abc')).toEqual({ error: '"abc" is not an integer' });
  });

  it('keeps big integers as digit strings', () => {
    expect(coerce(field('biginteger'), '9007199254740993')).toEqual({ value: '9007199254740993' });
    expect(coerce(field('biginteger'), '1e3')).toEqual({ error: '"1e3" is not an integer' });
  });

  it('parses floats and decimals', () => {
    expect(coerce(field('float'), '3.5')).toEqual({ value: 3.5 });
    expect(coerce(field('decimal'), '-0.25')).toEqual({ value: -0.25 });
    expect(coerce(field('float'), 'NaN')).toEqual({ error: '"NaN" is not a number' });
  });

  it('accepts common boolean spellings in any case', () => {
    for (const cell of ['true', 'TRUE', '1', 'yes', 'Y']) expect(coerce(field('boolean'), cell)).toEqual({ value: true });
    for (const cell of ['false', 'False', '0', 'no', 'n']) expect(coerce(field('boolean'), cell)).toEqual({ value: false });
    expect(coerce(field('boolean'), 'maybe')).toEqual({ error: '"maybe" is not a boolean' });
  });

  it('validates dates as YYYY-MM-DD', () => {
    expect(coerce(field('date'), '2026-10-09')).toEqual({ value: '2026-10-09' });
    expect(coerce(field('date'), '09/10/2026')).toEqual({ error: '"09/10/2026" is not a date (YYYY-MM-DD)' });
    expect(coerce(field('date'), '2026-13-01')).toEqual({ error: '"2026-13-01" is not a date (YYYY-MM-DD)' });
  });

  it('normalises datetimes to ISO 8601 UTC', () => {
    expect(coerce(field('datetime'), '2026-10-09T10:00:00+01:00')).toEqual({ value: '2026-10-09T09:00:00.000Z' });
    expect(coerce(field('datetime'), 'yesterday')).toEqual({ error: '"yesterday" is not a date-time' });
  });

  it('normalises times to HH:mm:ss.SSS', () => {
    expect(coerce(field('time'), '09:30')).toEqual({ value: '09:30:00.000' });
    expect(coerce(field('time'), '23:59:58.5')).toEqual({ value: '23:59:58.500' });
    expect(coerce(field('time'), '24:00')).toEqual({ error: '"24:00" is not a time (HH:mm or HH:mm:ss)' });
  });

  it('checks enumeration values against the schema', () => {
    const f = field('enumeration', { enum: ['draft', 'live'] });
    expect(coerce(f, 'live')).toEqual({ value: 'live' });
    expect(coerce(f, 'gone')).toEqual({ error: '"gone" is not one of: draft, live' });
  });

  it('parses json and blocks cells', () => {
    expect(coerce(field('json'), '{"a":1}')).toEqual({ value: { a: 1 } });
    expect(coerce(field('blocks'), '[]')).toEqual({ value: [] });
    expect(coerce(field('json'), '{a:1}')).toEqual({ error: 'is not valid JSON' });
  });

  it('refuses types it does not know how to import', () => {
    expect(coerce(field('component'), 'x')).toEqual({ error: 'type "component" cannot be imported' });
  });
});

describe('splitMulti', () => {
  it('splits on |, trims, drops blanks and duplicates', () => {
    expect(splitMulti(' a | b ||a ')).toEqual(['a', 'b']);
    expect(splitMulti('')).toEqual([]);
  });
});
