import test from 'node:test';
import assert from 'node:assert/strict';
import { nextLampState,runComparison,comparisonCsv,clampBrightness,signalToMotion,PRESETS } from '../src/logic.js';
test('단일 임계값의 경계',()=>{
 assert.equal(nextLampState('single',false,29),true);
 assert.equal(nextLampState('single',true,30),false);
 assert.equal(nextLampState('single',true,100),false);
});
test('히스테리시스 경계값에서 상태 유지',()=>{
 assert.equal(nextLampState('hysteresis',false,30),false);
 assert.equal(nextLampState('hysteresis',true,30),true);
 assert.equal(nextLampState('hysteresis',false,40),false);
 assert.equal(nextLampState('hysteresis',true,40),true);
 assert.equal(nextLampState('hysteresis',false,29),true);
 assert.equal(nextLampState('hysteresis',true,41),false);
});
test('같은 입력과 초기 상태로 비교',()=>{
 const r=runComparison([25,31,29,32,41],false);
 assert.deepEqual(r.rows.map(v=>v.brightness),[25,31,29,32,41]);
 assert.equal(r.singleSwitches,4);
 assert.equal(r.hysteresisSwitches,2);
 assert.equal(r.reduction,50);
});
test('반복 실험 재현성',()=>assert.deepEqual(runComparison(PRESETS.jitter.values),runComparison(PRESETS.jitter.values)));
test('입력 검증',()=>{
 assert.throws(()=>runComparison([]));
 assert.throws(()=>clampBrightness('abc'));
 assert.throws(()=>nextLampState('foo',false,12));
 assert.equal(clampBrightness(-1),0);
 assert.equal(clampBrightness(101),100);
});
test('신호등 제어',()=>{
 assert.equal(signalToMotion('green'),'moving');
 assert.equal(signalToMotion('yellow'),'stopped');
 assert.equal(signalToMotion('red'),'stopped');
});
test('CSV 출력',()=>{
 const csv=comparisonCsv(runComparison([29,40,41]));
 assert.ok(csv.startsWith('\uFEFF단계,가상 밝기'));
 assert.match(csv,/3,41,OFF,OFF/);
});