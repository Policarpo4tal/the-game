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
    let camera=[0,5,10];
    function desenhar(estado, agora, salto, ataque) {
      const dpr=Math.min(window.devicePixelRatio||1,1.5), w=Math.max(1,Math.floor(canvas.clientWidth*dpr)), h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      const noite=(Math.sin(agora*.000025)+1)/2;
      const luz=.76+(.24*(1-noite));
      gl.clearColor(.30*(1-noite)+.035*noite,.57*(1-noite)+.055*noite,.78*(1-noite)+.13*noite,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const destino=[estado.x,1,estado.z-3.4], alvoCam=[estado.x,5.1,estado.z+8.5];
      camera=camera.map((v,i)=>v+(alvoCam[i]-v)*.12);
      const vp=mul(perspective(Math.PI/3,w/h,.1,130),lookAt(camera,destino));
      gl.bindBuffer(gl.ARRAY_BUFFER,cube.pb); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,cube.nb); gl.enableVertexAttribArray(norm); gl.vertexAttribPointer(norm,3,gl.FLOAT,false,0,0);
      const box=(x,y,z,sx,sy,sz,color,ang=0)=>{
        const m=mul(vp,modelo(x,y,z,sx,sy,sz,ang)); gl.uniformMatrix4fv(uMvp,false,new Float32Array(m));
        gl.uniform3fv(uColor,new Float32Array(color)); gl.uniform1f(uLight,luz); gl.drawArrays(gl.TRIANGLES,0,cube.count);
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
      // Herói em blocos low-poly, cor associada à classe escolhida.
      const classe=Regras.CLASSES[estado.classe], py=salto;
      box(estado.x,.95+py,estado.z,.62,.88,.4,hex(classe.cor));
      box(estado.x,1.65+py,estado.z,.5,.48,.48,[.77,.57,.39]);
      box(estado.x,1.94+py,estado.z,.58,.22,.55,[.32,.22,.15]);
      box(estado.x-.42,1.02+py,estado.z,.24,.66,.27,hex(classe.cor),-.12);
      box(estado.x+.42,1.02+py,estado.z,.24,.66,.27,hex(classe.cor),.12);
      box(estado.x-.19,.35+py,estado.z,.25,.62,.32,[.23,.23,.24]); box(estado.x+.19,.35+py,estado.z,.25,.62,.32,[.23,.23,.24]);
      box(estado.x+.62,1.02+py,estado.z-.05,.11,.9,.13,[.72,.72,.67],-.48);
      if(ataque>0) box(estado.x+.82,1.1+py,estado.z-.25,.16,.6,.14,[.88,.83,.67],-.78);
      // Criaturas, barras de vida e sombra no chão.
      for(const e of estado.inimigos) if(e.vida>0) {
        const cor=e.tipo==='goblin'?[.25,.55,.20]:e.tipo==='lobo'?[.36,.38,.41]:[.78,.76,.65];
        box(e.x,.52,e.z,.8,.72,1.05,cor); box(e.x,.98,e.z-.08,.62,.55,.62,cor);
        box(e.x-.42,.44,e.z,.22,.62,.24,cor); box(e.x+.42,.44,e.z,.22,.62,.24,cor);
        box(e.x,.08,e.z,1.15,.08,.12,[.15,.08,.07]);
        box(e.x-(1-(e.vida/e.maxVida))*.5,.1,e.z-.08,Math.max(.04,e.vida/e.maxVida),.1,.14,[.75,.12,.09]);
      }
      // Bússola simples formada por quatro marcos de pedra.
      for(const [x,z] of [[-44,-44],[44,-44],[-44,44],[44,44]]) box(x,.8,z,1.2,1.6,1.2,[.45,.43,.37]);
    }
    return { desenhar };
  }
  function hex(s) { const n=parseInt(s.slice(1),16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }
  raiz.Mundo3D={ iniciar };
})(window);
