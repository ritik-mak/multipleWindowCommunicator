import WindowManager from './WindowManager.js'

const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let spheres = [];
let sceneOffsetTarget = { x: 0, y: 0 };
let sceneOffset = { x: 0, y: 0 };
let smallestSphere;

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime() {
    return (new Date().getTime() - today) / 1000.0;
}


if (new URLSearchParams(window.location.search).get("clear")) {
    localStorage.clear();
}
else {
    // this code is essential to circumvent that some browsers preload the content of some pages before you actually hit the url
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState != 'hidden' && !initialized) {
            init();
        }
    });

    window.onload = () => {
        if (document.visibilityState != 'hidden') {
            
            init();
        }
    };

    function init() {
        initialized = true;

        // add a short timeout because window.offsetX reports wrong values before a short period 
        setTimeout(() => {
            setupScene();
            setupWindowManager();
            resize();
            updateWindowShape(false);
            render();
            window.addEventListener('resize', resize);
        }, 500)
    }

    function setupScene() {
        camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);

        camera.position.z = 2.5;
        near = camera.position.z - .5;
        far = camera.position.z + 0.5;

        scene = new t.Scene();
        scene.background = new t.Color(0.0);
        scene.add(camera);

        renderer = new t.WebGLRenderer({ antialias: true, depthBuffer: true });
        renderer.setPixelRatio(pixR);

        world = new t.Object3D();
        scene.add(world);

        renderer.domElement.setAttribute("id", "scene");
        document.body.appendChild(renderer.domElement);
    }

    function setupWindowManager() {
        windowManager = new WindowManager();
        windowManager.setWinShapeChangeCallback(updateWindowShape);
        windowManager.setWinChangeCallback(windowsUpdated);

        // here you can add your custom metadata to each windows instance
        let metaData = { foo: "bar" };

        // this will init the windowmanager and add this window to the centralised pool of windows
        windowManager.init(metaData);

        // call update windows initially (it will later be called by the win change callback)
        windowsUpdated();
    }

    function windowsUpdated() {
        updateNumberOfSpheres();
    }

    function updateNumberOfSpheres() {
        let wins = windowManager.getWindows();

        // remove all spheres
        spheres.forEach((s) => {
            world.remove(s);
        });

        // remove smallest sphere if it exists
        if (smallestSphere) {
            world.remove(smallestSphere);
        }

        spheres = [];

        // add new spheres based on the current window setup
        for (let i = 0; i < wins.length; i++) {
            let win = wins[i];

            let c = new t.Color();
            c.setHSL(i * .1, 1.0, .5);

            let radius = 50 + i * 25;

            let sphere = new t.Mesh(new t.SphereGeometry(radius, 10, 10), new t.MeshBasicMaterial({ color: c, wireframe: true }));
            sphere.position.x = win.shape.x + (win.shape.w * .5);
            sphere.position.y = win.shape.y + (win.shape.h * .5);

            world.add(sphere);
            spheres.push(sphere);
        }

        // Find the smallest sphere
        smallestSphere = spheres.reduce((prev, curr) => {
            return prev.geometry.parameters.radius < curr.geometry.parameters.radius ? prev : curr;
        });

        // Create connecting lines from each sphere to the center of the smallest sphere
        let smallestCenter = smallestSphere.position.clone();
        spheres.forEach((sphere) => {
            if (sphere !== smallestSphere) {
                let lineGeometry = new t.Geometry();
                lineGeometry.vertices.push(
                    sphere.position.clone(), // start from the sphere's center
                    smallestCenter // end at the center of the smallest sphere
                );
                let line = new t.Line(lineGeometry, new t.LineBasicMaterial({ color: 0xffffff }));
                world.add(line);
            }
        });
    }

    function updateWindowShape(easing = true) {
        // storing the actual offset in a proxy that we update against in the render function
        sceneOffsetTarget = { x: -window.screenX, y: -window.screenY };
        if (!easing) sceneOffset = sceneOffsetTarget;
    }


    function render() {
        let t = getTime();

        windowManager.update();


        // calculate the new position based on the delta between current offset and new offset times a falloff value (to create the nice smoothing effect)
        let falloff = .05;
        sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
        sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

        // set the world position to the offset
        world.position.x = sceneOffset.x;
        world.position.y = sceneOffset.y;

        let wins = windowManager.getWindows();


        // loop through all our spheres and update their positions based on current window positions
        for (let i = 0; i < spheres.length; i++) {
            let sphere = spheres[i];
            let win = wins[i];
            let _t = t;

            let posTarget = { x: win.shape.x + (win.shape.w * .5), y: win.shape.y + (win.shape.h * .5) }

            sphere.position.x = sphere.position.x + (posTarget.x - sphere.position.x) * falloff;
            sphere.position.y = sphere.position.y + (posTarget.y - sphere.position.y) * falloff;
            sphere.rotation.x = _t * .5;
            sphere.rotation.y = _t * .3;
        };

        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }


    // resize the renderer to fit the window size
    function resize() {
        let width = window.innerWidth;
        let height = window.innerHeight

        camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}
