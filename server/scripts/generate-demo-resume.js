'use strict';

/**
 * Writes demo-data/resumes/john-react-resume.pdf, the demo resume used by the
 * spec's end-to-end check. The person is fictional; contact details use
 * reserved example domains/numbers.
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildPdfFromLines } = require('./lib/simplePdf');

const LINES = [
  '# John Carter',
  'Frontend Developer',
  'john.carter@example.com | +1 555 010 0199 | https://portfolio.example.com',
  '',
  '# Summary',
  'Frontend developer with 4 years of professional experience building accessible, fast',
  'web applications with React and JavaScript.',
  '',
  '# Experience',
  'Frontend Developer, Brightline Analytics (2022 - present)',
  '- Built a React dashboard with hooks and context used by 3,000 daily users.',
  '- Migrated pages to Next.js with server rendering, cutting load time by 40%.',
  '- Wrote responsive layouts in CSS grid and flexbox; introduced Tailwind CSS utilities.',
  'Junior Web Developer, Northwind Studio (2020 - 2022)',
  '- Developed JavaScript features and HTML templates for client marketing sites.',
  '- Added unit tests with Jest and fixed cross-browser CSS issues.',
  '',
  '# Skills',
  'JavaScript, React, Next.js, HTML, CSS, Tailwind CSS, Git, Jest, REST',
  '',
  '# Projects',
  'Recipe Finder - React app with search, filters and offline caching',
  'Design Tokens Kit - shared CSS variables and Tailwind CSS preset for two products',
  '',
  '# Education',
  'B.Sc. Computer Science, State University, 2020',
];

const out = path.resolve(__dirname, '../../demo-data/resumes/john-react-resume.pdf');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buildPdfFromLines(LINES));
process.stdout.write(`Wrote ${path.relative(process.cwd(), out)}\n`);
