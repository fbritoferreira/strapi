import type { FieldDescription } from '../types';

export type Coerced = { value: unknown } | { error: string };

const TRUE = new Set(['true', '1', 'yes', 'y']);
const FALSE = new Set(['false', '0', 'no', 'n']);
const INTEGER = /^-?\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const parseJson = (cell: string): Coerced => {
  try {
    return { value: JSON.parse(cell) };
  } catch {
    return { error: 'is not valid JSON' };
  }
};

const parseTime = (cell: string): Coerced => {
  const match = TIME.exec(cell);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59) {
    return { error: `"${cell}" is not a time (HH:mm or HH:mm:ss)` };
  }
  const [, hours, minutes, seconds = '00', millis = '0'] = match;
  return { value: `${hours}:${minutes}:${seconds}.${millis.padEnd(3, '0')}` };
};

/**
 * Turns one CSV cell into the value the Document Service expects for `field`.
 * A blank cell becomes null, which clears the field on update.
 * Relation and media cells are resolved by the importer, not here.
 */
export const coerce = (field: FieldDescription, raw: string): Coerced => {
  const cell = raw.trim();
  if (cell === '') return { value: null };

  switch (field.type) {
    case 'text':
    case 'richtext':
      return { value: raw };
    case 'string':
    case 'email':
    case 'uid':
      return { value: cell };
    case 'integer':
      return INTEGER.test(cell) ? { value: Number(cell) } : { error: `"${cell}" is not an integer` };
    case 'biginteger':
      return INTEGER.test(cell) ? { value: cell } : { error: `"${cell}" is not an integer` };
    case 'float':
    case 'decimal': {
      const value = Number(cell);
      return Number.isFinite(value) ? { value } : { error: `"${cell}" is not a number` };
    }
    case 'boolean': {
      const lower = cell.toLowerCase();
      if (TRUE.has(lower)) return { value: true };
      if (FALSE.has(lower)) return { value: false };
      return { error: `"${cell}" is not a boolean` };
    }
    case 'date':
      return DATE.test(cell) && !Number.isNaN(Date.parse(cell))
        ? { value: cell }
        : { error: `"${cell}" is not a date (YYYY-MM-DD)` };
    case 'datetime': {
      const time = Date.parse(cell);
      return Number.isNaN(time) ? { error: `"${cell}" is not a date-time` } : { value: new Date(time).toISOString() };
    }
    case 'time':
      return parseTime(cell);
    case 'enumeration':
      return field.enum?.includes(cell)
        ? { value: cell }
        : { error: `"${cell}" is not one of: ${(field.enum ?? []).join(', ')}` };
    case 'json':
    case 'blocks':
      return parseJson(cell);
    default:
      return { error: `type "${field.type}" cannot be imported` };
  }
};

/** Splits a relation or media cell on `|`, trimming and dropping blanks and duplicates. */
export const splitMulti = (cell: string): string[] => [
  ...new Set(
    cell
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
  ),
];
