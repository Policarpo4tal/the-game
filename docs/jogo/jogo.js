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

  let estado;
  let quadro;
  let ultimoTempo;
  let salvando = false;
  function mostrar(tela) { ['tela-inicio', 'tela-jogo', 'tela-fim'].forEach((id) => { $(id).hidden = id !== tela; }); }
  function desenhar() {
    const arena = $('arena');
    arena.replaceChildren();
    estado.alvos.forEach((alvo) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = alvo.bom ? 'alvo' : 'alvo proibido';
      botao.textContent = alvo.emoji;
      botao.setAttribute('aria-label', alvo.nome);
      botao.style.left = `calc(${alvo.x}% - 28px)`;
      botao.style.top = `calc(${alvo.y}% - 28px)`;
      botao.addEventListener('click', () => {
        estado = Regras.acertar(estado, alvo.id);
        $('mensagem').textContent = alvo.bom ? 'Boa! Continue a sequência.' : 'Caveira proibida! −15 pontos.';
        atualizarHud();
        desenhar();
      });
      arena.appendChild(botao);
    });
  }
  function atualizarHud() {
    $('tempo').textContent = Math.ceil(estado.restante / 1000);
    $('pontos').textContent = Regras.pontos(estado);
    $('combo').textContent = estado.combo;
  }
  function passo(agora) {
    if (!estado || estado.terminou) return;
    const delta = Math.min(100, Math.max(0, agora - ultimoTempo));
    ultimoTempo = agora;
    const idsAntes = estado.alvos.map((alvo) => alvo.id).join(',');
    estado = Regras.tick(estado, delta);
    atualizarHud();
    if (idsAntes !== estado.alvos.map((alvo) => alvo.id).join(',')) desenhar();
    if (Regras.terminou(estado)) terminar();
    else quadro = requestAnimationFrame(passo);
  }
  function comecar() {
    cancelAnimationFrame(quadro);
    estado = Regras.novaPartida();
    ultimoTempo = performance.now();
    $('mensagem').textContent = 'Toque nos itens bons!';
    mostrar('tela-jogo');
    quadro = requestAnimationFrame(passo);
  }
  async function terminar() {
    if (salvando) return;
    salvando = true;
    cancelAnimationFrame(quadro);
    const total = Regras.pontos(estado);
    $('resultado').textContent = total;
    $('situacao-salvamento').textContent = 'Salvando...';
    mostrar('tela-fim');
    try {
      const salvo = await Placar.registrarPartida(total, { acertos: estado.acertos, erros: estado.erros });
      $('situacao-salvamento').textContent = Placar.modo() === 'nuvem' && !salvo.salvoNaNuvem
        ? 'Salvo neste aparelho. Entre com apelido e PIN para ir ao ranking.' : 'Pontuação salva!';
    } catch (erro) {
      $('situacao-salvamento').textContent = 'Não deu para salvar: ' + erro.message;
    } finally { salvando = false; }
  }
  $('botao-jogar').addEventListener('click', comecar);
  $('botao-de-novo').addEventListener('click', comecar);
  mostrar('tela-inicio');
})();
