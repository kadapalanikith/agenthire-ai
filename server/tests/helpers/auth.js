'use strict';

const request = require('supertest');

let counter = 0;

/** Create a recruiter through the real signup endpoint and return { user, token, auth }. */
async function createRecruiter(app, overrides = {}) {
  counter += 1;
  const body = {
    name: overrides.name || `Recruiter ${counter}`,
    email: overrides.email || `recruiter${counter}-${Date.now()}@example.com`,
    password: overrides.password || 'Str0ngPassword',
  };
  const res = await request(app).post('/auth/signup').send(body);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const { user, token } = res.body.data;
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

module.exports = { createRecruiter };
