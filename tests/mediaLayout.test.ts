import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function getBlocksContaining(selectorFragment: string) {
  return styles
    .split("}")
    .map((block) => `${block}}`)
    .filter((block) => block.includes(selectorFragment));
}

function assertMediaUsesContain(selectorFragment: string) {
  const blocks = getBlocksContaining(selectorFragment);

  assert.ok(blocks.length > 0, `Nenhum bloco CSS encontrado para ${selectorFragment}.`);
  assert.equal(
    blocks.some((block) => /object-fit:\s*contain\b/i.test(block)),
    true,
    `${selectorFragment} deveria usar object-fit: contain.`
  );
  assert.equal(
    blocks.some((block) => /object-fit:\s*cover\b/i.test(block)),
    false,
    `${selectorFragment} nao deveria usar object-fit: cover.`
  );
}

test("camera e previews principais sempre exibem a midia inteira", () => {
  assertMediaUsesContain(".real-camera-video");
  assertMediaUsesContain(".maintenance-preview-real-image");
  assertMediaUsesContain(".maintenance-photo-thumb img");
  assertMediaUsesContain(".maintenance-photo-thumb video");
  assertMediaUsesContain(".collision-evidence-thumb img");
  assertMediaUsesContain(".collision-evidence-thumb video");
  assertMediaUsesContain(".collision-video-thumb img");
  assertMediaUsesContain(".collision-video-thumb video");
});

test("controles mobile da camera preservam obturador circular", () => {
  assert.match(styles, /@media\s*\(max-width:\s*520px\)\s*{[\s\S]*?\.camera-actions-pro\s*{[\s\S]*?grid-template-columns:\s*56px\s+88px\s+56px;/);
  assert.match(styles, /\.camera-actions-pro\s+\.camera-primary-action\s*{[\s\S]*?width:\s*88px\s*!important;[\s\S]*?height:\s*88px\s*!important;/);
  assert.match(styles, /\.camera-actions-pro\s+\.camera-secondary-action\s*{[\s\S]*?width:\s*56px\s*!important;[\s\S]*?height:\s*56px\s*!important;/);
  assert.doesNotMatch(styles, /@media\s*\(max-width:\s*520px\)\s*{[\s\S]*?\.camera-actions-pro\s+button\s*{[\s\S]*?height:\s*54px\s*!important;/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*66px\s+104px\s+66px;/);
});

test("controles da camera seguem visual minimalista do app", () => {
  const cameraControls = getBlocksContaining(".camera-actions-pro");
  const shutterShell = getBlocksContaining(".camera-shutter-shell");
  const shutterCore = getBlocksContaining(".camera-shutter-core");
  const recordButton = getBlocksContaining(".photo-record");

  assert.equal(cameraControls.some((block) => /background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/i.test(block)), true);
  assert.equal(shutterShell.some((block) => /background:\s*#ffffff\b/i.test(block)), true);
  assert.equal(shutterCore.some((block) => /background:\s*#000e23\b/i.test(block)), true);
  assert.equal(recordButton.some((block) => /background:\s*#fff4f5\b/i.test(block)), true);
  assert.equal([...cameraControls, ...shutterShell, ...shutterCore, ...recordButton].some((block) => /linear-gradient|radial-gradient/i.test(block)), false);
});
