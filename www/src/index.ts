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
}

let inputs: Inputs;

const CANVAS_SIZE = 1000;

const BATCHES = 100;

const canvas: HTMLCanvasElement = document.getElementById("fractal-canvas") as HTMLCanvasElement;
canvas.height = CANVAS_SIZE;
canvas.width = CANVAS_SIZE;

const status: HTMLElement = document.getElementById("status") as HTMLElement;
const startButton: HTMLButtonElement = document.getElementById("start") as HTMLButtonElement;

let context: CanvasRenderingContext2D;
let imageData: ImageData;

let currentPixel: Pixel = new Pixel(0, 0);

function drawDot(pixel: Pixel, iters: number, log: boolean) {
    const index = (CANVAS_SIZE * pixel.y + pixel.x) * 4;
    let r, b, g;
    if (iters === null || iters === undefined) {
        r = 255;
        g = 255;
        b = 255;
    } else {
        // const fraction = (iters / inputs.maxIter) * 255;
        const logr = (Math.log2(iters) / Math.log2(inputs.maxIter)) * 255;
        r = logr;
        g = 0;
        b = logr;
    }

    imageData.data[index + 0] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = 255;

    if (log) {
        context.putImageData(imageData, 0, 0);
    }
}

function complexToPixel(complex: Complex): Pixel {
    const pixelX = Math.floor(((complex.real - inputs.start.real) / (inputs.end.real - inputs.start.real)) * (CANVAS_SIZE));
    const pixelY = Math.floor(((complex.imag - inputs.start.imag) / (inputs.end.imag - inputs.start.imag)) * (CANVAS_SIZE));
    return new Pixel(pixelX, pixelY);
}

function pixelToComplex(pixel: Pixel): Complex {
    const real = ((pixel.x / CANVAS_SIZE) * (inputs.end.real - inputs.start.real)) + inputs.start.real;
    const imag = ((pixel.y / CANVAS_SIZE) * (inputs.end.imag - inputs.start.imag)) + inputs.start.imag;
    return new Complex(real, imag);
}

// returns whether or not there is another pixel left
function nextPixel(log: boolean): boolean {
    if (currentPixel === null) {
        console.log("no more pixels");
        return false;
    }

    const complex = pixelToComplex(currentPixel);
    const result = fractals.mandlebrot(complex.real, complex.imag, inputs.maxIter);
    drawDot(currentPixel, result, log);
    
    if (currentPixel.x < CANVAS_SIZE) {
        currentPixel.x += 1;
    } else {
        if (currentPixel.y < CANVAS_SIZE) {
            currentPixel.y += 1;
            currentPixel.x = 0;
        } else {
            currentPixel.x = null;
            currentPixel.y = null;
            context.putImageData(imageData, 0, 0);
            return false;
        }
    }

    if (log) {
        console.log(`mandlebrot at pixel (${currentPixel.x}, ${currentPixel.y}): \
        ${complex.real.toFixed(2)} + ${complex.imag.toFixed(2)}i, ${result !== null ? "not member" : "member"}`);
    }

    return true;
}

function reset() {
    currentPixel = new Pixel(0, 0);

    for (let i = 0; i < imageData.data.length; i++) {
        imageData.data[i] = 0;
    }
    context.putImageData(imageData, 0, 0);

    status.innerText = `not started`;
}

function getInputValue(id: string) {
    return (document.getElementById(id) as HTMLInputElement).valueAsNumber;
}

function complexToString(complex: Complex) {
    return `(${complex.real} + ${complex.imag}i)`;
}

function getInput() {
    const startReal = getInputValue("start-real");
    const endReal = getInputValue("end-real");
    const startImag = getInputValue("start-imag");
    const endImag = getInputValue("end-imag");
    const maxIter = getInputValue("max-iter");

    if (endReal <= startReal || endImag <= startImag) {
        alert("end value must be greater than start value!");
        return null;
    }

    return {
        start: new Complex(startReal, startImag),
        end: new Complex(endReal, endImag),
        maxIter: maxIter,
    }

}

function allPixel() {
    reset();

    inputs = getInput();

    if (inputs === null) {
        return;
    }

    console.log(`start: ${complexToString(inputs.start)}, end: ${complexToString(inputs.end)}, iters: ${inputs.maxIter}`);

    startButton.disabled = true;

    const pixelsPerBatch = CANVAS_SIZE * CANVAS_SIZE / BATCHES;
    let batchesDone = 0;
    const startTime = performance.now();
    function doBatch() {
        for (let i = 0; i < pixelsPerBatch; i++) {
            if(!nextPixel(false)) {
                break;
            }
        }
        batchesDone += 1;
        if (batchesDone <= BATCHES) {
            context.putImageData(imageData, 0, 0);
            status.innerText = `${(100 * batchesDone / BATCHES).toFixed(0)}% done`;
            // console.log(`done with ${batchesDone}/${BATCHES}`);
            
            if (batchesDone == BATCHES) {
                const endTime = performance.now();
                const totalSeconds: string = ((endTime-startTime) / 1000).toFixed(2);
                console.log(`done with all pixels, took ~${totalSeconds} seconds`);
                status.innerText = `done :) took ~${totalSeconds} seconds`;
                startButton.disabled = false;
            } else {
                // allow for other asyncs to trigger
                setTimeout(doBatch, 0);
            }
        }
    }

    doBatch();
}

const TEST_NUM = 200_000_000;

function testU8Array() {
    const startTime = performance.now();

    const arr = fractals.uint8array(TEST_NUM);
    let total = 0;
    for (const val of arr) {
        total += val;
    }

    const endTime = performance.now();
    console.log(`t${total} uint8array took ${endTime - startTime} ms`);
}

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

function main() {
    console.log(`canvas size: ${CANVAS_SIZE}px x ${CANVAS_SIZE}px`);

    context = canvas.getContext("2d");
    imageData = context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    reset();
}

startButton.onclick = allPixel;

main();

// (() => {
//     testU8Array();
//     testPtr();
// })();