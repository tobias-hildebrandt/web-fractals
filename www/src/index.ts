/* eslint-disable @typescript-eslint/no-non-null-assertion */

import * as fractals from "fractals";
import { Complex, Pixel } from "fractals";
import * as common from "./common";
import { Inputs } from "./common";

// class containing readonly references to important DOM elements
class Elements {
    static readonly fractalCanvas: HTMLCanvasElement = document.getElementById("fractal-canvas") as HTMLCanvasElement;
    static readonly dragCanvas: HTMLCanvasElement = document.getElementById("drag-canvas") as HTMLCanvasElement;

    static readonly status: HTMLElement = document.getElementById("status") as HTMLElement;
    static readonly startButton: HTMLButtonElement = document.getElementById("start") as HTMLButtonElement;

    static readonly canvases: HTMLCanvasElement[] = [this.fractalCanvas, this.dragCanvas];
}

// class to help make interacting with the canvas easier
class CanvasHelper {
    public static getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
        return canvas.getContext("2d")!; // assert this exists
    }

    // maybe invalid reference after setDimensions()???
    public static getImageData(canvas: HTMLCanvasElement): ImageData {
        return this.getContext(canvas).getImageData(0, 0, canvas.width, canvas.height);
    }

    public static draw(canvas: HTMLCanvasElement, imageData: ImageData) {
        this.getContext(canvas).putImageData(imageData, 0, 0);
    }

    public static clear(canvas: HTMLCanvasElement) {
        this.getContext(canvas).clearRect(0, 0, canvas.width, canvas.height);
    }

    public static setDimensions(canvas: HTMLCanvasElement, newWidth: number, newHeight: number) {
        canvas.height = newHeight;
        canvas.width = newWidth;
    }
}

function getCurrentInputs(): common.Inputs | null {
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

    return new common.Inputs(
        new Complex(startReal, startImag),
        new Complex(endReal, endImag),
        maxIterations,
        width,
        height,
        keepRatio,
    );
}

class State {
    public alreadyRenderedOnce = false;
    public constructor(public activeInputs: common.Inputs) { }
    public results: Int32Array | null = null;
    public canvasClickDown: fractals.Pixel | null = null;
    public canvasClickUp: fractals.Pixel | null = null;
    public clickDown = false;
    public workersActive = 0;
    public workersDone = 0;
    public workers: Worker[] = [];
    public currentPass = 0;
    public pixelsPerBatch = 0;
    public lowestIter: number | null = null;
    public startTime: number | null = null;

}

function main() {
    fractals.init();

    // reference should never change
    const state: State = new State(getCurrentInputs()!); // assert that they exist

    setUpUpdateRatioEvents();

    setUpCanvasEvents(state);

    setUpFormEvents(state);

    reset(Elements.canvases);

    setCanvasesSizes(state, Elements.canvases);

    createWorkers(state, 20);

    // TODO: disable button until workers are finished initializing (send ack message and wait for response)

    Elements.startButton.disabled = false; // ready!
}

