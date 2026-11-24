/* Renderizador low-poly WebGL nativo: meshes pequenas para continuar offline e leve no APK. */
(function (raiz) {
  'use strict';
  const VERTEX = `
    attribute vec3 a_position; attribute vec3 a_normal;
    uniform mat4 u_mvp; uniform mat4 u_model; uniform mat3 u_normalMatrix;
    varying vec3 v_world; varying vec3 v_normal;
    void main() {
      vec4 world = u_model * vec4(a_position, 1.0);
      v_world = world.xyz;
      v_normal = normalize(u_normalMatrix * a_normal);
      gl_Position = u_mvp * vec4(a_position, 1.0);
    }
  `;
  const FRAGMENT = `
    precision mediump float;
    uniform vec3 u_color, u_camera, u_lightDir, u_ambient, u_fogColor;
    uniform vec3 u_pointPos, u_pointColor, u_pointPos2, u_pointColor2;
    uniform float u_roughness, u_metalness, u_emissive, u_sun, u_fogDensity;
    varying vec3 v_world; varying vec3 v_normal;
    void main() {
      vec3 N = normalize(v_normal);
      vec3 L = normalize(u_lightDir);
      vec3 V = normalize(u_camera - v_world);
      vec3 H = normalize(L + V);
      float diffuse = max(dot(N, L), 0.0);
      float gloss = mix(72.0, 7.0, clamp(u_roughness, 0.0, 1.0));
      float specular = pow(max(dot(N, H), 0.0), gloss) * (0.10 + 0.68 * u_metalness) * (1.0 - .55 * u_roughness);
      vec3 f0 = mix(vec3(.045), u_color, u_metalness);
      vec3 direct = u_color * (u_ambient + diffuse * u_sun);
      direct += f0 * specular;
      vec3 toPoint = u_pointPos - v_world;
      float distancePoint = length(toPoint);
      float pointDiffuse = max(dot(N, normalize(toPoint)), 0.0);
      float attenuation = 1.0 / (1.0 + .10 * distancePoint + .035 * distancePoint * distancePoint);
      direct += u_color * u_pointColor * pointDiffuse * attenuation * .9;
      vec3 toPoint2 = u_pointPos2 - v_world;
      float distancePoint2 = length(toPoint2);
      float pointDiffuse2 = max(dot(N, normalize(toPoint2)), 0.0);
      float attenuation2 = 1.0 / (1.0 + .10 * distancePoint2 + .035 * distancePoint2 * distancePoint2);
      direct += u_color * u_pointColor2 * pointDiffuse2 * attenuation2 * .75;
      direct += u_color * u_emissive;
      float distanceCamera = length(u_camera - v_world);
      float fog = exp(-u_fogDensity * u_fogDensity * distanceCamera * distanceCamera);
      gl_FragColor = vec4(mix(u_fogColor, direct, clamp(fog, 0.0, 1.0)), 1.0);
    }
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
  function malhaData(gl, p, n) {
    const pb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,pb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(p),gl.STATIC_DRAW);
    const nb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,nb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(n),gl.STATIC_DRAW);
    return { pb, nb, count:p.length/3 };
  }
  function esferaData(gl, lados=10, faixas=7) {
    const p=[], n=[];
    const ponto=(t,f)=>[Math.sin(t)*Math.cos(f),Math.cos(t),Math.sin(t)*Math.sin(f)];
    const tri=(a,b,c)=>{ for(const v of [a,b,c]) { p.push(...v); n.push(...v); } };
    for(let y=0;y<faixas;y++) for(let x=0;x<lados;x++) {
      const t0=Math.PI*y/faixas, t1=Math.PI*(y+1)/faixas, f0=2*Math.PI*x/lados, f1=2*Math.PI*(x+1)/lados;
      const a=ponto(t0,f0), b=ponto(t1,f0), c=ponto(t1,f1), d=ponto(t0,f1);
      tri(a,d,b); tri(d,c,b);
    }
    return malhaData(gl,p,n);
  }
  function radialData(gl, raioTopo=.5, raioBase=.5, lados=9) {
    const p=[], n=[];
    const tri=(a,b,c,normalA,normalB,normalC)=>{ for(const [v,no] of [[a,normalA],[b,normalB],[c,normalC]]) { p.push(...v); n.push(...no); } };
    const inclinacao=raioBase-raioTopo;
    for(let i=0;i<lados;i++) {
      const a=i*2*Math.PI/lados, b=(i+1)*2*Math.PI/lados;
      const nb=[Math.cos(b),inclinacao,Math.sin(b)], na=[Math.cos(a),inclinacao,Math.sin(a)];
      const pba=[raioBase*Math.cos(a),-.5,raioBase*Math.sin(a)], pbb=[raioBase*Math.cos(b),-.5,raioBase*Math.sin(b)];
      const pta=[raioTopo*Math.cos(a),.5,raioTopo*Math.sin(a)], ptb=[raioTopo*Math.cos(b),.5,raioTopo*Math.sin(b)];
      tri(pba,pta,pbb,na,na,nb); tri(pta,ptb,pbb,na,nb,nb);
      if(raioTopo>0) tri([0,.5,0],ptb,pta,[0,1,0],[0,1,0],[0,1,0]);
      if(raioBase>0) tri([0,-.5,0],pba,pbb,[0,-1,0],[0,-1,0],[0,-1,0]);
    }
    return malhaData(gl,p,n);
  }
  function anelData(gl, lados=20) {
    const p=[],n=[];
    const ponto=(r,a)=>[r*Math.cos(a),0,r*Math.sin(a)];
    const tri=(a,b,c)=>{ for(const v of [a,b,c]) { p.push(...v); n.push(0,1,0); } };
    for(let i=0;i<lados;i++) {
      const a=2*Math.PI*i/lados, b=2*Math.PI*(i+1)/lados;
      const i0=ponto(.38,a), o0=ponto(.5,a), i1=ponto(.38,b), o1=ponto(.5,b);
      tri(o0,i0,o1); tri(o1,i0,i1);
    }
    return malhaData(gl,p,n);
  }
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
  function normalY(sx,sy,sz,ang=0) {
    const c=Math.cos(ang),s=Math.sin(ang);
    return [c/sx,0,-s/sx,0,1/sy,0,s/sz,0,c/sz];
  }
  const MAT={
    tecido:{roughness:.96,metalness:0},couro:{roughness:.78,metalness:.04},pele:{roughness:.82,metalness:0},
    pedra:{roughness:.94,metalness:0},metal:{roughness:.28,metalness:.78},ouro:{roughness:.24,metalness:.82},
    madeira:{roughness:.87,metalness:0},brilho:{roughness:.3,metalness:.08,emissive:1.2},sombra:{roughness:1,metalness:0}
  };
  function iniciar(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('Este aparelho não conseguiu iniciar o modo 3D.');
    const shader = (tipo, fonte) => { const s=gl.createShader(tipo); gl.shaderSource(s,fonte); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const programa=gl.createProgram(); gl.attachShader(programa,shader(gl.VERTEX_SHADER,VERTEX)); gl.attachShader(programa,shader(gl.FRAGMENT_SHADER,FRAGMENT)); gl.linkProgram(programa);
    if(!gl.getProgramParameter(programa,gl.LINK_STATUS)) throw new Error('Falha ao preparar a cena 3D.');
    gl.useProgram(programa);
    const pos=gl.getAttribLocation(programa,'a_position'), norm=gl.getAttribLocation(programa,'a_normal');
    const U={};
    for(const name of ['u_mvp','u_model','u_normalMatrix','u_color','u_camera','u_lightDir','u_ambient','u_fogColor','u_pointPos','u_pointColor','u_pointPos2','u_pointColor2','u_roughness','u_metalness','u_emissive','u_sun','u_fogDensity']) U[name]=gl.getUniformLocation(programa,name);
    const meshes={cubo:cubeData(gl),esfera:esferaData(gl),cilindro:radialData(gl,.5,.5),cone:radialData(gl,.015,.5),frustum:radialData(gl,.22,.5),anel:anelData(gl)};
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
    function desenhar(estado, quadro={}) {
      const {agora=performance.now(),salto=0,ataque=0,deltaSegundos=0,anguloHeroi=0}=quadro;
      const dpr=Math.min(window.devicePixelRatio||1,1.35), w=Math.max(1,Math.floor(canvas.clientWidth*dpr)), h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      const noite=(Math.sin(agora*.000025)+1)/2, dia=1-noite;
      const corNeblina=[.04+.27*dia,.06+.31*dia,.09+.32*dia];
      gl.clearColor(...corNeblina,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const destinoAtual=[estado.x,1.12,estado.z];
      if (!camera.alvoSuave) camera.alvoSuave=destinoAtual.slice();
      else {
        const alpha=1-Math.exp(-12*Math.max(0,Math.min(deltaSegundos,.1)));
        camera.alvoSuave=camera.alvoSuave.map((v,i)=>v+(destinoAtual[i]-v)*alpha);
      }
      const horizontal=camera.distance*Math.cos(camera.pitch);
      const posicaoCam=[camera.alvoSuave[0]+Math.sin(camera.yaw)*horizontal,
        camera.alvoSuave[1]+camera.distance*Math.sin(camera.pitch),
        camera.alvoSuave[2]+Math.cos(camera.yaw)*horizontal];
      const vp=mul(perspective(Math.PI/3,w/h,.1,100),lookAt(posicaoCam,camera.alvoSuave));
      gl.uniform3fv(U.u_camera,new Float32Array(posicaoCam)); gl.uniform3fv(U.u_lightDir,new Float32Array([-.42,.84,.34]));
      gl.uniform3fv(U.u_ambient,new Float32Array([.12+.08*dia,.13+.09*dia,.17+.08*dia]));
      gl.uniform3fv(U.u_fogColor,new Float32Array(corNeblina)); gl.uniform1f(U.u_fogDensity,.014);
      gl.uniform3fv(U.u_pointPos,new Float32Array([-3,2.2,6])); gl.uniform3fv(U.u_pointColor,new Float32Array([1,.42,.13]));
      gl.uniform3fv(U.u_pointPos2,new Float32Array([7,2.2,2])); gl.uniform3fv(U.u_pointColor2,new Float32Array([1,.25,.07])); gl.uniform1f(U.u_sun,.34+.62*dia);
      const enviar=(malha,matriz,normal,color,material=MAT.pedra)=>{
        gl.bindBuffer(gl.ARRAY_BUFFER,malha.pb); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,malha.nb); gl.enableVertexAttribArray(norm); gl.vertexAttribPointer(norm,3,gl.FLOAT,false,0,0);
        gl.uniformMatrix4fv(U.u_model,false,new Float32Array(matriz)); gl.uniformMatrix3fv(U.u_normalMatrix,false,new Float32Array(normal));
        gl.uniformMatrix4fv(U.u_mvp,false,new Float32Array(mul(vp,matriz))); gl.uniform3fv(U.u_color,new Float32Array(color));
        gl.uniform1f(U.u_roughness,material.roughness??.85); gl.uniform1f(U.u_metalness,material.metalness??0); gl.uniform1f(U.u_emissive,material.emissive??0);
        gl.drawArrays(gl.TRIANGLES,0,malha.count);
      };
      const forma=(nome,x,y,z,sx,sy,sz,color,ang=0,material=MAT.pedra)=>{
        const m=modelo(x,y,z,sx,sy,sz,ang); enviar(meshes[nome],m,normalY(sx,sy,sz,ang),color,material);
      };
      const box=(x,y,z,sx,sy,sz,color,ang=0,mat=MAT.pedra)=>forma('cubo',x,y,z,sx,sy,sz,color,ang,mat);
      const esfera=(x,y,z,sx,sy,sz,color,ang=0,mat=MAT.pedra)=>forma('esfera',x,y,z,sx,sy,sz,color,ang,mat);
      const cilindro=(x,y,z,sx,sy,sz,color,ang=0,mat=MAT.pedra)=>forma('cilindro',x,y,z,sx,sy,sz,color,ang,mat);
      const cone=(x,y,z,sx,sy,sz,color,ang=0,mat=MAT.pedra)=>forma('cone',x,y,z,sx,sy,sz,color,ang,mat);
      const frustum=(x,y,z,sx,sy,sz,color,ang=0,mat=MAT.pedra)=>forma('frustum',x,y,z,sx,sy,sz,color,ang,mat);
      const anel=(x,y,z,sx,sz,color,mat=MAT.ouro)=>forma('anel',x,y,z,sx,1,sz,color,0,mat);
      const segmento=(a,b,raio,color,mat=MAT.metal)=>{
        const dir=normalize(b.map((v,i)=>v-a[i])),len=Math.hypot(...b.map((v,i)=>v-a[i]));
        let q=[dir[2],0,-dir[0],1+dir[1]];
        if(q[3]<.001) q=[1,0,0,0];
        const qlen=Math.hypot(...q); q=q.map(v=>v/qlen);
        const [x,y,z,w]=q,sx=2*raio,sy=len,sz=2*raio;
        const r00=1-2*(y*y+z*z),r01=2*(x*y-z*w),r02=2*(x*z+y*w);
        const r10=2*(x*y+z*w),r11=1-2*(x*x+z*z),r12=2*(y*z-x*w);
        const r20=2*(x*z-y*w),r21=2*(y*z+x*w),r22=1-2*(x*x+y*y);
        const m=[r00*sx,r10*sx,r20*sx,0,r01*sy,r11*sy,r21*sy,0,r02*sz,r12*sz,r22*sz,0,(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5,1];
        const n=[r00/sx,r10/sx,r20/sx,r01/sy,r11/sy,r21/sy,r02/sz,r12/sz,r22/sz];
        enviar(meshes.cilindro,m,n,color,mat);
      };
      const criarArma=(classe,raiz,yaw)=>{
        const c=Math.cos(yaw),s=Math.sin(yaw),p=(lx,y,lz)=>[raiz[0]+lx*c+lz*s,raiz[1]+y,raiz[2]-lx*s+lz*c];
        if(classe==='Mago') {
          const base=p(-.62,.2,.02),foco=p(-.62,1.78,-.04);
          segmento(base,foco,.065,[.37,.22,.12],MAT.madeira);
          esfera(...foco,.22,.24,.22,[.24,.62,1],yaw,{...MAT.brilho,emissive:1.6});
        } else if(classe==='Arqueiro') {
          // Arco recurvo na mão esquerda e aljava presa às costas.
          const a=p(-.75,.58,-.2),b=p(-.92,.86,-.2),c=p(-.96,1.18,-.2),e=p(-.75,1.55,-.2);
          segmento(a,b,.045,[.48,.27,.1],MAT.madeira); segmento(b,c,.045,[.48,.27,.1],MAT.madeira); segmento(c,e,.045,[.48,.27,.1],MAT.madeira);
          segmento(a,e,.012,[.8,.75,.62],MAT.tecido);
          cilindro(...p(.34,1.25,.22),.2,.58,.2,[.3,.18,.1],yaw,MAT.couro);
          for(let i=0;i<3;i++) cone(...p(.3+i*.06,1.65,.2),.06,.46,.06,[.73,.67,.52],yaw,MAT.metal);
        } else if(classe==='Assassino') {
          for(const lx of [-.62,.62]) {
            segmento(p(lx,.72,-.08),p(lx,.98,-.12),.055,[.22,.17,.14],MAT.couro);
            segmento(p(lx,.98,-.12),p(lx*1.12,1.25,-.55),.045,[.57,.6,.64],MAT.metal);
          }
        } else {
          // Espada na mão direita; escudo frontal na esquerda, com contorno metálico.
          segmento(p(.62,.75,-.04),p(.65,1.12,-.13),.055,[.35,.22,.13],MAT.couro);
          segmento(p(.47,1.1,-.11),p(.83,1.1,-.11),.035,[.82,.66,.3],MAT.ouro);
          segmento(p(.65,1.12,-.13),p(.82,1.72,-.48),.055,[.78,.81,.82],MAT.metal);
          esfera(...p(-.67,1.02,-.02),.18,.58,.46,classe==='Paladino'?[.73,.52,.17]:[.25,.32,.4],yaw,MAT.metal);
          box(...p(-.67,1.02,-.28),.07,.55,.05,[.91,.73,.29],yaw,MAT.ouro);
        }
      };
      const criarModeloHeroi=(estado,yaw=0,ataque=false,py=0)=>{
        const x=estado.x,z=estado.z,classe=estado.classe,cor=hex(Regras.CLASSES[classe].cor),skin=[.72,.54,.38];
        const c=Math.cos(yaw), s=Math.sin(yaw);
        const parte=(forma,lx,y,lz,sx,sy,sz,color,mat=MAT.tecido,rot=0)=>{
          const wx=x+lx*c+lz*s,wz=z-lx*s+lz*c;
          return forma(wx,y+py,wz,sx,sy,sz,color,yaw+rot,mat);
        };
        // Cabeça, tronco e membros usam esferas/cilindros; X é largura, Y altura, Z profundidade.
        esfera(x,.008,z,1.3,.045,.8,[.075,.058,.04],0,MAT.sombra); anel(x,.012,z,1.43,.9,[.32,.22,.1],{...MAT.ouro,emissive:.12});
        parte(frustum,0,1.02,.31,.82,1.1,.26,[.18,.13,.1],MAT.tecido); // Capa fica nas costas (+Z).
        parte(frustum,0,.98,0,.66,.72,.5,cor,MAT.metal); // Peitoral e silhueta da armadura.
        parte(cilindro,0,.68,0,.62,.24,.48,[.25,.19,.13],MAT.couro);
        parte(cilindro,-.2,.36,0,.28,.55,.3,[.24,.2,.16],MAT.couro); parte(cilindro,.2,.36,0,.28,.55,.3,[.24,.2,.16],MAT.couro);
        parte(cilindro,-.2,.14,-.02,.32,.2,.4,[.14,.14,.15],MAT.metal); parte(cilindro,.2,.14,-.02,.32,.2,.4,[.14,.14,.15],MAT.metal);
        parte(esfera,-.42,1.18,0,.34,.32,.34,cor,MAT.metal); parte(esfera,.42,1.18,0,.34,.32,.34,cor,MAT.metal); // Ombreiras.
        parte(cilindro,-.48,.88,0,.23,.58,.24,cor,MAT.couro); parte(cilindro,.48,.88,0,.23,.58,.24,cor,MAT.couro);
        parte(esfera,-.5,.56,-.02,.15,.16,.15,skin,MAT.pele); parte(esfera,.5,.56,-.02,.15,.16,.15,skin,MAT.pele);
        parte(esfera,0,1.58,0,.3,.31,.29,skin,MAT.pele);
        if(classe==='Mago') { parte(cilindro,0,1.75,0,.66,.07,.66,[.24,.16,.4],MAT.tecido); parte(cone,0,2.02,0,.43,.62,.43,[.3,.2,.48],MAT.tecido); }
        else if(classe==='Arqueiro') { parte(esfera,0,1.66,.02,.35,.34,.36,[.19,.28,.17],MAT.couro); parte(cone,0,1.88,.02,.25,.35,.25,[.19,.28,.17],MAT.couro); }
        else if(classe==='Assassino') { parte(esfera,0,1.68,.04,.37,.35,.37,[.1,.11,.14],MAT.tecido); parte(box,0,1.51,-.25,.39,.13,.06,[.12,.13,.16],MAT.couro); }
        else {
          parte(esfera,0,1.73,0,.38,.34,.38,classe==='Paladino'?[.72,.62,.37]:[.36,.34,.31],MAT.metal);
          parte(box,0,1.62,-.29,.38,.07,.035,[.1,.11,.12],MAT.metal); // Viseira marca a frente (-Z).
          parte(cone,0,1.96,.01,.2,.28,.2,classe==='Paladino'?[.88,.67,.2]:[.48,.36,.2],MAT.ouro);
        }
        parte(esfera,-.11,1.59,-.25,.045,.05,.025,[1,.62,.13],{...MAT.brilho,emissive:.4});
        parte(esfera,.11,1.59,-.25,.045,.05,.025,[1,.62,.13],{...MAT.brilho,emissive:.4});
        parte(esfera,0,1.03,-.3,.12,.12,.08,[.94,.67,.19],MAT.ouro); // Emblema visível no peitoral.
        criarArma(classe,[x,py,z],yaw);
        if(ataque) anel(x,.02,z,1.6,1.1,[.92,.39,.1],{...MAT.brilho,emissive:.45});
      };
      const criarModeloInimigo=(e,ang,alerta)=>{
        const x=e.x,z=e.z,c=Math.cos(ang),s=Math.sin(ang),p=(lx,y,lz)=>[x+lx*c+lz*s,y,z-lx*s+lz*c];
        const parte=(forma,lx,y,lz,sx,sy,sz,cor,mat=MAT.tecido)=>forma(...p(lx,y,lz),sx,sy,sz,cor,ang,mat);
        const pulsar=alerta?1.2+.65*(.5+.5*Math.sin(agora*.018)):1;
        esfera(x,.008,z,1.02,.04,.68,[.07,.05,.04],0,MAT.sombra);
        anel(x,.012,z,1.12,.76,alerta?[.95,.055,.02]:[.31,.16,.07],alerta?{...MAT.brilho,emissive:pulsar}:{...MAT.ouro,emissive:.08});
        if(e.tipo==='goblin') {
          const green=[.23,.45,.16],eyes=alerta?[1,.08,.02]:[1,.62,.08];
          parte(cilindro,0,.55,.1,.42,.68,.4,[.2,.17,.13],MAT.couro); // Corcunda baixa.
          parte(esfera,0,1.02,-.05,.55,.58,.47,green,MAT.tecido);
          parte(esfera,0,1.43,-.14,.48,.46,.42,green,MAT.pele);
          parte(cone,-.31,1.43,-.08,.22,.12,.16,green,MAT.pele); parte(cone,.31,1.43,-.08,.22,.12,.16,green,MAT.pele);
          parte(esfera,-.13,1.47,-.35,.07,.07,.04,eyes,{...MAT.brilho,emissive:pulsar});
          parte(esfera,.13,1.47,-.35,.07,.07,.04,eyes,{...MAT.brilho,emissive:pulsar});
          parte(cilindro,-.36,.83,0,.18,.55,.18,green,MAT.pele); parte(cilindro,.36,.83,0,.18,.55,.18,green,MAT.pele);
          parte(cone,.56,.76,-.16,.12,.55,.12,[.53,.31,.13],MAT.madeira);
          parte(esfera,.56,1.07,-.16,.17,.19,.17,[.69,.67,.6],MAT.metal);
          parte(cilindro,-.16,.18,0,.2,.34,.2,[.15,.14,.12],MAT.couro); parte(cilindro,.16,.18,0,.2,.34,.2,[.15,.14,.12],MAT.couro);
        } else if(e.tipo==='lobo') {
          const pelo=[.33,.35,.38],eyes=alerta?[1,.07,.02]:[1,.64,.12];
          parte(esfera,0,.61,.03,.76,.55,1.12,pelo,MAT.tecido);
          parte(esfera,0,.79,-.53,.59,.55,.62,pelo,MAT.tecido);
          parte(cone,0,.61,-.9,.3,.25,.46,[.58,.51,.43],MAT.pele);
          parte(cone,-.2,1.0,-.58,.17,.3,.17,pelo,MAT.tecido); parte(cone,.2,1.0,-.58,.17,.3,.17,pelo,MAT.tecido);
          parte(esfera,-.17,.86,-.77,.06,.07,.04,eyes,{...MAT.brilho,emissive:pulsar});
          parte(esfera,.17,.86,-.77,.06,.07,.04,eyes,{...MAT.brilho,emissive:pulsar});
          for(const [lx,lz] of [[-.24,-.3],[.24,-.3],[-.24,.38],[.24,.38]]) cilindro(...p(lx,.29,lz),.17,.48,.19,pelo,ang,MAT.tecido);
          parte(cone,0,.72,.7,.16,.16,.58,pelo,MAT.tecido);
          parte(cone,0,.29,-.86,.2,.14,.26,[.79,.73,.61],MAT.metal);
        } else {
          const bone=[.77,.73,.63],eyes=alerta?[1,.06,.02]:[.72,.12,.08];
          parte(esfera,0,.53,0,.43,.47,.29,[.27,.23,.19],MAT.couro);
          for(let i=0;i<4;i++) parte(cilindro,0,.63+i*.15,-.03,.58,.045,.23,bone,MAT.metal);
          parte(cilindro,0,.96,0,.14,.62,.13,bone,MAT.metal);
          parte(esfera,0,1.52,-.04,.44,.41,.4,bone,MAT.metal);
          parte(esfera,-.11,1.55,-.25,.07,.09,.04,eyes,{...MAT.brilho,emissive:pulsar});
          parte(esfera,.11,1.55,-.25,.07,.09,.04,eyes,{...MAT.brilho,emissive:pulsar});
          parte(cilindro,-.34,1.0,0,.12,.65,.12,bone,MAT.metal); parte(cilindro,.34,1.0,0,.12,.65,.12,bone,MAT.metal);
          parte(cilindro,-.16,.29,0,.13,.5,.13,bone,MAT.metal); parte(cilindro,.16,.29,0,.13,.5,.13,bone,MAT.metal);
          parte(cilindro,.56,.89,-.1,.09,.77,.09,[.38,.26,.15],MAT.madeira);
          parte(esfera,.56,1.31,-.1,.17,.18,.17,[.65,.63,.54],MAT.metal);
        }
        if(alerta) parte(cone,0,2.18,0,.15,.2,.15,[1,.08,.02],{...MAT.brilho,emissive:pulsar});
      };
      // Cenário: X é largura, Y altura e Z profundidade; trilha e rio guiam o olhar.
      const criarCenario=()=>{
        box(0,-.38,0,100,.55,100,[.17,.25,.15],0,MAT.pedra);
        box(0,-.08,-4,3,.12,82,[.44,.33,.21],0,MAT.couro);
        box(25,-.08,7,7,.12,82,[.07,.23,.29],0,MAT.pedra);
        // Castelo de pedra fria contra casas de madeira e telhados cônicos.
        for(const x of [-17,17]) { box(x,3,-32,2,6,2,[.38,.37,.35],0,MAT.pedra); cone(x,6.4,-32,2.4,.7,2.4,[.26,.25,.23],0,MAT.pedra); }
        box(0,2,-32,32,4,1.5,[.43,.4,.35],0,MAT.pedra); box(0,1,-31,4,2,1.7,[.035,.03,.03],0,MAT.sombra);
        box(-7,5,-33,2,3,2,[.47,.4,.32],0,MAT.pedra); box(7,5,-33,2,3,2,[.47,.4,.32],0,MAT.pedra);
        box(0,8,-33,9,.35,2,[.54,.12,.08],0,MAT.tecido);
        for(const [x,z] of [[-10,9],[-15,15],[12,10],[18,13],[8,21]]) {
          box(x,1.3,z,4,2.6,4,[.43,.27,.16],0,MAT.madeira); cone(x,3,z,4.8,1.25,4.8,[.29,.1,.08],0,MAT.tecido);
          box(x,1,z-2.06,.8,1.9,.1,[.16,.1,.07],0,MAT.madeira);
          box(x-1,1.8,z-2.1,.65,.65,.12,[.63,.36,.13],0,{...MAT.brilho,emissive:.22});
        }
        // Árvores: troncos cilíndricos e copas cônicas mostram a silhueta à distância.
        for(const [x,z,s] of [[-22,-18,1],[-28,-8,1.3],[24,-16,1],[30,-2,1.2],[-25,20,1.1],[27,22,1.3],[-33,5,.9],[34,12,1]]) {
          cilindro(x,.9*s,z,.55*s,1.8*s,.55*s,[.25,.14,.08],0,MAT.madeira);
          cone(x,2.35*s,z,2.5*s,2.7*s,2.5*s,[.09,.22,.11],0,MAT.tecido); cone(x,3.45*s,z,1.7*s,2.2*s,1.7*s,[.13,.3,.15],0,MAT.tecido);
        }
        for(const [x,z,s] of [[-28,-28,2],[-25,-29,2.5],[-22,-27,2],[-30,-25,2.2],[23,-27,2],[28,-24,2.8]]) esfera(x,.7,z,s,1.4*s,s,[.28,.29,.28],0,MAT.pedra);
        esfera(-26,1.3,-26,.45,1.3,.28,[.025,.02,.025],0,MAT.sombra);
        for(let z=-28;z<34;z+=8) for(const x of [-2.1,2.1]) cilindro(x,.12,z,.22,.28,.22,[.46,.42,.33],0,MAT.pedra);
        // Fogueira do acampamento: chama emissiva, pedras e anel de luz quente.
        for(let i=0;i<6;i++){const a=i*Math.PI/3;esfera(-3+Math.cos(a)*.55,.12,6+Math.sin(a)*.55,.28,.2,.28,[.25,.21,.17],0,MAT.pedra);}
        box(-3,.18,6,.95,.12,.13,[.25,.13,.07],.2,MAT.madeira); box(-3,.18,6,.95,.12,.13,[.25,.13,.07],-.2,MAT.madeira);
        cone(-3,.42,6,.4,.72,.4,[.96,.22,.035],0,{...MAT.brilho,emissive:1.8});
        cone(-3,.4,6,.22,.48,.22,[1,.64,.12],0,{...MAT.brilho,emissive:2}); anel(-3,.025,6,1.45,1.45,[.69,.24,.05],{...MAT.brilho,emissive:.5});
        // Baú de loot com bandas douradas, fecho luminoso e marca no chão.
        if(!estado.bausAberto) {
          box(18,.55,18,1.25,.8,1.05,[.29,.13,.055],0,MAT.madeira); box(18,1.02,18,1.3,.2,1.1,[.4,.2,.07],0,MAT.madeira);
          box(18,.63,17.45,.13,.72,.08,[.76,.56,.16],0,MAT.ouro); esfera(18,.68,17.36,.14,.16,.08,[1,.7,.15],0,{...MAT.brilho,emissive:.8});
          anel(18,.025,18,2.1,1.7,[.83,.53,.1],{...MAT.brilho,emissive:.16});
        }
        for(const [x,z] of [[-7,2],[7,2],[-17,13],[17,15]]) {
          cilindro(x,1.05,z,.16,2.1,.16,[.24,.14,.08],0,MAT.madeira);
          cone(x,2.2,z,.25,.48,.25,[.98,.28,.04],0,{...MAT.brilho,emissive:1.45});
        }
      };
      criarCenario();
      criarModeloHeroi(estado,anguloHeroi,ataque>0,salto);
      // Inimigos exibem olhos e anel vermelho quando alcançam distância de ataque.
      for(const e of estado.inimigos) if(e.vida>0) {
        const distancia=Math.hypot(e.x-estado.x,e.z-estado.z), alerta=distancia<2.35;
        const ang=Math.atan2(estado.x-e.x,-(estado.z-e.z)); criarModeloInimigo(e,ang,alerta);
        const altura=e.tipo==='lobo'?1.35:2.05;
        box(e.x,altura,e.z,1.05,.07,.1,[.12,.055,.05],0,MAT.sombra);
        box(e.x-(1-e.vida/e.maxVida)*.48,altura+.012,e.z-.055,Math.max(.03,e.vida/e.maxVida)*.96,.08,.11,alerta?[1,.13,.035]:[.72,.08,.055],0,{...MAT.brilho,emissive:.25});
      }
      // Bússola simples formada por quatro marcos de pedra.
      for(const [x,z] of [[-44,-44],[44,-44],[-44,44],[44,44]]) box(x,.8,z,1.2,1.6,1.2,[.45,.43,.37]);
    }
    return { desenhar, moverCamera, orientarMovimento };
  }
  function hex(s) { const n=parseInt(s.slice(1),16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }
  raiz.Mundo3D={ iniciar };
})(window);
