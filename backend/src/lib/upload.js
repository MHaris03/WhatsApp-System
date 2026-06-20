/**
 * Multer upload middleware — stores uploads in UPLOAD_DIR with a safe filename.
 */
const multer = require('multer');
const { UPLOAD_DIR, MAX_UPLOAD_BYTES } = require('../config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-() ]/g, '_');
    cb(null, `${process.hrtime.bigint()}-${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } });

module.exports = upload;
