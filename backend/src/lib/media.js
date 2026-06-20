/**
 * Persist base64 media to the MEDIA_DIR and return a public URL for the browser.
 */
const fs = require('fs');
const path = require('path');
const { MEDIA_DIR } = require('../config');

const EXT_MAP = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
};

function saveMedia(base64Data, mimetype, suggestedName) {
  const ext =
    EXT_MAP[mimetype] ||
    (suggestedName && suggestedName.includes('.') ? suggestedName.split('.').pop() : 'bin');
  const filename = `${process.hrtime.bigint()}.${ext}`;
  fs.writeFileSync(path.join(MEDIA_DIR, filename), Buffer.from(base64Data, 'base64'));
  return { url: `/files/${filename}`, mimetype, filename: suggestedName || filename };
}

module.exports = { saveMedia };
