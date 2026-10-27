import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';

test('offline preload blocks side effects before adapters execute', async () => {
  for (const attempt of [
    () => fetch('https://invalid.example'),
    () => http.get('http://invalid.example'),
    () => net.connect(443, 'invalid.example'),
    () => spawn('must-never-run'),
    () => writeFileSync('must-never-exist', 'synthetic'),
    () => writeFile('must-never-exist', 'synthetic'),
  ]) assert.throws(attempt, /P0-02 offline policy/);
});
