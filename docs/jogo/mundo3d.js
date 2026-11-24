/* Mini-renderizador 3D low-poly feito com WebGL nativo, sem bibliotecas ou downloads. */
(function (raiz) {
  'use strict';
  const VERTEX = `
    attribute vec3 a_position; attribute vec3 a_normal;
    uniform mat4 u_mvp; uniform float u_light;
    varying float v_light;
    void main() { gl_Position = u_mvp * vec4(a_position, 1.0);
      v_light = (0.30 + max(0.0, dot(a_normal, normalize(vec3(-0.45, 0.85, 0.35)))) * 0.70) * u_light; }
  `;
  const FRAGMENT = `
    precision mediump float; uniform vec3 u_color; varying float v_light;
    void main() { gl_FragColor = vec4(u_color * v_light, 1.0); }
  `;
  const faces = [
    [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]], [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
    [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]], [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],
    [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]], [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]]
  ];
  function cubeData(gl) {
    const p = []; const n = [];
    for (const f of faces) {
      for (const index of [0,1,2,0,2,3]) { p.push(...f[index].map((v) => v * .5)); n.push(...f[4]); }
    }
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n), gl.STATIC_DRAW);
    return { pb, nb, count: p.length / 3 };
  }
  const ident = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  function mul(a,b) { const o = new Array(16); for (let c=0;c<4;c++) for (let r=0;r<4;r++) o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]; return o; }
  function perspective(fov, aspect, near, far) { const f=1/Math.tan(fov/2), nf=1/(near-far); return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]; }
  function normalize(v) { const l=Math.hypot(...v)||1; return v.map((x)=>x/l); }
  function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
  function lookAt(eye,center) {
    const z=normalize(eye.map((v,i)=>v-center[i])), x=normalize(cross([0,1,0],z)), y=cross(z,x);
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1];
  }
  function modelo(x,y,z,sx,sy,sz,ang=0) {
    const c=Math.cos(ang),s=Math.sin(ang);
    return [c*sx,0,-s*sx,0, 0,sy,0,0, s*sz,0,c*sz,0, x,y,z,1];
  }
  function iniciar(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('Este aparelho não conseguiu iniciar o modo 3D.');
    const shader = (tipo, fonte) => { const s=gl.createShader(tipo); gl.shaderSource(s,fonte); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const programa=gl.createProgram(); gl.attachShader(programa,shader(gl.VERTEX_SHADER,VERTEX)); gl.attachShader(programa,shader(gl.FRAGMENT_SHADER,FRAGMENT)); gl.linkProgram(programa);
    if(!gl.getProgramParameter(programa,gl.LINK_STATUS)) throw new Error('Falha ao preparar a cena 3D.');
    gl.useProgram(programa);
    const pos=gl.getAttribLocation(programa,'a_position'), norm=gl.getAttribLocation(programa,'a_normal');
    const uMvp=gl.getUniformLocation(programa,'u_mvp'), uColor=gl.getUniformLocation(programa,'u_color'), uLight=gl.getUniformLocation(programa,'u_light');
    const cube=cubeData(gl);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    const camera={ yaw:0, pitch:.30, distance:8.5, alvoSuave:null };
    function moverCamera(dx,dy,zoom=0) {
      camera.yaw += dx*.005;
      camera.pitch = Math.max(.12, Math.min(.9, camera.pitch-dy*.004));
      camera.distance = Math.max(4.5, Math.min(14, camera.distance+zoom));
    }
    function orientarMovimento(dx,dz) {
      const c=Math.cos(camera.yaw), s=Math.sin(camera.yaw);
      return { dx: dx*c + dz*s, dz: -dx*s + dz*c };
    }
    function desenhar(estado, agora, salto, ataque, deltaSegundos=0, anguloHeroi=0) {
      const dpr=Math.min(window.devicePixelRatio||1,1.5), w=Math.max(1,Math.floor(canvas.clientWidth*dpr)), h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      const noite=(Math.sin(agora*.000025)+1)/2;
      const luz=.76+(.24*(1-noite));
      gl.clearColor(.30*(1-noite)+.035*noite,.57*(1-noite)+.055*noite,.78*(1-noite)+.13*noite,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const destinoAtual=[estado.x,1.15,estado.z];
      if (!camera.alvoSuave) camera.alvoSuave=destinoAtual.slice();
      else {
        const alpha=1-Math.exp(-12*Math.max(0,Math.min(deltaSegundos,.1)));
        camera.alvoSuave=camera.alvoSuave.map((v,i)=>v+(destinoAtual[i]-v)*alpha);
      }
      const horizontal=camera.distance*Math.cos(camera.pitch);
      const posicaoCam=[camera.alvoSuave[0]+Math.sin(camera.yaw)*horizontal,
        camera.alvoSuave[1]+camera.distance*Math.sin(camera.pitch),
        camera.alvoSuave[2]+Math.cos(camera.yaw)*horizontal];
      const vp=mul(perspective(Math.PI/3,w/h,.1,130),lookAt(posicaoCam,camera.alvoSuave));
      gl.bindBuffer(gl.ARRAY_BUFFER,cube.pb); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,cube.nb); gl.enableVertexAttribArray(norm); gl.vertexAttribPointer(norm,3,gl.FLOAT,false,0,0);
      const box=(x,y,z,sx,sy,sz,color,ang=0)=>{
        const m=mul(vp,modelo(x,y,z,sx,sy,sz,ang)); gl.uniformMatrix4fv(uMvp,false,new Float32Array(m));
        gl.uniform3fv(uColor,new Float32Array(color)); gl.uniform1f(uLight,luz); gl.drawArrays(gl.TRIANGLES,0,cube.count);
      };
      const humanoide=(x,z,py,cor,skin,helm,arma,escudo=false,yaw=0,ataque=false)=>{
        const c=Math.cos(yaw), s=Math.sin(yaw);
        const parte=(lx,y,lz,sx,sy,sz,color,rot=0)=>
          box(x+lx*c+lz*s,y+py,z-lx*s+lz*c,sx,sy,sz,color,yaw+rot);
        // Frente local é -Z; a rotação aplica-se às peças e à posição de cada peça.
        parte(-.2,.23,0,.28,.42,.38,[.16,.16,.18]); parte(.2,.23,0,.28,.42,.38,[.16,.16,.18]);
        parte(-.2,.58,0,.3,.54,.34,[.28,.25,.21]); parte(.2,.58,0,.3,.54,.34,[.28,.25,.21]);
        parte(0,.98,0,.68,.68,.42,cor);
        parte(0,.72,-.23,.72,.13,.08,[.72,.52,.21]);
        parte(-.42,1.2,0,.27,.25,.45,cor); parte(.42,1.2,0,.27,.25,.45,cor);
        parte(-.48,.93,-.02,.2,.6,.25,cor,-.14); parte(.48,.93,-.02,.2,.6,.25,cor,.14);
        parte(0,1.52,0,.3,.2,.28,skin);
        parte(0,1.79,0,.48,.48,.42,skin);
        parte(0,2.01,-.02,.53,.17,.48,helm);
        parte(-.11,1.81,-.22,.055,.07,.035,[.12,.12,.13]); parte(.11,1.81,-.22,.055,.07,.035,[.12,.12,.13]);
        parte(0,1.7,-.255,.22,.06,.025,[.42,.22,.16]);
        // Espada, efeito do golpe e escudo acompanham a orientação do herói.
        parte(.67,1.02,-.12,.11,.64,.11,arma,-.38);
        parte(.67,1.1,-.12,.17,.08,.15,[.75,.62,.32],-.38);
        if(ataque) parte(.88,1.1,-.42,.13,.68,.12,[.95,.9,.72],-.9);
        if(escudo) { parte(-.66,1.04,-.06,.14,.68,.48,[.64,.48,.22]); parte(-.66,1.08,-.315,.07,.13,.04,[.9,.74,.35]); }
      };
      const goblin=(x,z,ang)=>{
        const green=[.27,.53,.19], dark=[.17,.35,.13];
        box(x,.48,z,.3,.72,.3,[.27,.23,.16],ang); box(x,.98,z,.52,.55,.4,green,ang);
        box(x,1.48,z-.04,.5,.5,.43,green,ang);
        box(x-.34,1.47,z-.03,.28,.12,.12,green,ang); box(x+.34,1.47,z-.03,.28,.12,.12,green,ang);
        box(x-.13,1.52,z-.265,.07,.09,.035,[1,.76,.13],ang); box(x+.13,1.52,z-.265,.07,.09,.035,[1,.76,.13],ang);
        box(x,1.34,z-.28,.19,.12,.08,[.72,.61,.24],ang);
        box(x-.37,1.01,z,.18,.58,.2,green,ang-.12); box(x+.37,1.01,z,.18,.58,.2,green,ang+.12);
        box(x-.2,.1,z,.22,.2,.38,dark,ang); box(x+.2,.1,z,.22,.2,.38,dark,ang);
        box(x+.53,.79,z-.12,.08,.58,.08,[.4,.25,.14],ang-.3);
        box(x+.53,1.12,z-.12,.1,.28,.1,[.65,.63,.54],ang-.3);
      };
      const lobo=(x,z,ang)=>{
        const pelo=[.37,.39,.42], sombra=[.25,.27,.30];
        box(x,.58,z,.66,.52,1.08,pelo,ang); box(x,.76,z-.53,.58,.52,.58,pelo,ang);
        box(x,.61,z-.85,.28,.22,.45,[.58,.54,.48],ang);
        box(x-.17,.85,z-.73,.08,.08,.04,[.95,.68,.13],ang); box(x+.17,.85,z-.73,.08,.08,.04,[.95,.68,.13],ang);
        for(const [sx,sz] of [[-.23,-.32],[.23,-.32],[-.23,.38],[.23,.38]]) {
          box(x+sx,.27,z+sz,.18,.5,.2,pelo,ang); box(x+sx,.07,z+sz-.03,.2,.12,.28,sombra,ang);
        }
        box(x,.7,z+.69,.16,.16,.58,pelo,ang+.2);
        box(x,.27,z-.75,.25,.08,.24,[.8,.74,.61],ang);
      };
      const esqueleto=(x,z,ang)=>{
        const bone=[.79,.76,.64], dark=[.34,.3,.25];
        box(x,.51,z,.48,.54,.28,dark,ang); box(x,.52,z,.38,.48,.22,bone,ang);
        box(x,1.13,z,.16,.72,.15,bone,ang);
        for(let i=0;i<3;i++) box(x,.76+i*.18,z-.03,.65,.07,.22,bone,ang);
        box(x,1.55,z,.47,.43,.42,bone,ang);
        box(x-.12,1.59,z-.22,.08,.1,.04,[.75,.13,.08],ang); box(x+.12,1.59,z-.22,.08,.1,.04,[.75,.13,.08],ang);
        box(x,1.42,z-.23,.18,.06,.04,dark,ang);
        box(x-.42,1.04,z,.14,.66,.14,bone,ang-.18); box(x+.42,1.04,z,.14,.66,.14,bone,ang+.18);
        box(x-.19,.27,z,.15,.5,.16,bone,ang); box(x+.19,.27,z,.15,.5,.16,bone,ang);
        box(x+.57,.87,z-.12,.08,.7,.08,[.53,.52,.48],ang-.28);
      };
      // Planície, trilha antiga e rio estreito.
      box(0,-.38,0,100,.55,100,[.27,.43,.20]);
      box(0,-.08,-4,3,.12,82,[.56,.42,.25]);
      box(25,-.08,7,7,.12,82,[.16,.42,.55]);
      // Muralhas e torres do castelo no horizonte.
      for(const x of [-17,17]) { box(x,3,-32,2,6,2,[.48,.43,.36]); box(x,6.25,-32,2.4,.5,2.4,[.32,.27,.24]); }
      box(0,2,-32,32,4,1.5,[.55,.49,.40]); box(0,1,-31,4,2,1.7,[.18,.16,.15]);
      box(-7,5,-33,2,3,2,[.57,.49,.38]); box(7,5,-33,2,3,2,[.57,.49,.38]);
      box(0,8,-33,9,.35,2,[.66,.17,.13]);
      // Casas da vila.
      for(const [x,z] of [[-10,9],[-15,15],[12,10],[18,13],[8,21]]) {
        box(x,1.3,z,4,2.6,4,[.63,.42,.25]); box(x,3,z,4.7,.7,4.7,[.40,.16,.12]);
        box(x,1,z-2.06,.8,1.9,.1,[.25,.15,.10]); box(x-1,1.8,z-2.1,.65,.65,.12,[.34,.57,.65]);
      }
      // Bosque low-poly ao redor do caminho.
      for(const [x,z,s] of [[-22,-18,1],[-28,-8,1.3],[24,-16,1],[30,-2,1.2],[-25,20,1.1],[27,22,1.3],[-33,5,.9],[34,12,1]]) {
        box(x,.9,z,.65,2*s,.65,[.31,.19,.10]); box(x,2.7*s,z,2.5*s,3*s,2.5*s,[.13,.34,.16]);
        box(x,4.1*s,z,1.7*s,2*s,1.7*s,[.18,.43,.20]);
      }
      // Rochas e entrada escura da caverna.
      for(const [x,z,s] of [[-28,-28,2],[-25,-29,2.5],[-22,-27,2],[-30,-25,2.2],[23,-27,2],[28,-24,2.8]]) box(x,1,z,s,2,s,[.34,.34,.31]);
      box(-26,1.4,-26,.8,2.8,.3,[.04,.035,.04]);
      // Arbustos e pedras próximos da trilha.
      for(const [x,z] of [[-5,18],[5,27],[-19,-5],[21,2],[-12,-20],[13,-13]]) box(x,.55,z,1.8,1.1,1.5,[.25,.38,.17]);
      // Baú de descoberta perto do rio.
      if (!estado.bausAberto) { box(18,.65,18,1.3,1.1,1.1,[.48,.25,.08]); box(18,1.15,18,1.35,.18,1.16,[.77,.57,.12]); }
      // Herói low-poly em armadura, com detalhes e equipamento da classe.
      const classe=Regras.CLASSES[estado.classe], py=salto;
      const corHeroi=hex(classe.cor), elmo=estado.classe==='Mago'?[.27,.2,.43]:estado.classe==='Arqueiro'?[.28,.31,.2]:[.36,.31,.24];
      humanoide(estado.x,estado.z,py,corHeroi,[.77,.57,.39],elmo,[.72,.72,.67],estado.classe==='Paladino',anguloHeroi,ataque>0);
      // Inimigos com silhuetas próprias e barras de vida.
      for(const e of estado.inimigos) if(e.vida>0) {
        const ang=Math.atan2(estado.x-e.x,-(estado.z-e.z));
        if(e.tipo==='goblin') goblin(e.x,e.z,ang);
        else if(e.tipo==='lobo') lobo(e.x,e.z,ang);
        else esqueleto(e.x,e.z,ang);
        const altura=e.tipo==='lobo'?1.25:1.95;
        box(e.x,altura,e.z,1.15,.08,.12,[.15,.08,.07]);
        box(e.x-(1-(e.vida/e.maxVida))*.5,altura+.01,e.z-.08,Math.max(.04,e.vida/e.maxVida),.1,.14,[.75,.12,.09]);
      }
      // Bússola simples formada por quatro marcos de pedra.
      for(const [x,z] of [[-44,-44],[44,-44],[-44,44],[44,44]]) box(x,.8,z,1.2,1.6,1.2,[.45,.43,.37]);
    }
    return { desenhar, moverCamera, orientarMovimento };
  }
  function hex(s) { const n=parseInt(s.slice(1),16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }
  raiz.Mundo3D={ iniciar };
})(window);
