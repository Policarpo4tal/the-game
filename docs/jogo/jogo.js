(async function () {
  'use strict';
  const config = window.JOGO_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  document.title = config.nome || 'The Warrior';
  $('titulo').textContent = config.nome || 'The Warrior';
  if (config.cor) {
    document.documentElement.style.setProperty('--cor', config.cor);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', config.cor);
  }
  PlacarUI.montar($('painel-placar'));
  const progresso = await Placar.iniciar();
  $('melhor').textContent = progresso.melhor;
  Placar.aoMudar((p) => { $('melhor').textContent = p.melhor; });

  let estadoAventura = progresso.dados && Regras.rpgDadosValidos(progresso.dados.rpg) ? progresso.dados.rpg : null;
  let renderizador = null;
  let frameMundo = 0;
  let tempoAnterior = 0;
  let salvarDecorrido = 0;
  let ataqueAnimacao = 0;
  let saltoDecorrido = 0;
  let ataqueSolicitado = false;
  let puloSolicitado = false;
  let interacaoSolicitada = false;
  let joystick = { dx: 0, dz: 0 };
  const cameraPointers = new Map();
  let distanciaToqueCamera = null;
  let anguloHeroi = 0;
  let treino;
  let frameTreino;
  let treinoSalvando = false;
  let contextoAudio = null;
  const teclas = new Set();
  const classes = Object.keys(Regras.CLASSES);

  function mostrar(tela) {
    ['tela-inicio', 'tela-aventura', 'tela-jogo', 'tela-fim'].forEach((id) => { $(id).hidden = id !== tela; });
  }
  function atualizarProgressoSalvo() {
    $('botao-continuar').hidden = !estadoAventura || estadoAventura.acabou;
    $('progresso-salvo').textContent = estadoAventura && !estadoAventura.acabou
      ? `Viagem salva: ${estadoAventura.nome}, nível ${estadoAventura.nivel}.` : '';
  }
  atualizarProgressoSalvo();

  function salvarAventura() {
    if (!estadoAventura || !Regras.rpgDadosValidos(estadoAventura)) return Promise.resolve();
    return Placar.salvar({ rpg: estadoAventura }).catch((erro) => {
      $('hud-mensagem').textContent = 'Não foi possível salvar: ' + erro.message;
    });
  }
  function prepararAudio() {
    if (contextoAudio) { contextoAudio.resume().catch(() => {}); return; }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      contextoAudio = new Audio();
      contextoAudio.resume().catch(() => {});
    }
  }
  function tocarImpactoEspada() {
    if (!contextoAudio) return;
    const agora = contextoAudio.currentTime;
    const brilho = contextoAudio.createOscillator();
    const corpo = contextoAudio.createOscillator();
    const volumeBrilho = contextoAudio.createGain();
    const volumeCorpo = contextoAudio.createGain();
    brilho.type = 'triangle'; corpo.type = 'sine';
    brilho.frequency.setValueAtTime(1180, agora);
    brilho.frequency.exponentialRampToValueAtTime(310, agora + .11);
    corpo.frequency.setValueAtTime(210, agora);
    corpo.frequency.exponentialRampToValueAtTime(95, agora + .09);
    volumeBrilho.gain.setValueAtTime(.0001, agora);
    volumeBrilho.gain.exponentialRampToValueAtTime(.12, agora + .006);
    volumeBrilho.gain.exponentialRampToValueAtTime(.0001, agora + .14);
    volumeCorpo.gain.setValueAtTime(.0001, agora);
    volumeCorpo.gain.exponentialRampToValueAtTime(.16, agora + .004);
    volumeCorpo.gain.exponentialRampToValueAtTime(.0001, agora + .1);
    brilho.connect(volumeBrilho); volumeBrilho.connect(contextoAudio.destination);
    corpo.connect(volumeCorpo); volumeCorpo.connect(contextoAudio.destination);
    brilho.start(agora); corpo.start(agora);
    brilho.stop(agora + .15); corpo.stop(agora + .11);
  }
  function montarRenderizador() {
    if (renderizador) return true;
    try {
      renderizador = Mundo3D.iniciar($('mundo'));
      $('tela-falha-3d').hidden = true;
      return true;
    } catch (erro) {
      $('tela-falha-3d').hidden = false;
      $('tela-falha-3d').textContent = erro.message + ' Use um navegador com WebGL habilitado. Você ainda pode voltar ao acampamento.';
      return false;
    }
  }
  function iniciarAventura(novoHeroi) {
    if (novoHeroi) {
      const nome = $('nome-heroi').value.trim().slice(0, 18) || 'Aventureiro';
      const classe = classes.includes($('classe-heroi').value) ? $('classe-heroi').value : 'Guerreiro';
      estadoAventura = Regras.rpgNovaAventura(nome, classe);
    } else if (!estadoAventura || estadoAventura.acabou) return;
    if (!montarRenderizador()) { mostrar('tela-aventura'); return; }
    mostrar('tela-aventura');
    $('tela-falha-3d').hidden = true;
    tempoAnterior = performance.now();
    salvarDecorrido = 0;
    atualizaHud();
    salvarAventura();
    cancelAnimationFrame(frameMundo);
    frameMundo = requestAnimationFrame(passoMundo);
  }
  function atualizaHud() {
    const e = estadoAventura;
    $('hud-nome').textContent = e.nome;
    $('hud-nivel').textContent = e.nivel;
    $('hud-classe').textContent = e.classe;
    $('hud-vida').max = e.vidaMax;
    $('hud-vida').value = Math.max(0, e.vida);
    $('hud-vida-texto').textContent = `${Math.ceil(e.vida)}/${e.vidaMax}`;
    $('hud-xp').max = e.nivel * 100;
    $('hud-xp').value = e.xp;
    $('hud-xp-texto').textContent = `${e.xp}/${e.nivel * 100} XP`;
    $('hud-moedas').textContent = e.moedas;
    $('hud-abates').textContent = e.inimigosDerrotados;
    $('hud-missao').textContent = e.inimigosDerrotados >= 3
      ? 'Missão concluída: vila protegida!' : `Missão: derrote as criaturas (${e.inimigosDerrotados}/3)`;
    const perto = e.inimigos.filter((inimigo) => inimigo.vida > 0)
      .map((inimigo) => ({ inimigo, distancia: Math.hypot(inimigo.x - e.x, inimigo.z - e.z) }))
      .sort((a, b) => a.distancia - b.distancia)[0];
    const mostrarInimigo = perto && perto.distancia < 8;
    $('hud-inimigo').hidden = !mostrarInimigo;
    if (mostrarInimigo) {
      const inimigo = perto.inimigo;
      const nivel = inimigo.nivel || (inimigo.tipo === 'goblin' ? 1 : inimigo.tipo === 'lobo' ? 2 : 3);
      $('hud-inimigo-nome').textContent = inimigo.nome;
      $('hud-inimigo-nivel').textContent = nivel;
      $('hud-inimigo-vida').max = inimigo.maxVida;
      $('hud-inimigo-vida').value = Math.max(0, inimigo.vida);
      $('hud-inimigo-vida-texto').textContent = `${Math.ceil(inimigo.vida)}/${inimigo.maxVida} HP`;
    }
  }
  function passoMundo(agora) {
    if (!estadoAventura || $('tela-aventura').hidden) return;
    const dt = Math.min(100, Math.max(0, agora - tempoAnterior));
    tempoAnterior = agora;
    const esquerda = teclas.has('a') || teclas.has('arrowleft');
    const direita = teclas.has('d') || teclas.has('arrowright');
    const frente = teclas.has('w') || teclas.has('arrowup');
    const tras = teclas.has('s') || teclas.has('arrowdown');
    const dxLocal = joystick.dx + (direita ? 1 : 0) - (esquerda ? 1 : 0);
    const dzLocal = joystick.dz + (tras ? 1 : 0) - (frente ? 1 : 0);
    const { dx, dz } = renderizador ? renderizador.orientarMovimento(dxLocal, dzLocal) : { dx: dxLocal, dz: dzLocal };
    const xAntes = estadoAventura.x, zAntes = estadoAventura.z;
    const bauAntes = estadoAventura.bausAberto;
    const abatesAntes = estadoAventura.inimigosDerrotados;
    const nivelAntes = estadoAventura.nivel;
    const derrotadosAntes = new Set(estadoAventura.inimigos.filter((inimigo) => inimigo.vida === 0).map((inimigo) => inimigo.id));
    const vidasAntes = new Map(estadoAventura.inimigos.map((inimigo) => [inimigo.id, inimigo.vida]));
    estadoAventura = Regras.rpgAtualizar(estadoAventura, {
      dx, dz, correr: teclas.has('shift') || $('botao-correr').dataset.pressionado === 'sim',
      atacar: ataqueSolicitado, pular: puloSolicitado, interagir: interacaoSolicitada
    }, dt, Math.random);
    const movimentoX = estadoAventura.x - xAntes, movimentoZ = estadoAventura.z - zAntes;
    if (Math.hypot(movimentoX,movimentoZ) > .0001) anguloHeroi = Math.atan2(-movimentoX,-movimentoZ);
    ataqueSolicitado = false;
    if (estadoAventura.inimigos.some((inimigo) => inimigo.vida < (vidasAntes.get(inimigo.id) ?? inimigo.vida))) tocarImpactoEspada();
    if (puloSolicitado && saltoDecorrido === 0) saltoDecorrido = .55;
    puloSolicitado = false;
    interacaoSolicitada = false;
    if (!bauAntes && estadoAventura.bausAberto) $('hud-mensagem').textContent = 'Baú encontrado! +50 moedas e +25 XP.';
    if (estadoAventura.inimigosDerrotados > abatesAntes) {
      const queda = estadoAventura.inimigos.find((inimigo) => inimigo.vida === 0 && !derrotadosAntes.has(inimigo.id));
      $('hud-mensagem').textContent = `Criatura derrotada${queda ? ': ' + queda.nome : ''}! +XP e moedas.`;
      salvarAventura();
    }
    if (estadoAventura.nivel > nivelAntes) {
      $('hud-mensagem').textContent = `Subiu para o nível ${estadoAventura.nivel}! Habilidade especial desbloqueada.`;
      salvarAventura();
    }
    saltoDecorrido = Math.max(0, saltoDecorrido - dt / 1000);
    ataqueAnimacao = Math.max(0, ataqueAnimacao - dt / 1000);
    if (estadoAventura.cooldown > .36) ataqueAnimacao = .2;
    const alturaSalto = saltoDecorrido > 0 ? Math.sin((.55 - saltoDecorrido) / .55 * Math.PI) * .8 : 0;
    renderizador.desenhar(estadoAventura, agora, alturaSalto, ataqueAnimacao, dt/1000, anguloHeroi);
    atualizaHud();
    salvarDecorrido += dt;
    if (salvarDecorrido > 5000) { salvarDecorrido = 0; salvarAventura(); }
    if (estadoAventura.inimigosDerrotados >= 3 && !$('hud-missao').dataset.concluida) {
      $('hud-missao').dataset.concluida = 'sim';
      $('hud-mensagem').textContent = 'Missão concluída! A vila está segura. Explore o reino.';
      salvarAventura();
    }
    if (estadoAventura.acabou) { encerrarAventura('derrota'); return; }
    frameMundo = requestAnimationFrame(passoMundo);
  }
  async function encerrarAventura(motivo) {
    cancelAnimationFrame(frameMundo);
    const e = estadoAventura;
    const total = e.inimigosDerrotados * 100 + (e.nivel - 1) * 200 + e.moedas + e.xp;
    $('fim-titulo').textContent = motivo === 'derrota' ? `${e.nome} caiu em batalha.` : 'Progresso da aventura salvo.';
    $('resultado').textContent = `${total} pontos · nível ${e.nivel} · ${e.inimigosDerrotados} criaturas derrotadas`;
    $('situacao-salvamento').textContent = 'Salvando progresso e pontuação...';
    mostrar('tela-fim');
    try {
      await Placar.salvar({ rpg: e });
      await Placar.registrarPartida(total, { modo: 'aventura', nivel: e.nivel, derrotados: e.inimigosDerrotados, rpg: e });
      $('situacao-salvamento').textContent = 'Progresso e pontuação salvos.';
    } catch (erro) { $('situacao-salvamento').textContent = 'Não foi possível salvar: ' + erro.message; }
    if (motivo === 'derrota') { estadoAventura = null; atualizarProgressoSalvo(); }
  }

  function moverJoystick(evento) {
    const caixa = $('joystick').getBoundingClientRect();
    const cx = caixa.left + caixa.width / 2, cy = caixa.top + caixa.height / 2;
    const max = caixa.width * .33;
    let dx = (evento.clientX - cx) / max, dy = (evento.clientY - cy) / max;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    joystick = { dx, dz: dy };
    const knob = $('joystick').firstElementChild;
    knob.style.transform = `translate(${dx * max}px, ${dy * max}px)`;
  }
  const pad = $('joystick');
  pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); moverJoystick(e); });
  pad.addEventListener('pointermove', (e) => { if (pad.hasPointerCapture(e.pointerId)) moverJoystick(e); });
  function soltarJoystick() { joystick = { dx: 0, dz: 0 }; $('joystick').firstElementChild.style.transform = ''; }
  pad.addEventListener('pointerup', soltarJoystick); pad.addEventListener('pointercancel', soltarJoystick);
  $('botao-correr').addEventListener('pointerdown', (e) => { e.currentTarget.dataset.pressionado = 'sim'; e.currentTarget.setPointerCapture(e.pointerId); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((tipo) => $('botao-correr').addEventListener(tipo, () => { $('botao-correr').dataset.pressionado = ''; }));
  $('botao-atacar').addEventListener('pointerdown', (e) => { e.preventDefault(); prepararAudio(); ataqueSolicitado = true; });
  $('botao-pular').addEventListener('pointerdown', (e) => { e.preventDefault(); puloSolicitado = true; });
  $('botao-interagir').addEventListener('pointerdown', (e) => { e.preventDefault(); interacaoSolicitada = true; });
  window.addEventListener('keydown', (e) => {
    if ($('tela-aventura').hidden) return;
    const k = e.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    if (!teclas.has(k) && (k === 'j' || k === ' ' || k === 'e')) { ataqueSolicitado = k === 'j'; if (k === 'j') prepararAudio(); if (k === ' ') puloSolicitado = true; if (k === 'e') interacaoSolicitada = true; }
    teclas.add(k);
  });
  window.addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => {
    teclas.clear(); soltarJoystick(); $('botao-correr').dataset.pressionado = '';
    cameraPointers.clear(); distanciaToqueCamera = null;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) salvarAventura(); });
  function instalarControlesCamera() {
    const canvas=$('mundo');
    const toquesAtivos=()=>[...cameraPointers.values()].filter((p)=>p.tipo==='touch');
    const distanciaEntre=(toques)=>toques.length<2?null:Math.hypot(toques[0].x-toques[1].x,toques[0].y-toques[1].y);
    const iniciar=(e)=>{
      if (e.pointerType==='mouse' && e.button===0) { prepararAudio(); ataqueSolicitado=true; return; }
      if (e.pointerType!=='touch' && !(e.pointerType==='mouse' && e.button===2)) return;
      e.preventDefault();
      cameraPointers.set(e.pointerId,{tipo:e.pointerType,x:e.clientX,y:e.clientY});
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      distanciaToqueCamera=distanciaEntre(toquesAtivos());
    };
    const mover=(e)=>{
      const ponteiro=cameraPointers.get(e.pointerId);
      if (!ponteiro) return;
      const dx=e.clientX-ponteiro.x, dy=e.clientY-ponteiro.y;
      const distanciaAntes=distanciaToqueCamera;
      ponteiro.x=e.clientX; ponteiro.y=e.clientY;
      const toquesDepois=toquesAtivos();
      if (!renderizador) return;
      if (toquesDepois.length>=2) {
        const distanciaNova=distanciaEntre(toquesDepois);
        if (distanciaAntes!==null && distanciaNova!==null) renderizador.moverCamera(0,0,(distanciaAntes-distanciaNova)*.035);
        distanciaToqueCamera=distanciaNova;
      } else {
        distanciaToqueCamera=null;
        renderizador.moverCamera(dx,dy);
      }
    };
    const soltar=(e)=>{
      if (!cameraPointers.has(e.pointerId)) return;
      cameraPointers.delete(e.pointerId);
      distanciaToqueCamera=distanciaEntre(toquesAtivos());
    };
    canvas.addEventListener('pointerdown',iniciar);
    canvas.addEventListener('pointermove',mover);
    canvas.addEventListener('pointerup',soltar);
    canvas.addEventListener('pointercancel',soltar);
    canvas.addEventListener('lostpointercapture',soltar);
    canvas.addEventListener('contextmenu',(e)=>e.preventDefault());
    canvas.addEventListener('wheel',(e)=>{
      if (!renderizador || $('tela-aventura').hidden) return;
      e.preventDefault();
      renderizador.moverCamera(0,0,Math.sign(e.deltaY)*.7);
    },{passive:false});
  }
  instalarControlesCamera();
  $('botao-jogar').addEventListener('click', () => iniciarAventura(true));
  $('botao-continuar').addEventListener('click', () => iniciarAventura(false));
  $('botao-sair').addEventListener('click', async () => { cancelAnimationFrame(frameMundo); await salvarAventura(); atualizarProgressoSalvo(); mostrar('tela-inicio'); });
  $('botao-fim-inicio').addEventListener('click', () => { atualizarProgressoSalvo(); mostrar('tela-inicio'); });

  // O treino original de alvos continua disponível como modo rápido.
  function desenharAlvos() {
    const arena = $('arena'); arena.replaceChildren();
    treino.alvos.forEach((alvo) => {
      const botao = document.createElement('button'); botao.type = 'button';
      botao.className = alvo.bom ? 'alvo' : 'alvo proibido'; botao.textContent = alvo.emoji;
      botao.setAttribute('aria-label', alvo.nome);
      botao.style.left = `calc(${alvo.x}% - 28px)`; botao.style.top = `calc(${alvo.y}% - 28px)`;
      botao.addEventListener('click', () => {
        treino = Regras.acertar(treino, alvo.id);
        $('mensagem').textContent = alvo.bom ? 'Boa! Continue a sequência.' : 'Caveira proibida! −15 pontos.';
        atualizarTreino(); desenharAlvos();
      });
      arena.appendChild(botao);
    });
  }
  function atualizarTreino() {
    $('tempo').textContent = Math.ceil(treino.restante / 1000);
    $('pontos').textContent = Regras.pontos(treino); $('combo').textContent = treino.combo;
  }
  function passoTreino(agora) {
    if (!treino || treino.terminou || $('tela-jogo').hidden) return;
    const dt = Math.min(100, Math.max(0, agora - treinoAgora)); treinoAgora = agora;
    const ids = treino.alvos.map((a) => a.id).join(','); treino = Regras.tick(treino, dt);
    atualizarTreino(); if (ids !== treino.alvos.map((a) => a.id).join(',')) desenharAlvos();
    if (treino.terminou) fimTreino(); else frameTreino = requestAnimationFrame(passoTreino);
  }
  let treinoAgora = 0;
  function iniciarTreino() {
    cancelAnimationFrame(frameTreino); treino = Regras.novaPartida(); treinoAgora = performance.now();
    $('mensagem').textContent = 'Toque nos itens bons!'; mostrar('tela-jogo'); desenharAlvos(); atualizarTreino();
    frameTreino = requestAnimationFrame(passoTreino);
  }
  async function fimTreino() {
    if (treinoSalvando) return; treinoSalvando = true; cancelAnimationFrame(frameTreino);
    $('fim-titulo').textContent = 'Treino concluído!'; $('resultado').textContent = `${Regras.pontos(treino)} pontos`;
    $('situacao-salvamento').textContent = 'Salvando pontuação...'; mostrar('tela-fim');
    try { await Placar.registrarPartida(Regras.pontos(treino), { modo: 'alvos', acertos: treino.acertos, rpg: estadoAventura }); $('situacao-salvamento').textContent = 'Pontuação salva!'; }
    catch (erro) { $('situacao-salvamento').textContent = 'Não deu para salvar: ' + erro.message; }
    finally { treinoSalvando = false; }
  }
  $('botao-treino').addEventListener('click', iniciarTreino);
  $('botao-voltar').addEventListener('click', () => { cancelAnimationFrame(frameTreino); atualizarProgressoSalvo(); mostrar('tela-inicio'); });
  $('botao-de-novo').addEventListener('click', () => {
    if ($('fim-titulo').textContent.includes('Treino')) iniciarTreino();
    else if (estadoAventura && !estadoAventura.acabou) iniciarAventura(false);
    else iniciarAventura(true);
  });
  mostrar('tela-inicio');
})();
