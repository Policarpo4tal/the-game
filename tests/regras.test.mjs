import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const Regras = require('../docs/jogo/regras.js');

test('uma partida começa com 30 segundos e zero pontos', () => {
  const e = Regras.novaPartida();
  assert.equal(e.restante, 30000);
  assert.equal(Regras.pontos(e), 0);
  assert.equal(Regras.terminou(e), false);
});

test('o primeiro alvo pode ser sorteado de forma reproduzível', () => {
  const e = Regras.tick(Regras.novaPartida(), 900, () => 0);
  assert.equal(e.alvos.length, 1);
  assert.equal(e.alvos[0].nome, 'moeda');
});

test('alvo bom soma 10 pontos e aumenta o combo', () => {
  let e = Regras.tick(Regras.novaPartida(), 900, () => 0);
  e = Regras.acertar(e, e.alvos[0].id);
  assert.equal(Regras.pontos(e), 10);
  assert.equal(e.combo, 1);
  assert.equal(e.acertos, 1);
});

test('cada quinto acerto seguido vale 20 pontos', () => {
  let e = Regras.novaPartida();
  for (let i = 0; i < 5; i++) {
    e = Regras.tick(e, 900, () => 0);
    e = Regras.acertar(e, e.alvos[0].id);
  }
  assert.equal(e.combo, 5);
  assert.equal(Regras.pontos(e), 60);
});

test('alvo proibido tira 15 pontos, nunca deixa pontuação negativa e zera combo', () => {
  let e = Regras.tick(Regras.novaPartida(), 900, () => 0.99);
  e = { ...e, pontos: 8, combo: 3 };
  e = Regras.acertar(e, e.alvos[0].id);
  assert.equal(Regras.pontos(e), 0);
  assert.equal(e.combo, 0);
  assert.equal(e.erros, 1);
});

test('um alvo que já sumiu não altera a partida', () => {
  const e = Regras.novaPartida();
  assert.equal(Regras.acertar(e, 99), e);
});

test('o relógio termina em zero e não passa para valor negativo', () => {
  const e = Regras.tick(Regras.novaPartida(), 31000, () => 0);
  assert.equal(e.restante, 0);
  assert.equal(Regras.terminou(e), true);
  assert.equal(e.alvos.length, 0);
});

test('uma partida encerrada não aceita mais alvos nem pontos', () => {
  const fim = Regras.tick(Regras.novaPartida(), 30000, () => 0);
  const depois = Regras.acertar(fim, 1);
  assert.equal(depois, fim);
  assert.equal(depois.pontos, 0);
});
