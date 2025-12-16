/**
 * Three.js Starfield Warp Background
 * Campo de estrellas con efecto hyperspace/warp
 * Elegante y no invasivo
 */

import * as THREE from 'three';

export interface BackgroundOptions {
  container: HTMLElement;
  starCount?: number;
  speed?: number;
  starColor?: number;
  backgroundColor?: number;
  mouseInfluence?: boolean;
}

interface Star {
  x: number;
  y: number;
  z: number;
  baseSpeed: number;
}

export class WebGPUBackground {
  private renderer!: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private stars: Star[] = [];
  private starsMesh!: THREE.Points;
  private container: HTMLElement;
  private animationId: number | null = null;
  private mouse: THREE.Vector2 = new THREE.Vector2(0, 0);
  private targetMouse: THREE.Vector2 = new THREE.Vector2(0, 0);
  private isWebGPU: boolean = false;
  private clock: THREE.Clock;

  // Config
  private starCount: number;
  private speed: number;
  private starColor: number;
  private mouseInfluence: boolean;
  private depth: number = 1500;

  constructor(options: BackgroundOptions) {
    this.container = options.container;
    this.starCount = options.starCount ?? 1500;
    this.speed = options.speed ?? 1;
    this.starColor = options.starColor ?? 0x06b6d4;
    this.mouseInfluence = options.mouseInfluence ?? true;
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(options.backgroundColor ?? 0x00010d);
    
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      this.depth
    );
    this.camera.position.z = 0;

    this.init();
  }

  private async init() {
    // Check for WebGPU support
    if ('gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          console.log('✓ WebGPU available - using optimized rendering');
          this.isWebGPU = true;
        }
      } catch (e) {
        console.log('WebGPU not available, using WebGL');
      }
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.createStarfield();
    this.setupEventListeners();
    this.animate();
  }

  private createStarfield() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.starCount * 3);
    const colors = new Float32Array(this.starCount * 3);
    const sizes = new Float32Array(this.starCount);

    // Parse star color
    const color = new THREE.Color(this.starColor);
    
    // Create secondary colors for variety
    const colorWhite = new THREE.Color(0xffffff);
    const colorCyan = new THREE.Color(0x22d3ee);

    for (let i = 0; i < this.starCount; i++) {
      // Random position in a cylinder around the camera
      const theta = Math.random() * Math.PI * 2;
      const radius = Math.random() * 800 + 100;
      
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius;
      const z = -(Math.random() * this.depth);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Store star data
      this.stars.push({
        x,
        y,
        z,
        baseSpeed: 0.5 + Math.random() * 1.5,
      });

      // Vary colors slightly - mostly cyan with some white
      const colorMix = Math.random();
      let starColor: THREE.Color;
      
      if (colorMix > 0.85) {
        starColor = colorWhite;
      } else if (colorMix > 0.6) {
        starColor = colorCyan;
      } else {
        starColor = color;
      }

      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;

      // Vary star sizes
      sizes[i] = Math.random() * 3 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for better star rendering
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uPixelRatio;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Size attenuation based on distance
          float depth = -mvPosition.z;
          float sizeScale = 300.0 / depth;
          
          gl_PointSize = size * sizeScale * uPixelRatio;
          gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          // Circular point with soft edges
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          // Soft glow effect
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha *= 0.9;
          
          // Add subtle glow
          float glow = exp(-dist * 3.0) * 0.5;
          
          gl_FragColor = vec4(vColor, alpha + glow);
        }
      `,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.starsMesh = new THREE.Points(geometry, material);
    this.scene.add(this.starsMesh);
  }

  private updateStars() {
    const positions = this.starsMesh.geometry.attributes.position.array as Float32Array;
    const deltaTime = this.clock.getDelta();
    const speedMultiplier = this.speed * 60 * deltaTime;

    // Mouse influence on speed (subtle boost when moving)
    const mouseSpeed = this.mouseInfluence 
      ? 1 + Math.abs(this.targetMouse.x - 0.5) * 0.8 
      : 1;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      
      // Move star towards camera
      star.z += star.baseSpeed * speedMultiplier * mouseSpeed;

      // Reset star when it passes the camera
      if (star.z > 0) {
        star.z = -this.depth + Math.random() * 100;
        
        // Randomize position when recycling
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.random() * 800 + 100;
        star.x = Math.cos(theta) * radius;
        star.y = Math.sin(theta) * radius;
      }

      // Apply mouse influence to star position (subtle parallax)
      let displayX = star.x;
      let displayY = star.y;
      
      if (this.mouseInfluence) {
        const depthFactor = (this.depth + star.z) / this.depth;
        displayX += (this.mouse.x - 0.5) * 100 * depthFactor;
        displayY += (this.mouse.y - 0.5) * 100 * depthFactor;
      }

      positions[i * 3] = displayX;
      positions[i * 3 + 1] = displayY;
      positions[i * 3 + 2] = star.z;
    }

    this.starsMesh.geometry.attributes.position.needsUpdate = true;
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    // Smooth mouse lerping
    this.mouse.lerp(this.targetMouse, 0.05);

    this.updateStars();

    // Subtle camera rotation based on mouse
    if (this.mouseInfluence) {
      this.camera.rotation.x = (this.mouse.y - 0.5) * 0.2;
      this.camera.rotation.y = (this.mouse.x - 0.5) * 0.2;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private setupEventListeners() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
  }

  private onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    
    // Update pixel ratio uniform
    const material = this.starsMesh.material as THREE.ShaderMaterial;
    material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  };

  private onMouseMove = (event: MouseEvent) => {
    this.targetMouse.x = event.clientX / window.innerWidth;
    this.targetMouse.y = 1.0 - event.clientY / window.innerHeight;
  };

  private onTouchMove = (event: TouchEvent) => {
    if (event.touches.length > 0) {
      this.targetMouse.x = event.touches[0].clientX / window.innerWidth;
      this.targetMouse.y = 1.0 - event.touches[0].clientY / window.innerHeight;
    }
  };

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('touchmove', this.onTouchMove);

    this.starsMesh.geometry.dispose();
    (this.starsMesh.material as THREE.Material).dispose();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  public isUsingWebGPU(): boolean {
    return this.isWebGPU;
  }

  // Adjust warp speed dynamically
  public setSpeed(speed: number) {
    this.speed = speed;
  }
}

// Auto-init function for use in Layout
export function initBackground(containerId: string = 'webgpu-bg') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container #${containerId} not found`);
    return null;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    container.style.backgroundColor = '#00010D';
    console.log('Background disabled: reduced motion preference');
    return null;
  }

  // Slightly fewer stars on mobile for performance
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const starCount = isMobile ? 800 : 1500;

  const bg = new WebGPUBackground({
    container,
    starCount,
    speed: 0.8,
    starColor: 0x06b6d4,      // Your cyan brand color
    backgroundColor: 0x00010d, // Deep dark blue
    mouseInfluence: true,
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => bg.destroy());

  return bg;
}

