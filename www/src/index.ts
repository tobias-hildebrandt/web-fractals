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
    maxIter: number;
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

let currentWorkPixel: Pixel = new Pixel(0, 0);
let canvasClickDown: Pixel;
let canvasClickUp: Pixel;
let clickDown = false;

let oldInputs: Inputs;
let lowestIter: number;
let results: Array<number>;

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

function drawDot(pixel: Pixel, iters: number, shouldDraw: boolean, maxIter: number, lowestIter: number) {
    const index = (canvasWidth * pixel.y + pixel.x) * 4;
    let r, b, g;
    if (iters === null || iters === undefined) {
        r = 255;
        g = 255;
        b = 255;
    } else {
        // const fraction = (iters / inputs.maxIter) * 255;
        const color = Math.floor((Math.log2(iters - lowestIter + 1) / Math.log2(maxIter)) * 255);
        r = color;
        g = 0;
        b = color / 2;

        if (pixel.x == 0 && pixel.y % 500 == 0) {
            console.log(`pixel: ${pixel}, iters:${iters}, maxIter:${maxIter}, lowestIter:${lowestIter}, color: ${color}`);
        }
    }

    imageData.data[index + 0] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = 255;

    if (shouldDraw) {
        context.putImageData(imageData, 0, 0);
    }
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

// returns whether or not there is another pixel left
function doWorkNextPixel(shouldLog: boolean, inputs: Inputs, secondRound: boolean): boolean {
    if (currentWorkPixel === null) {
        console.log("no more pixels");
        return false;
    }

    const complex = pixelToComplex(currentWorkPixel, inputs);
    let result: number;
    if (!secondRound) {
        // first round
        result = fractals.mandlebrot(complex.real, complex.imag, inputs.maxIter);

        results[currentWorkPixel.x + currentWorkPixel.y * inputs.width] = result;

        if (result !== null && result < lowestIter) {
            lowestIter = result;
        }
        drawDot(currentWorkPixel, result, shouldLog, inputs.maxIter, 0);
    } else {
        // second round
        result = results[currentWorkPixel.x + currentWorkPixel.y * inputs.width];
        drawDot(currentWorkPixel, result, shouldLog, inputs.maxIter, lowestIter);
    }


    if (currentWorkPixel.x < inputs.width) {
        currentWorkPixel.x += 1;
    } else {
        if (currentWorkPixel.y < inputs.height) {
            currentWorkPixel.y += 1;
            currentWorkPixel.x = 0;
        } else {
            currentWorkPixel.x = null;
            currentWorkPixel.y = null;
            context.putImageData(imageData, 0, 0);
            return false;
        }
    }

    if (shouldLog) {
        console.log(`mandlebrot at pixel (${currentWorkPixel.x}, ${currentWorkPixel.y}): \
        ${complex.real.toFixed(2)} + ${complex.imag.toFixed(2)}i, ${result !== null ? "not member" : "member"}`);
    }

    return true;
}

function reset() {
    currentWorkPixel = new Pixel(0, 0);

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

function getInputs(): Inputs {
    const startReal = getInputValue("start-real");
    const endReal = getInputValue("end-real");
    const startImag = getInputValue("start-imag");
    const endImag = getInputValue("end-imag");
    const maxIter = getInputValue("max-iter");
    const width = getInputValue("canvas-width");
    const height = getInputValue("canvas-height");
    const keepRatio = (document.getElementById("keep-ratio") as HTMLInputElement).checked;

    if (endReal <= startReal || endImag <= startImag) {
        alert("end value must be greater than start value!");
        return null;
    }

    return {
        start: new Complex(startReal, startImag),
        end: new Complex(endReal, endImag),
        maxIter: maxIter,
        width: width,
        height: height,
        keepRatio: keepRatio,
    };

}

function allPixel() {
    reset();

    const inputs = getInputs();

    if (inputs === null) {
        return;
    }

    oldInputs = inputs;
    lowestIter = inputs.maxIter;

    results = Array.of(inputs.height * inputs.width);

    console.log(`start: ${complexToString(inputs.start)}, end: ${complexToString(inputs.end)}, iters: ${inputs.maxIter}`);
    console.log(`inputs: ${JSON.stringify(inputs)}`);

    startButton.disabled = true;

    setCanvasSizes(inputs.height, inputs.width);

    const totalPixels = inputs.height * inputs.width;
    const pixelsPerBatch = 25000;//Math.max(totalPixels / 1000, 10000);
    const startTime = performance.now();
    function doBatch(secondRound: boolean, pixelsDone: number) {
        for (let i = 0; i < pixelsPerBatch; i++) {
            pixelsDone += 1;
            if (!doWorkNextPixel(false, inputs, secondRound)) {
                break;
            }
        }


        context.putImageData(imageData, 0, 0);
        status.innerText = `${!secondRound ? "first round" : "second round"}: ${(100 * pixelsDone / totalPixels).toFixed(0)}% done`;

        // console.log(`${!secondRound ? "first round" : "second round"}, finished batch ${batchesDone}`);

        if (pixelsDone <= totalPixels) {
            // still have more batches to do
            // allow for other asyncs to trigger
            // then recurse
            setTimeout(() => { doBatch(secondRound, pixelsDone) }, 0);
        } else {
            // done, do not recurse any more
            if (secondRound) {
                const endTime = performance.now();
                const totalSeconds: string = ((endTime - startTime) / 1000).toFixed(2);
                console.log(`done with all pixels, took ~${totalSeconds} seconds`);
                status.innerText = `done :) took ~${totalSeconds} seconds`;
                startButton.disabled = false;
                return false;
            } else {
                // do the second round
                pixelsDone = 0;
                currentWorkPixel = new Pixel(0, 0);
                console.log(`starting second round: lowest iter = ${lowestIter}`);
                setTimeout(() => { doBatch(true, 0) }, 0);
                return false;
            }
        }
    }

    doBatch(false, 0);
}

const TEST_NUM = 200_000_000;

// pointer is slightly faster
function testPtr() {
    const startTime = performance.now();

    const ps = new fractals.PointerStruct(TEST_NUM);
    const arr = new Uint8Array(memory.buffer, ps.u8pointer(), TEST_NUM);
    let total = 0;
    for (const val of arr) {
        total += val;
    }

    const endTime = performance.now();

    console.log(`t${total} pointer took ${endTime - startTime} ms`);
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
    areaRatioElem.innerText = `${areaRatio.toFixed(2)}`;

    const canvasRatio = inputs.width / inputs.height;
    canvasRatioElem.innerText = `${canvasRatio.toFixed(2)}`;
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

startButton.onclick = allPixel;

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
        const current = pixelToComplex(new Pixel(event.offsetX, newY), oldInputs);

        if (down.real == current.real || down.imag == current.imag) {
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