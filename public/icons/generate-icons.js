#!/usr/bin/env node
/**
 * Genera todos los íconos PNG necesarios para la PWA
 * Ejecutar: node generate-icons.js
 * Requiere: npm install canvas
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = path.join(__dirname, 'icons');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fondo degradado
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, '#1a2a3a');
  gradient.addColorStop(1, '#0f1923');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.18);
  ctx.fill();

  // Paw emoji
  ctx.font = `${size * 0.52}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐾', size / 2, size / 2 + size * 0.04);

  // Guardar como PNG
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`✅ Generado: icon-${size}x${size}.png`);
}

console.log('🎨 Generando íconos PWA...\n');
SIZES.forEach(size => generateIcon(size));
console.log('\n✅ ¡Todos los íconos generados en /public/icons/');
console.log('📁 Recuerda moverlos a: petshop-pwa/public/icons/');
