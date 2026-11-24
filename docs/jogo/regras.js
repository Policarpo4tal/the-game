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

  const CLASSES = {
    Guerreiro: { vida: 120, dano: 2, cor: '#b93b32', arma: '⚔️' },
    Mago: { vida: 90, dano: 3, cor: '#6853b7', arma: '🔮' },
    Arqueiro: { vida: 100, dano: 2, cor: '#39834d', arma: '🏹' },
    Paladino: { vida: 130, dano: 2, cor: '#c99d32', arma: '🛡️' },
    Assassino: { vida: 95, dano: 3, cor: '#51535c', arma: '🗡️' }
  };
  const INIMIGOS_INICIAIS = [
    { id: 1, nome: 'Goblin batedor', tipo: 'goblin', nivel: 1, x: -7, z: -12, vida: 3, maxVida: 3, dano: 7, xp: 35, moeda: 8 },
    { id: 2, nome: 'Lobo cinzento', tipo: 'lobo', nivel: 2, x: 8, z: -18, vida: 4, maxVida: 4, dano: 10, xp: 45, moeda: 10 },
    { id: 3, nome: 'Esqueleto errante', tipo: 'esqueleto', nivel: 3, x: 16, z: 4, vida: 5, maxVida: 5, dano: 12, xp: 60, moeda: 15 }
  ];
  // Reforços opcionais do mapa: preservamos a lista inicial pública de três inimigos.
  const INIMIGOS_RESERVA = [
    { id: 4, nome: 'Sentinela das ruínas', tipo: 'esqueleto', nivel: 2, x: -31, z: -16, vida: 5, maxVida: 5, dano: 9, xp: 40, moeda: 10 },
    { id: 5, nome: 'Lobo da muralha', tipo: 'lobo', nivel: 2, x: 32, z: -17, vida: 4, maxVida: 4, dano: 10, xp: 45, moeda: 10 },
    { id: 6, nome: 'Goblin da estrada', tipo: 'goblin', nivel: 1, x: -16, z: -37, vida: 3, maxVida: 3, dano: 7, xp: 35, moeda: 8 },
    { id: 7, nome: 'Esqueleto do portão', tipo: 'esqueleto', nivel: 3, x: 14, z: 31, vida: 6, maxVida: 6, dano: 11, xp: 55, moeda: 13 },
    { id: 8, nome: 'Lobo das cinzas', tipo: 'lobo', nivel: 3, x: -35, z: 28, vida: 5, maxVida: 5, dano: 12, xp: 55, moeda: 14 }
  ];
  const RAIO_AGRO_INIMIGO = 5.8;
  const RAIO_ATAQUE_INIMIGO = 1.65;
  const CONFIG_BOSS = Object.freeze({ vida: 42, alcance: 3.8, raioAgro: 19, windup: .72, ataque: .3, recuperacao: 1.8, dano: 20 });
  const CASAS = [[-10,9],[-15,15],[12,10],[18,13],[8,21]];
  const ARVORES = [[-22,-18],[-28,-8],[24,-16],[30,-2],[-25,20],[27,22],[-33,5],[34,12]];
  function bloqueado(x, z) {
    if (CASAS.some(([cx,cz]) => Math.abs(x-cx)<2.6 && Math.abs(z-cz)<2.6)) return true;
    if (Math.abs(z+32)<1.35 && Math.abs(x)>2.4) return true;
    if (Math.abs(x-25)<3.8 && z>-34 && z<48) return true;
    if (ARVORES.some(([tx,tz]) => Math.hypot(x-tx,z-tz)<1.45)) return true;
    return [[-28,-28,2],[-25,-29,2.5],[-22,-27,2],[-30,-25,2.2],[23,-27,2],[28,-24,2.8]]
      .some(([rx,rz,r]) => Math.hypot(x-rx,z-rz)<r*.55);
  }
  function rpgNovaAventura(nome, classe) {
    const classeOk = Object.hasOwn(CLASSES, classe) ? classe : 'Guerreiro';
    const atributos = CLASSES[classeOk];
    return {
      nome: String(nome || 'Aventureiro').trim().slice(0, 18) || 'Aventureiro', classe: classeOk,
      x: 0, z: 2, vida: atributos.vida, vidaMax: atributos.vida, nivel: 1, xp: 0, moedas: 0,
      inimigosDerrotados: 0, habilidade: false, cooldown: 0, invulneravel: 0,
      bausAberto: false, inimigos: INIMIGOS_INICIAIS.map((inimigo) => ({ ...inimigo })),
      inimigosReserva: INIMIGOS_RESERVA.map((inimigo) => ({ ...inimigo })), salaDoRei: false,
      boss: { x: 0, z: -114, vida: CONFIG_BOSS.vida, vidaMax: CONFIG_BOSS.vida, estado: 'vigilia', tempoEstado: 0, golpeAplicado: false, derrotado: false },
      tempo: 0, acabou: false
    };
  }
  function rpgInimigos(estado) { return [...(estado?.inimigos || []), ...(estado?.inimigosReserva || [])]; }
  function rpgPortalPerto(estado) {
    if (!estado) return false;
    return estado.salaDoRei
      ? Math.hypot(estado.x, estado.z + 78) < 3.2
      : Math.hypot(estado.x, estado.z + 42.2) < 3.2;
  }
  function rpgAtualizar(estado, entrada, deltaMs, sorteio) {
    if (estado.acabou) return estado;
    const dt = Math.max(0, Math.min(deltaMs, 100)) / 1000;
    const input = entrada || {};
    const velocidade = input.correr ? 8 : 5;
    let dx = Number(input.dx) || 0;
    let dz = Number(input.dz) || 0;
    const comprimento = Math.hypot(dx, dz) || 1;
    dx /= comprimento; dz /= comprimento;
    let salaDoRei = Boolean(estado.salaDoRei);
    let x = salaDoRei ? Math.max(-17.4, Math.min(17.4, estado.x + dx * velocidade * dt)) : Math.max(-44, Math.min(44, estado.x + dx * velocidade * dt));
    let z = salaDoRei ? Math.max(-123.5, Math.min(-76.5, estado.z + dz * velocidade * dt)) : Math.max(-44, Math.min(44, estado.z + dz * velocidade * dt));
    if (!salaDoRei && bloqueado(x,z)) { x = estado.x; z = estado.z; }
    let vida = estado.vida;
    let invulneravel = Math.max(0, estado.invulneravel - dt);
    let cooldown = Math.max(0, estado.cooldown - dt);
    let xp = estado.xp;
    let moedas = estado.moedas;
    let inimigosDerrotados = estado.inimigosDerrotados;
    let nivel = estado.nivel;
    let habilidade = estado.habilidade;
    let bausAberto = estado.bausAberto;
    let inimigos = estado.inimigos.map((inimigo) => ({ ...inimigo }));
    let inimigosReserva = (estado.inimigosReserva || []).map((inimigo) => ({ ...inimigo }));
    let boss = estado.boss ? { ...estado.boss } : { x: 0, z: -114, vida: CONFIG_BOSS.vida, vidaMax: CONFIG_BOSS.vida, estado: 'vigilia', tempoEstado: 0, golpeAplicado: false, derrotado: false };
    // E/Triângulo alterna entre a vila e o salão, usando spawns de cada lado do portal.
    if (input.interagir && !input.portalBloqueado && rpgPortalPerto({ ...estado, x, z })) {
      salaDoRei = !salaDoRei;
      x = 0; z = salaDoRei ? -82 : -38.5;
      dx = 0; dz = 0;
    }
    if (input.interagir && !bausAberto && Math.hypot(18 - x, 18 - z) < 2.5) {
      bausAberto = true;
      moedas += 50;
      xp += 25;
      if (!habilidade && xp >= 100) habilidade = true;
      while (xp >= nivel * 100) { xp -= nivel * 100; nivel++; }
    }
    if (input.atacar && cooldown === 0) {
      const todos = salaDoRei ? [] : [...inimigos, ...inimigosReserva];
      const alvo = todos.filter((item) => item.vida > 0)
        .map((item) => ({ item, distancia: Math.hypot(item.x - x, item.z - z) }))
        .filter((par) => par.distancia < 2.8).sort((a, b) => a.distancia - b.distancia)[0];
      cooldown = 0.48;
      const distanciaBoss = salaDoRei && !boss.derrotado ? Math.hypot(boss.x - x, boss.z - z) : Infinity;
      if (alvo && alvo.distancia <= distanciaBoss) {
        const item = [...inimigos, ...inimigosReserva].find((inimigo) => inimigo.id === alvo.item.id);
        item.vida = Math.max(0, item.vida - CLASSES[estado.classe].dano);
        if (item.vida === 0) {
          const rand = typeof sorteio === 'function' ? sorteio : Math.random;
          xp += item.xp;
          moedas += item.moeda + Math.floor(Math.max(0, Math.min(.9999, rand())) * 6);
          inimigosDerrotados++;
          if (!habilidade && xp >= 100) habilidade = true;
          while (xp >= nivel * 100) { xp -= nivel * 100; nivel++; }
        }
      } else if (distanciaBoss < 3.05) {
        boss.vida = Math.max(0, boss.vida - CLASSES[estado.classe].dano);
        if (boss.vida === 0) boss.derrotado = true;
      }
    }
    const atualizarInimigo = (inimigo) => {
      if (inimigo.vida <= 0) return inimigo;
      if (salaDoRei) return inimigo;
      const vx = x - inimigo.x; const vz = z - inimigo.z;
      const distancia = Math.hypot(vx, vz);
      if (distancia > RAIO_ATAQUE_INIMIGO && distancia < RAIO_AGRO_INIMIGO) {
        const passo = Math.min(distancia - 1.5, (inimigo.tipo === 'lobo' ? 2.6 : 1.7) * dt);
        inimigo.x += vx / (distancia || 1) * passo;
        inimigo.z += vz / (distancia || 1) * passo;
      } else if (distancia <= RAIO_ATAQUE_INIMIGO && invulneravel === 0) {
        vida = Math.max(0, vida - inimigo.dano * dt);
        invulneravel = .7;
      }
      return inimigo;
    };
    inimigos = inimigos.map(atualizarInimigo);
    inimigosReserva = inimigosReserva.map(atualizarInimigo);
    // Boss: vigília, windup legível, quadro ativo de golpe e recuperação sem ataques.
    if (salaDoRei && !boss.derrotado) {
      const distancia = Math.hypot(x - boss.x, z - boss.z);
      const vx = x - boss.x, vz = z - boss.z;
      if (boss.estado === 'vigilia') {
        if (distancia < CONFIG_BOSS.raioAgro && distancia > CONFIG_BOSS.alcance) {
          const passo = Math.min(distancia - CONFIG_BOSS.alcance, 1.15 * dt);
          boss.x += vx / (distancia || 1) * passo; boss.z += vz / (distancia || 1) * passo;
        } else if (distancia <= CONFIG_BOSS.alcance) { boss.estado = 'preparacao'; boss.tempoEstado = 0; boss.golpeAplicado = false; }
      } else {
        boss.tempoEstado += dt;
        if (boss.estado === 'preparacao' && boss.tempoEstado >= CONFIG_BOSS.windup) { boss.estado = 'ataque'; boss.tempoEstado = 0; }
        else if (boss.estado === 'ataque') {
          if (!boss.golpeAplicado) {
            if (distancia <= CONFIG_BOSS.alcance + .45 && invulneravel <= 0) { vida = Math.max(0, vida - CONFIG_BOSS.dano); invulneravel = .9; }
            boss.golpeAplicado = true;
          }
          if (boss.tempoEstado >= CONFIG_BOSS.ataque) { boss.estado = 'recuperacao'; boss.tempoEstado = 0; }
        } else if (boss.estado === 'recuperacao' && boss.tempoEstado >= CONFIG_BOSS.recuperacao) { boss.estado = 'vigilia'; boss.tempoEstado = 0; }
      }
    }
    return { ...estado, x, z, vida, invulneravel, cooldown, xp, moedas, nivel, habilidade,
      inimigosDerrotados, bausAberto, inimigos, inimigosReserva, salaDoRei, boss, tempo: estado.tempo + dt,
      acabou: vida <= 0 };
  }
  function rpgDadosValidos(estado) {
    return Boolean(estado && Object.hasOwn(CLASSES, estado.classe) &&
      typeof estado.nome === 'string' && estado.nome.length <= 18 &&
      Number.isFinite(estado.x) && Number.isFinite(estado.z) &&
      Number.isFinite(estado.vida) && Number.isFinite(estado.xp) &&
      Number.isInteger(estado.nivel) && estado.nivel >= 1 &&
      Array.isArray(estado.inimigos) && estado.inimigos.length <= 20 &&
      (estado.inimigosReserva === undefined || (Array.isArray(estado.inimigosReserva) && estado.inimigosReserva.length <= 20)) &&
      (estado.salaDoRei === undefined || typeof estado.salaDoRei === 'boolean') &&
      (estado.boss === undefined || (estado.boss && typeof estado.boss === 'object' && Number.isFinite(estado.boss.x) &&
        Number.isFinite(estado.boss.z) && Number.isFinite(estado.boss.vida) && Number.isFinite(estado.boss.vidaMax))));
  }
  return { DURACAO_MS, novaPartida, tick, acertar, pontos, terminou,
    CLASSES, RAIO_AGRO_INIMIGO, RAIO_ATAQUE_INIMIGO, CONFIG_BOSS,
    rpgNovaAventura, rpgAtualizar, rpgDadosValidos, rpgInimigos, rpgPortalPerto };
});
