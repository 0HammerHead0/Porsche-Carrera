import * as THREE from 'three';
import studio from '@theatre/studio'
import { getProject, types } from '@theatre/core'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';



studio.initialize()
const project = getProject('THREE.js x Theatre.js')
const sheet = project.sheet('Animated scene')


const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5))

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(2, 1, 4);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const spotLight = new THREE.SpotLight(0xffffff, 150);
spotLight.position.set(0, 10, 0);
spotLight.castShadow = true;
const spotLightHelper = new THREE.SpotLightHelper( spotLight );
spotLight.penumbra = 0.9;
spotLight.decay = 2;
spotLight.distance = 100;
spotLight.angle = Math.PI / 12;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);
var bias = -0.0001;
var shadowRes = 2048;
var near = 1;
var far = 100;
var modelBoundingBox;
var margin= 10;
function initLight(light) {
    light.shadow.camera.updateProjectionMatrix();
    light.castShadow = true;
    light.shadow.bias = bias;
    light.shadow.mapSize.width = shadowRes;
    light.shadow.mapSize.height = shadowRes;
    light.shadow.camera.near = near;
    light.shadow.camera.far = far;
    const factor = 0.22;
    light.shadow.radius = 10;
    const directionLightHelper = new THREE.SpotLightHelper(light, 5);
    scene.add(directionLightHelper);
    scene.add(light);
}
initLight(spotLight);


const draLoader = new DRACOLoader();
draLoader.setDecoderPath( 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/' );
const loader = new GLTFLoader();
loader.setDRACOLoader( draLoader );
let model;
let roof;
let modelLoaded = false;
loader.load('models/combined_car.glb', (gltf) => {
    model = gltf.scene;
    modelLoaded = true;
    scene.add(model);
    console.log(model);
    const modelSheet = sheet.object('Model',{
        rotation: types.compound({
            x: types.number(model.rotation.x, { min: -2, max: +2 }),
            y: types.number(model.rotation.y, { min: -2, max: +2 }),
            z: types.number(model.rotation.z, { min: -2, max: +2 }),
        })
    })

    modelSheet.onValuesChange(( values ) => {
        const {x,y,z} = values.rotation
        model.rotation.set(x*Math.PI/100,y*Math.PI/100,z*Math.PI/100)
    })
    model.traverse((child) => {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material.transparent = true;
            child.material.needsUpdate = true;
            if(child.name == 'Roof_Inner_Baked'){
                roof = child;
                spotLight.target.position=new THREE.Vector3(0,0,5);
            }
            if(child.material){
                child.material.flatShading = false;
            }
            if(child.name.startsWith('Cube') || child.name.startsWith('string')){
                child.castShadow = false;
            }
        }
    });
});


const modelLoadedPromise = new Promise((resolve) => {
    const interval = setInterval(() => {
        if (modelLoaded) {
            resolve();
            clearInterval(interval);
        }
    }, 100);
});
modelLoadedPromise.then(() => {
    new RGBELoader()
        .load('hdri/second.hdr', (texture) => {
            model.traverse((child) => {
                if(child.isMesh && !child.name.startsWith('Cube') && !child.name.startsWith('Env') && !child.name.startsWith('string')){
                    child.material.envMap = texture;
                    child.material.envMapIntensity = 1;
                    child.material.needsUpdate = true;
                }
            }
        );
    });
});
const lightSheet = sheet.object('Light', {
    position: types.compound({
        x: types.number(spotLight.position.x, { min: -10, max: +10 }),
        y: types.number(spotLight.position.y, { min: -10, max: +10 }),
        z: types.number(spotLight.position.z, { min: -10, max: +10 }),
    }),

});

lightSheet.onValuesChange((values) => {
    const { x, y, z, penumbra } = values.position;
    spotLight.position.set(x, y, z);
    spotLightHelper.update();
    spotLightHelper.visible = true;
});

window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight);
});


const renderScene = new RenderPass( scene, camera );
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2( window.innerWidth, window.innerHeight ),
    0.075, 0.05, 10
)
// const renderTarget = new THREE.WebGLRenderTarget(
//     800,
//     600,
//     {
//         samples: renderer.getPixelRatio() === 1 ? 4 : 0 ,
//     }
// )


const composer = new EffectComposer( renderer );
// composer.setSize( window.innerWidth, window.innerHeight );
// composer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ));
composer.addPass( renderScene );
composer.addPass( bloomPass );
composer.addPass( new SMAAPass( window.innerWidth, window.innerHeight ) );




renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2;
function animate() {
    composer.render();
    renderer.shadowMap.autoUpdate = true;
    requestAnimationFrame(animate);
}

animate();