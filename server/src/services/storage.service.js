'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { getEnv } = require('../config/env');

const KEY_PATTERN = /^[a-f0-9-]{36}\.pdf$/;

function uploadDir() {
  return path.resolve(getEnv().UPLOAD_DIR);
}

/** Resolve a storage key to an absolute path, refusing anything outside UPLOAD_DIR. */
function resolveKey(key) {
  if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
  const full = path.resolve(uploadDir(), key);
  if (path.dirname(full) !== uploadDir()) throw new Error('Invalid storage key');
  return full;
}

/**
 * Persist a validated resume under a random name (the original file name is
 * never used on disk). Returns { key, sha256, size_bytes }.
 */
async function saveResume(buffer) {
  await fsp.mkdir(uploadDir(), { recursive: true });
  const key = `${crypto.randomUUID()}.pdf`;
  await fsp.writeFile(resolveKey(key), buffer, { flag: 'wx', mode: 0o600 });
  return { key, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), size_bytes: buffer.length };
}

async function deleteResume(key) {
  await fsp.rm(resolveKey(key), { force: true });
}

async function resumeExists(key) {
  try {
    await fsp.access(resolveKey(key), fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function openResumeStream(key) {
  return fs.createReadStream(resolveKey(key));
}

module.exports = { saveResume, deleteResume, resumeExists, openResumeStream, resolveKey };
