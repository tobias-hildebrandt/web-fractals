import { Complex } from "fractals";
import * as fractals from "fractals";
import { memory } from "fractals/fractals_bg.wasm";
import "regenerator-runtime"; // needed by babel for async

fractals.init();

class Pixel {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    toString() {
        return `(${this.x}, ${this.y})`;
    }
}

interface Inputs {
    start: Complex;
    end: Complex;
    maxIterations: number;
    width: number;
    height: number;
    keepRatio: boolean;
}

const fractalCanvas: HTMLCanvasElement = document.getElementById("fractal-canvas") as HTMLCanvasElement;
const dragCanvas: HTMLCanvasElement = document.getElementById("drag-canvas") as HTMLCanvasElement;

let canvasHeight: number;
let canvasWidth: number;

const status: HTMLElement = document.getElementById("status") as HTMLElement;
const startButton: HTMLButtonElement = document.getElementById("start") as HTMLButtonElement;

let context: CanvasRenderingContext2D;
let imageData: ImageData;

let canvasClickDown: Pixel;
let canvasClickUp: Pixel;
let clickDown = false;

let oldInputs: Inputs;
let results: Int32Array;

function setCanvasSizes(height: number, width: number) {
    canvasHeight = height;
    canvasWidth = width;

    fractalCanvas.height = height;
    fractalCanvas.width = width;

    dragCanvas.height = height;
    dragCanvas.width = width;

    context = fractalCanvas.getContext("2d");
    imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);

    updateRatios();
}

function complexToPixel(complex: Complex, inputs: Inputs): Pixel {
    const pixelX = Math.floor(((complex.real - inputs.start.real) / (inputs.end.real - inputs.start.real)) * (inputs.width));

    // TODO: maybe flip imag start and end because canvas y coords grows down
    const pixelY = Math.floor(((complex.imag - inputs.start.imag) / (inputs.end.imag - inputs.start.imag)) * (inputs.height));
    return new Pixel(pixelX, pixelY);
}

function pixelToComplex(pixel: Pixel, inputs: Inputs): Complex {
    const real = ((pixel.x / inputs.width) * (inputs.end.real - inputs.start.real)) + inputs.start.real;

    // flip imag start and end because canvas y coords grows down
    const imag = ((pixel.y / inputs.height) * (inputs.start.imag - inputs.end.imag)) + inputs.end.imag;
    return new Complex(real, imag);
}

function reset() {
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    status.innerText = `not started`;
}

function getInputValue(id: string) {
    return (document.getElementById(id) as HTMLInputElement).valueAsNumber;
}

// overriding toString doesn't quite work with wasm_bindgen???
function complexToString(complex: Complex) {
    return `(${complex.real} + ${complex.imag}i)`;
}

function argsToString(args: fractals.MandlebrotArgs) {
    return `start: ${args.start} end: ${args.end} size: ${args.width} x ${args.height}, maxIterations: ${args.maxIterations}, keepRatio: ${args.keepRatio}`;
}

function getInputs(): fractals.MandlebrotArgs {
    const startReal = getInputValue("start-real");
    const endReal = getInputValue("end-real");
    const startImag = getInputValue("start-imag");
    const endImag = getInputValue("end-imag");
    const maxIterations = getInputValue("max-iter");
    const width = getInputValue("canvas-width");
    const height = getInputValue("canvas-height");
    const keepRatio = (document.getElementById("keep-ratio") as HTMLInputElement).checked;

    if (endReal <= startReal || endImag <= startImag) {
        alert("end value must be greater than start value!");
        return null;
    }

    return new fractals.MandlebrotArgs(
        new Complex(startReal, startImag),
        new Complex(endReal, endImag),
        width,
        height,
        maxIterations,
        keepRatio,
    );

}

