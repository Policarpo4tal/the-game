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
      eye: new T.MeshStandardMaterial({ color: 0xff3212, emissive: 0xff1600, emissiveIntensity: 3, roughness: .3 })
    };
    const hemi = new T.HemisphereLight(0x9eabc5, 0x211a19, 1.05); scene.add(hemi);
    const moon = new T.DirectionalLight(0xb6c7e4, 2.4); moon.position.set(-18, 28, 16); moon.castShadow = true;
    moon.shadow.mapSize.set(1536, 1536); moon.shadow.camera.left = -34; moon.shadow.camera.right = 34; moon.shadow.camera.top = 34; moon.shadow.camera.bottom = -34; moon.shadow.bias = -.00025; scene.add(moon);

    const v = (x, y, z) => new T.Vector3(x, y, z);
    function mesh(geometry, material, parent, pos = [0, 0, 0], scale = [1, 1, 1], cast = true) {
      const m = new T.Mesh(geometry, material); m.position.set(...pos); m.scale.set(...scale); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
    }
    const boxGeo = new T.BoxGeometry(1, 1, 1), sphereGeo = new T.SphereGeometry(1, 14, 10), cylGeo = new T.CylinderGeometry(1, 1, 1, 12), coneGeo = new T.ConeGeometry(1, 1, 12);
    function box(parent, x, y, z, sx, sy, sz, material = mat.stone, rot = 0) { const m = mesh(boxGeo, material, parent, [x, y, z], [sx, sy, sz]); m.rotation.y = rot; return m; }
    function orb(parent, x, y, z, sx, sy, sz, material) { return mesh(sphereGeo, material, parent, [x, y, z], [sx, sy, sz]); }
    function cyl(parent, x, y, z, sx, sy, sz, material, rot = 0) { const m = mesh(cylGeo, material, parent, [x, y, z], [sx, sy, sz]); m.rotation.z = rot; return m; }
    function link(parent, a, b, radius, material, sides = 10) { const p = v(...a), q = v(...b), d = q.clone().sub(p); const m = mesh(new T.CylinderGeometry(radius * .72, radius, d.length(), sides), material, parent); m.position.copy(p.add(q).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(v(0, 1, 0), d.normalize()); return m; }
    function rootScene(parent, position) { const g = new T.Group(); g.position.set(...position); parent.add(g); return g; }

    function criarCenario() {
      const world = new T.Group(); scene.add(world);
      const floor = mesh(new T.PlaneGeometry(120, 120), mat.ground, world, [0, -.18, 0], [1, 1, 1], false); floor.rotation.x = -Math.PI / 2;
      // Via de lajes claras: calçada de X=-1.8..1.8 avançando pelo eixo Z.
      const pathMat = new T.MeshStandardMaterial({ ...textures.chao, color: 0xb2a99a, roughness: .93, bumpScale: .12 });
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
        for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; const b = box(world, Math.cos(a) * 5.7, 3.6 + Math.sin(a) * 2.05, z, 1.08, .72, .9, mat.stone, a - Math.PI / 2); }
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
      const sparkPositions = new Float32Array(24 * 3); const sparks = new T.BufferGeometry(); sparks.setAttribute('position', new T.BufferAttribute(sparkPositions, 3));
      const sparkPoints = new T.Points(sparks, new T.PointsMaterial({ color: 0xffad52, size: .08, transparent: true, opacity: .9 })); world.add(sparkPoints);
      for (let i = 0; i < 24; i++) sparkPositions[i * 3] = (Math.random() - .5) * .7;
      // Baú com domo segmentado, faixas de ferro e aura sutil de interação.
      const chest = rootScene(world, [18, 0, 18]);
      box(chest, 0, .48, 0, 1.35, .82, 1.03, mat.wood); const lid = mesh(new T.SphereGeometry(.69, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat.wood, chest, [0, .87, 0], [1, .62, .76]);
      for (const x of [-.48, .48]) box(chest, x, .56, -.53, .12, .84, .08, mat.gold);
      box(chest, 0, .68, -.56, .18, .31, .09, mat.gold); const aura = new T.PointLight(0xe6a84d, 1.2, 4); aura.position.set(18, 1.3, 18); scene.add(aura);
      return { world, flickers, fireLight, sparkPositions, sparks, chest, lid, aura, bonfire };
    }

    const scenery = criarCenario();
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
      root.userData.parts = { torso, head, cape, arms, weapon, footRing, shadow };
      return root;
    }
    function criarModeloInimigo(tipo) {
      const root = new T.Group(); scene.add(root); const body = rootScene(root, [0, 0, 0]);
      const hide = new T.MeshStandardMaterial({ color: tipo === 'goblin' ? 0x40513a : tipo === 'lobo' ? 0x4b5058 : 0xa3a08e, roughness: .92 });
      if (tipo === 'lobo') {
        orb(body, 0, .65, 0, .55, .43, .84, hide); orb(body, 0, .83, -.57, .4, .35, .4, hide); mesh(coneGeo, hide, body, [0, .78, -.87], [.21, .42, .21], false).rotation.x = -Math.PI / 2;
        for (const x of [-.16, .16]) orb(body, x, .91, -.82, .045, .05, .035, mat.eye);
        for (const [x, z] of [[-.34,-.37],[.34,-.37],[-.34,.4],[.34,.4]]) cyl(body, x, .28, z, .105, .46, .11, hide, x * .5);
      } else {
        // Criatura humanoide curvada: crânio encajado, clavículas, placas dorsales y cuernos.
        const bone = tipo === 'goblin' ? hide : mat.iron;
        const spine = cyl(body, 0, .9, .1, .17, .8, .17, bone, -.18); spine.rotation.z = -.15;
        orb(body, 0, 1.46, -.05, .3, .31, .27, bone);
        const eye = orb(body, -.105, 1.48, -.29, .062, .07, .035, mat.eye); const eye2 = orb(body, .105, 1.48, -.29, .062, .07, .035, mat.eye);
        for (const side of [-1, 1]) { const horn = mesh(coneGeo, bone, body, [side * .23, 1.74, -.02], [.12, .39, .12]); horn.rotation.z = side * .42; orb(body, side * .37, 1.22, 0, .26, .22, .28, bone); cyl(body, side * .34, .76, -.03, .11, .56, .12, bone, side * .18); cyl(body, side * .15, .19, .05, .15, .36, .16, bone); }
        // arma colosal levantada: un asta irregular y cabeza ferrada.
        link(body, [.55, .45, -.15], [.72, 1.3, -.22], .075, mat.wood); box(body, .76, 1.36, -.22, .2, .67, .19, mat.iron, -.18); link(body, [.58, .52, -.15], [.7, .77, -.18], .1, mat.leather);
        if (tipo === 'goblin') { const blade = mesh(coneGeo, mat.iron, body, [.79, 1.75, -.22], [.17, .35, .17]); blade.rotation.z = Math.PI; root.userData.blade = blade; }
        root.userData.eyes = [eye, eye2];
      }
      const ring = marker(root, .53, 0x9f231e);
      const bar = new T.Group(); bar.position.set(0, tipo === 'lobo' ? 1.5 : 2.08, 0); root.add(bar);
      const back = new T.Mesh(new T.PlaneGeometry(1.18, .11), new T.MeshBasicMaterial({ color: 0x190b0b, side: T.DoubleSide })); bar.add(back);
      const fill = new T.Mesh(new T.PlaneGeometry(1.12, .065), new T.MeshBasicMaterial({ color: 0xc93428, side: T.DoubleSide })); fill.position.z = .01; bar.add(fill);
      root.userData.health = { bar, fill, eyes: root.userData.eyes || [], ring, type: tipo }; return root;
    }
    let hero = criarModeloHeroi('Guerreiro'); let heroClass = 'Guerreiro';
    const enemies = new Map();
    function moverCamera(dx, dy, zoom = 0) { controls.yaw += dx * .005; controls.pitch = Math.max(.12, Math.min(.9, controls.pitch - dy * .004)); controls.distance = Math.max(4.5, Math.min(14, controls.distance + zoom)); }
    function orientarMovimento(dx, dz) { const c = Math.cos(controls.yaw), s = Math.sin(controls.yaw); return { dx: dx * c + dz * s, dz: -dx * s + dz * c }; }
    function desenhar(estado, quadro = {}) {
      const { agora = performance.now(), salto = 0, ataque = 0, deltaSegundos = 0, anguloHeroi = 0 } = quadro;
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      if (estado.classe !== heroClass) { scene.remove(hero); hero = criarModeloHeroi(estado.classe); heroClass = estado.classe; }
      const dt = Math.min(.1, Math.max(0, deltaSegundos)); const target = v(estado.x, 1.13 + salto, estado.z); controls.target.lerp(target, 1 - Math.exp(-9 * dt));
      const horizontal = controls.distance * Math.cos(controls.pitch); camera.position.set(controls.target.x + Math.sin(controls.yaw) * horizontal, controls.target.y + controls.distance * Math.sin(controls.pitch), controls.target.z + Math.cos(controls.yaw) * horizontal); camera.lookAt(controls.target);
      const moving = Math.hypot(hero.position.x - estado.x, hero.position.z - estado.z) > .01;
      hero.position.set(estado.x, salto, estado.z); hero.rotation.y = anguloHeroi;
      const parts = hero.userData.parts; const stride = moving ? Math.sin(agora * .012) * .5 : 0;
      hero.userData['perna-1'].rotation.x = stride; hero.userData['perna1'].rotation.x = -stride;
      parts.arms[0].rotation.x = -stride * .55; parts.arms[1].rotation.x = stride * .55 - Math.max(0, ataque) * 4.2;
      parts.weapon.rotation.x = -Math.max(0, ataque) * 1.7; parts.cape.rotation.x = -.06 + Math.sin(agora * .003) * .045 + Math.abs(stride) * .08;
      parts.cape.rotation.z = Math.sin(agora * .004) * .035; parts.footRing.material.opacity = .36 + Math.sin(agora * .004) * .08;
      for (const e of estado.inimigos) {
        if (!enemies.has(e.id)) enemies.set(e.id, criarModeloInimigo(e.tipo));
        const group = enemies.get(e.id); group.visible = e.vida > 0; if (!group.visible) continue;
        group.position.set(e.x, 0, e.z); group.rotation.y = Math.atan2(estado.x - e.x, -(estado.z - e.z));
        const health = group.userData.health; health.fill.scale.x = Math.max(.001, e.vida / e.maxVida); health.fill.position.x = -(1 - e.vida / e.maxVida) * .56;
        health.bar.quaternion.copy(camera.quaternion);
        const alert = Math.hypot(e.x - estado.x, e.z - estado.z) < 2.35; health.ring.material.color.set(alert ? 0xff3215 : 0x79513f); health.ring.material.opacity = alert ? .9 : .4;
        if (health.eyes.length) for (const eye of health.eyes) eye.material.emissiveIntensity = alert ? 3 : .65;
        if (group.userData.blade) { group.userData.blade.material = alert ? mat.ember : mat.iron; group.userData.blade.scale.y = alert ? .47 : .35; }
      }
      scenery.flickers.forEach(({ flame, light, phase }) => { const pulse = .82 + .18 * Math.sin(agora * .012 + phase); flame.scale.y = pulse; light.intensity = 26 + 12 * pulse; });
      scenery.fireLight.intensity = 46 + 12 * Math.sin(agora * .009);
      for (const fire of scenery.bonfire.children) if (fire.userData.phase !== undefined) { fire.scale.y = .75 + .35 * Math.sin(agora * .015 + fire.userData.phase); fire.rotation.z = Math.sin(agora * .011 + fire.userData.phase) * .12; }
      for (let i = 0; i < 24; i++) { const t = (agora * .001 + i * .173) % 1; scenery.sparkPositions[i * 3] = Math.sin(i * 12.3 + agora * .001) * .36; scenery.sparkPositions[i * 3 + 1] = .32 + t * 1.9; scenery.sparkPositions[i * 3 + 2] = Math.cos(i * 8.8 + agora * .001) * .34; }
      scenery.sparks.attributes.position.needsUpdate = true;
      const chestNear = !estado.bausAberto && Math.hypot(estado.x - 18, estado.z - 18) < 4.5;
      scenery.chest.visible = !estado.bausAberto; scenery.aura.intensity = chestNear ? 8 + Math.sin(agora * .006) * 2 : .5;
      renderer.render(scene, camera);
    }
    return { desenhar, moverCamera, orientarMovimento };
  }
  raiz.Mundo3D = { iniciar, criarTexturasProcedurais };
})(window);
