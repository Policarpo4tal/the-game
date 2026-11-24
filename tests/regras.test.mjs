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

test('nova aventura cria herói válido com classe e inimigos', () => {
  const e = Regras.rpgNovaAventura('Lina', 'Mago');
  assert.equal(e.nome, 'Lina');
  assert.equal(e.classe, 'Mago');
  assert.equal(e.vidaMax, 90);
  assert.equal(e.inimigos.length, 3);
  assert.equal(Regras.rpgDadosValidos(e), true);
});

test('movimento aceita corrida e respeita o limite do mapa', () => {
  let e = Regras.rpgNovaAventura('Lina', 'Guerreiro');
  e = Regras.rpgAtualizar(e, { dx: 1, dz: 0, correr: true }, 100);
  assert.equal(e.x, 0.8);
  e = Regras.rpgAtualizar({ ...e, x: 43.9 }, { dx: 1 }, 100);
  assert.equal(e.x, 44);
});

test('paredes de casas bloqueiam passagem durante a exploração', () => {
  const e = { ...Regras.rpgNovaAventura('Lina', 'Guerreiro'), x: 9, z: 10 };
  const bloqueado = Regras.rpgAtualizar(e, { dx: 1, dz: 0 }, 100);
  assert.equal(bloqueado.x, e.x);
  assert.equal(bloqueado.z, e.z);
});

test('ataque só atinge inimigo próximo e respeita recarga', () => {
  let e = Regras.rpgNovaAventura('Lina', 'Guerreiro');
  const distante = Regras.rpgAtualizar(e, { atacar: true }, 16, () => 0);
  assert.equal(distante.inimigos[0].vida, 3);
  e = { ...e, x: -6, z: -12 };
  const perto = Regras.rpgAtualizar(e, { atacar: true }, 16, () => 0);
  assert.equal(perto.inimigos[0].vida, 1);
  const recarga = Regras.rpgAtualizar(perto, { atacar: true }, 16, () => 0);
  assert.equal(recarga.inimigos[0].vida, 1);
});

test('monstro persegue o herói e causa dano ao alcançar distância de ataque', () => {
  let e = Regras.rpgNovaAventura('Lina', 'Guerreiro');
  e = { ...e, x: -7, z: -12, inimigos: e.inimigos.map((enemy, i) => i ? { ...enemy, vida: 0 } : { ...enemy, x: -7, z: -13 }) };
  const perto = Regras.rpgAtualizar(e, {}, 100, () => 0);
  assert.ok(perto.vida < perto.vidaMax);
});

test('baú recompensa apenas uma vez e o progresso pode ser validado antes de salvar', () => {
  let e = Regras.rpgNovaAventura('Lina', 'Arqueiro');
  e = { ...e, x: 18, z: 18 };
  e = Regras.rpgAtualizar(e, { interagir: true }, 16, () => 0);
  assert.equal(e.bausAberto, true);
  assert.equal(e.moedas, 50);
  const segunda = Regras.rpgAtualizar(e, { interagir: true }, 16, () => 0);
  assert.equal(segunda.moedas, 50);
  assert.equal(Regras.rpgDadosValidos(segunda), true);
  assert.equal(Regras.rpgDadosValidos({ ...segunda, x: 'inválido' }), false);
});