async function useWasmAllPixels() {
    reset();

    const inputs = getInputs();

    if (inputs === null) {
        return;
    }

    oldInputs = inputs;

    startButton.disabled = true;
    setCanvasSizes(inputs.height, inputs.width);

    const startTime = performance.now();

    const totalPixels = inputs.height * inputs.width;
    // const pixelsPerBatch = 25000;
    // const NUM_WORKERS = 
    const pixelsPerBatch = Math.max(totalPixels / 10, 25000);
    const NUM_WORKERS = totalPixels / pixelsPerBatch;
    // const NUM_WORKERS = 5;
    results = new Int32Array(inputs.height * inputs.width);
    let lowestIter: number;
    let workersDone = 0;
    const workers: Worker[] = [];

    let currentPass = 1;

    status.innerText = `pass #${currentPass}, ${workersDone} of ${NUM_WORKERS} workers done (${(100 * workersDone / NUM_WORKERS).toFixed(2)}%)`;

    // TODO: cleanup this mess 
    for (let id = 0; id < NUM_WORKERS; id++) {
        const worker = new Worker(new URL('./worker.ts', import.meta.url));

        worker.onerror = (message) => {
            console.log(`worker ${id} had an error: ${message}`);
        }

        // when main thread receives a message
        worker.onmessage = (message) => {
            const workerId = message.data[0];
            const startingPixel = pixelsPerBatch * workerId;
            const pass = message.data[1];
            const workerImage: Uint8ClampedArray = message.data[2];

            // only on 1st pass
            if (pass == 1) {
                const workerResults: Int32Array = message.data[3];

                // copy worker results
                for (let j = 0; j < pixelsPerBatch; j++) {
                    results[startingPixel + j] = workerResults[j];
                }

                // handle min
                const min = message.data[4];
                if (lowestIter === null || lowestIter === undefined || min < lowestIter) {
                    lowestIter = min;
                }
            }

            // on all passes
            // copy worker pixels
            for (let j = 0; j < pixelsPerBatch * 4; j++) {
                imageData.data[startingPixel * 4 + j] = workerImage[j];
                // if (j % pixelsPerBatch == 0) {
                //     console.log(`on byte ${j} of worker ${workerId}, value is ${workerImage[j]}`);
                // }
            }

            // draw the incomplete image
            context.putImageData(imageData, 0, 0);

            workersDone += 1;

            status.innerText = `pass #${currentPass}, ${workersDone} of ${NUM_WORKERS} workers done (${(100 * workersDone / NUM_WORKERS).toFixed(2)}%)`;

            if (workersDone == NUM_WORKERS) {
                if (pass === 2) {
                    // finished second pass
                    const endTime = performance.now();
                    // console.log(imageData.data);
                    const totalSeconds: string = ((endTime - startTime) / 1000).toFixed(2);
                    console.log(`done with all pixels, took ~${totalSeconds} seconds`);
                    console.log(`min = ${lowestIter}`);
                    status.innerText = `done with WASM :) took ~${totalSeconds} seconds`;
                    startButton.disabled = false;
                    context.putImageData(imageData, 0, 0);

                    for (let j = 0; j < NUM_WORKERS; j++) {
                        const worker: Worker = workers[j];
                        worker.terminate();
                    }
                    return;
                } else {
                    // finished first pass
                    console.log(`done with first pass, switching to second`);
                    console.log(`min = ${lowestIter}`);
                    for (let j = 0; j < NUM_WORKERS; j++) {
                        const worker: Worker = workers[j];
                        const tempImage: Uint8ClampedArray = new Uint8ClampedArray(pixelsPerBatch * 4);
                        const tempResults: Int32Array = new Int32Array(pixelsPerBatch);
                        const secondRoundStartingPixel = j * pixelsPerBatch;

                        // copy results
                        for (let k = 0; k < pixelsPerBatch; k++) {
                            tempResults[k] = results[secondRoundStartingPixel + k];
                        }

                        // copy pixels
                        for (let k = 0; k < pixelsPerBatch * 4; k++) {
                            tempImage[k] = imageData.data[secondRoundStartingPixel * 4 + k];
                        }

                        worker.postMessage([j, 2, JSON.stringify(inputs), pixelsPerBatch, lowestIter, tempImage, tempResults]); // second pass
                    }
                    workersDone = 0;
                    currentPass = 2;

                    status.innerText = `pass #${currentPass}, ${workersDone} of ${NUM_WORKERS} workers done (${(100 * workersDone / NUM_WORKERS).toFixed(2)}%)`;
                }
            }

        };

        // console.log(`main thread sees worker ${id} init done!`);
        workers.push(worker);
    }
    for (let id = 0; id < NUM_WORKERS; id++) {
        const worker: Worker = workers[id];

        worker.postMessage([id, 1, JSON.stringify(inputs), pixelsPerBatch]);
        // console.log(`main thread posted message to worker #${id}`);
    }
}

function clearDragCanvas() {
    dragCanvas.getContext("2d").clearRect(0, 0, canvasWidth, canvasHeight);
}

function updateRatios() {

    const inputs = getInputs();
    const areaRatioElem = document.getElementById("area-ratio");
    const canvasRatioElem = document.getElementById("canvas-ratio");

    // x / y
    const areaRatio = (inputs.end.real - inputs.start.real) / (inputs.end.imag - inputs.start.imag);
    if (!Number.isFinite(areaRatio)) {
        areaRatioElem.innerText = "invalid";
    }
    areaRatioElem.innerText = `${areaRatio.toFixed(2)}`;

    const canvasRatio = inputs.width / inputs.height;
    if (!Number.isFinite(canvasRatio)) {
        canvasRatioElem.innerText = "invalid";
    } else {
        canvasRatioElem.innerText = `${canvasRatio.toFixed(2)}`;
    }

}

function setUpUpdateRatioEvents() {
    const inputElemNames = [
        "start-real",
        "end-real",
        "start-imag",
        "end-imag",
        "canvas-height",
        "canvas-width"
    ];

    for (const inputElemName of inputElemNames) {
        document.getElementById(inputElemName).oninput = updateRatios;
    }
}

function main() {
    setCanvasSizes(500, 500);

    reset();
}

