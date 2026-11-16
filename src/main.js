import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PRESETS, nextLampState, runComparison, comparisonCsv, signalToMotion } from './logic.js';

const $ = (selector) => document.querySelector(selector);
const state = {
  signal: 'red',
  brightness: 50,
  mode: 'single',
  lampOn: false,
  distance: 0,
  result: null,
  preset: 'jitter'
};
const sceneNode = $('#scene');
let renderer = null;
let scene = null;
let camera = null;
let orbit = null;
let robot = null;
let frontLight = null;
let frontBulb = null;
let ambient = null;
let signalMeshes = {};
let legs = [];
let shadowRing = null;
const clock = new THREE.Clock();

function mesh(geometry, color, metalness = 0.12, roughness = 0.6) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
}
function addPart(parent, geometry, color, x, y, z, metalness = 0.12) {
  const item = mesh(geometry, color, metalness);
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}
function init3D() {
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1c2b');
    scene.fog = new THREE.Fog('#0b1c2b', 11, 23);
    camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80);
    camera.position.set(5.9, 3.75, 5.8);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.48;
    sceneNode.appendChild(renderer.domElement);
    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.065;
    orbit.minDistance = 3.4;
    orbit.maxDistance = 11;
    orbit.maxPolarAngle = Math.PI / 2.05;
    orbit.target.set(0, 0.75, 0);
    orbit.update();

    ambient = new THREE.HemisphereLight('#a0d5e8', '#122532', 1.15);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#ddf7ff', 2.2);
    sun.position.set(4, 7, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.bias = -0.0003;
    scene.add(sun);
    const accent = new THREE.PointLight('#36a9b1', 10, 8, 2);
    accent.position.set(-3, 2, 2);
    scene.add(accent);

    const floor = addPart(scene, new THREE.PlaneGeometry(24, 24), '#142d3b', 0, -0.03, 0);
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    const grid = new THREE.GridHelper(24, 24, '#31616b', '#234453');
    grid.position.y = -0.019;
    grid.material.transparent = true;
    grid.material.opacity = 0.36;
    scene.add(grid);
    const runway = addPart(scene, new THREE.BoxGeometry(3, 0.075, 7.1), '#263b49', 0, -0.01, 0);
    runway.castShadow = false;
    for (let side of [-1, 1]) {
      addPart(scene, new THREE.BoxGeometry(0.055, 0.025, 6.9), '#51b4ae', side * 1.43, 0.043, 0);
      for (let z = -3.15; z <= 3.2; z += 0.85) {
        addPart(scene, new THREE.BoxGeometry(0.20, 0.025, 0.33), '#477685', side * 1.63, 0.017, z);
      }
    }
    for (let z = -2.9; z <= 3; z += 0.8) {
      addPart(scene, new THREE.BoxGeometry(0.06, 0.02, 0.36), '#67808c', 0, 0.033, z);
    }

    robot = new THREE.Group();
    robot.position.set(0, 0, 0.98);
    scene.add(robot);

    // Educational stylized quadruped; not a physical replica of MATDOG.
    addPart(robot, new THREE.BoxGeometry(1.12, 0.42, 1.48), '#c4d4d7', 0, 1.16, 0, 0.53);
    addPart(robot, new THREE.BoxGeometry(0.99, 0.09, 1.28), '#263d4d', 0, 1.416, 0, 0.4);
    addPart(robot, new THREE.BoxGeometry(0.88, 0.10, 0.25), '#49debe', 0, 1.38, 0.44, 0.25);
    addPart(robot, new THREE.BoxGeometry(0.54, 0.39, 0.43), '#d4e3e5', 0, 1.23, -0.93, 0.34);
    const visor = addPart(robot, new THREE.BoxGeometry(0.49, 0.15, 0.053), '#1a3947', 0, 1.30, -1.158, 0.3);
    visor.material.emissive = new THREE.Color('#2edebd');
    visor.material.emissiveIntensity = 0.25;
    for (const x of [-0.14, 0.14]) {
      const eye = addPart(robot, new THREE.BoxGeometry(0.074, 0.048, 0.017), '#5df9d5', x, 1.31, -1.192);
      eye.material.emissive = new THREE.Color('#35eec8');
      eye.material.emissiveIntensity = 2;
    }
    frontBulb = addPart(robot, new THREE.SphereGeometry(0.10, 18, 14), '#586c6e', 0, 1.08, -1.185);
    frontBulb.material.emissive = new THREE.Color('#ffcf78');
    frontBulb.material.emissiveIntensity = 0;
    frontLight = new THREE.SpotLight('#ffe2a1', 0, 7, Math.PI / 6, 0.65, 2);
    frontLight.position.set(0, 1.07, -1.24);
    frontLight.target.position.set(0, 0.3, -4.0);
    robot.add(frontLight);
    robot.add(frontLight.target);

    for (const x of [-0.47, 0.47]) {
      for (const z of [-0.51, 0.51]) {
        const hip = new THREE.Group();
        hip.position.set(x, 1.02, z);
        robot.add(hip);
        addPart(hip, new THREE.BoxGeometry(0.28, 0.47, 0.28), '#a6bdc2', 0, -0.18, 0, 0.43);
        addPart(hip, new THREE.CylinderGeometry(0.115, 0.115, 0.12, 16), '#2d5861', 0, 0, 0);
        const lower = addPart(hip, new THREE.BoxGeometry(0.18, 0.38, 0.18), '#637e8a', 0, -0.56, 0, 0.28);
        lower.rotation.x = z > 0 ? -0.10 : 0.10;
        addPart(hip, new THREE.BoxGeometry(0.30, 0.13, 0.36), '#263f49', 0, -0.78, -0.06);
        legs.push({ hip, phase: ((x > 0) === (z > 0)) ? 0 : Math.PI });
      }
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.73, 0.78, 48),
      new THREE.MeshBasicMaterial({ color: '#47c9b2', transparent: true, opacity: 0.48, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.071;
    robot.add(ring);
    shadowRing = ring;

    const post = new THREE.Group();
    post.position.set(-2.4, 0, -1.60);
    scene.add(post);
    addPart(post, new THREE.CylinderGeometry(0.065, 0.085, 2.70, 16), '#758d98', 0, 1.32, 0);
    addPart(post, new THREE.BoxGeometry(0.72, 1.55, 0.48), '#0b121e', 0, 2.57, 0);
    addPart(post, new THREE.BoxGeometry(0.77, 1.62, 0.04), '#3e5b69', 0, 2.57, 0.255);
    const colors = { red: '#ed4a61', yellow: '#e3b951', green: '#2ed9a3' };
    ['red', 'yellow', 'green'].forEach((key, i) => {
      const bulb = addPart(post, new THREE.SphereGeometry(0.22, 24, 18), colors[key], 0, 3.08 - i * 0.51, 0.32);
      bulb.material.emissive = new THREE.Color(colors[key]);
      bulb.material.emissiveIntensity = 0.05;
      signalMeshes[key] = bulb;
    });
    addPart(post, new THREE.BoxGeometry(0.72, 0.1, 0.55), '#486675', 0, 0.075, 0);
    syncScene();

    const resize = () => {
      const { width, height } = sceneNode.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(resize).observe(sceneNode);
    } else {
      window.addEventListener('resize', resize);
    }
    requestAnimationFrame(tick);
  } catch (error) {
    console.error('WebGL initialization failed:', error);
    $('#scene-error').hidden = false;
  }
}

function syncScene() {
  Object.entries(signalMeshes).forEach(([key, lamp]) => {
    const on = key === state.signal;
    lamp.material.emissiveIntensity = on ? 3 : 0.06;
    lamp.material.color.set(on ? { red:'#ff7488', yellow:'#ffe08c', green:'#61f0b7' }[key] : '#465462');
  });
  if (frontLight) frontLight.intensity = state.lampOn ? 22 : 0;
  if (frontBulb) {
    frontBulb.material.color.set(state.lampOn ? '#ffe6aa' : '#586c6e');
    frontBulb.material.emissiveIntensity = state.lampOn ? 3.6 : 0;
  }
  if (ambient) ambient.intensity = 0.52 + state.brightness * 0.010;
}

function refreshUI() {
  const names = { red:'빨간불', yellow:'노란불', green:'초록불' };
  const moving = signalToMotion(state.signal) === 'moving';
  $('#telemetry-signal').textContent = '● ' + names[state.signal];
  $('#telemetry-signal').style.color = { red:'#fa8a95', yellow:'#f7d58c', green:'#63e3b4' }[state.signal];
  $('#telemetry-motion').textContent = moving ? '이동 중' : '정지';
  $('#telemetry-motion').style.color = moving ? '#5fe2bd' : '#e9eff4';
  $('#telemetry-light').textContent = state.lampOn ? 'ON' : 'OFF';
  $('#telemetry-light').style.color = state.lampOn ? '#ffd27f' : '#8ba9b8';
  $('#telemetry-distance').textContent = state.distance.toFixed(1) + ' m';
  $('#lamp-state').textContent = state.lampOn ? 'ON' : 'OFF';
  $('#lamp-state').classList.toggle('on', state.lampOn);
  $('#indicator-led').classList.toggle('on', state.lampOn);
  $('#scene-motion').textContent = moving ? 'MOVING' : 'STANDBY';
  $('#scene-brightness').textContent = 'LIGHT SENSOR: ' + state.brightness + '%';
  $('#brightness-number').innerHTML = state.brightness + ' <small>/ 100</small>';
  $('#brightness').value = String(state.brightness);
  document.querySelectorAll('.signal-button').forEach(button => {
    const active = button.dataset.signal === state.signal;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  syncScene();
}

function setBrightness(value) {
  state.brightness = Number(value);
  state.lampOn = nextLampState(state.mode, state.lampOn, state.brightness);
  refreshUI();
}

function resetControls() {
  state.signal = 'red';
  state.brightness = 50;
  state.mode = 'single';
  state.lampOn = false;
  state.distance = 0;
  if (robot) robot.position.z = 0.98;
  $('input[name="mode"][value="single"]').checked = true;
  refreshUI();
}

function tick() {
  requestAnimationFrame(tick);
  if (!renderer || !robot) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const moving = signalToMotion(state.signal) === 'moving';
  const t = clock.elapsedTime;
  if (moving) {
    robot.position.z -= dt * 0.55;
    if (robot.position.z < -1.12) robot.position.z = 1.50;
    state.distance += dt * 0.55;
    $('#telemetry-distance').textContent = state.distance.toFixed(1) + ' m';
  }
  legs.forEach((leg) => {
    const target = moving ? Math.sin(t * 7.6 + leg.phase) * 0.38 : 0;
    leg.hip.rotation.x += (target - leg.hip.rotation.x) * Math.min(1, dt * 12);
  });
  robot.position.y = moving ? Math.abs(Math.sin(t * 7.6)) * 0.045 : 0;
  if (shadowRing) shadowRing.material.opacity = moving ? 0.55 : 0.32;
  orbit.update();
  renderer.render(scene, camera);
}

function createSparkline(values) {
  const n = values.length;
  const points = values.map((v, i) => {
    const x = 15 + i * (270 / Math.max(1, n - 1));
    const y = 88 - v * 0.73;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const y30 = (88 - 30 * 0.73).toFixed(1);
  const y40 = (88 - 40 * 0.73).toFixed(1);
  return '<svg class="sparkline" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="실험 입력 밝기 그래프">' +
    '<path d="M 0 ' + y30 + ' H 300" stroke="#d6a76e" stroke-dasharray="5 5" opacity=".52"/>' +
    '<path d="M 0 ' + y40 + ' H 300" stroke="#5bd9c4" stroke-dasharray="5 5" opacity=".38"/>' +
    '<polyline points="' + points + '" fill="none" stroke="#87bdeb" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<text x="280" y="' + (Number(y30) - 3) + '" fill="#d6a76e" font-size="9">30</text>' +
    '<text x="280" y="' + (Number(y40) - 3) + '" fill="#5bd9c4" font-size="9">40</text></svg>';
}
function renderComparison() {
  const r = state.result;
  if (!r) return;
  const max = Math.max(1, r.singleSwitches, r.hysteresisSwitches);
  const singleWidth = Math.round(r.singleSwitches / max * 100);
  const hysWidth = Math.round(r.hysteresisSwitches / max * 100);
  const cells = r.rows.map(row =>
    '<tr><td>' + row.step + '</td><td>' + row.brightness + '</td>' +
    '<td class="' + (row.single ? 'state-on' : 'state-off') + '">' + (row.single ? 'ON' : 'OFF') + (row.singleChanged ? ' <span class="change-mark">*</span>' : '') + '</td>' +
    '<td class="' + (row.hysteresis ? 'state-on' : 'state-off') + '">' + (row.hysteresis ? 'ON' : 'OFF') + (row.hysteresisChanged ? ' <span class="change-mark">*</span>' : '') + '</td></tr>'
  ).join('');
  $('#results').innerHTML =
    '<div class="result-metrics">' +
      '<div class="metric"><label>단일 임계값 · 전환 횟수</label><strong>' + r.singleSwitches + '<em> 회</em></strong><small>30 미만 ON / 30 이상 OFF</small></div>' +
      '<div class="metric"><label>히스테리시스 · 전환 횟수</label><strong>' + r.hysteresisSwitches + '<em> 회</em></strong><small>30 미만 ON / 40 초과 OFF</small></div>' +
      '<div class="metric accent"><label>불필요한 전환 감소율*</label><strong>' + r.reduction + '<em> %</em></strong><small>단일 임계값 대비 전환 횟수 변화</small></div>' +
    '</div>' +
    '<div class="result-layout">' +
      '<div class="result-card"><h3>전환 횟수 비교 <span>/ 동일 입력</span></h3><div class="chart-area">' +
        '<div class="bar-row"><div><span>단일 임계값</span><strong>' + r.singleSwitches + '회</strong></div><div class="bar single"><i style="width:' + singleWidth + '%"></i></div></div>' +
        '<div class="bar-row"><div><span>히스테리시스</span><strong>' + r.hysteresisSwitches + '회</strong></div><div class="bar hysteresis"><i style="width:' + hysWidth + '%"></i></div></div>' +
        '<div class="control-title"><strong>입력 밝기 변화</strong><span>가상 센서값</span></div>' +
        createSparkline(r.rows.map(row=>row.brightness)) +
        '<p class="chart-caption">점선은 밝기 30 / 40의 경계입니다. *감소율은 전환 횟수 차이이며 인식 정확도나 실제 로봇 성능이 아닙니다.</p>' +
      '</div></div>' +
      '<div class="result-card"><h3>단계별 제어 결과 <span>/ * 표시: 조명 상태 변경</span></h3><div class="table-scroll"><table><thead><tr><th>단계</th><th>밝기</th><th>단일</th><th>히스테리시스</th></tr></thead><tbody>' + cells + '</tbody></table></div></div>' +
    '</div>' +
    '<p class="small-warning">실험 조건: 초기 조명 OFF, 동일한 가상 밝기 시퀀스. 여기서는 조명 스위칭의 안정성을 비교하며 신호등 영상 인식 기능이나 하드웨어 측정은 다루지 않습니다.</p>';
}

function setupEvents() {
  document.querySelectorAll('.signal-button').forEach(button => {
    button.addEventListener('click', () => {
      state.signal = button.dataset.signal;
      refreshUI();
    });
  });
  $('#brightness').addEventListener('input', e => setBrightness(e.target.value));
  document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener('change', () => {
      state.mode = input.value;
      // When changing algorithms, start fresh instead of inheriting unrelated controller state.
      state.lampOn = false;
      state.lampOn = nextLampState(state.mode, state.lampOn, state.brightness);
      refreshUI();
    });
  });
  $('#reset-btn').addEventListener('click', resetControls);
  $('#fullscreen-btn').addEventListener('click', () => {
    const element = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      element.requestFullscreen?.().catch(() => {});
    }
  });
  $('#preset').addEventListener('change', e => { state.preset = e.target.value; });
  $('#run-btn').addEventListener('click', () => {
    state.preset = $('#preset').value;
    state.result = runComparison(PRESETS[state.preset].values, false);
    renderComparison();
    $('#csv-btn').disabled = false;
  });
  $('#csv-btn').addEventListener('click', () => {
    if (!state.result) return;
    const blob = new Blob([comparisonCsv(state.result)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'matdog-' + state.preset + '-comparison.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
setupEvents();
init3D();
refreshUI();
