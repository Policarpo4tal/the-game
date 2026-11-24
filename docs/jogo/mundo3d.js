/* Cena Three.js procedural. Eixos: X = largura, Y = altura, Z = profundidade; frente do herói = -Z. */
(function (raiz) {
  'use strict';

  function criarTexturasProcedurais() {
    const gerar = (tipo, tamanho = 512) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = tamanho;
      const ctx = canvas.getContext('2d');
      const base = { chao: '#514b43', muro: '#65615b', metal: '#7d8588', madeira: '#392417' }[tipo];
      ctx.fillStyle = base; ctx.fillRect(0, 0, tamanho, tamanho);
      let seed = tipo.length * 127 + tamanho;
      const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      if (tipo === 'chao' || tipo === 'muro') {
        const escala = tipo === 'chao' ? 64 : 96;
        for (let y = -escala; y < tamanho + escala; y += escala * .62) {
          const offset = tipo === 'muro' && Math.round(y / escala) % 2 ? escala / 2 : 0;
          for (let x = -escala + offset; x < tamanho + escala; x += escala) {
            const w = escala * (.84 + rand() * .12), h = escala * (.48 + rand() * .1);
            ctx.fillStyle = `hsl(28, 7%, ${tipo === 'muro' ? 31 + rand() * 17 : 24 + rand() * 15}%)`;
            ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
            ctx.strokeStyle = 'rgba(12,10,8,.64)'; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
            for (let i = 0; i < 8; i++) { ctx.fillStyle = `rgba(18,15,12,${rand() * .16})`; ctx.fillRect(x + rand() * w, y + rand() * h, 3 + rand() * 10, 2 + rand() * 7); }
          }
        }
      } else if (tipo === 'metal') {
        for (let i = 0; i < 1400; i++) { const y = rand() * tamanho; ctx.fillStyle = `rgba(${rand() > .5 ? 220 : 10},${rand() > .5 ? 220 : 10},${rand() > .5 ? 220 : 10},${rand() * .18})`; ctx.fillRect(0, y, tamanho, .5 + rand() * 2); }
        for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(85,48,28,${rand() * .25})`; ctx.beginPath(); ctx.arc(rand() * tamanho, rand() * tamanho, 2 + rand() * 12, 0, Math.PI * 2); ctx.fill(); }
      } else {
        for (let i = 0; i < 42; i++) { ctx.strokeStyle = `rgba(${rand() > .45 ? '124,77,39' : '12,8,5'},${.12 + rand() * .28})`; ctx.lineWidth = 1 + rand() * 5; ctx.beginPath(); let x = rand() * tamanho; ctx.moveTo(x, 0); ctx.bezierCurveTo(x - 30, 140, x + 30, 350, x + rand() * 15, tamanho); ctx.stroke(); }
      }
      // Manchas e riscos em todas as superfícies, como desgaste e terra acumulada.
      for (let i = 0; i < 260; i++) { const v = rand() > .5 ? 0 : 255; ctx.fillStyle = `rgba(${v},${v},${v},${rand() * .1})`; ctx.fillRect(rand() * tamanho, rand() * tamanho, 2 + rand() * 15, 2 + rand() * 11); }
      const color = new THREE.CanvasTexture(canvas); color.wrapS = color.wrapT = THREE.RepeatWrapping; color.colorSpace = THREE.SRGBColorSpace;
      const bump = new THREE.CanvasTexture(canvas); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
      const roughCanvas = document.createElement('canvas'); roughCanvas.width = roughCanvas.height = tamanho;
      const roughCtx = roughCanvas.getContext('2d'); roughCtx.drawImage(canvas, 0, 0); roughCtx.filter = 'grayscale(1) contrast(1.4)'; roughCtx.drawImage(canvas, 0, 0);
      const roughness = new THREE.CanvasTexture(roughCanvas); roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
      return { map: color, bumpMap: bump, roughnessMap: roughness };
    };
    return { chao: gerar('chao'), muro: gerar('muro'), metal: gerar('metal'), madeira: gerar('madeira') };
  }

  function iniciar(canvas) {
    const T = THREE;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const scene = new T.Scene(); scene.background = new T.Color(0x171b24); scene.fog = new T.FogExp2(0x252b35, .0135);
    const camera = new T.PerspectiveCamera(55, 1, .1, 120);
    const controls = { yaw: 0, pitch: .3, distance: 8.5, target: new T.Vector3(0, 1.15, 2) };
    const textures = criarTexturasProcedurais();
    Object.values(textures.chao).forEach(t => { if (t.repeat) t.repeat.set(9, 9); });
    Object.values(textures.muro).forEach(t => { if (t.repeat) t.repeat.set(1.4, 1.4); });
    const mat = {
      ground: new T.MeshStandardMaterial({ ...textures.chao, color: 0x99958c, roughness: .98, bumpScale: .18 }),
      stone: new T.MeshStandardMaterial({ ...textures.muro, color: 0xa5a19a, roughness: .97, bumpScale: .14 }),
      iron: new T.MeshStandardMaterial({ ...textures.metal, color: 0xb6c0c4, metalness: .82, roughness: .32, bumpScale: .025 }),
      gold: new T.MeshStandardMaterial({ color: 0xb18a43, metalness: .78, roughness: .3 }),
      wood: new T.MeshStandardMaterial({ ...textures.madeira, color: 0x96704b, roughness: .88, bumpScale: .07 }),
      leather: new T.MeshStandardMaterial({ color: 0x38261e, roughness: .92 }),
      cloth: new T.MeshStandardMaterial({ color: 0x26232a, roughness: .98, side: T.DoubleSide }),
      skin: new T.MeshStandardMaterial({ color: 0x88694e, roughness: .9 }),
      ember: new T.MeshStandardMaterial({ color: 0xff681c, emissive: 0xff3508, emissiveIntensity: 2.8, roughness: .4 }),
      eye: new T.MeshStandardMaterial({ color: 0xff3212, emissive: 0xff1600, emissiveIntensity: 3, roughness: .3 }),
      mira: new T.MeshBasicMaterial({ color: 0xffd45c, side: T.DoubleSide, toneMapped: false })
    };
    const hemi = new T.HemisphereLight(0x9eabc5, 0x211a19, 1.05); scene.add(hemi);
    const moon = new T.DirectionalLight(0xb6c7e4, 2.4); moon.position.set(-18, 28, 16); moon.castShadow = true;
    moon.shadow.mapSize.set(1536, 1536); moon.shadow.camera.left = -34; moon.shadow.camera.right = 34; moon.shadow.camera.top = 34; moon.shadow.camera.bottom = -34; moon.shadow.bias = -.00025; scene.add(moon);

    const v = (x, y, z) => new T.Vector3(x, y, z);
    // Os colisores são derivados das próprias malhas; não repetimos posições ou tamanhos do cenário.
    const MOSTRAR_COLISOES = false; // Mude para true para visualizar as caixas e círculos usados no jogo.
    const FATOR_COLISOR_CENARIO = .78; // Colisores mais estreitos que as malhas visuais.
    const ALTURA_CORPO_COLISAO = 1.8;
    const colisoresCenario = [];
    const limiteArena = 44;
    const visualColisores = new T.Group(); visualColisores.name = 'depuracao-colisoes'; scene.add(visualColisores);
    function criarVisualColisor(colisor) {
      if (!MOSTRAR_COLISOES || colisor.visual) return;
      if (colisor.tipo === 'circulo') {
        const material = new T.MeshBasicMaterial({ color: 0xffb34a, side: T.DoubleSide, transparent: true, opacity: .45, depthTest: false });
        colisor.visual = new T.Mesh(new T.RingGeometry(.97, 1, 32), material); colisor.visual.rotation.x = -Math.PI / 2; colisor.visual.position.y = .035; visualColisores.add(colisor.visual);
      } else {
        colisor.visual = new T.Box3Helper(new T.Box3(), 0xffb34a); colisor.visual.material.depthTest = false; colisor.visual.renderOrder = 10; visualColisores.add(colisor.visual);
      }
      atualizarVisualColisor(colisor);
    }
    function atualizarVisualColisor(colisor) {
      if (!colisor.visual) return;
      colisor.visual.visible = colisor.ativo !== false;
      if (colisor.tipo === 'circulo') {
        colisor.visual.position.set(colisor.x, .035, colisor.z); colisor.visual.scale.set(colisor.raio, 1, colisor.raio);
      } else {
        colisor.visual.box.min.set(colisor.minX, .035, colisor.minZ); colisor.visual.box.max.set(colisor.maxX, .045, colisor.maxZ); colisor.visual.updateMatrixWorld(true);
      }
    }
    function atualizarLimitesColisor(colisor, forcar = false) {
      const objeto = colisor.objeto;
      objeto.updateWorldMatrix(true, true);
      // Grupos pequenos (fogueira/baú) também acompanham mudanças nos filhos.
      if (!forcar && !objeto.isGroup && colisor.matriz.equals(objeto.matrixWorld) && colisor.geometria === objeto.geometry) return;
      const caixa = new T.Box3().setFromObject(objeto);
      if (caixa.isEmpty()) return;
      const largura = caixa.max.x - caixa.min.x, profundidade = caixa.max.z - caixa.min.z;
      // Ignora frestas, detalhes finos e peças totalmente acima/abaixo da altura do personagem.
      colisor.ativo = caixa.min.y < ALTURA_CORPO_COLISAO && caixa.max.y > .12 && Math.min(largura, profundidade) >= .14;
      colisor.x = (caixa.min.x + caixa.max.x) * .5; colisor.z = (caixa.min.z + caixa.max.z) * .5;
      if (colisor.tipo === 'circulo') colisor.raio = Math.max(largura, profundidade) * .5 * FATOR_COLISOR_CENARIO + colisor.margem;
      else {
        const meiaLargura = largura * .5 * FATOR_COLISOR_CENARIO, meiaProfundidade = profundidade * .5 * FATOR_COLISOR_CENARIO;
        colisor.minX = colisor.x - meiaLargura; colisor.maxX = colisor.x + meiaLargura;
        colisor.minZ = colisor.z - meiaProfundidade; colisor.maxZ = colisor.z + meiaProfundidade;
      }
      colisor.matriz.copy(objeto.matrixWorld); colisor.geometria = objeto.geometry;
      atualizarVisualColisor(colisor);
    }
    function registrarColisorCaixa(objeto, condicao = null) {
      const colisor = { tipo: 'caixa', objeto, condicao, matriz: new T.Matrix4(), geometria: null };
      atualizarLimitesColisor(colisor, true); criarVisualColisor(colisor); colisoresCenario.push(colisor); return colisor;
    }
    function registrarColisorCirculo(objeto, condicao = null, margem = 0) {
      const colisor = { tipo: 'circulo', objeto, condicao, margem, matriz: new T.Matrix4(), geometria: null };
      atualizarLimitesColisor(colisor, true); criarVisualColisor(colisor); colisoresCenario.push(colisor); return colisor;
    }
    function sincronizarColisoresCenario() {
      for (const colisor of colisoresCenario) {
        atualizarLimitesColisor(colisor);
        if (colisor.visual) colisor.visual.visible = colisor.ativo !== false && (!colisor.condicao || colisor.condicao());
      }
    }
    function mesh(geometry, material, parent, pos = [0, 0, 0], scale = [1, 1, 1], cast = true, registrarColisao = cast) {
      const m = new T.Mesh(geometry, material); m.position.set(...pos); m.scale.set(...scale); m.castShadow = cast; m.receiveShadow = true; parent.add(m);
      if (registrarColisao && parent.userData.registrarSolidos && !material.userData.semColisao) registrarColisorCaixa(m);
      return m;
    }
    const boxGeo = new T.BoxGeometry(1, 1, 1), sphereGeo = new T.SphereGeometry(1, 14, 10), cylGeo = new T.CylinderGeometry(1, 1, 1, 12), coneGeo = new T.ConeGeometry(1, 1, 12);
    function box(parent, x, y, z, sx, sy, sz, material = mat.stone, rot = 0, registrarColisao = true) {
      const m = mesh(boxGeo, material, parent, [x, y, z], [sx, sy, sz], true, registrarColisao); m.rotation.y = rot; return m;
    }
    function orb(parent, x, y, z, sx, sy, sz, material) { return mesh(sphereGeo, material, parent, [x, y, z], [sx, sy, sz]); }
    function cyl(parent, x, y, z, sx, sy, sz, material, rot = 0) { const m = mesh(cylGeo, material, parent, [x, y, z], [sx, sy, sz]); m.rotation.z = rot; return m; }
    function link(parent, a, b, radius, material, sides = 10) { const p = v(...a), q = v(...b), d = q.clone().sub(p); const m = mesh(new T.CylinderGeometry(radius * .72, radius, d.length(), sides), material, parent); m.position.copy(p.add(q).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(v(0, 1, 0), d.normalize()); return m; }
    function rootScene(parent, position) { const g = new T.Group(); g.position.set(...position); parent.add(g); return g; }

    function criarCenario() {
      const world = new T.Group(); scene.add(world);
      world.userData.registrarSolidos = true;
      const floor = mesh(new T.PlaneGeometry(120, 120), mat.ground, world, [0, -.18, 0], [1, 1, 1], false); floor.rotation.x = -Math.PI / 2;
      // Via de lajes claras: calçada de X=-1.8..1.8 avançando pelo eixo Z.
      const pathMat = new T.MeshStandardMaterial({ ...textures.chao, color: 0xb2a99a, roughness: .93, bumpScale: .12 });
      pathMat.userData.semColisao = true; // Lajes do caminho são superfície caminhável, não obstáculos.
      for (let z = -42; z < 34; z += 2.35) for (let x of [-1.1, 1.1]) { const p = box(world, x + (Math.random() - .5) * .22, -.035, z + (Math.random() - .5) * .18, 1.02 + Math.random() * .3, .13, 1.9, pathMat, (Math.random() - .5) * .06); p.material = pathMat; }
      // Ruínas com blocos irregulares, vãos e arcos sobre a antiga rua.
      for (const side of [-1, 1]) {
        for (let z = -26; z <= 29; z += 5.5) {
          const x = side * (8.5 + Math.random() * 1.4), tall = 1.8 + Math.random() * 1.5;
          for (let row = 0; row < 3; row++) box(world, x, row * .65 + .32, z + (row % 2) * .5, 3.5 + Math.random() * .8, .65, 1.05, mat.stone, (Math.random() - .5) * .07);
          if (z % 11 === 0) { cyl(world, x + side * 1.7, tall, z, .58, tall * 2, .58, mat.stone); box(world, x + side * 1.7, tall * 2, z, 1.3, .65, 1.3, mat.stone); }
        }
      }
      for (const z of [-28, -15, 0, 15]) {
        // Pilastras quebradas com capitel rachado.
        for (const x of [-5.7, 5.7]) { const h = 2.1 + Math.random() * 1.4; cyl(world, x, h / 2, z, .42, h, .42, mat.stone); box(world, x, h + .12, z, 1.05, .25, 1.05, mat.stone, .12); box(world, x + .42, h + .35, z, .42, .18, .48, mat.stone, .32); }
        // Arco segmentado em cunhas de pedra.
        // As cunhas do arco ficam acima da cápsula do personagem: só as colunas
        // laterais (cilindros e capitéis abaixo) entram na lista de colisão.
        for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; box(world, Math.cos(a) * 5.7, 3.6 + Math.sin(a) * 2.05, z, 1.08, .72, .9, mat.stone, a - Math.PI / 2, false); }
      }
      // Casas queimadas ao leste; paredes de pedra, vigas e telhados partidos.
      for (const [x, z] of [[-17, 9], [-19, 17], [17, 11], [19, 20], [-14, -8], [15, -12]]) {
        box(world, x, 1.15, z, 4.7, 2.5, 4.1, mat.stone); box(world, x, 2.53, z - 1.9, 4.8, .22, .35, mat.wood);
        for (const side of [-1, 1]) { const beam = box(world, x + side * 1.2, 3, z, 3, .2, .32, mat.wood, side * -.42); beam.rotation.z = side * -.42; }
        box(world, x, 1.05, z - 2.08, .92, 1.45, .15, mat.wood); box(world, x - 1.48, 1.5, z - 2.2, .75, .92, .1, mat.leather);
      }
      // Árvores mortas com galhos longos e torcidos.
      for (const [x, z, s] of [[-24, -20, 1.1], [24, -18, 1.3], [-25, 18, 1.2], [28, 12, 1.4], [-31, 3, .9], [32, -3, 1]]) {
        const trunk = cyl(world, x, 2 * s, z, .28 * s, 4 * s, .3 * s, mat.wood, -.08);
        for (const [dx, dy, dz, len] of [[-1, 1, 0, 2], [1.1, 1.4, .1, 2.5], [-.3, 2, -.1, 2.3], [.3, 2.35, .2, 2]]) link(world, [x, 2 * s + dy * s, z], [x + dx * s, 2 * s + (dy + .3) * s, z + dz + .15], .13 * s, mat.wood);
      }
      // Tochas, ponto luminoso quente; seus materiais e luzes pulsam no loop.
      const flickers = [];
      for (const [x, z] of [[-6, -9], [6, -23], [-7, 17], [7, 21]]) {
        cyl(world, x, 1.65, z, .13, 2.3, .13, mat.wood); link(world, [x, 2.65, z], [x, 2.95, z - .12], .12, mat.gold);
        const flame = mesh(coneGeo, mat.ember, world, [x, 3.08, z - .12], [.2, .55, .2]);
        const light = new T.PointLight(0xff7a30, 34, 11, 2); light.position.set(x, 3.15, z); scene.add(light); flickers.push({ flame, light, phase: Math.random() * 6 });
      }
      // Fogueira central: brasas, lenha, espada cravada e faíscas ascendentes.
      const bonfire = rootScene(world, [-3, 0, 6]);
      for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9; orb(bonfire, Math.cos(a) * .66, .13, Math.sin(a) * .6, .3, .19, .28, mat.stone); }
      const log1 = box(bonfire, 0, .2, 0, 1.2, .15, .16, mat.wood, .4); const log2 = box(bonfire, 0, .21, 0, 1.15, .14, .17, mat.wood, -.4);
      link(bonfire, [0, .28, 0], [.02, 1.4, -.05], .075, mat.iron); link(bonfire, [-.31, .43, -.04], [.35, .43, -.04], .045, mat.iron); link(bonfire, [0, 1.35, -.05], [0, 1.54, -.05], .09, mat.gold);
      for (let i = 0; i < 6; i++) { const fire = mesh(coneGeo, mat.ember, bonfire, [(Math.random() - .5) * .28, .55 + Math.random() * .25, (Math.random() - .5) * .2], [.2, .7, .2]); fire.userData.phase = Math.random() * 7; }
      const fireLight = new T.PointLight(0xff6321, 55, 17, 1.8); fireLight.position.set(-3, 1.6, 6); scene.add(fireLight);
      const colisorFogueira = registrarColisorCirculo(bonfire, null, -.05);
      const sparkPositions = new Float32Array(24 * 3); const sparks = new T.BufferGeometry(); sparks.setAttribute('position', new T.BufferAttribute(sparkPositions, 3));
      const sparkPoints = new T.Points(sparks, new T.PointsMaterial({ color: 0xffad52, size: .08, transparent: true, opacity: .9 })); world.add(sparkPoints);
      for (let i = 0; i < 24; i++) sparkPositions[i * 3] = (Math.random() - .5) * .7;
      // Baú com domo segmentado, faixas de ferro e aura sutil de interação.
      const chest = rootScene(world, [18, 0, 18]);
      box(chest, 0, .48, 0, 1.35, .82, 1.03, mat.wood); const lid = mesh(new T.SphereGeometry(.69, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat.wood, chest, [0, .87, 0], [1, .62, .76]);
      for (const x of [-.48, .48]) box(chest, x, .56, -.53, .12, .84, .08, mat.gold);
      box(chest, 0, .68, -.56, .18, .31, .09, mat.gold); const aura = new T.PointLight(0xe6a84d, 1.2, 4); aura.position.set(18, 1.3, 18); scene.add(aura);
      const colisorBau = registrarColisorCaixa(chest, () => chest.visible);
      return { world, flickers, fireLight, sparkPositions, sparks, chest, lid, aura, bonfire, colisorFogueira, colisorBau };
    }

    mat.ember.userData.semColisao = true;
    const scenery = criarCenario();
    function colisorAtivo(colisor) { return colisor.ativo !== false && (!colisor.condicao || colisor.condicao()); }
    function limitarAoMapa(pos, raio) {
      return { x: Math.max(-limiteArena + raio, Math.min(limiteArena - raio, pos.x)),
        z: Math.max(-limiteArena + raio, Math.min(limiteArena - raio, pos.z)) };
    }
    // Corrige penetrações círculo-versus-caixa/círculo no plano do chão.
    function resolverColisaoHorizontal(pos, raio = .42) {
      sincronizarColisoresCenario();
      const resolvido = limitarAoMapa(pos, raio);
      for (let passada = 0; passada < 6; passada++) {
        let houveColisao = false;
        for (const c of colisoresCenario) {
          if (!colisorAtivo(c)) continue;
          if (c.tipo === 'circulo') {
            if (Math.hypot(resolvido.x - c.x, resolvido.z - c.z) > raio + c.raio + .05) continue;
          } else if (resolvido.x + raio < c.minX - .05 || resolvido.x - raio > c.maxX + .05 || resolvido.z + raio < c.minZ - .05 || resolvido.z - raio > c.maxZ + .05) continue;
          let nx, nz, profundidade;
          if (c.tipo === 'circulo') {
            const dx = resolvido.x - c.x, dz = resolvido.z - c.z, distancia = Math.hypot(dx, dz), minimo = raio + c.raio;
            if (distancia >= minimo) continue;
            if (distancia > 1e-6) { nx = dx / distancia; nz = dz / distancia; profundidade = minimo - distancia; }
            else { nx = 1; nz = 0; profundidade = minimo; }
          } else {
            const px = Math.max(c.minX, Math.min(c.maxX, resolvido.x)); const pz = Math.max(c.minZ, Math.min(c.maxZ, resolvido.z));
            let dx = resolvido.x - px, dz = resolvido.z - pz, distancia = Math.hypot(dx, dz);
            if (distancia >= raio) continue;
            if (distancia > 1e-6) { nx = dx / distancia; nz = dz / distancia; profundidade = raio - distancia; }
            else {
              const lados = [
                { d: resolvido.x - c.minX, nx: -1, nz: 0, saida: c.minX - raio },
                { d: c.maxX - resolvido.x, nx: 1, nz: 0, saida: c.maxX + raio },
                { d: resolvido.z - c.minZ, nx: 0, nz: -1, saida: c.minZ - raio },
                { d: c.maxZ - resolvido.z, nx: 0, nz: 1, saida: c.maxZ + raio }
              ].sort((a, b) => a.d - b.d);
              const lado = lados[0]; nx = lado.nx; nz = lado.nz;
              if (nx) resolvido.x = lado.saida; else resolvido.z = lado.saida;
              houveColisao = true; continue;
            }
          }
          resolvido.x += nx * (profundidade + .004); resolvido.z += nz * (profundidade + .004); houveColisao = true;
        }
        const limitado = limitarAoMapa(resolvido, raio); resolvido.x = limitado.x; resolvido.z = limitado.z;
        if (!houveColisao) break;
      }
      return resolvido;
    }
    // Move em dois eixos separados: se um eixo encontra um muro, o outro continua deslizando.
    function moverComColisao(origem, destino, raio = .42) {
      let p = resolverColisaoHorizontal(origem, raio);
      const eixos = Math.abs(destino.x - origem.x) >= Math.abs(destino.z - origem.z) ? ['x', 'z'] : ['z', 'x'];
      for (const eixo of eixos) { p[eixo] = destino[eixo]; p = resolverColisaoHorizontal(p, raio); }
      return p;
    }
    const raycasterCamera = new T.Raycaster();
    const cameraAlvoTmp = new T.Vector3(), cameraDirecaoTmp = new T.Vector3();
    function ajustarCameraContraCenario() {
      sincronizarColisoresCenario();
      cameraAlvoTmp.copy(controls.target);
      cameraDirecaoTmp.subVectors(camera.position, cameraAlvoTmp);
      const distanciaDesejada = cameraDirecaoTmp.length();
      if (distanciaDesejada > 1e-4) {
        cameraDirecaoTmp.normalize(); raycasterCamera.set(cameraAlvoTmp, cameraDirecaoTmp);
        raycasterCamera.near = .08; raycasterCamera.far = distanciaDesejada;
        const fontes = colisoresCenario.filter(colisorAtivo).map((colisor) => colisor.objeto);
        const impacto = raycasterCamera.intersectObjects(fontes, true)[0];
        if (impacto) camera.position.copy(cameraAlvoTmp).addScaledVector(cameraDirecaoTmp, Math.max(.45, impacto.distance - .3));
      }
      // O ângulo mínimo da órbita costuma bastar; este piso também protege câmeras encurraladas.
      camera.position.y = Math.max(1.25, camera.position.y);
    }
    function marker(parent, radius, color) {
      const ring = new T.Mesh(new T.TorusGeometry(radius, .028, 6, 40), new T.MeshBasicMaterial({ color, transparent: true, opacity: .48 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .035; parent.add(ring); return ring;
    }
    function criarArma(parent, classe, armor) {
      const weapon = new T.Group(); parent.add(weapon);
      if (classe === 'Mago') {
        link(weapon, [0, .52, 0], [0, 1.58, -.1], .065, mat.wood); link(weapon, [-.12, 1.48, -.1], [.12, 1.48, -.1], .04, mat.gold);
        const crystal = mesh(new T.OctahedronGeometry(.24, 0), new T.MeshStandardMaterial({ color: 0x64b9ff, emissive: 0x2a78ff, emissiveIntensity: 2.5, metalness: .25 }), weapon, [0, 1.82, -.1]); weapon.userData.crystal = crystal;
      } else if (classe === 'Arqueiro') {
        for (let i = 0; i < 8; i++) { const a = -.9 + i * .23; link(weapon, [Math.sin(a) * .48, .55 + i * .09, 0], [Math.sin(a + .16) * .62, .7 + i * .09, 0], .035, mat.wood); }
        link(weapon, [0, .55, -.02], [0, 1.6, -.02], .012, mat.iron);
      } else if (classe === 'Assassino') {
        link(weapon, [0, .48, 0], [0, .83, 0], .06, mat.leather); link(weapon, [0, .83, 0], [-.12, 1.35, -.1], .045, mat.iron);
      } else {
        link(weapon, [0, .48, 0], [0, .83, 0], .075, mat.wood); link(weapon, [-.2, .83, 0], [.2, .83, 0], .052, mat.gold); link(weapon, [0, .83, 0], [0, 1.68, -.08], .085, mat.iron); link(weapon, [0, 1.68, -.08], [0, 1.85, -.09], .12, mat.gold);
      }
      return weapon;
    }
    function criarModeloHeroi(classe) {
      const root = new T.Group(); scene.add(root);
      const skin = mat.skin, steel = classe === 'Paladino' ? mat.gold : mat.iron;
      const torso = rootScene(root, [0, 0, 0]); torso.name = 'tronco';
      // Tronco anatômico em camadas: couraça, pescoço, ombreiras e cinturão.
      const chest = mesh(new T.CapsuleGeometry(.31, .42, 4, 8), new T.MeshStandardMaterial({ color: new T.Color(Regras.CLASSES[classe].cor), metalness: .42, roughness: .6 }), torso, [0, 1.08, 0], [1, 1, .72]);
      orb(torso, 0, 1.39, -.02, .34, .22, .28, steel); cyl(torso, 0, .84, 0, .34, .13, .25, mat.leather);
      box(torso, 0, .84, -.17, .15, .14, .035, mat.gold); cyl(torso, 0, 1.4, 0, .12, .16, .12, skin);
      const shoulderGeo = new T.SphereGeometry(1, 14, 10);
      for (const side of [-1, 1]) { mesh(shoulderGeo, steel, torso, [side * .39, 1.38, 0], [.23, .2, .24]); for (let i = 0; i < 2; i++) link(torso, [side * (.48 + i * .04), 1.4, 0], [side * (.67 + i * .08), 1.28 - i * .05, -.02], .055, steel); }
      // Cabeça, elmo e viseira na frente (-Z), visíveis sobre a capa escura.
      const head = rootScene(torso, [0, 1.58, 0]); head.name = 'cabeca'; orb(head, 0, 0, 0, .2, .23, .18, skin);
      if (classe === 'Mago') { mesh(new T.ConeGeometry(.32, .7, 9), mat.cloth, head, [0, .3, .02]); orb(head, 0, -.1, -.06, .25, .1, .2, mat.cloth); }
      else { mesh(new T.SphereGeometry(.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * .58), steel, head, [0, .05, 0], [1, 1, .95]); box(head, 0, -.06, -.17, .24, .045, .045, mat.eye); box(head, 0, -.15, -.11, .25, .13, .13, steel); }
      if (classe === 'Arqueiro' || classe === 'Assassino') { const hood = mesh(new T.SphereGeometry(.27, 14, 10, 0, Math.PI * 2, 0, Math.PI * .72), mat.cloth, head, [0, .05, .02], [1.12, 1.18, 1]); hood.material = mat.cloth; }
      // Cape is a tapered cloth mesh parented at the back, with visible folds.
      const cape = rootScene(torso, [0, 1.45, .14]); cape.name = 'capa'; const capeShape = new T.Shape(); capeShape.moveTo(-.25, 0); capeShape.lineTo(.25, 0); capeShape.lineTo(.48, -1.25); capeShape.lineTo(.22, -1.18); capeShape.lineTo(0, -1.35); capeShape.lineTo(-.18, -1.18); capeShape.lineTo(-.48, -1.25); capeShape.closePath();
      const capeMesh = new T.Mesh(new T.ShapeGeometry(capeShape), new T.MeshStandardMaterial({ color: classe === 'Paladino' ? 0x452326 : 0x211d25, roughness: 1, side: T.DoubleSide })); capeMesh.position.z = .04; cape.add(capeMesh); capeMesh.castShadow = true;
      for (const side of [-1, 1]) { const leg = rootScene(root, [side * .16, .65, 0]); leg.name = side > 0 ? 'pernaDireita' : 'pernaEsquerda'; cyl(leg, 0, -.28, 0, .14, .48, .15, steel); cyl(leg, 0, -.59, -.08, .17, .22, .28, mat.leather); leg.userData.swingSide = side; root.userData['perna' + side] = leg; }
      const arms = [];
      for (const side of [-1, 1]) { const arm = rootScene(root, [side * .42, 1.32, 0]); arm.name = side > 0 ? 'bracoDireito' : 'bracoEsquerdo'; cyl(arm, 0, -.26, 0, .12, .43, .13, steel, side * .16); orb(arm, 0, -.49, -.04, .12, .13, .13, mat.leather); arms.push(arm); }
      // O grupo compensado leva a geometria da arma ao espaço do herói, mas mantém
      // a hierarquia do braço direito para que o ataque gire no ombro.
      const weapon = criarArma(arms[1], classe, steel); weapon.position.set(.2, -1.32, -.05);
      // Escudo, foco secundário ou adaga na mão esquerda, direcionados à câmera/jogador.
      if (classe === 'Guerreiro' || classe === 'Paladino') { const shield = rootScene(arms[0], [-.05, -.35, -.18]); orb(shield, 0, -.06, -.02, .24, .37, .1, steel); link(shield, [0, -.42, -.1], [0, .34, -.1], .024, mat.gold); }
      else if (classe === 'Assassino') link(arms[0], [0, -.45, -.1], [-.06, -.96, -.2], .045, mat.iron);
      const shadow = new T.Mesh(new T.CircleGeometry(.46, 28), new T.MeshBasicMaterial({ color: 0x07080b, transparent: true, opacity: .38, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; root.add(shadow);
      const footRing = marker(root, .58, 0xb59661);
      root.userData.parts = { torso, head, cape, arms, weapon, footRing, shadow, legs: [root.userData['perna-1'], root.userData.perna1] };
      return root;
    }
    function criarModeloInimigo(tipo) {
      const root = new T.Group(); scene.add(root); const body = rootScene(root, [0, 0, 0]);
      let attackWeapon = null; const bodyParts = [];
      const hide = new T.MeshStandardMaterial({ color: tipo === 'goblin' ? 0x40513a : tipo === 'lobo' ? 0x4b5058 : 0xa3a08e, roughness: .92 });
      if (tipo === 'lobo') {
        orb(body, 0, .65, 0, .55, .43, .84, hide); orb(body, 0, .83, -.57, .4, .35, .4, hide); mesh(coneGeo, hide, body, [0, .78, -.87], [.21, .42, .21], false).rotation.x = -Math.PI / 2;
        for (const x of [-.16, .16]) bodyParts.push(orb(body, x, .91, -.82, .045, .05, .035, mat.eye));
        for (const [x, z] of [[-.34,-.37],[.34,-.37],[-.34,.4],[.34,.4]]) bodyParts.push(cyl(body, x, .28, z, .105, .46, .11, hide, x * .5));
      } else {
        // Criatura humanoide curvada: crânio encajado, clavículas, placas dorsales y cuernos.
        const bone = tipo === 'goblin' ? hide : mat.iron;
        const spine = cyl(body, 0, .9, .1, .17, .8, .17, bone, -.18); spine.rotation.z = -.15;
        orb(body, 0, 1.46, -.05, .3, .31, .27, bone);
        const eye = orb(body, -.105, 1.48, -.29, .062, .07, .035, mat.eye); const eye2 = orb(body, .105, 1.48, -.29, .062, .07, .035, mat.eye); bodyParts.push(eye, eye2);
        for (const side of [-1, 1]) { const horn = mesh(coneGeo, bone, body, [side * .23, 1.74, -.02], [.12, .39, .12]); horn.rotation.z = side * .42; orb(body, side * .37, 1.22, 0, .26, .22, .28, bone); const arm = cyl(body, side * .34, .76, -.03, .11, .56, .12, bone, side * .18); const leg = cyl(body, side * .15, .19, .05, .15, .36, .16, bone); bodyParts.push(arm, leg); }
        // arma colosal levantada: un asta irregular y cabeza ferrada.
        link(body, [.55, .45, -.15], [.72, 1.3, -.22], .075, mat.wood); attackWeapon = box(body, .76, 1.36, -.22, .2, .67, .19, mat.iron, -.18); link(body, [.58, .52, -.15], [.7, .77, -.18], .1, mat.leather);
        if (tipo === 'goblin') { const blade = mesh(coneGeo, mat.iron, body, [.79, 1.75, -.22], [.17, .35, .17]); blade.rotation.z = Math.PI; attackWeapon = blade; }
        root.userData.eyes = [eye, eye2];
      }
      const ring = marker(root, .53, 0x9f231e);
      const bar = new T.Group(); bar.position.set(0, tipo === 'lobo' ? 1.5 : 2.08, 0); root.add(bar);
      const back = new T.Mesh(new T.PlaneGeometry(1.18, .11), new T.MeshBasicMaterial({ color: 0x190b0b, side: T.DoubleSide })); bar.add(back);
      const fill = new T.Mesh(new T.PlaneGeometry(1.12, .065), new T.MeshBasicMaterial({ color: 0xc93428, side: T.DoubleSide })); fill.position.z = .01; bar.add(fill);
      // Losango dourado billboarding no peito: só aparece no inimigo sob mira.
      const lockMarker = rootScene(root, [0, tipo === 'lobo' ? 1.12 : 1.62, 0]); lockMarker.visible = false;
      mesh(new T.OctahedronGeometry(.14), mat.mira, lockMarker, [0, 0, 0], [1, 1.25, 1]);
      const lockRing = mesh(new T.TorusGeometry(.27, .018, 6, 24), mat.mira, lockMarker, [0, 0, 0]); lockRing.rotation.z = Math.PI / 4;
      // Materiais próprios permitem o flash do acerto sem alterar outros modelos.
      const emissivos = [];
      root.traverse((obj) => { if (!obj.isMesh || !obj.material.isMeshStandardMaterial) return; obj.material = obj.material.clone(); emissivos.push({ mesh: obj, material: obj.material, cor: obj.material.emissive.clone(), intensidade: obj.material.emissiveIntensity }); });
      root.userData.parts = { body, eyes: root.userData.eyes || [], weapon: attackWeapon, ring, legs: bodyParts };
      root.userData.emissivos = emissivos;
      root.userData.health = { bar, fill, eyes: root.userData.eyes || [], ring, lockMarker, type: tipo }; return root;
    }
    let hero = criarModeloHeroi('Guerreiro'); let heroClass = 'Guerreiro';
    const enemies = new Map();
    const inimigosAnimacao = new Map();
    const danosPendentes = new Map();
    let alvoMiraId = null;
    const animHeroi = { tempo: 0, fasePasso: 0, ataque: 1, duracaoAtaque: .48, correndo: false, movimento: 0 };
    const slash = mesh(new T.TorusGeometry(.82, .035, 6, 28, Math.PI * .88), new T.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }), hero, [.43, 1.08, -.82]);
    slash.rotation.set(.15, -.22, -.4); slash.visible = false; slash.renderOrder = 3;
    function moverCamera(dx, dy, zoom = 0) { controls.yaw += dx * .005; controls.pitch = Math.max(.12, Math.min(.9, controls.pitch - dy * .004)); controls.distance = Math.max(4.5, Math.min(14, controls.distance + zoom)); }
    // Controle analógico: sensibilidade em radianos por segundo, independente do FPS.
    function moverCameraComAnalogo(eixoX, eixoY, dt) {
      controls.yaw += eixoX * 1.65 * dt;
      controls.pitch = Math.max(.12, Math.min(.9, controls.pitch - eixoY * 1.05 * dt));
    }
    function orientarMovimento(dx, dz) { const c = Math.cos(controls.yaw), s = Math.sin(controls.yaw); return { dx: dx * c + dz * s, dz: -dx * s + dz * c }; }
    function orientarMovimentoComMira(dx, dz, xHeroi, zHeroi, xAlvo, zAlvo) {
      const yawAlvo = Math.atan2(-(xAlvo - xHeroi), -(zAlvo - zHeroi)); const c = Math.cos(yawAlvo), s = Math.sin(yawAlvo);
      return { dx: dx * c + dz * s, dz: -dx * s + dz * c };
    }
    function definirAlvoMira(id) { alvoMiraId = id ?? null; }
    function pontuarAlinhamentoMira(x, y, z) {
      camera.updateMatrixWorld(true);
      const ponto = v(x, y, z).project(camera);
      if (ponto.z < -1 || ponto.z > 1 || Math.abs(ponto.x) > 1.15 || Math.abs(ponto.y) > 1.15) return Infinity;
      return Math.hypot(ponto.x, ponto.y * 1.1);
    }
    function atualizarMiraTravada(dt, estado) {
      const inimigo = estado.inimigos.find((item) => item.id === alvoMiraId && item.vida > 0);
      if (!inimigo) { alvoMiraId = null; return null; }
      const dx = inimigo.x - estado.x, dz = inimigo.z - estado.z, distancia = Math.hypot(dx, dz);
      if (distancia > 22) { alvoMiraId = null; return null; }
      // Yaw acompanha o vetor herói-alvo; pitch e distância enquadram os dois sem travar o movimento.
      const yawDesejado = Math.atan2(-dx, -dz);
      const deltaYaw = Math.atan2(Math.sin(yawDesejado - controls.yaw), Math.cos(yawDesejado - controls.yaw));
      controls.yaw += deltaYaw * (1 - Math.exp(-4.5 * dt));
      const pitchDesejado = Math.max(.2, Math.min(.47, .25 + distancia * .008));
      controls.pitch += (pitchDesejado - controls.pitch) * (1 - Math.exp(-2.8 * dt));
      const distanciaDesejada = Math.max(6, Math.min(14, 5.4 + distancia * .39));
      controls.distance += (distanciaDesejada - controls.distance) * (1 - Math.exp(-1.8 * dt));
      return inimigo;
    }
    const suave = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const aproximar = (atual, alvo, dt, velocidade = 14) => atual + (alvo - atual) * (1 - Math.exp(-velocidade * dt));
    function dispararAnimacaoAtaqueHeroi() {
      if (animHeroi.ataque < animHeroi.duracaoAtaque) return false;
      animHeroi.ataque = 0; return true;
    }
    function dispararDanoInimigo(id, dano = 1) {
      const anim = inimigosAnimacao.get(id);
      if (!anim) { danosPendentes.set(id, (danosPendentes.get(id) || 0) + dano); return; }
      anim.flash = .13; anim.tremor = .2; anim.postura += dano;
      if (anim.postura >= 3) { anim.atordoado = .42; anim.postura = 0; }
    }
    function atualizarAnimacaoHeroi(dt, estadoHeroi) {
      const parts = hero.userData.parts;
      animHeroi.tempo += dt;
      animHeroi.ataque = Math.min(animHeroi.duracaoAtaque, animHeroi.ataque + dt);
      const atacando = animHeroi.ataque < animHeroi.duracaoAtaque;
      const movimentoDesejado = estadoHeroi.movendo ? (estadoHeroi.correndo ? 1 : .58) : 0;
      animHeroi.movimento = aproximar(animHeroi.movimento, atacando ? 0 : movimentoDesejado, dt, 11);
      animHeroi.correndo = estadoHeroi.correndo;
      const velocidadePasso = animHeroi.correndo ? 11.2 : 7.2;
      animHeroi.fasePasso += dt * velocidadePasso;
      const ciclo = Math.sin(animHeroi.fasePasso);
      const caminhada = animHeroi.movimento;
      const passo = ciclo * caminhada;
      const respiracao = Math.sin(animHeroi.tempo * 1.7);
      const balancoArma = Math.sin(animHeroi.tempo * 1.25) * .035;
      const pesoCorrida = animHeroi.correndo ? caminhada : 0;
      const fase = animHeroi.ataque / animHeroi.duracaoAtaque;
      let golpeBracoX = 0, golpeBracoZ = 0, golpeArmaZ = 0, giroTronco = 0, avancar = 0;
      if (atacando) {
        // Preparação .00-.22, corte .22-.62 e recuperação .62-1.00.
        if (fase < .22) { const t = suave(fase / .22); golpeBracoX = -.78 * t; golpeBracoZ = -.62 * t; giroTronco = -.2 * t; }
        else if (fase < .62) { const t = suave((fase - .22) / .4); golpeBracoX = -.78 + 1.95 * t; golpeBracoZ = -.62 + 1.18 * t; golpeArmaZ = -.15 + .92 * t; giroTronco = -.2 + .54 * t; avancar = Math.sin(Math.PI * (fase - .22) / .4) * .2; }
        else { const t = suave((fase - .62) / .38); golpeBracoX = 1.17 * (1 - t); golpeBracoZ = .56 * (1 - t); golpeArmaZ = .77 * (1 - t); giroTronco = .34 * (1 - t); }
      }
      parts.legs[0].rotation.x = aproximar(parts.legs[0].rotation.x, passo * .68, dt);
      parts.legs[1].rotation.x = aproximar(parts.legs[1].rotation.x, -passo * .68, dt);
      parts.arms[0].rotation.x = aproximar(parts.arms[0].rotation.x, -passo * .34 + golpeBracoX * .12, dt);
      parts.arms[1].rotation.x = aproximar(parts.arms[1].rotation.x, passo * .32 + balancoArma + golpeBracoX, dt, 18);
      parts.arms[0].rotation.z = aproximar(parts.arms[0].rotation.z, 0, dt);
      parts.arms[1].rotation.z = aproximar(parts.arms[1].rotation.z, golpeBracoZ, dt, 18);
      parts.weapon.rotation.z = aproximar(parts.weapon.rotation.z, golpeArmaZ + balancoArma, dt, 20);
      parts.torso.rotation.x = aproximar(parts.torso.rotation.x, -.025 - pesoCorrida * .09 + (atacando ? -.06 * Math.sin(Math.PI * fase) : 0), dt, 9);
      parts.torso.rotation.y = aproximar(parts.torso.rotation.y, giroTronco, dt, 16);
      parts.torso.position.y = 0;
      parts.torso.scale.y = 1 + respiracao * .008;
      parts.head.rotation.x = aproximar(parts.head.rotation.x, -.018 + respiracao * .012, dt, 7);
      parts.cape.rotation.x = aproximar(parts.cape.rotation.x, -.045 + Math.abs(passo) * .16 + Math.sin(animHeroi.tempo * 2.3) * .035, dt, 5);
      parts.cape.rotation.z = aproximar(parts.cape.rotation.z, Math.sin(animHeroi.fasePasso) * caminhada * .12 + Math.sin(animHeroi.tempo * 1.4) * .025, dt, 5);
      hero.position.y = estadoHeroi.salto + Math.abs(ciclo) * caminhada * (animHeroi.correndo ? .055 : .025);
      hero.position.x = estadoHeroi.x; hero.position.z = estadoHeroi.z;
      const deltaYawHeroi = Math.atan2(Math.sin(estadoHeroi.angulo - hero.rotation.y), Math.cos(estadoHeroi.angulo - hero.rotation.y));
      hero.rotation.y += deltaYawHeroi * (1 - Math.exp(-14 * dt));
      if (avancar) hero.translateZ(-avancar);
      slash.visible = atacando && fase > .24 && fase < .67;
      slash.material.opacity = slash.visible ? Math.sin(Math.PI * suave((fase - .24) / .43)) * .68 : 0;
      slash.rotation.z = -.65 + (fase - .24) * 3.2;
      slash.rotation.y = -.35 + (fase - .24) * 2.1;
      parts.footRing.material.opacity = .36 + Math.sin(animHeroi.tempo * 2.5) * .045;
    }
    function atualizarAnimacaoInimigo(dt, inimigo, distancia, angulo) {
      if (!enemies.has(inimigo.id)) {
        const model = criarModeloInimigo(inimigo.tipo); enemies.set(inimigo.id, model);
        const animNova = { tempo: Math.random() * 4, flash: 0, tremor: 0, postura: 0, atordoado: 0, telegraph: -.1 };
        const danoPendente = danosPendentes.get(inimigo.id) || 0;
        if (danoPendente) { animNova.flash = .13; animNova.tremor = .2; animNova.postura = danoPendente >= 3 ? 0 : danoPendente; animNova.atordoado = danoPendente >= 3 ? .42 : 0; danosPendentes.delete(inimigo.id); }
        inimigosAnimacao.set(inimigo.id, animNova);
      }
      const group = enemies.get(inimigo.id); const anim = inimigosAnimacao.get(inimigo.id); const parts = group.userData.parts;
      anim.tempo += dt; anim.flash = Math.max(0, anim.flash - dt); anim.tremor = Math.max(0, anim.tremor - dt); anim.atordoado = Math.max(0, anim.atordoado - dt);
      const alertando = distancia < 2.9;
      if (alertando) { if (anim.telegraph < 0) anim.telegraph = .72; else { anim.telegraph -= dt; if (anim.telegraph <= 0) anim.telegraph = .9; } }
      else anim.telegraph = -.1;
      const carga = alertando ? 1 - Math.max(0, anim.telegraph) / .9 : 0;
      const aviso = alertando && (anim.telegraph < .36 || distancia < 2.25);
      group.visible = inimigo.vida > 0; if (!group.visible) return;
      group.position.set(inimigo.x, 0, inimigo.z); group.rotation.y = angulo;
      parts.body.position.set(0, 0, 0);
      const treme = anim.tremor > 0 ? Math.sin(anim.tempo * 72) * anim.tremor * .09 : 0;
      parts.body.rotation.x = (inimigo.tipo === 'lobo' ? 0 : .08) - anim.atordoado * .85 + (anim.flash > 0 ? -.22 : 0) + (aviso ? -.1 * carga : 0);
      parts.body.rotation.z = treme + (anim.atordoado > 0 ? Math.sin(anim.tempo * 34) * .06 : 0);
      parts.legs.forEach((limb, i) => { if (limb.geometry.type === 'CylinderGeometry') limb.rotation.x = Math.sin(anim.tempo * 8 + i * Math.PI) * .2 * (aviso ? .3 : 1); });
      parts.ring.material.color.set(aviso ? 0xff2914 : alertando ? 0xbd5b24 : 0x79513f);
      parts.ring.material.opacity = aviso ? .85 + .12 * Math.sin(anim.tempo * 22) : alertando ? .58 : .4;
      if (parts.weapon) parts.weapon.rotation.z = aviso ? -.24 - .24 * carga : 0;
      for (const eye of parts.eyes) if (eye.material.isMeshStandardMaterial) eye.material.emissiveIntensity = aviso ? 3.8 : alertando ? 1.7 : .65;
      for (const item of group.userData.emissivos) {
        const hit = anim.flash > 0 ? 1 - anim.flash / .13 : 0;
        item.material.emissive.copy(item.cor).lerp(new T.Color(0xff604b), hit * .9);
        item.material.emissiveIntensity = item.intensidade + (anim.flash > 0 ? 2.8 * (1 - hit) : 0);
      }
      if (parts.weapon?.material.isMeshStandardMaterial && aviso) { parts.weapon.material.emissive.set(0xff3812); parts.weapon.material.emissiveIntensity = 1.8 + Math.sin(anim.tempo * 18) * .55; }
      if (anim.flash > 0) for (const eye of parts.eyes) eye.material.emissiveIntensity = 4.5;
      group.userData.health.bar.quaternion.copy(camera.quaternion);
    }
    function desenhar(estado, quadro = {}) {
      const { deltaSegundos = 0, correndo = false, movendo = false, velocidade = 0, salto = 0, anguloHeroi = 0 } = quadro;
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      if (estado.classe !== heroClass) { scene.remove(hero); hero = criarModeloHeroi(estado.classe); scene.remove(slash); hero.add(slash); heroClass = estado.classe; }
      const dt = Math.min(.1, Math.max(0, deltaSegundos)); const inimigoMira = atualizarMiraTravada(dt, estado);
      let alvoCamera = v(estado.x, 1.13 + salto, estado.z);
      let anguloPersonagem = anguloHeroi;
      if (inimigoMira) {
        alvoCamera = v((estado.x + inimigoMira.x) * .5, inimigoMira.tipo === 'lobo' ? .98 : 1.18, (estado.z + inimigoMira.z) * .5);
        anguloPersonagem = Math.atan2(-(inimigoMira.x - estado.x), -(inimigoMira.z - estado.z));
      }
      controls.target.lerp(alvoCamera, 1 - Math.exp(-9 * dt));
      const horizontal = controls.distance * Math.cos(controls.pitch); camera.position.set(controls.target.x + Math.sin(controls.yaw) * horizontal, controls.target.y + controls.distance * Math.sin(controls.pitch), controls.target.z + Math.cos(controls.yaw) * horizontal); camera.lookAt(controls.target);
      ajustarCameraContraCenario(); camera.lookAt(controls.target);
      atualizarAnimacaoHeroi(dt, { x: estado.x, z: estado.z, angulo: anguloPersonagem, salto, movendo: movendo && velocidade > .15, correndo });
      for (const e of estado.inimigos) {
        const distancia = Math.hypot(e.x - estado.x, e.z - estado.z); const angulo = Math.atan2(estado.x - e.x, -(estado.z - e.z));
        atualizarAnimacaoInimigo(dt, e, distancia, angulo);
        if (e.vida <= 0) continue;
        const group = enemies.get(e.id);
        const health = group.userData.health; health.fill.scale.x = Math.max(.001, e.vida / e.maxVida); health.fill.position.x = -(1 - e.vida / e.maxVida) * .56;
        health.lockMarker.visible = e.id === alvoMiraId;
        if (health.lockMarker.visible) { health.lockMarker.quaternion.copy(camera.quaternion); health.lockMarker.rotation.z += dt * 1.7; }
      }
      const tempo = inimigosAnimacao.get(estado.inimigos[0]?.id)?.tempo || 0;
      scenery.flickers.forEach(({ flame, light, phase }) => { const pulse = .82 + .18 * Math.sin(tempo * 1.5 + phase); flame.scale.y = pulse; light.intensity = 26 + 12 * pulse; });
      scenery.fireLight.intensity = 46 + 12 * Math.sin(tempo * 1.1);
      for (const fire of scenery.bonfire.children) if (fire.userData.phase !== undefined) { fire.scale.y = .75 + .35 * Math.sin(tempo * 1.8 + fire.userData.phase); fire.rotation.z = Math.sin(tempo * 1.3 + fire.userData.phase) * .12; }
      for (let i = 0; i < 24; i++) { const t = (tempo * .35 + i * .173) % 1; scenery.sparkPositions[i * 3] = Math.sin(i * 12.3 + tempo * .35) * .36; scenery.sparkPositions[i * 3 + 1] = .32 + t * 1.9; scenery.sparkPositions[i * 3 + 2] = Math.cos(i * 8.8 + tempo * .35) * .34; }
      scenery.sparks.attributes.position.needsUpdate = true;
      const chestNear = !estado.bausAberto && Math.hypot(estado.x - 18, estado.z - 18) < 4.5;
      scenery.chest.visible = !estado.bausAberto; scenery.aura.intensity = chestNear ? 8 + Math.sin(tempo * 1.8) * 2 : .5;
      renderer.render(scene, camera);
    }
    return { desenhar, moverCamera, moverCameraComAnalogo, orientarMovimento, orientarMovimentoComMira, definirAlvoMira, pontuarAlinhamentoMira,
      dispararAnimacaoAtaqueHeroi, dispararDanoInimigo,
      resolverColisaoHorizontal, moverComColisao, get colisoresCenario() { return colisoresCenario.slice(); } };
  }
  raiz.Mundo3D = { iniciar, criarTexturasProcedurais };
})(window);