function testWorkers() {
    const worker = new Worker(new URL('./testworker.ts', import.meta.url));
    worker.postMessage("hello");

    worker.onmessage = (message: MessageEvent<string>) => {
        console.log(`main sees message: ${message.data}`);
    }
}

startButton.onclick = () => {
    testWorkers();
    useWasmAllPixels();
}

// click the button whenever enter is pressed inside the form
document.getElementById("inputs").addEventListener("keyup", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        startButton.click();
    }
});

document.getElementById("save").onclick = function () {
    const image = fractalCanvas.toDataURL();

    window.open(image, "_blank");

    // const date = new Date();
    // date.setMilliseconds(0);

    // let timeStr = date.toISOString();
    // timeStr = timeStr.slice(0, -5);
    // timeStr = timeStr.replace(/:/g, "-");

    // console.log(`timeStr: ${timeStr}`);

    // const tempAnchor = document.createElement('a');
    // tempAnchor.download = `mandlebrot-${timeStr}.png`;
    // tempAnchor.href = image;

    // // temporarily add it, trigger it, then delete it
    // document.body.appendChild(tempAnchor);
    // tempAnchor.click();
    // document.body.removeChild(tempAnchor);
}

// click on canvas
dragCanvas.addEventListener("mousedown", function (event) {
    // only care about left click
    if (event.button !== 0) {
        return;
    }

    if (!clickDown) {
        clickDown = true;
        const clickDownPixel = new Pixel(event.x, event.y);
        const boundingBox = dragCanvas.getBoundingClientRect();
        // console.log(`down: ${clickDownPixel}, bounding left: ${boundingBox.left}, bounding top: ${boundingBox.top}`);
        canvasClickDown = new Pixel(Math.floor(clickDownPixel.x - boundingBox.left), Math.floor(clickDownPixel.y - boundingBox.top));
        console.log(`canvasStart = ${canvasClickDown}`);
    }
});

dragCanvas.addEventListener("mouseup", function (event) {
    if (clickDown) {
        clickDown = false;
        const clickUpPixel = new Pixel(event.x, event.y);
        const boundingBox = dragCanvas.getBoundingClientRect();
        // console.log(`up: ${clickUpPixel}`);
        // console.log(`canvas offsetlet: ${canvas.offsetLeft}`);
        // let canvasStart = new Pixel(clickDownPixel.x - dragCanvas.offsetLeft, clickDownPixel.y - dragCanvas.offsetTop);
        canvasClickUp = new Pixel(Math.floor(clickUpPixel.x - boundingBox.left), Math.floor(clickUpPixel.y - boundingBox.top));

        console.log(`canvasEnd = ${canvasClickUp}`);
    }
});

dragCanvas.addEventListener("mousemove", function (event) {
    if (clickDown) {
        const inputs = getInputs();

        clearDragCanvas();

        const context = dragCanvas.getContext("2d");
        context.lineWidth = 2;
        context.strokeStyle = "red";

        let newY = event.offsetY;
        let newX = event.offsetX;

        const yDist = event.offsetY - canvasClickDown.y;
        const xDist = event.offsetX - canvasClickDown.x;

        if (inputs.keepRatio) {
            if (Math.abs(yDist) > Math.abs(xDist)) {
                newX = canvasClickDown.x + yDist * (inputs.width / inputs.height);
            } else {
                newY = canvasClickDown.y + xDist * (inputs.height / inputs.width);
            }
        } else {
            const newHeight = Math.abs(Math.floor(inputs.width * ((newY - canvasClickDown.y) / (newX - canvasClickDown.x))));

            (document.getElementById("canvas-height") as HTMLInputElement).valueAsNumber = newHeight;
        }


        // TODO: fix or scrap this
        const width = newX - canvasClickDown.x, height = newY - canvasClickDown.y;

        if (newY < canvasClickDown.y) {
            // above start
            if (newX < canvasClickDown.x) {
                // upper left of start
                // height = -height;
            } else {
                // upper right of start
                // height = -height;
            }
        } else {
            if (newX < canvasClickDown.x) {
                // lower left of start
                // height = -height;
            } else {
                // lower right of start
                // width = -width;
            }
        }


        context.strokeRect(canvasClickDown.x, canvasClickDown.y, width, height);

        if (oldInputs === undefined || oldInputs === null) {
            return;
        }

        const down = pixelToComplex(new Pixel(canvasClickDown.x, canvasClickDown.y), oldInputs);
        const current = pixelToComplex(new Pixel(newX, newY), oldInputs);

        if (down.real == current.real || down.imag == current.imag) {
            console.log("not adjusting, width/length of 0");
            return;
        }

        (document.getElementById("start-real") as HTMLInputElement).valueAsNumber = Math.min(down.real, current.real);
        (document.getElementById("start-imag") as HTMLInputElement).valueAsNumber = Math.min(down.imag, current.imag);

        (document.getElementById("end-real") as HTMLInputElement).valueAsNumber = Math.max(down.real, current.real);
        (document.getElementById("end-imag") as HTMLInputElement).valueAsNumber = Math.max(down.imag, current.imag);


    }
});

setUpUpdateRatioEvents();

main();