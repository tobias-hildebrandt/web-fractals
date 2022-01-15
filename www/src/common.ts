import * as fractals from "wasm-fractals";

export interface RequestMessage {
    idNumber: number,
    pass: number,
    inputsJSON: string,
    pixelsPerBatch: number,
}

export interface SecondPassRequestMessage extends RequestMessage {
    min: number,
    imageData: Uint8ClampedArray,
    results: Uint32Array,
}

export interface ResponseMessage {
    idNumber: number,
    pass: number,
    imageData: Uint8ClampedArray,
}

export interface FirstPassResponseMessage extends ResponseMessage {
    results: Uint32Array,
    min: number
}

export class Inputs {
    public constructor(
        public start: fractals.Complex,
        public end: fractals.Complex,
        public maxIterations: number,
        public width: number,
        public height: number,
        public keepRatio: boolean) { }
}

export function inputsToArgs(inputs: Inputs): fractals.MandelbrotArgs {
    return new fractals.MandelbrotArgs(
        new fractals.Complex(inputs.start.real, inputs.start.imag),
        new fractals.Complex(inputs.end.real, inputs.end.imag),
        inputs.width,
        inputs.height,
        inputs.maxIterations,
    );
}