export const LOWER_THRESHOLD = 30;
export const UPPER_THRESHOLD = 40;
export const PRESETS = Object.freeze({
  jitter: { label: '임계값 근처의 흔들림', values: [26,31,29,32,28,33,29,31,27,35,41,34,28,31,44] },
  gradual: { label: '점차 어두워졌다 밝아짐', values: [65,54,45,42,39,34,30,27,22,25,30,35,39,41,49,58] },
  noisy: { label: '넓은 범위의 센서 오차', values: [52,47,28,33,24,31,37,45,29,26,43,32,21,39,44,55] }
});
export function clampBrightness(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError('밝기는 유한한 숫자여야 합니다.');
  return Math.min(100, Math.max(0, n));
}
export function nextLampState(mode, previousOn, brightness) {
  const b = clampBrightness(brightness);
  if (mode === 'single') return b < LOWER_THRESHOLD;
  if (mode === 'hysteresis') {
    if (b < LOWER_THRESHOLD) return true;
    if (b > UPPER_THRESHOLD) return false;
    return Boolean(previousOn);
  }
  throw new Error('알 수 없는 제어 방식: ' + mode);
}
export function runComparison(values, initialOn = false) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('실험 입력값이 필요합니다.');
  let single = Boolean(initialOn), hysteresis = Boolean(initialOn);
  let singleSwitches = 0, hysteresisSwitches = 0;
  const rows = values.map((raw, index) => {
    const brightness = clampBrightness(raw);
    const s0 = single, h0 = hysteresis;
    single = nextLampState('single', single, brightness);
    hysteresis = nextLampState('hysteresis', hysteresis, brightness);
    if (single !== s0) singleSwitches++;
    if (hysteresis !== h0) hysteresisSwitches++;
    return { step:index+1, brightness, single, hysteresis, singleChanged:single!==s0, hysteresisChanged:hysteresis!==h0 };
  });
  return {rows,singleSwitches,hysteresisSwitches, reduction:singleSwitches===0?0:Math.round(100*(singleSwitches-hysteresisSwitches)/singleSwitches),initialOn:Boolean(initialOn)};
}
export function comparisonCsv(result) {
  const head='단계,가상 밝기,단일 임계값,히스테리시스,단일 전환,히스테리시스 전환';
  return '\uFEFF'+[head,...result.rows.map(r=>[r.step,r.brightness,r.single?'ON':'OFF',r.hysteresis?'ON':'OFF',r.singleChanged?1:0,r.hysteresisChanged?1:0].join(','))].join('\r\n');
}
export function signalToMotion(signal) { return signal==='green'?'moving':'stopped'; }