import { fail, text, uuid, integer } from './validation.js';

export const adventureColumns = 'version,revision,title,synopsis,storyline,dm_guidance AS "dmGuidance",canvas';

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
}

function coordinate(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) fail(`${label} must be a number from 0 to 100.`);
  return value;
}

// Build an allowlisted object at every level; unknown fields are discarded.
export function adventure(value) {
  object(value, 'Campaign image');
  if (value.version !== 1) fail('Unsupported campaign image version.');
  const result = {
    version: 1,
    revision: integer(value.revision, 'Revision', 0, 2147483646),
    title: text(value.title, 'Adventure title', 150, true),
    synopsis: text(value.synopsis, 'Synopsis', 2000),
    storyline: text(value.storyline, 'Storyline', 20000),
    dmGuidance: text(value.dmGuidance, 'DM guidance', 20000),
    canvas: null,
  };
  if (value.canvas !== null) {
    object(value.canvas, 'Canvas');
    if (!Array.isArray(value.canvas.points) || value.canvas.points.length > 100) fail('Canvas must contain no more than 100 points.');
    const ids = new Set();
    result.canvas = {
      title: text(value.canvas.title, 'Canvas title', 150, true),
      points: value.canvas.points.map((point) => {
        object(point, 'Canvas point');
        const id = uuid(point.id).toLowerCase();
        if (ids.has(id)) fail('Canvas point IDs must be unique.');
        ids.add(id);
        if (!['story', 'location', 'encounter', 'npc'].includes(point.kind)) fail('Invalid canvas point kind.');
        return {
          id, title: text(point.title, 'Point title', 150, true), kind: point.kind,
          x: coordinate(point.x, 'Point x'), y: coordinate(point.y, 'Point y'),
          notes: text(point.notes, 'Point notes', 4000),
          location: text(point.location, 'Point location', 200),
          characters: text(point.characters, 'Point characters', 4000),
        };
      }),
    };
  }
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 200000) fail('Campaign image must be no larger than 200 KB.');
  return result;
}
