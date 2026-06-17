/**
 * postprocessing.js — Pipeline de post-procesado para el look holográfico.
 *
 * Usa EffectComposer con UnrealBloomPass para que SOLO las aristas
 * emisivas (guinda/rosa) brillen con bloom en tema oscuro.
 * En tema claro el composer no se usa y el renderer dibuja directo.
 *
 * Parámetros de bloom calibrados para glow elegante:
 *   strength  0.85  — intensidad del resplandor; bajo para no lavar todo
 *   radius    0.50  — difusión del halo en pantalla
 *   threshold 0.68  — solo lo que supere este brillo (en espacio lineal)
 *                     activa bloom; como superficies de área son tenues
 *                     y los edges tienen emissive alto, SOLO ellos brillan.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/** @type {EffectComposer | null} */
let _composer = null;

/**
 * Crea y configura el EffectComposer con el pipeline de bloom holográfico.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene}         scene
 * @param {THREE.Camera}        camera
 * @returns {EffectComposer}
 */
export const createComposer = (renderer, scene, camera) => {
  const composer = new EffectComposer(renderer);

  // Pase base: renderizar la escena normal.
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // UnrealBloom: solo dispara sobre píxeles con luminancia > threshold.
  // threshold 0.68 en espacio lineal ≈ colores brillantes/emisivos como
  // #c44e71 con emissiveIntensity ≥ 1.0; superficies opacas y vidrio
  // semi-transparente quedan por debajo y no se lavan.
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight), // resolución (se actualiza en resize)
    0.85, // strength  — intensidad total del bloom
    0.5, // radius    — suavizado/difusión del halo
    0.68, // threshold — umbral de luminancia para activar bloom
  );
  composer.addPass(bloomPass);

  // OutputPass: convierte de espacio lineal a sRGB y aplica tone mapping.
  // Reemplaza la corrección que antes hacía el renderer directamente.
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  _composer = composer;
  return composer;
};

/**
 * Actualiza la resolución del composer al hacer resize de ventana.
 * Llamar desde el listener de resize de main.js.
 *
 * @param {number} w — nuevo ancho en píxeles
 * @param {number} h — nuevo alto en píxeles
 */
export const resizeComposer = (w, h) => {
  _composer?.setSize(w, h);
};
