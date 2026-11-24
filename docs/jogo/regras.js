(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.Regras = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const DURACAO_MS = 30000;
  const ALVOS = [
    { emoji: '🪙', bom: true, nome: 'moeda' },
    { emoji: '🧪', bom: true, nome: 'poção' },
    { emoji: '🛡️', bom: true, nome: 'escudo' },
    { emoji: '💀', bom: false, nome: 'caveira proibida' }
  ];
  function novaPartida() {
    return { restante: DURACAO_MS, pontos: 0, combo: 0, acertos: 0, erros: 0, alvos: [], proximoId: 1, proximoAlvo: 0, terminou: false };
  }
  function tick(estado, deltaMs, sorteio) {
    if (estado.terminou) return estado;
    const rand = typeof sorteio === 'function' ? sorteio : Math.random;
    const restante = Math.max(0, estado.restante - Math.max(0, deltaMs));
    let alvos = estado.alvos.map((alvo) => ({ ...alvo, vida: alvo.vida - deltaMs })).filter((alvo) => alvo.vida > 0);
    let proximoAlvo = estado.proximoAlvo - deltaMs;
    const nivel = Math.floor((DURACAO_MS - restante) / 10000);
    const intervalo = Math.max(360, 850 - nivel * 170);
    if (restante > 0 && proximoAlvo <= 0 && alvos.length < 4) {
      const op = ALVOS[Math.floor(Math.max(0, Math.min(0.999999, rand())) * ALVOS.length)];
      alvos.push({ id: estado.proximoId, emoji: op.emoji, nome: op.nome, bom: op.bom,
        x: 8 + rand() * 84, y: 8 + rand() * 82, vida: Math.max(650, 1400 - nivel * 180) });
      estado = { ...estado, proximoId: estado.proximoId + 1 };
      proximoAlvo = intervalo;
    }
    return { ...estado, restante, alvos, proximoAlvo, terminou: restante === 0 };
  }
  function acertar(estado, id) {
    if (estado.terminou) return estado;
    const alvo = estado.alvos.find((item) => item.id === id);
    if (!alvo) return estado;
    const alvos = estado.alvos.filter((item) => item.id !== id);
    if (!alvo.bom) return { ...estado, alvos, combo: 0, erros: estado.erros + 1, pontos: Math.max(0, estado.pontos - 15) };
    const combo = estado.combo + 1;
    const valor = combo > 0 && combo % 5 === 0 ? 20 : 10;
    return { ...estado, alvos, combo, acertos: estado.acertos + 1, pontos: estado.pontos + valor };
  }
  function pontos(estado) { return estado.pontos; }
  function terminou(estado) { return estado.terminou; }
  return { DURACAO_MS, novaPartida, tick, acertar, pontos, terminou };
});
