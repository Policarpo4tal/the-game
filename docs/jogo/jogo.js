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
  let frameGamepadMenu = 0;
  let tempoAnterior = 0;
  let tempoAmbiente = 0;
  let salvarDecorrido = 0;
  let saltoDecorrido = 0;
  let ataqueSolicitado = false;
  let puloSolicitado = false;
  let esquivaSolicitada = false;
  const esquiva = { ativa: false, decorrido: 0, cooldown: 0, dirX: 0, dirZ: -1 };
  const CONFIG_ESQUIVA = Object.freeze({ duracao: .4, velocidadeInicial: 18, janelaInvencibilidadeInicio: .15, janelaInvencibilidadeFim: .75, cooldown: .68 });
  let interacaoSolicitada = false;
  let alvoMiraId = null;
  let controlMiraPressionado = false;
  const controlesMiraAbaixo = new Set();
  let gamepadAtivoIndex = null;
  let gamepadAssinatura = '';
  let estadoBotoesGamepad = [];
  let direcaoVerticalMenuAnterior = 0;
  let direcaoHorizontalMenuAnterior = 0;
  let assinaturaDebugGamepad = '';
  let gamepadCorrendo = false;
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
  const RAIO_COLISAO_HEROI = .3;
  const RAIO_COLISAO_INIMIGO = .25;
  // A parede de regras em z=-32 deixa um vão estreito (|x|<2.4).
  // O vão visual entre as colunas do arco é maior; este limite deixa folga
  // até o núcleo sólido das colunas, cujos colisores continuam no Mundo3D.
  const PORTAO_ARCO_Z = -32;
  const MEIA_FAIXA_PORTAO_ARCO = 1.35;
  const MEIA_LARGURA_LIVRE_ARCO = 5;
  const ALCANCE_MIRA = 22;
  const DEADZONE_GAMEPAD = .16;
  const DEBUG_GAMEPAD = false;

  function iniciarEsquiva(dx, dz, anguloAlvo = anguloHeroi) {
    const comprimento = Math.hypot(dx, dz);
    if (comprimento > .08) { esquiva.dirX = dx / comprimento; esquiva.dirZ = dz / comprimento; }
    else { esquiva.dirX = -Math.sin(anguloAlvo); esquiva.dirZ = -Math.cos(anguloAlvo); }
    esquiva.ativa = true; esquiva.decorrido = 0;
  }

  // Passos curtos impedem que o impulso rápido salte por cima de colisores estreitos.
  function moverEsquivaComColisao(origem, dirX, dirZ, distancia, raio) {
    const passos = Math.max(1, Math.ceil(Math.abs(distancia) / .12));
    const passoX = dirX * distancia / passos, passoZ = dirZ * distancia / passos;
    let posicao = { x: origem.x, z: origem.z };
    for (let i = 0; i < passos; i++) {
      posicao = renderizador.moverComColisao(posicao, { x: posicao.x + passoX, z: posicao.z + passoZ }, raio);
    }
    return posicao;
  }

  function estaInvencivelEsquivando(progresso) {
    return esquiva.ativa && progresso >= CONFIG_ESQUIVA.janelaInvencibilidadeInicio
      && progresso <= CONFIG_ESQUIVA.janelaInvencibilidadeFim;
  }

  // A Gamepad API pode devolver valores pequenos mesmo com o analógico solto.
  // A faixa restante é reescalada para continuar atingindo o curso completo.
  function aplicarDeadzone(valor, deadzone = DEADZONE_GAMEPAD) {
    const modulo = Math.abs(valor);
    if (modulo <= deadzone) return 0;
    return Math.sign(valor) * Math.min(1, (modulo - deadzone) / (1 - deadzone));
  }

  function atualizarIndicadorGamepad(texto, ativo = false) {
    ['hud-gamepad', 'gamepad-status-menu'].forEach((id) => {
      const indicador = $(id);
      indicador.textContent = texto;
      indicador.classList.toggle('conectado', ativo);
    });
  }

  function gamepadConectado(gamepad) {
    gamepadAtivoIndex = gamepad.index;
    estadoBotoesGamepad = [];
    gamepadAssinatura = `${gamepad.index}:${gamepad.id}`;
    atualizarIndicadorGamepad('🎮 Controle conectado', true);
  }

  function gamepadDesconectado(gamepad) {
    if (gamepadAtivoIndex !== gamepad.index) return;
    gamepadAtivoIndex = null;
    estadoBotoesGamepad = [];
    gamepadAssinatura = '';
    direcaoVerticalMenuAnterior = 0;
    direcaoHorizontalMenuAnterior = 0;
    gamepadCorrendo = false;
    atualizarIndicadorGamepad('🎮 Controle desconectado', false);
  }

  // Lê o controle escolhido e calcula bordas de pressão uma vez por quadro.
  function lerControlePS4() {
    const dispositivos = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : [];
    // Não depende do evento gamepadconnected: procura em todos os slots a cada quadro.
    const gamepad = dispositivos.find((item) => item?.connected && item.index === gamepadAtivoIndex)
      || dispositivos.find((item) => item && item.connected) || null;
    if (!gamepad) {
      if (gamepadAtivoIndex !== null) gamepadDesconectado({ index: gamepadAtivoIndex });
      return null;
    }
    const assinatura = `${gamepad.index}:${gamepad.id}`;
    if (assinatura !== gamepadAssinatura) gamepadConectado(gamepad);
    // Índices do mapeamento "standard": X=0, círculo=1, quadrado=2,
    // triângulo=3, L1/R1=4/5, L2/R2=6/7, L3/R3=10/11 e D-pad=12..15.
    const botao = (indice) => {
      const item = gamepad.buttons[indice];
      return Boolean(item && (item.pressed || item.value > .5));
    };
    const atuais = gamepad.buttons.map((item) => Boolean(item && (item.pressed || item.value > .5)));
    const acaoMira = botao(11) || botao(4) || botao(5);
    const miraAnterior = Boolean(estadoBotoesGamepad[11] || estadoBotoesGamepad[4] || estadoBotoesGamepad[5]);
    const ataque = botao(2) || botao(7);
    const ataqueAnterior = Boolean(estadoBotoesGamepad[2] || estadoBotoesGamepad[7]);
    const pulo = botao(0), interagir = botao(3);
    const correrGatilho = botao(6);
    const confirmar = (pulo && !estadoBotoesGamepad[0]) || (ataque && !ataqueAnterior);
    const cancelar = botao(1) && !estadoBotoesGamepad[1];
    const dados = {
      dx: aplicarDeadzone(gamepad.axes[0] || 0) + (botao(15) ? 1 : 0) - (botao(14) ? 1 : 0),
      dz: aplicarDeadzone(gamepad.axes[1] || 0) + (botao(13) ? 1 : 0) - (botao(12) ? 1 : 0),
      cameraX: aplicarDeadzone(gamepad.axes[2] || 0),
      cameraY: aplicarDeadzone(gamepad.axes[3] || 0),
      correr: botao(1) || correrGatilho,
      atacar: ataque && !ataqueAnterior,
      pular: pulo && !estadoBotoesGamepad[0],
      interagir: interagir && !estadoBotoesGamepad[3],
      alternarMira: acaoMira && !miraAnterior,
      confirmar,
      cancelar,
      esquivar: botao(1) && !estadoBotoesGamepad[1]
    };
    estadoBotoesGamepad = atuais;
    if (DEBUG_GAMEPAD) {
      const pressionados = atuais.flatMap((pressionado, indice) => pressionado ? [indice] : []);
      const assinatura = `${gamepad.index}|${gamepad.axes.map((eixo) => eixo.toFixed(2)).join(',')}|${pressionados.join(',')}`;
      if (assinatura !== assinaturaDebugGamepad) {
        console.debug('[gamepad]', { id: gamepad.id, index: gamepad.index, axes: [...gamepad.axes], buttonsPressed: pressionados });
        assinaturaDebugGamepad = assinatura;
      }
    }
    return dados;
  }

  function processarEntradasGamepad(dt) {
    const entrada = lerControlePS4();
    gamepadCorrendo = Boolean(entrada?.correr);
    if (!entrada) return { dx: 0, dz: 0 };
    if (entrada.atacar) { ataqueSolicitado = true; prepararAudio(); }
    if (entrada.pular) puloSolicitado = true;
    if (entrada.esquivar) esquivaSolicitada = true;
    if (entrada.interagir) interacaoSolicitada = true;
    if (entrada.alternarMira) alternarTravaMira();
    // O analógico direito controla yaw/pitch livre; no lock-on a câmera já segue o alvo.
    if (renderizador && alvoMiraId === null && !$('tela-aventura').hidden) {
      renderizador.moverCameraComAnalogo(entrada.cameraX, entrada.cameraY, dt);
    }
    return { dx: entrada.dx, dz: entrada.dz };
  }

  // Mantém leitura ativa nos menus, onde o loop da aventura ainda não está rodando.
  function processarMenuGamepad() {
    const entrada = lerControlePS4();
    if (!entrada) { direcaoVerticalMenuAnterior = 0; direcaoHorizontalMenuAnterior = 0; return; }
    const telaAtiva = ['tela-inicio', 'tela-jogo', 'tela-fim'].map((id) => $(id)).find((tela) => !tela.hidden);
    if (!telaAtiva) { direcaoVerticalMenuAnterior = 0; direcaoHorizontalMenuAnterior = 0; return; }
    const controles = [...telaAtiva.querySelectorAll('button:not([hidden]), input:not([disabled]), select:not([disabled]), summary')]
      .filter((controle) => !controle.disabled);
    const vertical = Math.abs(entrada.dz) > .55 ? Math.sign(entrada.dz) : 0;
    const horizontal = Math.abs(entrada.dx) > .55 ? Math.sign(entrada.dx) : 0;
    if (vertical && vertical !== direcaoVerticalMenuAnterior && controles.length) {
      let indice = controles.indexOf(document.activeElement);
      indice = indice < 0 ? 0 : (indice + (vertical > 0 ? 1 : -1) + controles.length) % controles.length;
      controles[indice].focus();
    }
    if (horizontal && horizontal !== direcaoHorizontalMenuAnterior && document.activeElement?.tagName === 'SELECT') {
      const seletor = document.activeElement;
      seletor.selectedIndex = Math.max(0, Math.min(seletor.options.length - 1, seletor.selectedIndex + horizontal));
      seletor.dispatchEvent(new Event('change', { bubbles: true }));
    }
    direcaoVerticalMenuAnterior = vertical;
    direcaoHorizontalMenuAnterior = horizontal;
    if (entrada.cancelar) {
      if (telaAtiva.id === 'tela-jogo') $('botao-voltar').click();
      else if (telaAtiva.id === 'tela-fim') $('botao-fim-inicio').click();
      return;
    }
    if (entrada.confirmar) {
      let alvo = controles.includes(document.activeElement) ? document.activeElement : null;
      if (!alvo && telaAtiva.id === 'tela-inicio') {
        alvo = !$('botao-continuar').hidden ? $('botao-continuar') : $('botao-jogar');
      }
      if (!alvo) alvo = controles.find((controle) => controle.tagName === 'BUTTON');
      alvo?.click();
    }
  }

  function passoMenus(agora) {
    // A leitura é mantida também na tela inicial, sem depender de eventos de conexão.
    if ($('tela-aventura').hidden) processarMenuGamepad();
    frameGamepadMenu = requestAnimationFrame(passoMenus);
  }

  function mostrar(tela) {
    if (tela !== 'tela-aventura') sairTelaCheia();
    ['tela-inicio', 'tela-aventura', 'tela-jogo', 'tela-fim'].forEach((id) => { $(id).hidden = id !== tela; });
  }
  function sincronizarTelaCheia(ativa) {
    document.body.classList.toggle('modo-tela-cheia', ativa);
    const botao = $('botao-tela-cheia');
    if (!botao) return;
    botao.setAttribute('aria-pressed', String(ativa));
    botao.setAttribute('aria-label', ativa ? 'Sair da tela cheia' : 'Ativar tela cheia');
    botao.textContent = ativa ? '⛶ Sair da tela cheia' : '⛶ Tela cheia';
  }
  async function entrarTelaCheia() {
    const alvo = $('tela-aventura');
    try {
      if (alvo.requestFullscreen) {
        try { await alvo.requestFullscreen({ navigationUI: 'hide' }); }
        catch (_) { await alvo.requestFullscreen(); }
        sincronizarTelaCheia(true);
        return;
      }
    } catch (_) {
      // Alguns WebViews Android não implementam o modo imersivo do Fullscreen API.
    }
    sincronizarTelaCheia(true);
  }
  async function sairTelaCheia() {
    const nativoAtivo = Boolean(document.fullscreenElement);
    sincronizarTelaCheia(false);
    if (nativoAtivo && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch (_) { /* O fallback visual já foi removido. */ }
    }
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
    alvoMiraId = null;
    controlMiraPressionado = false;
    controlesMiraAbaixo.clear();
    renderizador.definirAlvoMira(null);
    atualizarHudMira();
    mostrar('tela-aventura');
    $('tela-falha-3d').hidden = true;
    tempoAnterior = performance.now();
    tempoAmbiente = 0;
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
  function atualizarHudMira() {
    const painel = $('hud-mira');
    const alvo = estadoAventura?.inimigos.find((inimigo) => inimigo.id === alvoMiraId && inimigo.vida > 0);
    painel.hidden = !alvo;
    if (alvo) $('hud-mira-alvo').textContent = alvo.nome;
  }
  function sincronizarAlvoMira() {
    const alvo = estadoAventura?.inimigos.find((inimigo) => inimigo.id === alvoMiraId && inimigo.vida > 0);
    if (!alvo || Math.hypot(alvo.x - estadoAventura.x, alvo.z - estadoAventura.z) > ALCANCE_MIRA) alvoMiraId = null;
    renderizador?.definirAlvoMira(alvoMiraId);
    atualizarHudMira();
  }
  function encontrarMelhorAlvoMira() {
    if (!estadoAventura || !renderizador) return null;
    let melhor = null, melhorPontuacao = Infinity;
    for (const inimigo of estadoAventura.inimigos) {
      if (inimigo.vida <= 0) continue;
      const distancia = Math.hypot(inimigo.x - estadoAventura.x, inimigo.z - estadoAventura.z);
      if (distancia > ALCANCE_MIRA) continue;
      const alinhamento = renderizador.pontuarAlinhamentoMira(inimigo.x, inimigo.tipo === 'lobo' ? .82 : 1.35, inimigo.z);
      if (!Number.isFinite(alinhamento)) continue;
      const pontuacao = alinhamento + distancia * .006;
      if (pontuacao < melhorPontuacao) { melhor = inimigo; melhorPontuacao = pontuacao; }
    }
    return melhor;
  }
  function alternarTravaMira() {
    if (alvoMiraId !== null) {
      alvoMiraId = null;
      $('hud-mensagem').textContent = 'Mira livre.';
    } else {
      const alvo = encontrarMelhorAlvoMira();
      if (!alvo) { $('hud-mensagem').textContent = 'Nenhuma criatura visível ao alcance da mira.'; return; }
      alvoMiraId = alvo.id;
      $('hud-mensagem').textContent = `Mira travada em ${alvo.nome}.`;
    }
    sincronizarAlvoMira();
  }
  function passoMundo(agora) {
    if (!estadoAventura || $('tela-aventura').hidden) return;
    const dtMs = Math.min(100, Math.max(0, agora - tempoAnterior));
    const dt = dtMs / 1000;
    tempoAnterior = agora;
    tempoAmbiente += dt;
    renderizador.atualizarVentoAmbiente(dt, tempoAmbiente);
    const entradaGamepad = processarEntradasGamepad(dt);
    const esquerda = teclas.has('a') || teclas.has('arrowleft');
    const direita = teclas.has('d') || teclas.has('arrowright');
    const frente = teclas.has('w') || teclas.has('arrowup');
    const tras = teclas.has('s') || teclas.has('arrowdown');
    const dxLocal = joystick.dx + entradaGamepad.dx + (direita ? 1 : 0) - (esquerda ? 1 : 0);
    const dzLocal = joystick.dz + entradaGamepad.dz + (tras ? 1 : 0) - (frente ? 1 : 0);
    sincronizarAlvoMira();
    const alvoTravado = estadoAventura.inimigos.find((inimigo) => inimigo.id === alvoMiraId && inimigo.vida > 0);
    const movimentoOrientado = alvoTravado
      ? renderizador.orientarMovimentoComMira(dxLocal, dzLocal, estadoAventura.x, estadoAventura.z, alvoTravado.x, alvoTravado.z)
      : renderizador.orientarMovimento(dxLocal, dzLocal);
    let { dx, dz } = movimentoOrientado;
    esquiva.cooldown = Math.max(0, esquiva.cooldown - dt);
    if (esquivaSolicitada && !esquiva.ativa && esquiva.cooldown <= 0) {
      const anguloAlvo = alvoTravado
        ? Math.atan2(-(alvoTravado.x - estadoAventura.x), -(alvoTravado.z - estadoAventura.z)) : anguloHeroi;
      iniciarEsquiva(dx, dz, anguloAlvo);
    }
    esquivaSolicitada = false;
    const esquivaAtiva = esquiva.ativa;
    const progressoEsquiva = esquivaAtiva ? Math.min(1, esquiva.decorrido / CONFIG_ESQUIVA.duracao) : 0;
    const iFramesEsquiva = estaInvencivelEsquivando(progressoEsquiva);
    if (esquivaAtiva) { dx = 0; dz = 0; }
    const xAntes = estadoAventura.x, zAntes = estadoAventura.z;
    const bauAntes = estadoAventura.bausAberto;
    const abatesAntes = estadoAventura.inimigosDerrotados;
    const nivelAntes = estadoAventura.nivel;
    const derrotadosAntes = new Set(estadoAventura.inimigos.filter((inimigo) => inimigo.vida === 0).map((inimigo) => inimigo.id));
    const vidasAntes = new Map(estadoAventura.inimigos.map((inimigo) => [inimigo.id, inimigo.vida]));
    const posicoesInimigosAntes = new Map(estadoAventura.inimigos.map((inimigo) => [inimigo.id, { x: inimigo.x, z: inimigo.z }]));
    const ataqueIniciado = ataqueSolicitado && estadoAventura.cooldown <= 0;
    const correndo = teclas.has('shift') || $('botao-correr').dataset.pressionado === 'sim' || gamepadCorrendo;
    const velocidade = correndo ? 8 : 5;
    const comprimentoEntrada = Math.hypot(dx, dz) || 1;
    const suavizarEsquiva = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    const pEsquivaFim = Math.min(1, (esquiva.decorrido + dt) / CONFIG_ESQUIVA.duracao);
    const distanciaEsquiva = CONFIG_ESQUIVA.velocidadeInicial * CONFIG_ESQUIVA.duracao / 3
      * (suavizarEsquiva(pEsquivaFim) - suavizarEsquiva(progressoEsquiva));
    const destinoPedido = esquivaAtiva
      ? { x: Math.max(-44, Math.min(44, xAntes + esquiva.dirX * distanciaEsquiva)), z: Math.max(-44, Math.min(44, zAntes + esquiva.dirZ * distanciaEsquiva)) }
      : { x: xAntes + dx / comprimentoEntrada * velocidade * dt, z: zAntes + dz / comprimentoEntrada * velocidade * dt };
    if (iFramesEsquiva) estadoAventura.invulneravel = Math.max(estadoAventura.invulneravel || 0, dt + .001);
    estadoAventura = Regras.rpgAtualizar(estadoAventura, {
      dx, dz, correr: esquivaAtiva ? false : correndo,
      atacar: ataqueSolicitado, pular: puloSolicitado, interagir: interacaoSolicitada
    }, dtMs, Math.random);
    // Regras continua sendo a autoridade do combate; o renderer resolve o deslocamento
    // contra os colisores derivados das malhas e permite deslizar junto a obstáculos.
    const destinoRegras = { x: estadoAventura.x, z: estadoAventura.z };
    const regraImpediuMovimento = Math.hypot(destinoRegras.x - xAntes, destinoRegras.z - zAntes) < .0001
      && Math.hypot(destinoPedido.x - xAntes, destinoPedido.z - zAntes) > .0001;
    const destinoPedidoResolvido = esquivaAtiva
      ? moverEsquivaComColisao({ x: xAntes, z: zAntes }, esquiva.dirX, esquiva.dirZ, distanciaEsquiva, RAIO_COLISAO_HEROI)
      : renderizador.moverComColisao({ x: xAntes, z: zAntes }, destinoPedido, RAIO_COLISAO_HEROI);
    const pedidoNoVaoDoArco = Math.abs(destinoPedido.z - PORTAO_ARCO_Z) < MEIA_FAIXA_PORTAO_ARCO
      && Math.abs(destinoPedido.x) < MEIA_LARGURA_LIVRE_ARCO;
    const bloqueadoPeloCenario = Math.hypot(destinoPedidoResolvido.x - destinoPedido.x, destinoPedidoResolvido.z - destinoPedido.z) > .005;
    // Dentro do vão, os colisores das colunas no renderer definem a passagem;
    // a parede lógica estreita não deve fechar a abertura visual do arco.
    if (regraImpediuMovimento && (pedidoNoVaoDoArco || bloqueadoPeloCenario)) {
      destinoRegras.x = destinoPedidoResolvido.x; destinoRegras.z = destinoPedidoResolvido.z;
    }
    // A esquiva já usa o mesmo resolvedor físico; as regras puras continuam cuidando do combate.
    if (esquivaAtiva) { destinoRegras.x = destinoPedidoResolvido.x; destinoRegras.z = destinoPedidoResolvido.z; }
    const posicaoHeroiResolvida = renderizador.moverComColisao({ x: xAntes, z: zAntes }, destinoRegras, RAIO_COLISAO_HEROI);
    estadoAventura.x = posicaoHeroiResolvida.x; estadoAventura.z = posicaoHeroiResolvida.z;
    if (esquivaAtiva) {
      esquiva.decorrido += dt;
      if (esquiva.decorrido >= CONFIG_ESQUIVA.duracao) {
        esquiva.ativa = false; esquiva.cooldown = CONFIG_ESQUIVA.cooldown;
      }
    }
    // A IA mantém seu movimento original, mas cada passo é varrido contra a mesma lista de colisores.
    for (const inimigo of estadoAventura.inimigos) {
      const origem = posicoesInimigosAntes.get(inimigo.id);
      if (!origem || inimigo.vida <= 0) continue;
      const posicao = renderizador.moverComColisao(origem, { x: inimigo.x, z: inimigo.z }, RAIO_COLISAO_INIMIGO);
      inimigo.x = posicao.x; inimigo.z = posicao.z;
    }
    const movimentoX = estadoAventura.x - xAntes, movimentoZ = estadoAventura.z - zAntes;
    if (alvoTravado) anguloHeroi = Math.atan2(-(alvoTravado.x - estadoAventura.x), -(alvoTravado.z - estadoAventura.z));
    else if (esquivaAtiva) anguloHeroi = Math.atan2(-esquiva.dirX, -esquiva.dirZ);
    else if (Math.hypot(movimentoX,movimentoZ) > .0001) anguloHeroi = Math.atan2(-movimentoX,-movimentoZ);
    if (ataqueIniciado) renderizador.dispararAnimacaoAtaqueHeroi();
    ataqueSolicitado = false;
    const inimigosAtingidos = estadoAventura.inimigos.filter((inimigo) => inimigo.vida < (vidasAntes.get(inimigo.id) ?? inimigo.vida));
    if (inimigosAtingidos.length) tocarImpactoEspada();
    for (const inimigo of inimigosAtingidos) {
      const dano = (vidasAntes.get(inimigo.id) || inimigo.vida) - inimigo.vida;
      const dxImpacto = inimigo.x - estadoAventura.x, dzImpacto = inimigo.z - estadoAventura.z;
      const distancia = Math.hypot(dxImpacto, dzImpacto) || 1;
      const destinoRecuo = { x: inimigo.x + dxImpacto / distancia * .3, z: inimigo.z + dzImpacto / distancia * .3 };
      const recuoResolvido = renderizador.moverComColisao({ x: inimigo.x, z: inimigo.z }, destinoRecuo, RAIO_COLISAO_INIMIGO);
      inimigo.x = recuoResolvido.x; inimigo.z = recuoResolvido.z;
      renderizador.dispararDanoInimigo(inimigo.id, dano);
    }
    sincronizarAlvoMira();
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
    saltoDecorrido = Math.max(0, saltoDecorrido - dt);
    const alturaSalto = saltoDecorrido > 0 ? Math.sin((.55 - saltoDecorrido) / .55 * Math.PI) * .8 : 0;
    renderizador.desenhar(estadoAventura, {
      salto: alturaSalto, deltaSegundos: dt, anguloHeroi, correndo: correndo && !esquivaAtiva,
      esquiva: { ativa: esquivaAtiva, progresso: progressoEsquiva, invencivel: iFramesEsquiva, dirX: esquiva.dirX, dirZ: esquiva.dirZ },
      movendo: Math.hypot(movimentoX, movimentoZ) > .0001,
      velocidade: Math.hypot(movimentoX, movimentoZ) / Math.max(dt, .001)
    });
    atualizaHud();
    salvarDecorrido += dtMs;
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
  $('botao-esquivar').addEventListener('pointerdown', (e) => { e.preventDefault(); esquivaSolicitada = true; });
  $('botao-interagir').addEventListener('pointerdown', (e) => { e.preventDefault(); interacaoSolicitada = true; });
  window.addEventListener('keydown', (e) => {
    if ($('tela-aventura').hidden) return;
    if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
      if (!controlMiraPressionado) alternarTravaMira();
      controlMiraPressionado = true;
      controlesMiraAbaixo.add(e.code || 'Control');
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'q' && !teclas.has(k)) { e.preventDefault(); esquivaSolicitada = true; }
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    if (!teclas.has(k) && (k === 'j' || k === ' ' || k === 'e')) { ataqueSolicitado = k === 'j'; if (k === 'j') prepararAudio(); if (k === ' ') puloSolicitado = true; if (k === 'e') interacaoSolicitada = true; }
    teclas.add(k);
  });
  window.addEventListener('keyup', (e) => {
    teclas.delete(e.key.toLowerCase());
    if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      controlesMiraAbaixo.delete(e.code || 'Control');
      controlMiraPressionado = controlesMiraAbaixo.size > 0;
    }
  });
  window.addEventListener('blur', () => {
    teclas.clear(); soltarJoystick(); $('botao-correr').dataset.pressionado = '';
    gamepadCorrendo = false;
    controlMiraPressionado = false;
    controlesMiraAbaixo.clear();
    cameraPointers.clear(); distanciaToqueCamera = null;
  });
  window.addEventListener('gamepadconnected', (evento) => gamepadConectado(evento.gamepad));
  window.addEventListener('gamepaddisconnected', (evento) => gamepadDesconectado(evento.gamepad));
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
  $('botao-tela-cheia').addEventListener('click', () => {
    if (document.body.classList.contains('modo-tela-cheia')) sairTelaCheia();
    else entrarTelaCheia();
  });
  document.addEventListener('fullscreenchange', () => sincronizarTelaCheia(Boolean(document.fullscreenElement)));
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && document.body.classList.contains('modo-tela-cheia') && !document.fullscreenElement) sairTelaCheia();
  });
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
  frameGamepadMenu = requestAnimationFrame(passoMenus);
})();