function setCanvasesSizes(state: State, canvases: HTMLCanvasElement[]) {
    for (const canvas of canvases) {
        CanvasHelper.setDimensions(canvas, state.activeInputs.width, state.activeInputs.height);
    }

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

function reset(canvases: HTMLCanvasElement[]) {
    for (const canvas of canvases) {
        CanvasHelper.clear(canvas);
    }

    Elements.status.innerText = `not started`;
}

function getInputValue(id: string) {
    return (document.getElementById(id) as HTMLInputElement).valueAsNumber;
}

// overriding toString doesn't quite work with wasm_bindgen???
function complexToString(complex: Complex) {
    return `(${complex.real} + ${complex.imag}i)`;
}

function argsToString(args: fractals.MandlebrotArgs) {
    return `start: ${args.start} end: ${args.end} size: ${args.width} x ${args.height}, maxIterations: ${args.maxIterations}`;
}

function pixelToString(pixel: Pixel) {
    return `(${pixel.x, pixel.y})`;
}

function useWasmAllPixels(state: State) {
    reset(Elements.canvases);

    const newInputs = getCurrentInputs();

    if (newInputs === null) {
        return;
    }

    state.activeInputs = newInputs;
    state.results = new Int32Array(newInputs.height * newInputs.width); // located by JS
    state.startTime = performance.now();
    state.currentPass = 1;
    state.lowestIter = null;
    state.workersDone = 0;

    Elements.startButton.disabled = true;

    setCanvasesSizes(state, Elements.canvases);

    const totalPixels = newInputs.height * newInputs.width;
    console.log(`total pixels: ${totalPixels}, imageData size: ~${totalPixels * 4 / 1000000}MB`)
    // each worker should have at least 25000 pixels
    // and there should be at most 50 workers
    state.pixelsPerBatch = Math.max(totalPixels / 20, 25000);
    state.workersActive = totalPixels / state.pixelsPerBatch;

    updateStatusText(state);

    // if we need more workers
    if (state.workers.length < state.workersActive) {
        // init however many new workers we need
        const numNewWorkers = state.workersActive - state.workers.length;
        createWorkers(state, numNewWorkers);
    }

    const inputsJSON = JSON.stringify(newInputs);

    // send message to workers
    for (let id = 0; id < state.workersActive; id++) {
        const worker: Worker = state.workers[id];
        const message: common.RequestMessage = {
            idNumber: id,
            pass: 1,
            inputsJSON: inputsJSON,
            pixelsPerBatch: state.pixelsPerBatch,
        }
        worker.postMessage(message);
        // console.log(`main thread posted message to worker #${id}`);
    }
}

function createWorkers(state: State, numberOfWorkers: number) {
    console.log(`creating ${numberOfWorkers} workers!`);
    for (let i = 0; i <= numberOfWorkers; i++) {
        const worker = new Worker(new URL('./worker.ts', import.meta.url));

        const id = state.workers.length - 1;
        worker.onerror = (message) => {
            console.log(`worker ${id} had an error: ${message}`);
        }

        // when main thread receives a message
        worker.onmessage = (message) => {
            workerOnMessage(message, state);
        };

        // console.log(`main thread sees worker ${id} init done!`);
        state.workers.push(worker);
    }
}

function updateStatusText(state: State) {
    Elements.status.innerText =
        `pass #${state.currentPass}, ${state.workersDone} of ${state.workersActive} ` +
        `workers done (${(100 * state.workersDone / state.workersActive).toFixed(2)}%)`;
}

function workerOnMessage(message: MessageEvent, state: State) {
    const imageData = CanvasHelper.getImageData(Elements.fractalCanvas);

    const response = message.data as unknown as common.ResponseMessage;
    const startingPixel = state.pixelsPerBatch * response.idNumber;

    const workerImageData = response.imageData;

    // only on 1st pass
    if (response.pass == 1) {
        const firstPassResponse = response as common.FirstPassResponseMessage;

        const workerResults: Int32Array = firstPassResponse.results;

        // copy worker results
        for (let j = 0; j < state.pixelsPerBatch; j++) {
            state.results![startingPixel + j] = workerResults[j];
        }

        // handle min
        const min = firstPassResponse.min;
        if (state.lowestIter === null || min < state.lowestIter) {
            state.lowestIter = min;
        }
    }


    // on all passes, copy worker pixels
    for (let j = 0; j < state.pixelsPerBatch * 4; j++) {
        imageData.data[startingPixel * 4 + j] = workerImageData[j];
        // if (j % pixelsPerBatch == 0) {
        //     console.log(`on byte ${j} of worker ${workerId}, value is ${response.imageData[j]}`);
        // }
    }

    // draw the incomplete image
    CanvasHelper.draw(Elements.fractalCanvas, imageData);

    // single-threaded, so don't need to worry about race conditions (i think?)
    state.workersDone += 1;

    updateStatusText(state);

    // if all workers have finished
    if (state.workersDone == state.workersActive) {

        if (response.pass == 1) {
            // finished first pass
            if (!state.lowestIter) {
                console.log(`error starting second pass! state.lowestIter = ${state.lowestIter}`);
                return;
            }

            console.log(`done with first pass, switching to second`);
            console.log(`min = ${state.lowestIter}`);

            // set state before sending out messages
            state.workersDone = 0;
            state.currentPass = 2;
            
            // prepare and send out messages to start second pass
            for (let j = 0; j < state.workersActive; j++) {
                const worker: Worker = state.workers[j];

                // located in JS memory
                const tempImage: Uint8ClampedArray = new Uint8ClampedArray(state.pixelsPerBatch * 4);
                const tempResults: Int32Array = new Int32Array(state.pixelsPerBatch);

                const secondRoundStartingPixel = j * state.pixelsPerBatch;

                // copy results
                for (let k = 0; k < state.pixelsPerBatch; k++) {
                    tempResults[k] = state.results![secondRoundStartingPixel + k];
                }

                // copy pixels
                for (let k = 0; k < state.pixelsPerBatch * 4; k++) {
                    tempImage[k] = imageData.data[secondRoundStartingPixel * 4 + k];
                }

                const message: common.SecondPassRequestMessage = {
                    idNumber: j,
                    pass: 2,
                    inputsJSON: JSON.stringify(state.activeInputs),
                    pixelsPerBatch: state.pixelsPerBatch,
                    min: state.lowestIter,
                    imageData: tempImage,
                    results: tempResults,
                };

                // second pass, pass references to arrays
                worker.postMessage(message, [tempImage.buffer, tempResults.buffer]);
            }

            updateStatusText(state);

        } else if (response.pass === 2) {
            // finished second pass
            const endTime = performance.now();
            // console.log(imageData.data);
            let totalSeconds: string;
            if (state.startTime) {
                totalSeconds = ((endTime - state.startTime) / 1000).toFixed(2);
            } else {
                totalSeconds = "error";
            }
            console.log(`done with all pixels, took ~${totalSeconds} seconds`);
            Elements.status.innerText = `done with WASM :) took ~${totalSeconds} seconds`;

            Elements.startButton.disabled = false;
            CanvasHelper.draw(Elements.fractalCanvas, imageData);

            state.results = null;
            state.startTime = null;
            state.currentPass = 0;
            state.lowestIter = null;
            state.workersDone = 0;
            state.alreadyRenderedOnce = true;

            // don't terminate workers, since they take a while to spin up
        } else {
            console.log(`main thread received message with unrecognized pass value of ${response.pass}`);
        }
    }
}

function updateRatios() {

    const currentInputs = getCurrentInputs();

    if (!currentInputs) {
        console.log("unable to get current inputs!")
        return;
    }

    const areaRatioElem = document.getElementById("area-ratio")!;
    const canvasRatioElem = document.getElementById("canvas-ratio")!;

    // x / y
    const areaRatio = (currentInputs.end.real - currentInputs.start.real) / (currentInputs.end.imag - currentInputs.start.imag);
    if (!Number.isFinite(areaRatio)) {
        areaRatioElem.innerText = "invalid";
    }
    areaRatioElem.innerText = `${areaRatio.toFixed(2)}`;

    const canvasRatio = currentInputs.width / currentInputs.height;
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
        "canvas-width",
        "canvas-height",
    ];

    for (const inputElemName of inputElemNames) {
        // update the ratios no matter the event
        document.getElementById(inputElemName)!.oninput = updateRatios;
    }
}

function setUpFormEvents(state: State) {
    Elements.startButton.onclick = () => {
        useWasmAllPixels(state);
    };

    // click the button whenever enter is pressed inside the form
    document.getElementById("inputs")!.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            Elements.startButton.click();
        }
    });

    document.getElementById("save")!.onclick = function () {
        const image = Elements.fractalCanvas.toDataURL();

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
    };
}

function setUpCanvasEvents(state: State) {
    Elements.fractalCanvas.addEventListener("mousedown", function (event) {
        if (event.button === 0) { // left click
            Elements.fractalCanvas.style.zIndex = "0"; // move fractal canvas behind drag canvas
            Elements.dragCanvas.dispatchEvent(new MouseEvent("mousedown", event)); // pass event to drag canvas
        }
    });

    Elements.fractalCanvas.addEventListener("mouseup", function (event) {
        if (event.button === 0) { // left click
            Elements.fractalCanvas.style.zIndex = "2"; // move fractal canvas behind drag canvas
        }
    });

    // click on canvas
    Elements.dragCanvas.addEventListener("mousedown", function (event) {
        if (!state.clickDown && event.button === 0) { // left click
            CanvasHelper.clear(Elements.dragCanvas);
            state.clickDown = true;
            const clickDownPixel = new Pixel(event.x, event.y);
            const boundingBox = Elements.dragCanvas.getBoundingClientRect();
            // console.log(`down: ${clickDownPixel}, bounding left: ${boundingBox.left}, bounding top: ${boundingBox.top}`);
            state.canvasClickDown = new Pixel(Math.floor(clickDownPixel.x - boundingBox.left), Math.floor(clickDownPixel.y - boundingBox.top));
            console.log(`canvasStart = ${state.canvasClickDown}`);
            
        }
    });

    Elements.dragCanvas.addEventListener("mouseup", function (event) {
        if (state.clickDown && event.button === 0) { // left click

            state.clickDown = false;
            const clickUpPixel = new Pixel(event.x, event.y);
            const boundingBox = Elements.dragCanvas.getBoundingClientRect();
            // console.log(`up: ${clickUpPixel}`);
            // console.log(`canvas offsetlet: ${canvas.offsetLeft}`);
            // let canvasStart = new Pixel(clickDownPixel.x - dragCanvas.offsetLeft, clickDownPixel.y - dragCanvas.offsetTop);
            state.canvasClickUp = new Pixel(Math.floor(clickUpPixel.x - boundingBox.left), Math.floor(clickUpPixel.y - boundingBox.top));

            console.log(`canvasEnd = ${state.canvasClickUp}`);

            Elements.fractalCanvas.style.zIndex = "2"; // move fractal canvas back infront of drag canvas
        }
    });

    Elements.dragCanvas.addEventListener("mousemove", function (event) {
        if (state.clickDown && state.canvasClickDown) {
            const newInputs = getCurrentInputs();

            if (!newInputs) {
                console.log("unable to get current inputs!");
                return;
            }

            CanvasHelper.clear(Elements.dragCanvas);

            const context = CanvasHelper.getContext(Elements.dragCanvas);
            context.lineWidth = 2;
            context.strokeStyle = "red";

            let newY = event.offsetY;
            let newX = event.offsetX;

            const yDist = event.offsetY - state.canvasClickDown.y;
            const xDist = event.offsetX - state.canvasClickDown.x;

            if (newInputs.keepRatio) {
                if (Math.abs(yDist) > Math.abs(xDist)) {
                    newX = state.canvasClickDown.x + yDist * (newInputs.width / newInputs.height);
                } else {
                    newY = state.canvasClickDown.y + xDist * (newInputs.height / newInputs.width);
                }
            } else {
                const newHeight = Math.abs(Math.floor(newInputs.width * ((newY - state.canvasClickDown.y) / (newX - state.canvasClickDown.x))));

                (document.getElementById("canvas-height") as HTMLInputElement).valueAsNumber = newHeight;
            }


            // TODO: fix or scrap this
            const width = newX - state.canvasClickDown.x, height = newY - state.canvasClickDown.y;

            if (newY < state.canvasClickDown.y) {
                // above start
                if (newX < state.canvasClickDown.x) {
                    // upper left of start
                    // height = -height;
                } else {
                    // upper right of start
                    // height = -height;
                }
            } else {
                if (newX < state.canvasClickDown.x) {
                    // lower left of start
                    // height = -height;
                } else {
                    // lower right of start
                    // width = -width;
                }
            }


            context.strokeRect(state.canvasClickDown.x, state.canvasClickDown.y, width, height);

            if (!state.alreadyRenderedOnce) {
                return;
            }

            const down = pixelToComplex(new Pixel(state.canvasClickDown.x, state.canvasClickDown.y), state.activeInputs);
            const current = pixelToComplex(new Pixel(newX, newY), state.activeInputs);

            if (!down || !current || down.real === current.real || down.imag === current.imag) {
                console.log("not adjusting, width/length of 0");
                return;
            }

            (document.getElementById("start-real") as HTMLInputElement).valueAsNumber = Math.min(down.real, current.real);
            (document.getElementById("start-imag") as HTMLInputElement).valueAsNumber = Math.min(down.imag, current.imag);

            (document.getElementById("end-real") as HTMLInputElement).valueAsNumber = Math.max(down.real, current.real);
            (document.getElementById("end-imag") as HTMLInputElement).valueAsNumber = Math.max(down.imag, current.imag);


        }
    });
}

main();